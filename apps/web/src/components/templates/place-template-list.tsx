/**
 * Settings → Account → Templates → Places (#238): the account's own place templates, beside the
 * built-in cube shelves, bookcase and chest. Each gives a layout (a grid of cubes, levels or
 * drawers), the furniture's kind and its compartments', how they are named and, optionally,
 * how their codes derive from the furniture's own code. List-standard (search in the URL);
 * owners and admins add, edit and delete them, shared with locations they administer, as thing
 * templates are (D177).
 */
import {
  BUILTIN_PLACE_TEMPLATES,
  layoutProblem,
  PLACE_LAYOUT_LIMITS,
  type PlaceLayout,
  patternProblem,
} from '@kept/shared';
import { plural } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { api, ifMatch } from '@/api/client';
import { inventoryPaths as p } from '@/api/inventory/paths';
import { usePlaceKinds } from '@/api/inventory/queries';
import type {
  AccountPlaceTemplate,
  PlaceTemplateBody,
  PlaceTemplateLayout,
} from '@/api/inventory/types';
import { useLocations } from '@/api/queries';
import { CopyIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { ListSurface } from '@/components/list-surface';
import { EmptyState, useErrorText } from '@/components/page';
import {
  placeTemplateKeys,
  useBuiltinTemplateName,
  useDefaultCompartmentName,
} from '@/components/places/furniture';
import { usePlaceKindName } from '@/components/places/labels';
import { Tile } from '@/components/places/rows';
import { Sheet } from '@/components/places/sheet';
import { type AccountScope, useWholeList } from '@/components/registries/api';
import { TypeIcon } from '@/components/type-icon';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { DialogFooter } from '@/components/ui/dialog';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectItem } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { useFormat } from '@/lib/format';
import { useLocationName } from '@/lib/labels';
import { useListState } from '@/lib/url-state';

const placeTemplatesApi = {
  list: (accountId: string) =>
    api.get<{ items: AccountPlaceTemplate[] }>(p.accountPlaceTemplates(accountId)),
  create: (accountId: string, body: PlaceTemplateBody) =>
    api.post<AccountPlaceTemplate>(p.accountPlaceTemplates(accountId), body),
  update: (id: string, body: Partial<PlaceTemplateBody>, rowVersion: number) =>
    api.patch<AccountPlaceTemplate>(p.placeTemplate(id), body, ifMatch(rowVersion)),
  remove: (id: string) => api.del(p.placeTemplate(id)),
};

/** "4 × 2", "6 shelves", "9 drawers". */
function useLayoutText() {
  const { t } = useLingui();
  const fmt = useFormat();
  return (layout: PlaceTemplateLayout): string => {
    if (layout.kind === 'grid') {
      const across = fmt.num(layout.across);
      const up = fmt.num(layout.up);
      return t`${across} × ${up} cubes`;
    }
    const count = layout.count;
    return layout.kind === 'levels'
      ? plural(count, { one: '# shelf', other: '# shelves' })
      : plural(count, { one: '# drawer', other: '# drawers' });
  };
}

