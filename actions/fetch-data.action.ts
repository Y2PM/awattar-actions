import { eventsClient } from '@dynatrace-sdk/client-classic-environment-v2';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { appSettingsObjectsClient } from '@dynatrace-sdk/client-app-settings-v2';
import { httpClient } from '@dynatrace-sdk/http-client';

type ComparisonOperator = 'GREATER_THAN' | 'LESS_THAN';

interface DqlAlertInput {
  query?: string;
  comparison?: ComparisonOperator;
  threshold?: number | null;
  problemTitle?: string;
  createProblem?: boolean;
  sendRequest?: boolean;
  connectionId?: string;
  requestBodyTemplate?: string;
}

interface DqlAlertResult {
  recordsCount: number;
  triggered: boolean;
  problemEvent?: {
    correlationId?: string;
  };
}

const DEFAULT_PROBLEM_TITLE = 'DQL alert triggered';
const POLL_DELAY_MS = 1000;
const MAX_POLL_ATTEMPTS = 5;

interface ConnectionDetails {
  url: string;
  token: string;
}

type TemplateContext = {
  comparison: ComparisonOperator;
  query: string;
  threshold: number;
  records: unknown[];
  metadata: Record<string, unknown>;
  types: unknown[];
  recordsCount: number;
  triggered: boolean;
};

type TemplateFilter = (value: unknown, ...args: unknown[]) => unknown;

const templateFilters: Record<string, TemplateFilter> = {
  length: (value: unknown) => {
    if (Array.isArray(value) || typeof value === 'string') {
      return value.length;
    }

    if (value && typeof value === 'object' && 'length' in value && typeof (value as { length?: unknown }).length === 'number') {
      return (value as { length: number }).length;
    }

    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>).length;
    }

    return 0;
  },
  default: (value: unknown, defaultValue: unknown) => {
    if (value === undefined || value === null || value === '' || value === false) {
      return defaultValue;
    }

    return value;
  },
  json: (value: unknown) => JSON.stringify(value),
};

const transformTemplateExpression = (expression: string): string => {
  const segments = expression
    .split('|')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    throw new Error('Empty expression in template.');
  }

  let current = segments[0];

  for (let index = 1; index < segments.length; index += 1) {
    const segment = segments[index];
    const match = segment.match(/^([a-zA-Z_][\w]*)(?:\((.*)\))?$/);

    if (!match) {
      throw new Error(`Unsupported filter syntax: ${segment}`);
    }

    const [, filterName, args = ''] = match;
    const argList = args
      .split(',')
      .map((arg) => arg.trim())
      .filter((arg) => arg.length > 0)
      .map((arg) => transformTemplateExpression(arg));

    const serializedArgs = argList.length > 0 ? `, ${argList.join(', ')}` : '';
    current = `__applyFilter("${filterName}", ${current}${serializedArgs})`;
  }

  return current;
};

const evaluateTemplateExpression = (expression: string, context: TemplateContext) => {
  const transformed = transformTemplateExpression(expression);

  const evaluator = new Function(
    'context',
    '__applyFilter',
    `with (context) {
      return (${transformed});
    }`,
  );

  const applyFilter = (filterName: string, value: unknown, ...args: unknown[]) => {
    const filter = templateFilters[filterName];

    if (!filter) {
      throw new Error(`Unknown filter: ${filterName}`);
    }

    return filter(value, ...args);
  };

  return evaluator(context, applyFilter);
};

const wait = async (ms: number) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const ensureThreshold = (value: number | null | undefined) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  throw new Error('A numeric threshold is required to evaluate the DQL result.');
};

const getComparison = (value: ComparisonOperator | undefined): ComparisonOperator => value ?? 'GREATER_THAN';

const fetchQueryResult = async (query: string) => {
  const execution = await queryExecutionClient.queryExecute({
    body: {
      query,
    },
  });

  if (execution.state === 'SUCCEEDED' && execution.result) {
    return execution.result;
  }

  if (!execution.requestToken) {
    throw new Error('Query execution did not finish and no request token was returned.');
  }

  let attempts = 0;
  while (attempts < MAX_POLL_ATTEMPTS) {
    const poll = await queryExecutionClient.queryPoll({
      requestToken: execution.requestToken,
      requestTimeoutMilliseconds: POLL_DELAY_MS,
    });

    if (poll.state === 'SUCCEEDED' && poll.result) {
      return poll.result;
    }

    if (poll.state === 'FAILED' || poll.state === 'CANCELLED' || poll.state === 'RESULT_GONE') {
      throw new Error(`Query execution did not complete successfully. Current state: ${poll.state}.`);
    }

    attempts += 1;
    await wait(POLL_DELAY_MS);
  }

  throw new Error('Query polling timed out before the result became available.');
};

