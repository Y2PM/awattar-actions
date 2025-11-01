import { eventsClient } from '@dynatrace-sdk/client-classic-environment-v2';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';

type ComparisonOperator = 'GREATER_THAN' | 'LESS_THAN';

interface DqlAlertInput {
  query?: string;
  comparison?: ComparisonOperator;
  threshold?: number | null;
  problemTitle?: string;
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

  const correlationId = eventResult.eventIngestResults?.[0]?.correlationId;

  return {
    recordsCount,
    triggered: true,
    problemEvent: {
      correlationId,
    },
  };
};