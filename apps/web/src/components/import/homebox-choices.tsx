/**
 * A Homebox import's choices before the check (D146):
 * the currency, asked only when the backup holds an amount (the ZIP has no currency: the
 * connection's, else the target's; another enabled one relabels the amounts, it doesn't convert
 * them), archived items, items with quantity 0 (kept where the type is one you run out of and
 * archived otherwise, set to 1, or left out), the "Insured" field, Homebox's empty starter places
 * and tags, the locations that look like boxes (brought in as boxes when ticked), each Homebox
 * type mapped to a Kept type, a new one named here, or no type, and each custom field added to its
 * type or kept in the notes. Saved on the run with If-Match (POST …/choices), then checked.
 *
 * Homebox 0.27's own names for its two types, `global.item` and `global.location`, read as
 * "Item" and "Location" here, as they do in Homebox; its catch-all type defaults to No type.
 *
 * The types and the boxes are list-standard lists (search, a filter, pages), in the URL.
 */
import { HB_GLOBAL_TYPE_NAMES, type HomeboxChoices } from '@kept/shared';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useMemo } from 'react';
import { useCurrencies, useTypes } from '@/api/inventory/queries';
import type { HomeboxConnection, HomeboxMappingHints } from '@/api/portability/types';
import type { FilterDef } from '@/components/filters/types';
import { ListSurface } from '@/components/list-surface';
import { List, Notice, Row } from '@/components/page';
import { useTypeName } from '@/components/things/names';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { TickBox } from '@/components/ui/tick-box';
import { useFormat } from '@/lib/format';
import { isNot, useListState } from '@/lib/url-state';
import { useMemoryPages } from './memory-list';

const NEW = '__new__';
const NONE = '__none__';
const fold = (s: string) => s.trim().toLocaleLowerCase();
const TYPE_NAME_MAX = 80;

type KeptType = { id: string; name: string };

/** A Homebox type's name as a person reads it: Homebox 0.27's `global.item` is "Item". */
export function useHomeboxTypeName() {
  const { t } = useLingui();
  const words: Record<string, string> = {
    'global.item': t`Item`,
    'global.location': t`Location`,
  };
  return (name: string): string => {
    const trimmed = name.trim();
    return trimmed in HB_GLOBAL_TYPE_NAMES ? (words[trimmed] ?? trimmed) : trimmed;
  };
}

/** The choices first offered: the connection's currency when it's enabled here, else the
 * target's; Homebox's catch-all type as No type, each other type matched to a Kept type of the
 * same name, else a new one with its name; every field added to its type; archived items
 * archived; quantity 0 kept or archived; no location brought in as a box until ticked; the
 * Insured field; empty starter rows left out. */
export function initialChoices(
  hints: HomeboxMappingHints | undefined,
  keptTypes: readonly KeptType[],
  currency: string,
  typeName: (name: string) => string = (n) => n.trim(),
): HomeboxChoices {
  const byName = new Map(keptTypes.map((y) => [fold(y.name), y.id]));
  return {
    archived: 'archived',
    currency,
    quantityRounding: 'keep_note',
    fields: Object.fromEntries((hints?.fields ?? []).map((f) => [f.name, 'add_to_type' as const])),
    types: Object.fromEntries(
      (hints?.types ?? []).map((y) => {
        if (y.id === hints?.catchAll) return [y.id, { none: true as const }];
        const name = typeName(y.name);
        const match = byName.get(fold(name));
        return [y.id, match ? { typeId: match } : { create: name.slice(0, TYPE_NAME_MAX) }];
      }),
    ),
    insured: 'field',
    seeded: 'skip_unused',
    zeroQuantity: 'keep_or_archive',
    boxes: [],
  };
}

/** Whether the choices can be sent: every new type has a name. */
export function choicesComplete(choices: HomeboxChoices): boolean {
  return Object.values(choices.types).every((c) => !('create' in c) || c.create.trim() !== '');
}

