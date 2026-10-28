/**
 * The pickers the thing sheets share. All are the app's Combobox (never a native select):
 * type (with its icon), brand, vendor, currency, and "where" (a place or a container, in this or
 * another location you can write to).
 *
 * Which account's registries a location uses: the server doesn't send a location's owner
 * account yet (a contract question for task 11/13). Until it does, `useLocationAccountId` takes
 * `ownerAccountId` when present, else your own account for a location you own, else the one
 * other account you can see.
 */
import { useLingui } from '@lingui/react/macro';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { composeRenderProps, type Key, ListBoxItem } from 'react-aria-components';
import {
  inventoryApi,
  useAccounts,
  useCurrencies,
  usePlaces,
  useThings,
  useTypes,
} from '@/api/inventory/queries';
import type { MoveTarget, TypeNode } from '@/api/inventory/types';
import { useLocations } from '@/api/queries';
import type { LocationDetail, LocationSummary } from '@/api/types';
import { CheckIcon } from '@/components/icons';
import { useErrorText } from '@/components/page';
import { flattenTree } from '@/components/places/tree';
import { TypeIcon } from '@/components/type-icon';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { toast } from '@/components/ui/toast';
import { useLocationName } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { useTypeName } from './names';

export function useLocationAccountId(location: LocationSummary | LocationDetail | undefined) {
  const accounts = useAccounts();
  if (!location) return '';
  const explicit = (location as { ownerAccountId?: string }).ownerAccountId;
  if (explicit) return explicit;
  const list = accounts.data?.accounts ?? [];
  const own = list.find((a) => a.isOwn);
  if (location.role === 'owner' || location.kind === 'personal') return own?.id ?? '';
  const others = list.filter((a) => !a.isOwn);
  return others.length === 1 ? (others[0]?.id ?? '') : (own?.id ?? '');
}

type IconOption = ComboboxOption & { icon?: string | null };

function IconItem({ item }: { item: IconOption }) {
  return (
    <ListBoxItem
      id={item.id}
      textValue={item.label}
      className={composeRenderProps('', () =>
        cn(
          'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] leading-snug outline-none data-focused:bg-sunken',
        ),
      )}
    >
      {({ isSelected }) => (
        <>
          <TypeIcon icon={item.icon} className="size-[18px] text-ink-2" />
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="[overflow-wrap:anywhere]">{item.label}</span>
            {item.description ? (
              <span className="text-small text-ink-3 [overflow-wrap:anywhere]">
                {item.description}
              </span>
            ) : null}
          </span>
          <span className="grid size-5 shrink-0 place-items-center text-ok">
            {isSelected ? <CheckIcon /> : null}
          </span>
        </>
      )}
    </ListBoxItem>
  );
}

