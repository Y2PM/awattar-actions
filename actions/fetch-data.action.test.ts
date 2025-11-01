import fetchData from './fetch-data.action';
import { buildMockedFetchResponse } from './test-utils';

describe('fetch-data action', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should request the market data API with the expected query parameters', async () => {
    const mockedResponse = [{ foo: 'bar' }];

    fetchMock.mockImplementation((requestUrl: string) => {
      expect(requestUrl).toBe('https://api.awattar.de/v1/marketdata?start=1000&end=2000');
      return buildMockedFetchResponse(mockedResponse);
    });

    const result = await fetchData({ start: '1000', end: '2000' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockedResponse);
  });

  it('should omit missing query parameters', async () => {
    const mockedResponse = { data: [] };

    fetchMock.mockImplementation((requestUrl: string) => {
      expect(requestUrl).toBe('https://api.awattar.de/v1/marketdata');
      return buildMockedFetchResponse(mockedResponse);
    });

    const result = await fetchData({ start: undefined, end: undefined });

    expect(fetchMock).toHaveBeenCalledWith('https://api.awattar.de/v1/marketdata');
    expect(result).toEqual(mockedResponse);
  });
});