export function PlaceTemplateList({ scope }: { scope: AccountScope }) {
  const { t } = useLingui();
  const [list] = useListState();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const errorText = useErrorText();
  const layoutText = useLayoutText();
  const builtinName = useBuiltinTemplateName();
  const [editing, setEditing] = useState<AccountPlaceTemplate | null | undefined>(undefined);
  const query = useWholeList(
    placeTemplateKeys.account(scope.accountId),
    () => placeTemplatesApi.list(scope.accountId).then((r) => r.items),
    list.q,
    (x: AccountPlaceTemplate) => x.name,
    !!scope.accountId,
  );
  const remove = useMutation({
    mutationFn: (x: AccountPlaceTemplate) => placeTemplatesApi.remove(x.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: placeTemplateKeys.all }),
    onError: (e) =>
      toast({ title: t`Couldn't delete it`, description: errorText(e), tone: 'danger' }),
  });
  const askRemove = async (x: AccountPlaceTemplate) => {
    const name = x.name;
    const ok = await confirm({
      title: t`Delete ${name}?`,
      body: t`Furniture already made from it stays as it is.`,
      confirmLabel: t`Delete`,
      destructive: true,
    });
    if (ok) remove.mutate(x);
  };
  const none = !list.q && query.isSuccess && (query.data?.pages[0]?.items.length ?? 0) === 0;
  const newButton = (
    <Button variant="secondary" className="justify-self-start" onPress={() => setEditing(null)}>
      <PlusIcon className="size-4" />
      <Trans>New place template</Trans>
    </Button>
  );
  const builtins = BUILTIN_PLACE_TEMPLATES.map((b) => builtinName(b)).join(', ');

  return (
    <div className="grid gap-3">
      <p className="m-0 text-small text-ink-2 [overflow-wrap:anywhere]">
        <Trans>Built in: {builtins}.</Trans>
      </p>
      <ListSurface<AccountPlaceTemplate>
        label={t`Place templates`}
        search={{ label: t`Search place templates`, placeholder: t`Search place templates` }}
        query={query}
        getKey={(x) => x.id}
        empty={
          <EmptyState
            icon={<CopyIcon />}
            title={<Trans>No place templates of your own yet</Trans>}
            action={scope.canManage ? newButton : undefined}
          >
            <Trans>
              Make one for furniture you have more than one of, with its compartments, their names
              and their codes.
            </Trans>
          </EmptyState>
        }
        renderRow={(x) => {
          const where = x.locations.map((l) => l.name).join(', ');
          const size = layoutText(x.layout);
          return (
            <div className="flex min-h-14 items-center gap-3 px-3.5 py-2.5">
              <Tile>
                <TypeIcon icon="lucide:library-big" />
              </Tile>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="font-semibold text-[15px] [overflow-wrap:anywhere]">
                  <bdi>{x.name}</bdi>
                </span>
                <span className="text-small text-ink-2 [overflow-wrap:anywhere]">{size}</span>
                <span className="text-small text-ink-2 [overflow-wrap:anywhere]">
                  <Plural
                    value={x.locations.length}
                    one="Shared with 1 location"
                    other="Shared with # locations"
                  />
                  {': '}
                  <bdi>{where}</bdi>
                </span>
              </span>
              {scope.canManage ? (
                <span className="flex shrink-0 gap-1">
                  <Button variant="secondary" size="small" onPress={() => setEditing(x)}>
                    <Trans>Edit</Trans>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t`Delete ${x.name}`}
                    onPress={() => void askRemove(x)}
                  >
                    <TrashIcon />
                  </Button>
                </span>
              ) : null}
            </div>
          );
        }}
      />
      {scope.canManage && !none ? newButton : null}
      <Sheet
        isOpen={editing !== undefined}
        onOpenChange={(o) => {
          if (!o) setEditing(undefined);
        }}
        title={editing ? <Trans>Edit place template</Trans> : <Trans>New place template</Trans>}
        wide
      >
        <PlaceTemplateForm
          key={editing ? `${editing.id}:${editing.rowVersion}` : 'new'}
          accountId={scope.accountId}
          template={editing ?? null}
          onDone={() => setEditing(undefined)}
        />
      </Sheet>
    </div>
  );
}

type Draft = {
  name: string;
  kind: PlaceTemplateLayout['kind'];
  across: string;
  up: string;
  count: string;
  kindKey: string;
  compartmentKindKey: string;
  compartmentName: string | null;
  codePattern: string;
  locationIds: string[];
};

const COMPARTMENT_KIND = { grid: 'cube', levels: 'shelf', drawers: 'drawer' } as const;

