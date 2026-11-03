/**
 * The caller's own Personal location as the app names it in a sentence ("Used for Personal, your
 * private threads…"): its own name once renamed, "Personal" in the reader's language before that
 * and while the locations load (lib/labels.ts useLocationName).
 */
import { useLingui } from '@lingui/react/macro';
import { useLocations } from '@/api/queries';
import { useLocationName } from '@/lib/labels';

export function usePersonalName(): string {
  const { t } = useLingui();
  const locations = useLocations();
  const name = useLocationName();
  const own = locations.data?.find((l) => l.kind === 'personal');
  return own ? name(own) : t`Personal`;
}
