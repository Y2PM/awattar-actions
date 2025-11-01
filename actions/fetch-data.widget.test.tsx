import { render } from '@dynatrace/strato-components-preview-testing/jest';
import { screen } from '@testing-library/react';
import React from 'react';
import { buildMockedFetchResponse } from './test-utils';
import FetchDataWidget from './fetch-data.widget';

describe('FetchDataWidget', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    // Clean up the mock to prevent interference with other tests
    fetchMock.mockClear();
  });

  it('should render a widget with values', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith('/platform/app-settings/v2/objects?')) {
        return buildMockedFetchResponse({
          items: [
            {
              objectId: 'fetch-data-connection-object-id',
              summary: 'My Connection',
            },
          ],
          totalCount: 1,
          pageSize: 500,
        });
      } else if (
        url === '/platform/app-settings/v2/objects/fetch-data-connection-object-id'
      ) {
        return buildMockedFetchResponse({
          objectId: 'fetch-data-connection-object-id',
          summary: 'My Connection',
        });
      } else {
        return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
      }
    });

    render(
      <FetchDataWidget
        value={{ name: 'Mark', connectionId: 'fetch-data-connection-object-id' }}
        onValueChanged={jest.fn()}
      />,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Mark')).toBeTruthy();
    expect(await screen.findByText('My Connection')).toBeTruthy();
  });
});
