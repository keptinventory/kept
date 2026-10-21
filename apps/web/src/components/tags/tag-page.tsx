/**
 * A tag's page (`/tags/<id>`, #209): the tag, how many things have it in each of your locations,
 * and every one of them across your locations with the list standard (search, filters, grouping
 * and pages in the URL). The owner and admins rename, recolour, merge and delete it (each
 * undoable); anyone who edits things selects some and takes the tag off, or adds others.
 */
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import type { Tag, ThingListParams, ThingRow } from '@/api/inventory/types';
import { useLocations } from '@/api/queries';
import { filterParams } from '@/components/filters/params';
import { useFilterRegistry } from '@/components/filters/registry';
import { useOfferUndo } from '@/components/history/undo';
import { CheckIcon } from '@/components/icons';
import { ListSurface } from '@/components/list-surface';
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Page,
  Section,
  useErrorText,
} from '@/components/page';
import { useThingsQuery } from '@/components/places/api';
import { ThingRowView } from '@/components/places/rows';
import {
  invalidateRegistry,
  registryApi,
  registryKeys,
  useAccountScope,
  useRegistryItem,
} from '@/components/registries/api';
import { MergeSheet, type MergeSubject } from '@/components/registries/merge-sheet';
import { RegistryEditSheet } from '@/components/registries/registry-edit-sheet';
import { useInUseText } from '@/components/registries/registry-list';
import { useTypeName } from '@/components/things/names';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { toast } from '@/components/ui/toast';
import { isolate } from '@/lib/bidi';
import { sep, useFormat } from '@/lib/format';
import { useLocationName } from '@/lib/labels';
import { useListState } from '@/lib/url-state';
import { useTagThings } from './api';
import { TagChip } from './chip';
import { BulkTagButtons } from './lazy';

export function TagPage({ id }: { id: string }) {
  const { t } = useLingui();
  const item = useRegistryItem('tags', id);
  const back = '/settings/account/tags' as const;
  if (item.isPending)
    return (
      <Page title={t`Tag`} back={back}>
        <LoadingRows rows={3} />
      </Page>
    );
  if (item.error)
    return (
      <Page title={t`Tag`} back={back}>
        <ErrorState error={item.error} onRetry={() => void item.refetch()} />
      </Page>
    );
  return <Loaded tag={item.data} />;
}