/** The account's types as the combobox lists them (field groups aren't types you pick). */
export function useKeptTypes(accountId: string | undefined): KeptType[] | undefined {
  const types = useTypes(accountId ?? '');
  const typeName = useTypeName();
  return useMemo(
    () =>
      types.data?.types
        .filter((y) => !y.isFieldGroup)
        .map((y) => ({ id: y.id, name: typeName(y) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [types.data, typeName],
  );
}

export function HomeboxChoicesStep({
  hints,
  choices,
  onChange,
  keptTypes,
  locationCurrency,
  connection,
}: {
  hints: HomeboxMappingHints | undefined;
  choices: HomeboxChoices;
  onChange: (choices: HomeboxChoices) => void;
  keptTypes: readonly KeptType[];
  locationCurrency: string;
  connection: HomeboxConnection | null;
}) {
  const { t, i18n } = useLingui();
  const f = useFormat();
  const currencies = useCurrencies();
  const set = (patch: Partial<HomeboxChoices>) => onChange({ ...choices, ...patch });
  const enabled = (currencies.data?.currencies ?? []).filter((c) => c.enabled);
  const fromConnection = connection?.collections[0]?.currency;
  const connectionOff = !!fromConnection && !enabled.some((c) => c.code === fromConnection);
  const seeded = [...(hints?.seededUnused.places ?? []), ...(hints?.seededUnused.tags ?? [])];
  const insured = hints?.insuredItems ?? 0;
  const seededList = new Intl.ListFormat(i18n.locale || 'en', { type: 'conjunction' }).format(
    seeded,
  );

  // Asked only when the backup holds an amount (an inspection before 1.13.0 doesn't say: asked).
  const prices = hints?.prices === undefined || hints.prices > 0;
  const zeroItems = hints?.zeroItems;

  return (
    <div className="grid gap-6">
      {prices ? (
        <div className="grid gap-2">
          <Combobox
            label={t`Prices are in`}
            items={enabled.map((c) => ({ id: c.code, label: c.code, description: c.name }))}
            selectedKey={choices.currency}
            onSelectionChange={(k) => {
              if (k) set({ currency: String(k) });
            }}
            description={
              fromConnection && !connectionOff && choices.currency === fromConnection
                ? t`From the connection to Homebox. Choosing another relabels the amounts; it doesn't convert them.`
                : t`Homebox's export has no currency. Choosing one relabels the amounts; it doesn't convert them.`
            }
          />
          {connectionOff ? (
            <Notice tone="warn">
              <Trans>
                Homebox's currency, <bdi dir="ltr">{fromConnection}</bdi>, isn't turned on in Kept.
                An instance admin can turn it on in Admin → Currencies.
              </Trans>
            </Notice>
          ) : null}
          {locationCurrency !== choices.currency ? (
            <p className="m-0 text-small text-ink-2">
              <Trans>
                This location counts in <bdi dir="ltr">{locationCurrency}</bdi>; prices in another
                currency are kept as they are.
              </Trans>
            </p>
          ) : null}
        </div>
      ) : null}

      <Segmented<HomeboxChoices['archived']>
        label={t`Archived items`}
        value={choices.archived}
        onChange={(archived) => set({ archived })}
        options={[
          { id: 'archived', label: t`Archived` },
          { id: 'in_use', label: t`In use` },
          { id: 'skip', label: t`Leave out` },
        ]}
      />

      {zeroItems === undefined || zeroItems > 0 ? (
        <div className="grid gap-1">
          <Segmented<NonNullable<HomeboxChoices['zeroQuantity']>>
            label={t`Items with quantity 0`}
            value={choices.zeroQuantity ?? 'keep_or_archive'}
            onChange={(zeroQuantity) => set({ zeroQuantity })}
            options={[
              { id: 'keep_or_archive', label: t`Keep 0 or archive` },
              { id: 'one', label: t`Set to 1` },
              { id: 'skip', label: t`Leave out` },
            ]}
          />
          <p className="m-0 text-small text-ink-2">
            {zeroItems ? (
              <>
                <Plural
                  value={zeroItems}
                  one="# item has quantity 0."
                  other="# items have quantity 0."
                />{' '}
              </>
            ) : null}
            {(choices.zeroQuantity ?? 'keep_or_archive') === 'keep_or_archive' ? (
              <Trans>
                A type you run out of keeps 0; anything else comes in archived. The notes say
                "Quantity in Homebox: 0".
              </Trans>
            ) : (choices.zeroQuantity ?? 'keep_or_archive') === 'one' ? (
              <Trans>They come in as 1, and the notes say "Quantity in Homebox: 0".</Trans>
            ) : (
              <Trans>They aren't imported. What's inside one comes in, in its place.</Trans>
            )}
          </p>
        </div>
      ) : null}

      {insured > 0 ? (
        <div className="grid gap-1">
          <Switch
            isSelected={choices.insured === 'field'}
            onChange={(on) => set({ insured: on ? 'field' : 'skip' })}
          >
            <Trans>Add an "Insured" yes/no field</Trans>
          </Switch>
          <p className="m-0 text-small text-ink-2">
            <Plural
              value={insured}
              one="# item is marked insured."
              other="# items are marked insured."
            />
          </p>
        </div>
      ) : null}

      {seeded.length > 0 ? (
        <div className="grid gap-1">
          <Switch
            isSelected={choices.seeded === 'skip_unused'}
            onChange={(on) => set({ seeded: on ? 'skip_unused' : 'all' })}
          >
            <Trans>Leave out Homebox's starter places and tags</Trans>
          </Switch>
          <p className="m-0 text-small text-ink-2">
            <Trans>
              Only the empty ones: <bdi>{seededList}</bdi>.
            </Trans>
          </p>
        </div>
      ) : null}

      {hints?.boxes && hints.boxes.length > 0 ? (
        <BoxSuggestions boxes={hints.boxes} choices={choices} onChange={onChange} />
      ) : null}

      {hints && hints.types.length > 0 ? (
        <TypeMapping
          types={hints.types}
          choices={choices}
          onChange={onChange}
          keptTypes={keptTypes}
        />
      ) : null}

      {hints && hints.fields.length > 0 ? (
        <section className="grid gap-2" aria-labelledby="hb-fields">
          <h3 id="hb-fields" className="m-0 font-semibold text-[17px]">
            <Trans>Custom fields</Trans>
          </h3>
          <List aria-label={t`Custom fields`}>
            {hints.fields.map((field) => (
              <li key={field.name}>
                <Row
                  title={<bdi>{field.name}</bdi>}
                  subtitle={
                    <>
                      <FieldKind kind={field.kind} />
                      {f.sep}
                      <Plural value={field.items} one="on # item" other="on # items" />
                    </>
                  }
                >
                  <Segmented<'add_to_type' | 'notes'>
                    aria-label={t`What happens to ${field.name}`}
                    className="pt-1.5"
                    value={choices.fields[field.name] ?? 'add_to_type'}
                    onChange={(v) => set({ fields: { ...choices.fields, [field.name]: v } })}
                    options={[
                      { id: 'add_to_type', label: t`Add to the type` },
                      { id: 'notes', label: t`Keep in notes` },
                    ]}
                  />
                </Row>
              </li>
            ))}
          </List>
        </section>
      ) : null}

      {!hints ? (
        <Notice tone="info">
          <Trans>
            Homebox's types are matched to Kept's by name, and its custom fields are added to their
            types. The check shows what that does before anything is imported.
          </Trans>
        </Notice>
      ) : null}
    </div>
  );
}

function FieldKind({ kind }: { kind: string }) {
  switch (kind) {
    case 'number':
      return <Trans>number</Trans>;
    case 'boolean':
      return <Trans>yes or no</Trans>;
    case 'time':
      return <Trans>date</Trans>;
    default:
      return <Trans>text</Trans>;
  }
}

type TypeRow = HomeboxMappingHints['types'][number];
type TypeState = 'matched' | 'create' | 'none';

const stateOf = (c: HomeboxChoices['types'][string] | undefined): TypeState =>
  !c ? 'create' : 'typeId' in c ? 'matched' : 'none' in c ? 'none' : 'create';

function TypeMapping({
  types,
  choices,
  onChange,
  keptTypes,
}: {
  types: HomeboxMappingHints['types'];
  choices: HomeboxChoices;
  onChange: (choices: HomeboxChoices) => void;
  keptTypes: readonly KeptType[];
}) {
  const { t } = useLingui();
  const f = useFormat();
  const typeName = useHomeboxTypeName();
  const [list] = useListState();
  const wanted = list.filters.typeMatch ?? [];
  const not = isNot(list, 'typeMatch');
  const q = fold(list.q);
  const rows = types.filter((y) => {
    const state = stateOf(choices.types[y.id]);
    if (wanted.length && wanted.includes(state) === not) return false;
    return !q || fold(typeName(y.name)).includes(q) || fold(y.name).includes(q);
  });
  const count = (state: TypeState) =>
    types.filter((y) => stateOf(choices.types[y.id]) === state).length;
  // The rows read their choice as they render: the list is keyed on the choices only while the
  // Match filter depends on them, so picking or naming a type keeps the field's focus.
  const query = useMemoryPages(
    [
      'hb-types',
      q,
      wanted,
      not,
      wanted.length ? types.map((y) => stateOf(choices.types[y.id])).join() : '',
    ],
    rows,
    50,
  );
  const filters: FilterDef[] = [
    {
      key: 'typeMatch',
      label: t`Match`,
      kind: 'multi',
      hideZero: true,
      values: {
        from: 'static',
        options: [
          { value: 'matched', label: t`A Kept type`, count: count('matched') },
          { value: 'create', label: t`A new type`, count: count('create') },
          { value: 'none', label: t`No type`, count: count('none') },
        ],
      },
    },
  ];
  const setType = (id: string, next: HomeboxChoices['types'][string]) =>
    onChange({ ...choices, types: { ...choices.types, [id]: next } });
  const max = f.num(TYPE_NAME_MAX);

  return (
    <section className="grid gap-2" aria-labelledby="hb-types">
      <h3 id="hb-types" className="m-0 font-semibold text-[17px]">
        <Trans>Types</Trans>
      </h3>
      <p className="m-0 text-small text-ink-2">
        <Trans>
          No type keeps things as they are, without a type's fields. A new type is made with the
          name you give it.
        </Trans>
      </p>
      <ListSurface<TypeRow>
        label={t`Homebox types`}
        search={{ label: t`Search Homebox types`, placeholder: t`Search` }}
        filters={filters}
        query={query}
        getKey={(y) => y.id}
        empty={null}
        renderRow={(y) => {
          const c = choices.types[y.id];
          const name = typeName(y.name);
          const state = stateOf(c);
          const draft = c && 'create' in c ? c.create : '';
          return (
            <div className="grid gap-2 px-3.5 py-2.5 sm:grid-cols-[1fr_minmax(0,18rem)] sm:items-start">
              <span className="grid gap-0.5">
                <bdi className="font-semibold [overflow-wrap:anywhere]">{name}</bdi>
                <span className="text-small text-ink-2">
                  <Plural value={y.items} one="# item" other="# items" />
                </span>
              </span>
              <span className="grid gap-2">
                <Combobox
                  aria-label={t`Kept type for ${name}`}
                  items={[
                    { id: NONE, label: t`No type` },
                    { id: NEW, label: t`New type…` },
                    ...keptTypes.map((k) => ({ id: k.id, label: k.name })),
                  ]}
                  selectedKey={
                    state === 'matched' && c && 'typeId' in c
                      ? c.typeId
                      : state === 'none'
                        ? NONE
                        : NEW
                  }
                  onSelectionChange={(k) => {
                    if (!k) return;
                    const key = String(k);
                    if (key === NONE) setType(y.id, { none: true });
                    else if (key === NEW) setType(y.id, { create: name.slice(0, TYPE_NAME_MAX) });
                    else setType(y.id, { typeId: key });
                  }}
                />
                {state === 'create' ? (
                  <TextField
                    label={t`Name of the new type`}
                    value={draft}
                    onChange={(v) => setType(y.id, { create: v.slice(0, TYPE_NAME_MAX) })}
                    isRequired
                    isInvalid={draft.trim() === ''}
                    errorMessage={t`Give the new type a name (at most ${max} characters).`}
                  />
                ) : null}
              </span>
            </div>
          );
        }}
      />
    </section>
  );
}

type BoxRow = NonNullable<HomeboxMappingHints['boxes']>[number];

/** The locations whose names read as boxes: ticked ones come in as boxes (things that hold
 * things) instead of places. */
function BoxSuggestions({
  boxes,
  choices,
  onChange,
}: {
  boxes: NonNullable<HomeboxMappingHints['boxes']>;
  choices: HomeboxChoices;
  onChange: (choices: HomeboxChoices) => void;
}) {
  const { t } = useLingui();
  const f = useFormat();
  const [list] = useListState();
  const chosen = new Set(choices.boxes ?? []);
  const wanted = list.filters.boxChosen ?? [];
  const not = isNot(list, 'boxChosen');
  const pathOf = (b: BoxRow) => b.path.join(' › ');
  const rows = boxes.filter((b) => {
    const state = chosen.has(b.id) ? 'yes' : 'no';
    return !(wanted.length && wanted.includes(state) === not);
  });
  const query = useMemoryPages(
    ['hb-boxes', wanted, not, wanted.length ? [...chosen].join() : ''],
    rows,
    50,
  );
  const filters: FilterDef[] = [
    {
      key: 'boxChosen',
      label: t`Chosen`,
      kind: 'multi',
      hideZero: true,
      values: {
        from: 'static',
        options: [
          { value: 'yes', label: t`As boxes`, count: chosen.size },
          { value: 'no', label: t`As places`, count: boxes.length - chosen.size },
        ],
      },
    },
  ];
  const setAll = (ids: string[]) => onChange({ ...choices, boxes: ids });
  const all = chosen.size === boxes.length;
  const n = f.num(chosen.size);
  const of = f.num(boxes.length);

  return (
    <section className="grid gap-2" aria-labelledby="hb-boxes">
      <h3 id="hb-boxes" className="m-0 font-semibold text-[17px]">
        <Trans>These look like boxes</Trans>
      </h3>
      <p className="m-0 text-small text-ink-2">
        <Trans>
          Ticked, they come in as boxes: things that hold things, carried with what's inside. The
          rest come in as places. You can change either later.
        </Trans>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onPress={() => setAll(all ? [] : boxes.map((b) => b.id))}>
          {all ? <Trans>Choose none</Trans> : <Trans>Choose all</Trans>}
        </Button>
        <span className="text-small text-ink-2">
          <Trans>
            {n} of {of} as boxes
          </Trans>
        </span>
      </div>
      <ListSurface<BoxRow>
        label={t`Locations that look like boxes`}
        // The page's search is the types list's; this one is short enough to tick through.
        search={false}
        filters={filters}
        query={query}
        getKey={(b) => b.id}
        empty={null}
        renderRow={(b) => (
          <div className="px-3.5">
            <TickBox
              isSelected={chosen.has(b.id)}
              onChange={(on) => {
                const next = new Set(chosen);
                if (on) next.add(b.id);
                else next.delete(b.id);
                setAll(boxes.map((x) => x.id).filter((id) => next.has(id)));
              }}
              description={
                <>
                  <bdi>{pathOf(b)}</bdi>
                  {f.sep}
                  <Plural value={b.items} one="# item" other="# items" />
                </>
              }
            >
              <bdi className="font-medium">{b.name}</bdi>
            </TickBox>
          </div>
        )}
      />
    </section>
  );
}