/** Types a thing can have: no field groups, nothing archived. */
export function useTypeOptions(accountId: string) {
  const types = useTypes(accountId);
  const typeName = useTypeName();
  const list = (types.data?.types ?? []).filter((t) => !t.isFieldGroup && !t.archivedAt);
  const byId = new Map(list.map((t) => [t.id, t]));
  const options: IconOption[] = list
    .map((t) => {
      const parent = t.parentId ? byId.get(t.parentId) : undefined;
      return {
        id: t.id,
        label: typeName(t),
        icon: t.icon,
        ...(parent ? { description: typeName(parent) } : {}),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  return { options, byId, isPending: types.isPending };
}

export function TypePicker({
  accountId,
  value,
  onChange,
  label,
  errorMessage,
  exclude,
}: {
  accountId: string;
  value: string | null;
  onChange: (id: string | null, type: TypeNode | undefined) => void;
  label: ReactNode;
  errorMessage?: string;
  exclude?: string;
}) {
  const { t } = useLingui();
  const { options, byId } = useTypeOptions(accountId);
  return (
    <Combobox<IconOption>
      label={label}
      items={options.filter((o) => o.id !== exclude)}
      selectedKey={value}
      onSelectionChange={(k: Key | null) =>
        onChange(k ? String(k) : null, k ? byId.get(String(k)) : undefined)
      }
      placeholder={t`Search types`}
      {...(errorMessage ? { errorMessage, isInvalid: true } : {})}
    >
      {(item) => <IconItem item={item} />}
    </Combobox>
  );
}

function useRegistry(kind: 'brands' | 'vendors', accountId: string) {
  return useQuery({
    queryKey: ['registry', kind, accountId, { limit: 200 }],
    queryFn: () => inventoryApi.registry(kind, accountId, { limit: 200 }),
    enabled: !!accountId,
  });
}

/** The "Add “…”" option's key: never an id. */
const ADD = '__add__';

const sameName = (a: string, b: string) =>
  a.trim().localeCompare(b.trim(), undefined, { sensitivity: 'base' }) === 0;

/**
 * A brand or shop of the account. With `addIn` (a location you edit things in), a brand that
 * isn't there yet can be typed: "Add “…”" finds or makes it (POST /locations/:id/brands, #349),
 * as capture and the assistant do, and picks it.
 */
export function RegistryPicker({
  kind,
  accountId,
  value,
  onChange,
  label,
  addIn,
}: {
  kind: 'brands' | 'vendors';
  accountId: string;
  value: string | null;
  onChange: (id: string | null) => void;
  label: ReactNode;
  addIn?: string;
}) {
  const { t } = useLingui();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const q = useRegistry(kind, accountId);
  const items = (q.data?.items ?? []).map((x) => ({ id: x.id, label: x.name }));
  const chosen = items.find((i) => i.id === value)?.label ?? '';
  const [input, setInput] = useState(chosen);
  // The chosen name fills the box once it is known, and again when the value changes.
  useEffect(() => setInput(chosen), [chosen]);
  const typed = input.trim();
  const canAdd =
    kind === 'brands' && !!addIn && typed !== '' && !items.some((i) => sameName(i.label, typed));
  const add = useMutation({
    mutationFn: (name: string) => inventoryApi.brandByName(addIn as string, name),
    onSuccess: ({ item }) => {
      qc.setQueryData(['registry', kind, accountId, { limit: 200 }], (old: typeof q.data) =>
        old && !old.items.some((x) => x.id === item.id)
          ? { ...old, items: [...old.items, item] }
          : old,
      );
      void qc.invalidateQueries({ queryKey: ['registry', kind] });
      setInput(item.name);
      onChange(item.id);
    },
    onError: (e) => toast({ title: errorText(e), tone: 'danger' }),
  });
  return (
    <Combobox
      label={label}
      items={canAdd ? [...items, { id: ADD, label: t`Add “${typed}”` }] : items}
      selectedKey={value}
      inputValue={input}
      onInputChange={setInput}
      onSelectionChange={(k) => {
        if (k === ADD) add.mutate(typed);
        else onChange(k ? String(k) : null);
      }}
      isDisabled={add.isPending}
      placeholder={kind === 'brands' ? t`Search brands` : t`Search shops`}
    />
  );
}

export function CurrencyPicker({
  value,
  onChange,
  label,
}: {
  value: string | null;
  onChange: (code: string | null) => void;
  label: ReactNode;
}) {
  const q = useCurrencies();
  const items = (q.data?.currencies ?? [])
    .filter((c) => c.enabled)
    .map((c) => ({ id: c.code, label: c.code, description: c.name }));
  return (
    <Combobox
      label={label}
      items={items}
      selectedKey={value}
      onSelectionChange={(k) => onChange(k ? String(k) : null)}
    />
  );
}

export type WhereValue = { locationId: string; target: MoveTarget };

/** Containers the picker reads at most: 10 pages of 200. */
const MAX_CONTAINER_PAGES = 10;

const keyOf = (t: MoveTarget) => ('placeId' in t ? `p:${t.placeId}` : `c:${t.containerId}`);
const targetOf = (k: string): MoveTarget =>
  k.startsWith('p:') ? { placeId: k.slice(2) } : { containerId: k.slice(2) };

/**
 * Where a thing goes: a location you can write to, then a room, spot or container in it.
 * `exclude` leaves a thing (and so a move into itself) out of the containers.
 */
export function WherePicker({
  value,
  onChange,
  allowOtherLocations = true,
  exclude,
  label,
}: {
  value: WhereValue;
  onChange: (v: WhereValue) => void;
  allowOtherLocations?: boolean;
  exclude?: string;
  label?: ReactNode;
}) {
  const { t } = useLingui();
  const locationName = useLocationName();
  const locations = useLocations();
  const writable = (locations.data ?? []).filter((l) => l.role !== 'viewer');
  const places = usePlaces(value.locationId);
  // The location's containers, every page: the server's container filter, so a box is offered
  // however many other things the location has.
  const things = useThings({ locationId: value.locationId, container: 1, limit: 200 });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = things;
  const pages = things.data?.pages.length ?? 0;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && pages < MAX_CONTAINER_PAGES) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, pages]);

  const tree = places.data?.places ?? [];
  const byPlace = new Map(tree.map((p) => [p.id, p]));
  const pathOf = (id: string | null): string[] => {
    const out: string[] = [];
    let cur = id ? byPlace.get(id) : undefined;
    while (cur) {
      out.unshift(cur.name);
      cur = cur.parentId ? byPlace.get(cur.parentId) : undefined;
    }
    return out;
  };
  const placeOptions: IconOption[] = flattenTree(tree).map(({ place: p }) => ({
    id: `p:${p.id}`,
    label: p.isUnplaced ? t`Unplaced` : p.name,
    icon: p.icon ?? 'lucide:map-pin',
    ...(p.parentId ? { description: pathOf(p.parentId).join(' › ') } : {}),
  }));
  const containerOptions: IconOption[] = (things.data?.pages.flatMap((pg) => pg.items) ?? [])
    .filter((th) => th.id !== exclude && !th.path.some((s) => s.id === exclude) && th.isContainer)
    .map((th) => ({
      id: `c:${th.id}`,
      label: th.name ?? t`Untitled`,
      icon: th.type?.icon ?? 'lucide:package',
      description: th.path.map((s) => (s.isUnplaced ? t`Unplaced` : s.name)).join(' › '),
    }));

  return (
    <div className="grid gap-3">
      {allowOtherLocations && writable.length > 1 ? (
        <Combobox
          label={t`Location`}
          items={writable.map((l) => ({ id: l.id, label: locationName(l) }))}
          selectedKey={value.locationId}
          onSelectionChange={(k) => {
            if (!k || String(k) === value.locationId) return;
            onChange({ locationId: String(k), target: { placeId: '' } });
          }}
        />
      ) : null}
      <Combobox<IconOption>
        label={label ?? t`Room, spot or box`}
        items={[...placeOptions, ...containerOptions]}
        selectedKey={
          'placeId' in value.target && !value.target.placeId ? null : keyOf(value.target)
        }
        onSelectionChange={(k) => {
          if (k) onChange({ locationId: value.locationId, target: targetOf(String(k)) });
        }}
        // The current place's name fills the box once its option arrives; typing before that
        // would be mixed into it.
        isDisabled={places.isPending || things.isPending}
        placeholder={t`Search rooms, spots and boxes`}
      >
        {(item) => <IconItem item={item} />}
      </Combobox>
    </div>
  );
}

/** A target that has been chosen (a location switch leaves it empty until a place is picked). */
export const isChosen = (t: MoveTarget) => ('placeId' in t ? !!t.placeId : !!t.containerId);
