/**
 * "Add tags…" and "Remove tags…" for a selection (#209): a place's contents, a tag's page. The
 * picker chooses the tags; they are added to every selected thing, or taken off, in one request
 * with one Undo (`POST /things/tags`, at most 200 things).
 */

import { TAG_LIMITS } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTagThings } from './api';
import { TagPicker } from './lazy';

export function BulkTagButtons({
  thingIds,
  accountId,
  canCreate,
  onDone,
  locationId,
}: {
  thingIds: readonly string[];
  /** Their location, when they share one: offline, the change is queued for it. */
  locationId?: string;
  /** The account the things' tags come from (one location's, or one tag's). */
  accountId: string;
  canCreate: boolean;
  onDone?: () => void;
}) {
  const { t } = useLingui();
  const tagThings = useTagThings();
  const [mode, setMode] = useState<'add' | 'remove' | null>(null);
  const n = thingIds.length;
  const disabled = n === 0 || n > TAG_LIMITS.bulkThings;
  const apply = async (ids: string[]) => {
    if (!mode || ids.length === 0) return;
    const ok = await tagThings({ thingIds: [...thingIds], [mode]: ids }, t`Tags changed`, {
      ...(locationId ? { locationId } : {}),
    });
    if (ok) onDone?.();
  };
  return (
    <>
      <Button size="small" variant="secondary" isDisabled={disabled} onPress={() => setMode('add')}>
        <Trans>Add tags…</Trans>
      </Button>
      <Button
        size="small"
        variant="secondary"
        isDisabled={disabled}
        onPress={() => setMode('remove')}
      >
        <Trans>Remove tags…</Trans>
      </Button>
      <TagPicker
        isOpen={mode !== null}
        onClose={() => setMode(null)}
        accountId={accountId}
        title={mode === 'remove' ? t`Remove tags…` : t`Add tags…`}
        value={[]}
        onApply={(next) => void apply(next.map((g) => g.id))}
        canCreate={mode === 'add' && canCreate}
      />
    </>
  );
}
