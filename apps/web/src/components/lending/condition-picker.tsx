/** The condition something went out or came back in (Kept's thing scale), optional. */
import type { Condition } from '@kept/shared';
import { useConditionLabels } from '@/components/things/labels';
import { Combobox } from '@/components/ui/combobox';

export function ConditionPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Condition | null;
  onChange: (c: Condition | null) => void;
}) {
  const conditions = useConditionLabels();
  return (
    <Combobox
      label={label}
      items={(Object.keys(conditions) as Condition[]).map((c) => ({ id: c, label: conditions[c] }))}
      selectedKey={value}
      onSelectionChange={(k) => onChange(k ? (String(k) as Condition) : null)}
    />
  );
}
