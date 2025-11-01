import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import FetchDataWidget from './fetch-data.widget';

jest.mock('@dynatrace/automation-action-components', () => ({
  AutomationNumberInput: ({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) => (
    <input
      aria-label="threshold"
      type="number"
      value={value ?? ''}
      onChange={(event) => {
        const nextValue = event.target.value === '' ? null : Number(event.target.value);
        onChange(nextValue);
      }}
    />
  ),
  AutomationConnectionPicker: ({
    connectionId,
    onChange,
    dataTestId,
  }: {
    connectionId?: string;
    onChange: (value: string) => void;
    dataTestId?: string;
  }) => (
    <select
      aria-label="connection-picker"
      data-testid={dataTestId}
      value={connectionId ?? ''}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Select a connection</option>
      <option value="connection-1">Connection 1</option>
      <option value="connection-2">Connection 2</option>
    </select>
  ),
  AutomationCodeEditor: ({
    value,
    onChange,
    ariaLabel,
  }: {
    value?: string;
    onChange: (value: string) => void;
    ariaLabel?: string;
  }) => (
    <textarea aria-label={ariaLabel ?? 'code-editor'} value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
  ),
  AutomationSelect: ({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) => (
    <select
      aria-label="comparison"
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    >
      {children}
    </select>
  ),
  AutomationTextInput: ({ value, onChange }: { value?: string; onChange: (value?: string) => void }) => (
    <input aria-label="text-input" value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} />
  ),
  _AutomationDQLEditor: ({ value, onChange }: { value?: string; onChange: (value: string) => void }) => (
    <textarea aria-label="dql-editor" value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
  ),
}));

jest.mock('@dynatrace/strato-components-preview', () => ({
  FormField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Hint: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  Label: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock('@dynatrace/strato-components-preview/forms', () => ({
  SelectV2: Object.assign(
    ({ children }: { children: React.ReactNode }) => <>{children}</>,
    {
      Content: ({ children }: { children: React.ReactNode }) => <>{children}</>,
      Option: ({ value, children }: { value: string; children: React.ReactNode }) => (
        <option value={value}>{children}</option>
      ),
      Trigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    },
  ),
  Checkbox: ({ checked, onChange, 'aria-label': ariaLabel }: { checked?: boolean; onChange: (checked: boolean) => void; 'aria-label'?: string }) => (
    <input
      type="checkbox"
      aria-label={ariaLabel}
      checked={Boolean(checked)}
      onChange={(event) => onChange(event.target.checked)}
    />
  ),
}));

describe('FetchDataWidget', () => {
  it('renders the configured values', () => {
    const onValueChanged = jest.fn();

    render(
      <FetchDataWidget
        value={{
          query: 'fetch logs',
          comparison: 'LESS_THAN',
          threshold: 3,
          problemTitle: 'Alert title',
          createProblem: true,
          sendRequest: true,
          connectionId: 'connection-2',
          requestBodyTemplate: '{ "foo": "bar" }',
        }}
        onValueChanged={onValueChanged}
      />,
    );

    const queryEditor = screen.getByLabelText('dql-editor') as HTMLTextAreaElement;
    const comparisonSelect = screen.getByLabelText('comparison') as HTMLSelectElement;
    const thresholdInput = screen.getByLabelText('threshold') as HTMLInputElement;
    const [titleInput] = screen.getAllByLabelText('text-input') as HTMLInputElement[];
    const createProblemToggle = screen.getByLabelText('create-problem') as HTMLInputElement;
    const sendRequestToggle = screen.getByLabelText('send-request') as HTMLInputElement;
    const connectionPicker = screen.getByTestId('connection-picker') as HTMLSelectElement;
    const requestBodyEditor = screen.getByLabelText('request-body-template') as HTMLTextAreaElement;

    expect(queryEditor.value).toBe('fetch logs');
    expect(comparisonSelect.value).toBe('LESS_THAN');
    expect(thresholdInput.value).toBe('3');
    expect(titleInput.value).toBe('Alert title');
    expect(createProblemToggle.checked).toBe(true);
    expect(sendRequestToggle.checked).toBe(true);
    expect(connectionPicker.value).toBe('connection-2');
    expect(requestBodyEditor.value).toBe('{ "foo": "bar" }');
  });

  it('updates the value when fields change', () => {
    const Wrapper = () => {
      const [state, setState] = React.useState({
        query: '',
        comparison: 'GREATER_THAN' as const,
        threshold: 1,
        problemTitle: '',
        createProblem: false,
        sendRequest: false,
        connectionId: 'connection-1',
        requestBodyTemplate: '',
      });
      return <FetchDataWidget value={state} onValueChanged={setState} />;
    };

    render(<Wrapper />);

    const queryEditor = screen.getByLabelText('dql-editor') as HTMLTextAreaElement;
    const comparisonSelect = screen.getByLabelText('comparison') as HTMLSelectElement;
    const thresholdInput = screen.getByLabelText('threshold') as HTMLInputElement;
    const [titleInput] = screen.getAllByLabelText('text-input') as HTMLInputElement[];
    const createProblemToggle = screen.getByLabelText('create-problem') as HTMLInputElement;
    const sendRequestToggle = screen.getByLabelText('send-request') as HTMLInputElement;
    const connectionPicker = screen.getByTestId('connection-picker') as HTMLSelectElement;
    const requestBodyEditor = screen.getByLabelText('request-body-template') as HTMLTextAreaElement;

    fireEvent.change(queryEditor, { target: { value: 'fetch logs' } });
    fireEvent.change(comparisonSelect, { target: { value: 'LESS_THAN' } });
    fireEvent.change(thresholdInput, { target: { value: '5' } });
    fireEvent.change(titleInput, { target: { value: 'New problem title' } });
    fireEvent.click(createProblemToggle);
    fireEvent.click(sendRequestToggle);
    fireEvent.change(connectionPicker, { target: { value: 'connection-2' } });
    fireEvent.change(requestBodyEditor, { target: { value: '{ "new": "value" }' } });

    expect(queryEditor.value).toBe('fetch logs');
    expect(comparisonSelect.value).toBe('LESS_THAN');
    expect(thresholdInput.value).toBe('5');
    expect(titleInput.value).toBe('New problem title');
    expect(createProblemToggle.checked).toBe(true);
    expect(sendRequestToggle.checked).toBe(true);
    expect(connectionPicker.value).toBe('connection-2');
    expect(requestBodyEditor.value).toBe('{ "new": "value" }');
  });
});
