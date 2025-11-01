import { AutomationTextInput } from '@dynatrace/automation-action-components';
import { FormField, Hint, Label } from '@dynatrace/strato-components-preview';
import { ActionWidget } from '@dynatrace-sdk/automation-action-utils';
import React from 'react';
interface FetchDataInput {
  start: string | undefined;
  end: string | undefined;
}
const FetchDataWidget: ActionWidget<FetchDataInput> = (props) => {
  const { value, onValueChanged } = props;
  const updateValue = (newValue: Partial<FetchDataInput>) => {
    onValueChanged({ ...value, ...newValue });
  };
  return (
    <>
      <FormField>
        <Label>Start</Label>
        <AutomationTextInput value={value.start} onChange={(start) => updateValue({ start })} />
        <Hint>Optional - see https://www.awattar.de/services/api for details</Hint>
      </FormField>
      <FormField>
        <Label>End</Label>
        <AutomationTextInput value={value.end} onChange={(end) => updateValue({ end })} />
        <Hint>Optional - see https://www.awattar.de/services/api for details</Hint>
      </FormField>
    </>
  );
};
export default FetchDataWidget;