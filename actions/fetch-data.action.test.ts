import fetchData from './fetch-data.action';
import { buildMockedFetchResponse } from './test-utils';

describe('fetch-data', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    // Clean up the mock to prevent interference with other tests
    fetchMock.mockClear();
  });

    it('should produce expected results', async () => {
      fetchMock.mockImplementation(() =>
        buildMockedFetchResponse({
          schemaId: 'fetch-data-connection',
          value: {
            name: 'My Connection',
            token: 'abc123',
            url: 'https://foo.bar',
          },
          summary: 'My Connection',
        }),
      );

      const result = await fetchData({ name: 'Mark', connectionId: 'fetch-data-connection-object-id' });
      expect(result).toEqual({ message: 'Hello Mark!' });
      expect.assertions(1);
  });
});
