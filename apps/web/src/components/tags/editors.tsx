/**
 * The tag editors (#209), one on-demand chunk (vite.config.ts ON_DEMAND_ENTRIES, wrapped by
 * ./lazy.tsx): a thing's tags with × and "Add tag", the form field, the selection buttons and
 * capture's chip. Their chips show from the precache meanwhile, so a page never waits on them to
 * read.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import type { ThingTag } from '@/api/inventory/types';
import { PlusIcon, XIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { isolate } from '@/lib/bidi';
import { useTagThings } from './api';
import { TagChip } from './chip';
import { TagPicker } from './lazy';

export { BulkTagButtons } from './bulk-tags';
export { CaptureTags } from './capture-tags';
export { TagsField } from './tags-field';

/** The toast after a change: what was added or taken off. */
export function useTagChangeTitle() {
  const { t } = useLingui();
  return (added: readonly ThingTag[], removed: readonly ThingTag[]) => {
    const one = added[0] ?? removed[0];
    if (added.length + removed.length === 1 && one) {
      const shown = isolate(one.name);
      return added.length ? t`Tagged ${shown}` : t`Took off ${shown}`;
    }
    return t`Tags changed`;
  };
}

/**
 * A thing's tags, changed in place: × on each chip and "Add tag". One change is one step with
 * one Undo; offline it is queued for `locationId` (api.ts useTagThings).
 */
export function TagsEditor({
  thingId,
  locationId,
  accountId,
  tags,
  canCreate,
  onChanged,
}: {
  thingId: string;
  locationId: string;
  accountId: string;
  tags: readonly ThingTag[];
  canCreate: boolean;
  /** After a change was sent or queued (read the thing again). */
  onChanged?: () => unknown;
}) {
  const { t } = useLingui();
  const tagThings = useTagThings();
  const titleOf = useTagChangeTitle();
  const [picking, setPicking] = useState(false);
  const apply = async (next: readonly ThingTag[]) => {
    const added = next.filter((g) => !tags.some((x) => x.id === g.id));
    const removed = tags.filter((g) => !next.some((x) => x.id === g.id));
    if (added.length + removed.length === 0) return;
    const ok = await tagThings(
      {
        thingIds: [thingId],
        ...(added.length ? { add: added.map((g) => g.id) } : {}),
        ...(removed.length ? { remove: removed.map((g) => g.id) } : {}),
      },
      titleOf(added, removed),
      { locationId },
    );
    if (ok) await onChanged?.();
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((g) => (
        <TagChip
          key={g.id}
          tag={g}
          link
          end={
            <button
              type="button"
              aria-label={t`Take ${isolate(g.name)} off`}
              onClick={() => void apply(tags.filter((x) => x.id !== g.id))}
              className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full text-ink-2 outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-info"
            >
              <XIcon aria-hidden="true" className="size-3.5" />
            </button>
          }
        />
      ))}
      <Button variant="ghost" size="small" onPress={() => setPicking(true)}>
        <PlusIcon className="size-4" />
        <Trans>Add tag</Trans>
      </Button>
      <TagPicker
        isOpen={picking}
        onClose={() => setPicking(false)}
        accountId={accountId}
        title={t`Tags`}
        value={tags}
        onApply={(next) => void apply(next)}
        canCreate={canCreate}
      />
    </div>
  );
}
