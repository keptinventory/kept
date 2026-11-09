/**
 * Who took it back (#374): a member of the location, you by default. Shown only where there is
 * someone else to choose; a location of one is always you. A borrowed thing is given back, so
 * the label says so.
 */
import { useLingui } from '@lingui/react/macro';
import { useMe, useMembers } from '@/api/queries';
import { Combobox } from '@/components/ui/combobox';

/** The chosen member's user id, or null for you (the server's default). */
export type TakenBackBy = string | null;

/** What a return sends: the member chosen, or nothing when it is you. */
export function takenBackByInput(value: TakenBackBy, myId: string | undefined): string | undefined {
  return value && value !== myId ? value : undefined;
}

export function TakenBackByPicker({
  locationId,
  direction,
  value,
  onChange,
}: {
  locationId: string;
  direction: 'out' | 'in';
  value: TakenBackBy;
  onChange: (v: TakenBackBy) => void;
}) {
  const { t } = useLingui();
  const me = useMe();
  const members = useMembers(locationId);
  const myId = me.data?.user.id;
  const items = (members.data?.members ?? []).map((m) => ({ id: m.userId, label: m.displayName }));
  if (items.length < 2) return null;
  return (
    <Combobox
      label={direction === 'in' ? t`Given back by` : t`Taken back by`}
      items={items}
      selectedKey={value ?? myId ?? null}
      showsChoice
      onSelectionChange={(k) => onChange(k ? String(k) : null)}
    />
  );
}

export function useMyId(): string | undefined {
  return useMe().data?.user.id;
}
