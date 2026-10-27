/**
 * A thing's or a place's page from the phone's copy (D36,
 * D188): when the server can't be reached, `/t/$id` and `/p/$id` show what the
 * snapshot holds, "as of last sync": the name, short ID, where it is, the derived states and the
 * loan line ("With Murdock · due 17 Oct"), its tags, a container's or place's contents, and
 * "Details need a connection" for the rest. Only tags change here (#209: queued as a `tag_things`
 * op); every other action waits for the server, as the offline matrix says.
 *
 *   const off = useOfflinePage(query);   if (off) return <OfflineThingPage id={id} />;
 */
import {
  can,
  naturalCompare,
  type Role,
  type SnapPlace,
  type SnapTag,
  type SnapThing,
} from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { isApiError } from '@/api/client';
import type { BoxNode, PathStep, PlaceNode, ThingRow, ThingTag } from '@/api/inventory/types';
import { placePath } from '@/components/capture/target';
import { KeptExtras } from '@/components/device/kept-extras';
import { ChevronEndIcon } from '@/components/icons';
import { IdChip } from '@/components/id-chip';
import { List, LoadingRows, Notice, Page, Pill, Section } from '@/components/page';
import { StatusPill } from '@/components/status-pill';
import { TagChips } from '@/components/tags/chip';
import { TagsEditor } from '@/components/tags/lazy';
import { tagsOfSnap } from '@/components/tags/offline';
import { useFormat } from '@/lib/format';
import { useOnline } from '@/lib/online';
import { formatLocale, usePrefs } from '@/lib/prefs';
import { asOfTime } from '@/offline/as-of';
import { useOffline } from '@/offline/provider';
import type { OfflineStore } from '@/offline/store';
import { usePlaceName } from './labels';
import { PathText, rowLink, ThingRowView } from './rows';
import { PlaceTree } from './tree';

/**
 * Whether a page should answer from the phone: there is a copy, the page's own read has nothing,
 * and the browser is offline or the server couldn't be reached.
 */
export function useOfflinePage(query: { data?: unknown; error: unknown }): boolean {
  const online = useOnline();
  const store = useOffline()?.store;
  const unreachable = isApiError(query.error) && query.error.code === 'offline';
  return !!store && query.data === undefined && (!online || unreachable);
}

const stepOf = (p: SnapPlace): PathStep => ({
  id: p.id,
  name: p.name,
  kind: 'place',
  isUnplaced: p.isUnplaced,
});

/** A phone row in the server's row shape, so the lists read like online. */
function rowOf(t: SnapThing, path: PathStep[], tags: readonly SnapTag[] = []): ThingRow {
  return {
    id: t.id,
    locationId: t.locationId,
    shortCode: t.shortCode,
    name: t.name,
    type: null,
    quantity: Number(t.quantity) || 1,
    lifecycle: t.lifecycle,
    derivedState: [
      ...(t.locationUncertain ? (['uncertain'] as const) : []),
      ...(t.reviewState === 'draft' ? (['draft'] as const) : []),
      ...(t.derived ?? []),
    ],
    path,
    containerThumbUrl: null,
    thumbUrl: null,
    lastSeenAt: t.lastSeenAt,
    isContainer: t.isContainer,
    tags: tagsOfSnap(t.tagIds, tags),
  };
}

async function pathOf(store: OfflineStore, t: SnapThing, places: SnapPlace[]): Promise<PathStep[]> {
  const box = t.containerId ? await store.thing(t.containerId) : undefined;
  const steps = placePath(places, box ? box.placeId : t.placeId).map(stepOf);
  return box
    ? [...steps, { id: box.id, name: box.name ?? '', kind: 'container', isUnplaced: false }]
    : steps;
}

type Copy = { asOf: string | null; locationName: string | null };

function useCopy<T>(key: string, id: string, load: (store: OfflineStore) => Promise<T>) {
  const store = useOffline()?.store;
  return useQuery({
    queryKey: ['offline-page', key, id],
    queryFn: async () => (store ? load(store) : null),
    enabled: !!store,
    networkMode: 'always',
    staleTime: 0,
    gcTime: 0,
  });
}

/**
 * A location's place tree from the phone's copy, in the shapes the online tree takes: its places,
 * and its boxes as leaves (a live container directly in a place, with what is in it counted), at
 * most 50 per place, A to Z, as the server sends them.
 */
