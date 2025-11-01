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
  AutomationSelect: ({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) => (
    <select
      aria-label="comparison"
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) {
          return null;
        }
        return (
          <option value={child.props.value}>
            {child.props.children}
          </option>
        );
      })}
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
      Option: ({ value, children }: { value: string; children: React.ReactNode }) => (
        <option value={value}>{children}</option>
      ),
      Trigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    },
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
        }}
        onValueChanged={onValueChanged}
      />,
    );

    const queryEditor = screen.getByLabelText('dql-editor') as HTMLTextAreaElement;
    const comparisonSelect = screen.getByLabelText('comparison') as HTMLSelectElement;
    const thresholdInput = screen.getByLabelText('threshold') as HTMLInputElement;
    const [titleInput] = screen.getAllByLabelText('text-input') as HTMLInputElement[];

    expect(queryEditor.value).toBe('fetch logs');
    expect(comparisonSelect.value).toBe('LESS_THAN');
    expect(thresholdInput.value).toBe('3');
    expect(titleInput.value).toBe('Alert title');
  });

  it('updates the value when fields change', () => {
    const Wrapper = () => {
      const [state, setState] = React.useState({
        query: '',
        comparison: 'GREATER_THAN' as const,
        threshold: 1,
        problemTitle: '',
      });
      return <FetchDataWidget value={state} onValueChanged={setState} />;
    };

    render(<Wrapper />);

    const queryEditor = screen.getByLabelText('dql-editor') as HTMLTextAreaElement;
    const comparisonSelect = screen.getByLabelText('comparison') as HTMLSelectElement;
    const thresholdInput = screen.getByLabelText('threshold') as HTMLInputElement;
    const [titleInput] = screen.getAllByLabelText('text-input') as HTMLInputElement[];

    fireEvent.change(queryEditor, { target: { value: 'fetch logs' } });
    fireEvent.change(comparisonSelect, { target: { value: 'LESS_THAN' } });
    fireEvent.change(thresholdInput, { target: { value: '5' } });
    fireEvent.change(titleInput, { target: { value: 'New problem title' } });

    expect(queryEditor.value).toBe('fetch logs');
    expect(comparisonSelect.value).toBe('LESS_THAN');
    expect(thresholdInput.value).toBe('5');
    expect(titleInput.value).toBe('New problem title');
  });
});