const shouldCreateProblem = (comparison: ComparisonOperator, recordsCount: number, threshold: number) => {
  if (comparison === 'GREATER_THAN') {
    return recordsCount > threshold;
  }

  return recordsCount < threshold;
};

const buildProblemDescription = (comparison: ComparisonOperator, recordsCount: number, threshold: number, query: string) => {
  const comparisonText = comparison === 'GREATER_THAN' ? 'greater than' : 'less than';
  return `Query returned ${recordsCount} record(s), which is ${comparisonText} the configured threshold (${threshold}).\n\nQuery: ${query}`;
};

const resolveConnection = async (connectionId: string): Promise<ConnectionDetails> => {
  const connection = await appSettingsObjectsClient.getAppSettingsObjectByObjectId({
    objectId: connectionId,
  });

  const value = connection.value as Record<string, unknown> | undefined;
  const url = typeof value?.url === 'string' ? value.url : undefined;
  const token = typeof value?.token === 'string' ? value.token : undefined;

  if (!url || !token) {
    throw new Error('The selected connection is missing the required URL or token.');
  }

  return { url, token };
};

const renderRequestTemplate = (template: string, context: TemplateContext) => {
  try {
    return template.replace(/{{\s*([^}]+?)\s*}}/g, (_, expression: string) => {
      const evaluated = evaluateTemplateExpression(expression, context);

      if (evaluated === null || evaluated === undefined) {
        return '';
      }

      return String(evaluated);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to render request body template: ${message}`);
  }
};

const buildRequestPayload = (renderedTemplate: string) => {
  const trimmed = renderedTemplate.trim();

  if (!trimmed) {
    return {
      body: '',
      requestBodyType: 'text' as const,
      headers: {
        'Content-Type': 'text/plain',
      },
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    return {
      body: parsed,
      requestBodyType: 'json' as const,
      headers: {
        'Content-Type': 'application/json',
      },
    };
  } catch {
    return {
      body: renderedTemplate,
      requestBodyType: 'text' as const,
      headers: {
        'Content-Type': 'text/plain',
      },
    };
  }
};

export default async (payload: DqlAlertInput): Promise<DqlAlertResult> => {
  if (!payload.query?.trim()) {
    throw new Error('A DQL query is required to evaluate the alert.');
  }

  const threshold = ensureThreshold(payload.threshold);
  const comparison = getComparison(payload.comparison);
  const queryResult = await fetchQueryResult(payload.query);
  const recordsCount = queryResult.records?.length ?? 0;
  const problemShouldBeCreated = shouldCreateProblem(comparison, recordsCount, threshold);

  if (!problemShouldBeCreated) {
    return {
      recordsCount,
      triggered: false,
    };
  }

  const templateContext: TemplateContext = {
    comparison,
    query: payload.query,
    threshold,
    records: queryResult.records ?? [],
    metadata: (queryResult.metadata as Record<string, unknown>) ?? {},
    types: queryResult.types ?? [],
    recordsCount,
    triggered: problemShouldBeCreated,
  };

  if (payload.sendRequest) {
    if (!payload.connectionId) {
      throw new Error('A connection ID is required when sending a request.');
    }

    if (!payload.requestBodyTemplate) {
      throw new Error('A request body template is required when sending a request.');
    }

    const connection = await resolveConnection(payload.connectionId);
    const renderedTemplate = renderRequestTemplate(payload.requestBodyTemplate, templateContext);
    const { body, requestBodyType, headers } = buildRequestPayload(renderedTemplate);

    await httpClient.send({
      url: connection.url,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.token}`,
        ...headers,
      },
      body,
      requestBodyType,
    });
  }

  let correlationId: string | undefined;
  const shouldCreateProblemEvent = payload.createProblem ?? true;

  if (shouldCreateProblemEvent) {
    const eventResult = await eventsClient.createEvent({
      body: {
        eventType: 'CUSTOM_ALERT',
        title: payload.problemTitle ?? DEFAULT_PROBLEM_TITLE,
        properties: {
          'dt.event.description': buildProblemDescription(comparison, recordsCount, threshold, payload.query),
          'dql.query': payload.query,
        },
      },
    });

    correlationId = eventResult.eventIngestResults?.[0]?.correlationId;
  }

  return {
    recordsCount,
    triggered: true,
    problemEvent: correlationId
      ? {
          correlationId,
        }
      : undefined,
  };
};
