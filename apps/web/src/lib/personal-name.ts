/**
 * The caller's own Personal location as the app names it in a sentence ("Used for Personal, your
 * private threads…"): its own name once renamed, "Personal" in the reader's language before that
 * and while the locations load (lib/labels.ts useLocationName).
 */
import { useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { keys, useAllLocations, useMe } from '@/api/queries';
import type { Me } from '@/api/types';
import { useLocationName } from '@/lib/labels';

export function usePersonalName(): string {
  const { t } = useLingui();
  const locations = useAllLocations();
  const name = useLocationName();
  const own = locations.data?.find((l) => l.kind === 'personal');
  return own ? name(own) : t`Personal`;
}

/** Whether Personal is out of this person's lists right now (#392). */
export function usePersonalHidden(): boolean {
  return useMe().data?.personalHidden === true;
}

/** The hidden Personal's id, or null. From what the frame already read (the offline surfaces use
 * it, and ask the server nothing). */
export function useHiddenLocationId(): string | null {
  const me = useQuery<Me>({ queryKey: keys.me, enabled: false }).data;
  return me?.personalHidden ? me.personalLocationId : null;
}

/** The location "Export my data" carries, as the server picks it (exports/service.ts): Personal,
 * or while it is hidden the first other location the person owns. */
export function useMyDataLocation(): { name: string; insteadOfPersonal: boolean } {
  const name = useLocationName();
  const personal = usePersonalName();
  const hidden = usePersonalHidden();
  const all = useAllLocations().data ?? [];
  const own = all.find((l) => l.kind === 'personal');
  const carried = hidden
    ? all.find((l) => !l.hidden && own && l.ownerAccountId === own.ownerAccountId)
    : undefined;
  return carried
    ? { name: name(carried), insteadOfPersonal: true }
    : { name: personal, insteadOfPersonal: false };
}

/** The locations chosen when a sheet opened. A hidden Personal among them stays offered while the
 * sheet is open: deselected, it can be chosen again rather than vanish (#459). */
export function useChosenAtOpen(ids: readonly (string | null | undefined)[]): readonly string[] {
  const [atOpen] = useState(() => ids.filter((id): id is string => !!id));
  return atOpen;
}