function draftOf(x: AccountPlaceTemplate | null): Draft {
  const l = x?.layout;
  return {
    name: x?.name ?? '',
    kind: l?.kind ?? 'grid',
    across: l?.kind === 'grid' ? String(l.across) : '2',
    up: l?.kind === 'grid' ? String(l.up) : '4',
    count: l && l.kind !== 'grid' ? String(l.count) : '6',
    kindKey: x?.kindKey ?? 'furniture',
    compartmentKindKey: x?.compartmentKindKey ?? 'cube',
    compartmentName: x?.compartmentName ?? null,
    codePattern: x?.codePattern ?? '',
    locationIds: x?.locations.map((loc) => loc.id) ?? [],
  };
}

const layoutOf = (d: Draft): PlaceLayout =>
  d.kind === 'grid'
    ? { kind: 'grid', across: Number(d.across), up: Number(d.up) }
    : { kind: d.kind, count: Number(d.count) };

/** Placeholders, put into sentences as values so the catalogues never parse them. */
const N = '{n}';
const ROW = '{row}';
const COL = '{col}';

function PlaceTemplateForm({
  accountId,
  template,
  onDone,
}: {
  accountId: string;
  template: AccountPlaceTemplate | null;
  onDone: () => void;
}) {
  const { t } = useLingui();
  const fmt = useFormat();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const kindName = usePlaceKindName();
  const defaultName = useDefaultCompartmentName();
  const locationName = useLocationName();
  const locations = useLocations();
  const kinds = usePlaceKinds(accountId);
  const [d, setD] = useState<Draft>(() => draftOf(template));
  const [errors, setErrors] = useState<
    Partial<Record<'name' | 'size' | 'names' | 'codes' | 'locations', string>>
  >({});
  const set = (patch: Partial<Draft>) => {
    setD((prev) => ({ ...prev, ...patch }));
    setErrors({});
  };
  const shareable = (locations.data ?? []).filter(
    (l) => l.ownerAccountId === accountId && (l.role === 'owner' || l.role === 'admin'),
  );
  const locationItems = shareable.map((l) => ({ id: l.id, name: locationName(l) }));
  const kindItems = (kinds.data?.placeKinds ?? [])
    .filter((k) => !k.archivedAt)
    .map((k) => ({ id: k.key, name: k.name ?? kindName(k.key) }));
  const names = d.compartmentName ?? defaultName(d.kind);

  const save = useMutation({
    mutationFn: () => {
      const body: PlaceTemplateBody = {
        name: d.name.trim(),
        layout: layoutOf(d),
        kindKey: d.kindKey,
        compartmentKindKey: d.compartmentKindKey,
        compartmentName: names.trim(),
        codePattern: d.codePattern.trim() ? d.codePattern.trim() : null,
        locationIds: d.locationIds,
      };
      return template
        ? placeTemplatesApi.update(template.id, body, template.rowVersion)
        : placeTemplatesApi.create(accountId, body);
    },
    onSuccess: async (saved) => {
      await qc.invalidateQueries({ queryKey: placeTemplateKeys.all });
      const name = saved.name;
      toast({ title: template ? t`Saved ${name}` : t`Added ${name}`, tone: 'ok' });
      onDone();
    },
    onError: (e) => toast({ title: errorText(e), tone: 'danger' }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!d.name.trim()) next.name = t`Give it a name, like Wide cube shelf.`;
    if (layoutProblem(layoutOf(d))) {
      const side = fmt.num(PLACE_LAYOUT_LIMITS.side);
      const most = fmt.num(PLACE_LAYOUT_LIMITS.cells);
      const count = fmt.num(PLACE_LAYOUT_LIMITS.count);
      next.size = t`A grid is 1 to ${side} across and up, at most ${most} cubes; shelves and drawers 1 to ${count}.`;
    }
    if (patternProblem(names, { code: false })) {
      next.names = t`Use ${N} for the number, or ${ROW} and ${COL}.`;
    }
    if (d.codePattern.trim() && patternProblem(d.codePattern, { code: true, distinct: true })) {
      next.codes = t`Use ${N}, or ${ROW} and ${COL}, so each one gets its own code.`;
    }
    if (d.locationIds.length === 0) next.locations = t`Share it with at least one location.`;
    setErrors(next);
    if (Object.keys(next).length === 0) save.mutate();
  };

  const numeric = { inputMode: 'numeric' as const, dir: 'ltr' as const };
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <TextField
        label={t`Name`}
        value={d.name}
        maxLength={80}
        onChange={(v) => set({ name: v })}
        isInvalid={!!errors.name}
        errorMessage={errors.name}
        inputProps={{ dir: 'auto' }}
      />
      <Segmented
        label={t`Compartments`}
        value={d.kind}
        onChange={(kind) =>
          set({
            kind,
            compartmentKindKey: COMPARTMENT_KIND[kind],
            compartmentName: d.compartmentName,
          })
        }
        options={[
          { id: 'grid', label: t`Cubes` },
          { id: 'levels', label: t`Shelves` },
          { id: 'drawers', label: t`Drawers` },
        ]}
      />
      {d.kind === 'grid' ? (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t`Across`}
            value={d.across}
            onChange={(v) => set({ across: v.replace(/\D/g, '') })}
            isInvalid={!!errors.size}
            inputProps={numeric}
          />
          <TextField
            label={t`Up, standing upright`}
            value={d.up}
            onChange={(v) => set({ up: v.replace(/\D/g, '') })}
            isInvalid={!!errors.size}
            inputProps={numeric}
          />
        </div>
      ) : (
        <TextField
          label={t`How many`}
          value={d.count}
          onChange={(v) => set({ count: v.replace(/\D/g, '') })}
          isInvalid={!!errors.size}
          inputProps={numeric}
        />
      )}
      {errors.size ? (
        <p className="m-0 text-small text-danger" role="alert">
          {errors.size}
        </p>
      ) : null}
      <Select<(typeof kindItems)[number]>
        label={t`Kind of the furniture`}
        items={kindItems}
        value={d.kindKey}
        onChange={(key) => set({ kindKey: String(key) })}
      >
        {(item) => (
          <SelectItem id={item.id} textValue={item.name}>
            <bdi>{item.name}</bdi>
          </SelectItem>
        )}
      </Select>
      <Select<(typeof kindItems)[number]>
        label={t`Kind of each compartment`}
        items={kindItems}
        value={d.compartmentKindKey}
        onChange={(key) => set({ compartmentKindKey: String(key) })}
      >
        {(item) => (
          <SelectItem id={item.id} textValue={item.name}>
            <bdi>{item.name}</bdi>
          </SelectItem>
        )}
      </Select>
      <TextField
        label={t`Compartment names`}
        value={names}
        maxLength={120}
        description={t`${N} is the number, ${ROW} and ${COL} where it sits.`}
        onChange={(v) => set({ compartmentName: v })}
        isInvalid={!!errors.names}
        errorMessage={errors.names}
        inputProps={{ dir: 'auto' }}
      />
      <TextField
        label={t`Compartment codes (optional)`}
        value={d.codePattern}
        maxLength={100}
        placeholder="{parent}-F{col:02}{row:02}"
        onChange={(v) => set({ codePattern: v })}
        isInvalid={!!errors.codes}
        errorMessage={errors.codes}
        inputProps={{ dir: 'ltr' }}
      />
      <Select<(typeof locationItems)[number], 'multiple'>
        label={t`Share with`}
        selectionMode="multiple"
        items={locationItems}
        value={d.locationIds}
        onChange={(keys) => set({ locationIds: [...keys].map(String) })}
        description={t`Members of these locations can make furniture from it.`}
        {...(errors.locations ? { errorMessage: errors.locations, isInvalid: true } : {})}
      >
        {(item) => (
          <SelectItem id={item.id} textValue={item.name}>
            <bdi>{item.name}</bdi>
          </SelectItem>
        )}
      </Select>
      <DialogFooter>
        <Button variant="secondary" onPress={onDone}>
          <Trans>Cancel</Trans>
        </Button>
        <Button type="submit" isPending={save.isPending}>
          <Trans>Save</Trans>
        </Button>
      </DialogFooter>
    </form>
  );
}
