import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import FetchDataWidget from './fetch-data.widget';

jest.mock('@dynatrace/automation-action-components', () => ({
  AutomationTextInput: ({ value, onChange }: { value?: string; onChange: (value?: string) => void }) => (
    <input value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} />
  ),
}));

jest.mock('@dynatrace/strato-components-preview', () => ({
  FormField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Hint: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  Label: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

describe('FetchDataWidget', () => {
  it('should render start and end inputs with existing values', () => {
    const onValueChanged = jest.fn();

    render(<FetchDataWidget value={{ start: '1000', end: '2000' }} onValueChanged={onValueChanged} />);

    const [startInput, endInput] = screen.getAllByRole('textbox') as HTMLInputElement[];

    expect(startInput.value).toBe('1000');
    expect(endInput.value).toBe('2000');
    expect(
      screen.getAllByText('Optional - see https://www.awattar.de/services/api for details').length,
    ).toBe(2);
  });

  it('should notify about updates', () => {
    const onValueChanged = jest.fn();

    render(<FetchDataWidget value={{ start: '1000', end: undefined }} onValueChanged={onValueChanged} />);

    const [startInput] = screen.getAllByRole('textbox') as HTMLInputElement[];

    fireEvent.change(startInput, { target: { value: '1234' } });

    expect(onValueChanged).toHaveBeenCalledWith({ start: '1234', end: undefined });
  });
});