export async function offlineTree(
  store: OfflineStore,
  places: readonly SnapPlace[],
): Promise<{ places: PlaceNode[]; boxes: BoxNode[] }> {
  const live = places.filter((p) => !p.deleted);
  const nodes: PlaceNode[] = [];
  const boxes: BoxNode[] = [];
  for (const p of live) {
    const here = (await store.contentsOf({ placeId: p.id })).filter((x) => !x.deleted);
    const mine: BoxNode[] = [];
    for (const x of here) {
      const inside = (await store.contentsOf({ containerId: x.id })).filter((c) => !c.deleted);
      if (!x.isContainer && inside.length === 0) continue;
      mine.push({
        id: x.id,
        placeId: p.id,
        name: x.name,
        icon: null,
        shortCode: x.shortCode,
        contentCount: inside.length,
      });
    }
    // As the server sorts things: lower(name), then the id.
    const key = (b: BoxNode) => (b.name ?? '').toLowerCase();
    mine.sort((a, b) => naturalCompare(key(a), key(b)) || (a.id < b.id ? -1 : 1));
    boxes.push(...mine.slice(0, 50));
    nodes.push({
      id: p.id,
      parentId: p.parentId,
      name: p.name,
      kindKey: p.kindKey,
      icon: p.icon,
      sort: p.sort,
      isUnplaced: p.isUnplaced,
      shortCode: null,
      thingCount: here.length,
      childCount: live.filter((c) => c.parentId === p.id).length,
      createdAt: p.createdAt ?? '',
      boxCount: mine.length,
    });
  }
  return { places: nodes, boxes };
}

async function copyOf(store: OfflineStore, locationId: string): Promise<Copy> {
  const [asOf, locations] = await Promise.all([store.asOf(), store.locations()]);
  return { asOf, locationName: locations.find((l) => l.id === locationId)?.name ?? null };
}

/** "Offline · as of last sync, 14:02 · Details need a connection." */
function AsOf({ asOf }: { asOf: string | null }) {
  const { t } = useLingui();
  const { locale, digits } = usePrefs();
  const time = asOf ? asOfTime(asOf, formatLocale(locale, digits)) : null;
  return (
    <Notice
      tone="info"
      title={time ? t`On this phone · as of last sync, ${time}` : t`On this phone`}
    >
      <Trans>Details need a connection.</Trans>
    </Notice>
  );
}

function Missing({ title }: { title: string }) {
  return (
    <Page title={title} back="/">
      <Notice tone="warn" title={<Trans>Not on this phone</Trans>}>
        <Trans>It isn't in this phone's copy. It opens when you're back online.</Trans>
      </Notice>
    </Page>
  );
}

function ThingList({ label, rows }: { label: string; rows: ThingRow[] }) {
  return (
    <List aria-label={label}>
      {rows.map((r) => (
        <li key={r.id}>
          <ThingRowView thing={r} />
        </li>
      ))}
    </List>
  );
}

export function OfflineThingPage({ id }: { id: string }) {
  const { t } = useLingui();
  const f = useFormat();
  const q = useCopy('thing', id, async (store) => {
    const thing = await store.thing(id);
    if (!thing || thing.deleted) return null;
    const places = await store.placesOf(thing.locationId);
    const inside = thing.isContainer ? await store.contentsOf({ containerId: id }) : [];
    const tags = await store.tags();
    const location = (await store.locations()).find((l) => l.id === thing.locationId);
    return {
      thing,
      tags,
      location: location ?? null,
      path: await pathOf(store, thing, places),
      inside: inside.filter((x) => !x.deleted).map((x) => rowOf(x, [], tags)),
      ...(await copyOf(store, thing.locationId)),
    };
  });
  if (q.isPending)
    return (
      <Page title={t`Thing`} back="/">
        <LoadingRows rows={3} />
      </Page>
    );
  const found = q.data;
  if (!found) return <Missing title={t`Thing`} />;
  const { thing, path, inside, asOf, locationName, tags, location } = found;
  const loan = thing.loan;
  // The person's name isolated in the sentence (UI step-4 review L9).
  const who = <bdi>{loan?.personName ?? ''}</bdi>;
  const due = loan?.dueOn ? f.day(loan.dueOn) : null;
  const loanLine = !loan ? null : loan.direction === 'out' ? (
    due ? (
      <Trans>
        With {who} · due {due}
      </Trans>
    ) : (
      <Trans>With {who}</Trans>
    )
  ) : due ? (
    <Trans>
      From {who} · due back {due}
    </Trans>
  ) : (
    <Trans>From {who}</Trans>
  );
  const row = rowOf(thing, path, tags);
  return (
    <Page title={thing.name ? <bdi>{thing.name}</bdi> : t`Untitled draft`} back="/">
      <div className="grid gap-4">
        <AsOf asOf={asOf} />
        <div className="grid gap-2">
          <span className="flex flex-wrap items-center gap-1.5">
            <IdChip code={thing.shortCode} />
            {row.derivedState.map((s) => (
              <StatusPill key={s} state={s} />
            ))}
            {Number(thing.quantity) > 1 ? <Pill>× {f.num(Number(thing.quantity))}</Pill> : null}
          </span>
          {locationName || path.length ? (
            <span className="text-small text-ink-2 [overflow-wrap:anywhere]">
              {locationName ? <bdi>{locationName}</bdi> : null}
              {locationName && path.length ? <span aria-hidden="true"> › </span> : null}
              <PathText path={path} />
            </span>
          ) : null}
          {loanLine ? <p className="m-0 [overflow-wrap:anywhere]">{loanLine}</p> : null}
        </div>
        <OfflineThingTags
          thingId={thing.id}
          locationId={thing.locationId}
          accountId={location?.ownerAccountId ?? ''}
          role={location?.role ?? 'viewer'}
          tags={row.tags}
        />
        {inside.length ? (
          <Section title={<Trans>Inside</Trans>}>
            <ThingList label={t`Inside ${thing.name ?? ''}`} rows={inside} />
          </Section>
        ) : null}
        {/* A location kept offline (D159): its money and documents, from the device. */}
        <KeptExtras thingId={thing.id} />
      </div>
    </Page>
  );
}

