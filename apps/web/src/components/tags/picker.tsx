/**
 * The tag picker (#209): search the account's tags on the server (no cap), tick to add, untick to
 * take off, and when nothing has the name typed, "Create "camping"" (members may). Near matches
 * come first, under "Did you mean", before anything is made. A sheet on phones, a dialog from
 * `md` up. What was ticked is applied once, when it closes (Done, Escape or a tap outside), so a
 * thing's tags change in one step with one Undo.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Checkbox, GridList, GridListItem } from 'react-aria-components';
import { isApiError } from '@/api/client';
import type { ThingTag } from '@/api/inventory/types';
import { FindField } from '@/components/filters/panel';
import { CheckIcon, PlusIcon } from '@/components/icons';
import { useErrorText } from '@/components/page';
import { Sheet } from '@/components/things/sheet';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useOnline } from '@/lib/online';
import { useOffline } from '@/offline/provider';
import { createTag, hasName, thingTagOf, useTagSearch } from './api';
import { TagDot } from './chip';
import { newOfflineTag, useOfflineTagOptions } from './offline';

const rowClass =
  'group flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[15px] leading-snug text-ink outline-none data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-info data-focused:bg-sunken data-hovered:bg-sunken';
const listClass =
  'grid max-h-[min(50dvh,22rem)] content-start gap-px overflow-y-auto rounded-[10px] border border-line p-1 outline-none';

/** Whether two tag lists hold the same tags. */
export const sameTags = (a: readonly ThingTag[], b: readonly ThingTag[]): boolean =>
  a.length === b.length && a.every((g) => b.some((x) => x.id === g.id));

export function TagPicker({
  isOpen,
  onClose,
  accountId,
  title,
  value,
  onApply,
  canCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  title: string;
  /** The tags it has now. */
  value: readonly ThingTag[];
  /** The tags it should have, when they changed: called once, as the picker closes. */
  onApply: (next: ThingTag[]) => void;
  /** Members and up may make a tag here. */
  canCreate: boolean;
}) {
  const [chosen, setChosen] = useState<ThingTag[]>([...value]);
  const opened = useRef(false);
  useEffect(() => {
    if (isOpen && !opened.current) setChosen([...value]);
    opened.current = isOpen;
  }, [isOpen, value]);
  const close = () => {
    if (!sameTags(chosen, value)) onApply(chosen);
    onClose();
  };
  return (
    <Sheet isOpen={isOpen} onOpenChange={(o) => !o && close()} title={title} fitKeyboard>
      {isOpen ? (
        <PickerBody
          accountId={accountId}
          initial={value}
          chosen={chosen}
          onChange={setChosen}
          canCreate={canCreate}
          onDone={close}
        />
      ) : null}
    </Sheet>
  );
}

function PickerBody({
  accountId,
  initial: start,
  chosen: selected,
  onChange,
  canCreate,
  onDone,
}: {
  accountId: string;
  initial: readonly ThingTag[];
  chosen: readonly ThingTag[];
  onChange: (next: ThingTag[]) => void;
  canCreate: boolean;
  onDone: () => void;
}) {
  const onToggle = (tag: ThingTag, on: boolean) =>
    onChange(
      on
        ? [...selected.filter((g) => g.id !== tag.id), tag]
        : selected.filter((g) => g.id !== tag.id),
    );
  const { t } = useLingui();
  const errorText = useErrorText();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  // What it had when the picker opened leads the list, so rows don't jump under the pointer.
  const [initial] = useState(() => start.map((g) => g.id));
  const online = useOnline();
  const store = useOffline()?.store ?? null;
  const search = useTagSearch(accountId, q, online);
  // Offline, or the server out of reach: the phone's copy of the tags (#209).
  const offline =
    !!store && (!online || (isApiError(search.error) && search.error.code === 'offline'));
  const local = useOfflineTagOptions(store, accountId, q, offline);
  const typed = q.trim();
  const found = offline ? (local.data ?? []) : (search.data?.items ?? []).map(thingTagOf);
  const exact = typed !== '' && hasName([...found, ...selected], typed);

  const items = useMemo(() => {
    if (typed) return found;
    const first = [
      ...selected.filter((g) => initial.includes(g.id)),
      ...found.filter((g) => initial.includes(g.id) && !selected.some((s) => s.id === g.id)),
    ];
    return [...first, ...found.filter((g) => !first.some((x) => x.id === g.id))];
  }, [typed, found, selected, initial]);
  const ids = new Set(selected.map((g) => g.id));

  const create = async () => {
    if (!typed || creating) return;
    setCreating(true);
    try {
      // Offline, the new tag goes with the change that adds it, and is made when it syncs.
      const made = offline ? { tag: newOfflineTag(typed) } : await createTag(accountId, typed);
      onToggle(made.tag, true);
      setQ('');
    } catch (e) {
      toast({ title: t`Couldn't change the tags`, description: errorText(e), tone: 'danger' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3">
      <FindField label={t`Find a tag`} value={q} onChange={setQ} autoFocus />
      <div className="grid min-h-0 content-start gap-2">
        {typed && !exact && items.length > 0 ? (
          <p className="m-0 text-small text-ink-2">
            <Trans>Did you mean</Trans>
          </p>
        ) : null}
        <GridList
          aria-label={t`Tags`}
          items={items}
          selectionMode="multiple"
          selectionBehavior="toggle"
          escapeKeyBehavior="none"
          selectedKeys={ids}
          onSelectionChange={(keys) => {
            const next = keys === 'all' ? new Set(items.map((g) => g.id)) : new Set([...keys]);
            // Tags not listed now (searched away) stay as they are.
            const keep = selected.filter(
              (g) => !items.some((i) => i.id === g.id) || next.has(g.id),
            );
            onChange([...keep, ...items.filter((g) => next.has(g.id) && !ids.has(g.id))]);
          }}
          renderEmptyState={() => (
            <div className="px-3 py-2.5 text-small text-ink-3">
              {(offline ? local.isPending : search.isPending) ? (
                <Trans>Loading…</Trans>
              ) : !offline && search.isError ? (
                <Trans>Couldn't load the choices. Try again in a moment.</Trans>
              ) : typed ? (
                <Trans>No matches</Trans>
              ) : (
                <Trans>No tags yet.</Trans>
              )}
            </div>
          )}
          className={listClass}
        >
          {(g: ThingTag) => (
            <GridListItem id={g.id} textValue={g.name} className={rowClass}>
              {({ isSelected }) => (
                <>
                  <Checkbox
                    slot="selection"
                    className="grid size-5 shrink-0 place-items-center rounded-[5px] border-2 border-ink-3 outline-none data-selected:border-ink data-selected:bg-ink data-selected:text-paper"
                  >
                    {isSelected ? <CheckIcon aria-hidden="true" className="size-3.5" /> : null}
                  </Checkbox>
                  <TagDot colour={g.colour} className="size-2.5" />
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    <bdi>{g.name}</bdi>
                  </span>
                </>
              )}
            </GridListItem>
          )}
        </GridList>
        {canCreate && typed && !exact ? (
          <Button
            variant="secondary"
            className="justify-self-start"
            isPending={creating}
            onPress={() => void create()}
          >
            <PlusIcon className="size-4" />
            {/* One flex item: the button's gap would otherwise widen the space before the name. */}
            <span>
              <Trans>
                Create “<bdi>{typed}</bdi>”
              </Trans>
            </span>
          </Button>
        ) : null}
      </div>
      <DialogFooter>
        <Button onPress={onDone}>
          <Trans>Done</Trans>
        </Button>
      </DialogFooter>
    </div>
  );
}
