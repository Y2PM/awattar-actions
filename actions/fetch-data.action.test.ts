import { eventsClient } from '@dynatrace-sdk/client-classic-environment-v2';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import { appSettingsObjectsClient } from '@dynatrace-sdk/client-app-settings-v2';
import { httpClient } from '@dynatrace-sdk/http-client';
import fetchData from './fetch-data.action';

jest.mock('@dynatrace-sdk/client-query', () => ({
  queryExecutionClient: {
    queryExecute: jest.fn(),
    queryPoll: jest.fn(),
  },
}));

jest.mock('@dynatrace-sdk/client-classic-environment-v2', () => ({
  eventsClient: {
    createEvent: jest.fn(),
  },
}));

jest.mock('@dynatrace-sdk/client-app-settings-v2', () => ({
  appSettingsObjectsClient: {
    getAppSettingsObjectByObjectId: jest.fn(),
  },
}));

jest.mock('@dynatrace-sdk/http-client', () => ({
  httpClient: {
    send: jest.fn(),
  },
}));

const buildResult = (recordsCount: number) => ({
  records: Array.from({ length: recordsCount }, (_, index) => ({ id: index })),
  metadata: {},
  types: [],
});

describe('fetch-data action', () => {
  const mockedQueryClient = queryExecutionClient as unknown as jest.Mocked<typeof queryExecutionClient>;
  const mockedEventsClient = eventsClient as unknown as jest.Mocked<typeof eventsClient>;
  const mockedAppSettingsClient = appSettingsObjectsClient as unknown as jest.Mocked<typeof appSettingsObjectsClient>;
  const mockedHttpClient = httpClient as unknown as jest.Mocked<typeof httpClient>;

  beforeEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it('throws when no DQL query is provided', async () => {
    await expect(fetchData({ query: '', threshold: 1, comparison: 'GREATER_THAN' })).rejects.toThrow(
      'A DQL query is required to evaluate the alert.',
    );
  });

  it('does not create a problem when the threshold is not exceeded', async () => {
    mockedQueryClient.queryExecute.mockResolvedValue({
      state: 'SUCCEEDED',
      result: buildResult(2),
    } as any);

    const result = await fetchData({ query: 'fetch logs', threshold: 5, comparison: 'GREATER_THAN' });

    expect(result).toEqual({
      recordsCount: 2,
      triggered: false,
    });
    expect(mockedEventsClient.createEvent).not.toHaveBeenCalled();
    expect(mockedHttpClient.send).not.toHaveBeenCalled();
  });

  it('creates a custom alert when the condition is met', async () => {
    mockedQueryClient.queryExecute.mockResolvedValue({
      state: 'SUCCEEDED',
      result: buildResult(10),
    } as any);

    mockedEventsClient.createEvent.mockResolvedValue({
      eventIngestResults: [
        {
          correlationId: 'event-123',
        },
      ],
    } as any);

    const result = await fetchData({
      query: 'fetch logs',
      threshold: 5,
      comparison: 'GREATER_THAN',
      problemTitle: 'Logs alert',
      createProblem: true,
    });

    expect(mockedEventsClient.createEvent).toHaveBeenCalledWith({
      body: expect.objectContaining({
        eventType: 'CUSTOM_ALERT',
        title: 'Logs alert',
        properties: expect.objectContaining({
          'dql.query': 'fetch logs',
          'dt.event.description': expect.stringContaining('Query returned 10 record(s)'),
        }),
      }),
    });
    expect(result).toEqual({
      recordsCount: 10,
      triggered: true,
      problemEvent: {
        correlationId: 'event-123',
      },
    });
  });

  it('polls for results when the initial response is still running', async () => {
    jest.useFakeTimers();

    mockedQueryClient.queryExecute.mockResolvedValue({
      state: 'RUNNING',
      requestToken: 'token-1',
    } as any);

    mockedQueryClient.queryPoll.mockResolvedValueOnce({
      state: 'RUNNING',
    } as any);

    mockedQueryClient.queryPoll.mockResolvedValueOnce({
      state: 'SUCCEEDED',
      result: buildResult(0),
    } as any);

    mockedEventsClient.createEvent.mockResolvedValue({} as any);

    const fetchPromise = fetchData({
      query: 'fetch logs',
      threshold: 1,
      comparison: 'LESS_THAN',
    });

    if (jest.advanceTimersByTimeAsync) {
      await jest.advanceTimersByTimeAsync(1000);
    } else {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    }

    await expect(fetchPromise).resolves.toEqual({
      recordsCount: 0,
      triggered: true,
      problemEvent: undefined,
    });

    expect(mockedQueryClient.queryPoll).toHaveBeenCalledTimes(2);
    expect(mockedEventsClient.createEvent).toHaveBeenCalled();
  });

  it('sends a POST request using the selected connection when sendRequest is enabled', async () => {
    mockedQueryClient.queryExecute.mockResolvedValue({
      state: 'SUCCEEDED',
      result: buildResult(3),
    } as any);

    mockedAppSettingsClient.getAppSettingsObjectByObjectId.mockResolvedValue({
      value: {
        url: 'https://example.com/webhook',
        token: 'secret-token',
      },
    } as any);

    mockedHttpClient.send.mockResolvedValue({} as any);

    await fetchData({
      query: 'fetch logs',
      threshold: 1,
      comparison: 'GREATER_THAN',
      sendRequest: true,
      connectionId: 'connection-1',
      requestBodyTemplate: '{"count": {{ recordsCount }}}',
      createProblem: false,
    });

    expect(mockedAppSettingsClient.getAppSettingsObjectByObjectId).toHaveBeenCalledWith({
      objectId: 'connection-1',
    });

    expect(mockedHttpClient.send).toHaveBeenCalledWith({
      url: 'https://example.com/webhook',
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret-token',
        'Content-Type': 'application/json',
      },
      body: { count: 3 },
      requestBodyType: 'json',
    });
    expect(mockedEventsClient.createEvent).not.toHaveBeenCalled();
  });

  it('sends both the request and creates a problem when both toggles are enabled', async () => {
    mockedQueryClient.queryExecute.mockResolvedValue({
      state: 'SUCCEEDED',
      result: buildResult(6),
    } as any);

    mockedAppSettingsClient.getAppSettingsObjectByObjectId.mockResolvedValue({
      value: {
        url: 'https://example.com/alert',
        token: 'token-123',
      },
    } as any);

    mockedHttpClient.send.mockResolvedValue({} as any);

    mockedEventsClient.createEvent.mockResolvedValue({
      eventIngestResults: [
        { correlationId: 'corr-1' },
      ],
    } as any);

    const result = await fetchData({
      query: 'fetch logs',
      threshold: 1,
      comparison: 'GREATER_THAN',
      sendRequest: true,
      connectionId: 'connection-42',
      requestBodyTemplate: '{"records": {{ records | length }}}',
      createProblem: true,
    });

    expect(mockedHttpClient.send).toHaveBeenCalled();
    expect(mockedEventsClient.createEvent).toHaveBeenCalled();
    expect(result).toEqual({
      recordsCount: 6,
      triggered: true,
      problemEvent: {
        correlationId: 'corr-1',
      },
    });
  });

  it('throws an error when the request template fails to render', async () => {
    mockedQueryClient.queryExecute.mockResolvedValue({
      state: 'SUCCEEDED',
      result: buildResult(4),
    } as any);

    mockedAppSettingsClient.getAppSettingsObjectByObjectId.mockResolvedValue({
      value: {
        url: 'https://example.com/alert',
        token: 'token-123',
      },
    } as any);

    await expect(
      fetchData({
        query: 'fetch logs',
        threshold: 1,
        comparison: 'GREATER_THAN',
        sendRequest: true,
        connectionId: 'connection-42',
        requestBodyTemplate: '{{ records | invalidFilter }}',
        createProblem: false,
      }),
    ).rejects.toThrow(/Failed to render request body template:/);

    expect(mockedHttpClient.send).not.toHaveBeenCalled();
    expect(mockedEventsClient.createEvent).not.toHaveBeenCalled();
  });

  it('does not create a problem when createProblem is false but still returns a triggered result', async () => {
    mockedQueryClient.queryExecute.mockResolvedValue({
      state: 'SUCCEEDED',
      result: buildResult(5),
    } as any);

    const result = await fetchData({
      query: 'fetch logs',
      threshold: 1,
      comparison: 'GREATER_THAN',
      createProblem: false,
    });

    expect(result).toEqual({
      recordsCount: 5,
      triggered: true,
      problemEvent: undefined,
    });
    expect(mockedEventsClient.createEvent).not.toHaveBeenCalled();
  });
});