function Loaded({ tag }: { tag: Tag }) {
  const { t } = useLingui();
  const fmt = useFormat();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const offerUndo = useOfferUndo();
  const errorText = useErrorText();
  const inUseText = useInUseText();
  const locations = useLocations();
  const locationName = useLocationName();
  const scope = useAccountScope(tag.ownerAccountId);
  const [editing, setEditing] = useState(false);
  const [merging, setMerging] = useState<MergeSubject | null>(null);
  const name = tag.name;
  const count = tag.thingCount ?? 0;
  const uses = (tag.uses ?? []).flatMap((u) => {
    const loc = locations.data?.find((l) => l.id === u.locationId);
    return loc ? [`${locationName(loc)} ${fmt.num(u.count)}`] : [];
  });

  const remove = async () => {
    const ok = await confirm({
      title: t`Delete ${name}?`,
      body: t`Only something nothing uses can be deleted. Otherwise, merge it into another.`,
      confirmLabel: t`Delete`,
      destructive: true,
    });
    if (!ok) return;
    try {
      const { auditEvents } = await registryApi.remove('tags', tag.id);
      await invalidateRegistry(qc, 'tags');
      offerUndo({ title: t`Deleted ${name}` }, auditEvents);
      void navigate({ to: '/settings/account/tags' });
    } catch (e) {
      toast({ title: inUseText(e, name) ?? errorText(e), tone: 'danger' });
    }
  };

  return (
    <Page
      title={<bdi>{name}</bdi>}
      back={'/settings/account/tags' as never}
      actions={
        scope.canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button size="small" variant="secondary" onPress={() => setEditing(true)}>
              <Trans>Edit</Trans>
            </Button>
            <Button
              size="small"
              variant="secondary"
              onPress={() => setMerging({ id: tag.id, name, accountId: scope.accountId })}
            >
              <Trans>Merge into…</Trans>
            </Button>
            <Button size="small" variant="secondary" onPress={() => void remove()}>
              <Trans>Delete</Trans>
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="grid gap-2 rounded-[10px] border border-line bg-surface p-3.5">
        <TagChip tag={tag} className="w-fit text-[15px]" />
        <p className="m-0 text-small text-ink-2">
          {plural(count, { one: '# thing', other: '# things' })}
          {uses.length > 1 ? (
            <>
              {sep()}
              {uses.map((u, i) => (
                <span key={u}>
                  {i > 0 ? sep() : null}
                  <bdi>{u}</bdi>
                </span>
              ))}
            </>
          ) : null}
        </p>
      </div>

      <Things tag={tag} accountId={scope.accountId} canCreate={scope.canAddInline} />

      <RegistryEditSheet
        kind="tags"
        item={editing ? tag : null}
        onClose={() => {
          setEditing(false);
          void qc.invalidateQueries({ queryKey: registryKeys.item('tags', tag.id) });
        }}
      />
      <MergeSheet
        kind="tags"
        subject={merging}
        onClose={() => setMerging(null)}
        onMerged={(targetId) => void navigate({ to: '/tags/$id', params: { id: targetId } })}
      />
    </Page>
  );
}

function Things({
  tag,
  accountId,
  canCreate,
}: {
  tag: Tag;
  accountId: string;
  canCreate: boolean;
}) {
  const { t } = useLingui();
  const fmt = useFormat();
  const [list] = useListState();
  const locations = useLocations();
  const f = useFilterRegistry();
  const typeName = useTypeName();
  const tagThings = useTagThings();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const canEdit = (locations.data ?? []).some((l) => l.role !== 'viewer');
  const params: ThingListParams = {
    ...filterParams(list, {
      location: 'locationId',
      type: 'typeId',
      state: 'state',
      brand: 'brandId',
      belongsTo: 'belongsToId',
    }),
    // The page's own tag last, so a filter never replaces it.
    tagId: [tag.id],
    ...(list.q ? { q: list.q } : {}),
    ...(list.group === 'type' ? { group: 'type' as const } : {}),
  } as ThingListParams;
  const query = useThingsQuery(params, true);
  const rows: ThingRow[] = query.data?.pages.flatMap((p) => p.items) ?? [];
  const heading = t`Things tagged ${tag.name}`;
  const stop = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const name = tag.name;
  const shown = isolate(name);
  const takeOff = async () => {
    const ids = [...selected];
    const ok = await tagThings({ thingIds: ids, remove: [tag.id] }, t`Took off ${shown}`);
    if (ok) stop();
  };

  return (
    <Section title={heading}>
      {selecting ? (
        <div
          role="toolbar"
          aria-label={t`Selection`}
          className="flex flex-wrap items-center gap-2 rounded-[10px] border border-line bg-surface p-2"
        >
          <span className="flex flex-1 items-center gap-2 ps-1 text-[14px] font-medium">
            <CheckIcon className="size-4" />
            {selected.size === 0 ? (
              <Trans>Choose things</Trans>
            ) : (
              <Trans>
                <span className="tabular-nums">{fmt.num(selected.size)}</span> selected
              </Trans>
            )}
          </span>
          <Button size="small" isDisabled={selected.size === 0} onPress={() => void takeOff()}>
            {t`Take ${isolate(name)} off`}
          </Button>
          <BulkTagButtons
            thingIds={[...selected]}
            accountId={accountId}
            canCreate={canCreate}
            onDone={stop}
          />
          <Button size="small" variant="ghost" onPress={stop}>
            <Trans>Done</Trans>
          </Button>
        </div>
      ) : null}
      <ListSurface
        label={heading}
        search={
          canEdit && !selecting && rows.length
            ? {
                end: (
                  <Button size="small" variant="secondary" onPress={() => setSelecting(true)}>
                    <Trans>Select</Trans>
                  </Button>
                ),
              }
            : {}
        }
        query={query}
        filters={[
          ...((locations.data?.length ?? 0) > 1 ? [f.location()] : []),
          f.type(),
          f.state(['uncertain', 'draft', 'ended', 'archived']),
          f.brand(),
          f.belongsTo(),
        ]}
        groups={[
          { value: 'none', label: t`None` },
          { value: 'type', label: t`Type`, short: t`by type` },
        ]}
        surface="things"
        getKey={(x) => x.id}
        groupOf={(x, group) =>
          group === 'type'
            ? { key: x.type?.id ?? '__none', label: typeName(x.type) ?? <Trans>No type</Trans> }
            : null
        }
        renderRow={(x) => (
          <ThingRowView
            thing={x}
            showPath
            leading={
              selecting ? (
                <label className="grid size-11 shrink-0 cursor-pointer place-items-center ps-2">
                  <input
                    type="checkbox"
                    checked={selected.has(x.id)}
                    onChange={() => toggle(x.id)}
                    aria-label={t`Select ${x.name ?? ''}`}
                    className="size-5 accent-ink"
                  />
                </label>
              ) : undefined
            }
          />
        )}
        empty={<EmptyState title={<Trans>Nothing here yet</Trans>} />}
      />
    </Section>
  );
}