export function OfflinePlacePage({ id }: { id: string }) {
  const { t } = useLingui();
  const placeName = usePlaceName();
  const q = useCopy('place', id, async (store) => {
    for (const loc of await store.locations()) {
      const places = await store.placesOf(loc.id);
      const place = places.find((p) => p.id === id && !p.deleted);
      if (!place) continue;
      const things = await store.contentsOf({ placeId: id });
      const tags = await store.tags();
      return {
        place,
        path: placePath(places, place.parentId).map(stepOf),
        children: places.filter((p) => p.parentId === id && !p.deleted),
        tree: await offlineTree(store, places),
        things: things.filter((x) => !x.deleted && !x.containerId).map((x) => rowOf(x, [], tags)),
        ...(await copyOf(store, loc.id)),
      };
    }
    return null;
  });
  if (q.isPending)
    return (
      <Page title={t`Place`} back="/">
        <LoadingRows rows={3} />
      </Page>
    );
  const found = q.data;
  if (!found) return <Missing title={t`Place`} />;
  const { place, path, children, tree, things, asOf, locationName } = found;
  const name = placeName(stepOf(place));
  return (
    <Page title={<bdi>{name}</bdi>} back="/">
      <div className="grid gap-4">
        <AsOf asOf={asOf} />
        {locationName || path.length ? (
          <span className="text-small text-ink-2 [overflow-wrap:anywhere]">
            {locationName ? <bdi>{locationName}</bdi> : null}
            {locationName && path.length ? <span aria-hidden="true"> › </span> : null}
            <PathText path={path} />
          </span>
        ) : null}
        <PlaceTree places={tree.places} boxes={tree.boxes} currentId={place.id} />
        {children.length ? (
          <Section title={<Trans>Places</Trans>}>
            <List aria-label={t`Places in ${name}`}>
              {children.map((p) => (
                <li key={p.id}>
                  <Link to="/p/$id" params={{ id: p.id }} className={rowLink}>
                    <span className="min-w-0 flex-1 font-semibold text-[15px] [overflow-wrap:anywhere]">
                      <bdi>{placeName(p)}</bdi>
                    </span>
                    <ChevronEndIcon className="size-5 shrink-0 text-ink-3" />
                  </Link>
                </li>
              ))}
            </List>
          </Section>
        ) : null}
        {things.length ? (
          <Section title={<Trans>Things</Trans>}>
            <ThingList label={t`Things in ${name}`} rows={things} />
          </Section>
        ) : (
          <p className="m-0 text-small text-ink-2">
            <Trans>Nothing here in this phone's copy.</Trans>
          </p>
        )}
      </div>
    </Page>
  );
}

/**
 * A thing's tags on the phone (#209): its chips, and for anyone who edits things there the editor
 * as online (./tags/editors.tsx, on demand), queued as one `tag_things` op that syncs later.
 */
function OfflineThingTags({
  thingId,
  locationId,
  accountId,
  role,
  tags,
}: {
  thingId: string;
  locationId: string;
  accountId: string;
  role: Role;
  tags: ThingTag[];
}) {
  const canEdit = can(role, 'things.edit') && !!accountId;
  if (!canEdit && tags.length === 0) return null;
  return (
    <Section title={<Trans>Tags</Trans>}>
      {canEdit ? (
        <TagsEditor
          thingId={thingId}
          locationId={locationId}
          accountId={accountId}
          tags={tags}
          canCreate={can(role, 'tags.create')}
          fallback={<TagChips tags={tags} />}
        />
      ) : (
        <TagChips tags={tags} />
      )}
    </Section>
  );
}
