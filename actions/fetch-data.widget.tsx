import { AutomationNumberInput, AutomationSelect, AutomationTextInput, _AutomationDQLEditor } from '@dynatrace/automation-action-components';
import { FormField, Hint, Label } from '@dynatrace/strato-components-preview';
import { SelectV2 } from '@dynatrace/strato-components-preview/forms';
import { ActionWidget } from '@dynatrace-sdk/automation-action-utils';
import React from 'react';
type ComparisonOperator = 'GREATER_THAN' | 'LESS_THAN';

interface FetchDataInput {
  query?: string;
  comparison?: ComparisonOperator;
  threshold?: number | null;
  problemTitle?: string;
}
const FetchDataWidget: ActionWidget<FetchDataInput> = (props) => {
  const { value, onValueChanged } = props;
  const updateValue = (newValue: Partial<FetchDataInput>) => {
    onValueChanged({ ...value, ...newValue });
  };
  const comparison = value.comparison ?? 'GREATER_THAN';
  const threshold = typeof value.threshold === 'number' ? value.threshold : null;
  return (
    <>
      <FormField>
        <Label>DQL query</Label>
        <_AutomationDQLEditor
          value={value.query ?? ''}
          onChange={(query) => updateValue({ query })}
          placeholder="Enter the DQL query to evaluate"
        />
        <Hint>Provide the DQL statement that returns the log records you want to evaluate.</Hint>
      </FormField>
      <FormField>
        <Label>Alert condition</Label>
        <AutomationSelect
          value={comparison}
          onChange={(selected) => {
            if (typeof selected === 'string') {
              updateValue({ comparison: selected as ComparisonOperator });
            }
          }}
        >
          <SelectV2.Content>
            <SelectV2.Option value="GREATER_THAN">Greater than threshold</SelectV2.Option>
            <SelectV2.Option value="LESS_THAN">Less than threshold</SelectV2.Option>
          </SelectV2.Content>
        </AutomationSelect>
        <Hint>Select how the number of returned records should be compared to the threshold.</Hint>
      </FormField>
      <FormField>
        <Label>Threshold</Label>
        <AutomationNumberInput
          value={threshold}
          onChange={(nextValue) => {
            if (typeof nextValue === 'number') {
              updateValue({ threshold: nextValue });
            } else if (nextValue === null) {
              updateValue({ threshold: null });
            }
          }}
          min={0}
        />
        <Hint>Trigger the alert when the number of records breaches this value.</Hint>
      </FormField>
      <FormField>
        <Label>Problem title</Label>
        <AutomationTextInput value={value.problemTitle} onChange={(problemTitle) => updateValue({ problemTitle })} />
        <Hint>Optional title for the problem created when the alert condition is met.</Hint>
      </FormField>
    </>
  );
};
export default FetchDataWidget;