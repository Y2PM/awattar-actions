import { eventsClient } from '@dynatrace-sdk/client-classic-environment-v2';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
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

const buildResult = (recordsCount: number) => ({
  records: Array.from({ length: recordsCount }, (_, index) => ({ id: index })),
  metadata: {},
  types: [],
});

describe('fetch-data action', () => {
  const mockedQueryClient = queryExecutionClient as unknown as jest.Mocked<typeof queryExecutionClient>;
  const mockedEventsClient = eventsClient as unknown as jest.Mocked<typeof eventsClient>;

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
      problemEvent: {
        correlationId: undefined,
      },
    });

    expect(mockedQueryClient.queryPoll).toHaveBeenCalledTimes(2);
    expect(mockedEventsClient.createEvent).toHaveBeenCalled();
  });
});
