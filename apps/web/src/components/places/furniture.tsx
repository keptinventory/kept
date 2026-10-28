/**
 * Furniture from a place template (#238): a cube shelf, a bookcase, a chest of drawers or the
 * account's own template, made with a place for each compartment in one step and one Undo
 * (POST /locations/:locationId/places/from-template). Loaded on demand (furniture-lazy.tsx;
 * vite.config.ts ON_DEMAND_ENTRIES): it needs a connection anyway.
 *
 * The template gives the size; the person picks how the unit stands (upright, or on its side for
 * a grid that isn't square). The preview counts the compartments as the server will: top left to
 * bottom right, row by row, on the grid as it stands, with the names and codes they will get.
 * Codes are optional: the furniture's own code, and a pattern for the compartments such as
 * `{parent}-F{col:02}{row:02}`. A code the location's rule refuses, or one already taken, is named.
 */
import {
  asItStands,
  BUILTIN_PLACE_TEMPLATES,
  type BuiltinPlaceTemplate,
  canTurn,
  cellsOf,
  fillPattern,
  layoutProblem,
  newId,
  PLACE_LAYOUT_LIMITS,
  type PlaceLayout,
  type PlaceOrientation,
  patternProblem,
  usesParent,
  withCount,
} from '@kept/shared';
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type FormEvent, useMemo, useState } from 'react';
import { api, isApiError, written } from '@/api/client';
import { inventoryPaths as p, qs } from '@/api/inventory/paths';
import type {
  FailedCode,
  FromTemplateBody,
  FromTemplateResult,
  PlaceTemplate,
  PlaceTemplateLayout,
} from '@/api/inventory/types';
import { useOfferUndo } from '@/components/history/undo';
import { Notice, useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectItem } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { useFormat } from '@/lib/format';
import { useInvalidateBrowse } from './api';

export type FurnitureFormProps = {
  locationId: string;
  /** Where the furniture goes: a place, or null for the top level of the location. */
  parentId: string | null;
  onDone: () => void;
};

export const placeTemplateKeys = {
  all: ['place-templates'] as const,
  usable: (locationId: string) => ['place-templates', 'usable', locationId] as const,
  account: (accountId: string) => ['place-templates', 'account', accountId] as const,
};

export const placeTemplateApi = {
  usable: (locationId: string) =>
    api.get<{ items: PlaceTemplate[] }>(`${p.placeTemplates}${qs({ locationId })}`),
  fromTemplate: (locationId: string, body: FromTemplateBody) =>
    written.post<FromTemplateResult>(p.placesFromTemplate(locationId), body),
};

/** A built-in template's name in the reader's language. */
export function useBuiltinTemplateName() {
  const { t } = useLingui();
  const fmt = useFormat();
  return (b: BuiltinPlaceTemplate): string => {
    if (b.layout.kind === 'grid') {
      const across = fmt.num(b.layout.across);
      const up = fmt.num(b.layout.up);
      return t`Cube shelf ${across} × ${up}`;
    }
    if (b.key === 'bookcase') return t`Bookcase`;
    if (b.key === 'chest') return t`Chest of drawers`;
    return t`Shelving unit`;
  };
}

/** What compartments are called when a template doesn't say, as a pattern: "Cube {n}". */
export function useDefaultCompartmentName() {
  const { t } = useLingui();
  return (kind: PlaceLayout['kind']): string => {
    // The number goes in as the placeholder itself, so each language puts it where it belongs.
    const n = N;
    if (kind === 'grid') return t`Cube ${n}`;
    if (kind === 'levels') return t`Shelf ${n}`;
    return t`Drawer ${n}`;
  };
}

/** A refused code in words: the rule it breaks, or where it already is. */
export function useFailedCodeText() {
  const { t } = useLingui();
  const errorText = useErrorText();
  return (error: unknown): string => {
    const failed = isApiError(error) ? (error.details.failed as FailedCode | undefined) : undefined;
    if (!failed) return errorText(error);
    const code = failed.code;
    if (failed.reason === 'taken') return t`${code} is already on something else here.`;
    if (failed.reason === 'duplicate')
      return t`${code} would be on two places. Change the code pattern.`;
    const rule = isApiError(error)
      ? (error.details.rule as { message?: string } | undefined)
      : undefined;
    const message = rule?.message ?? '';
    return message
      ? t`${code} doesn't follow this location's code rule: ${message}`
      : t`${code} doesn't follow this location's code rule.`;
  };
}

/** Placeholders, put into sentences as values so the catalogues never parse them. */
const N = '{n}';
const ROW = '{row}';
const COL = '{col}';
const PARENT = '{parent}';
const PADDED = '{col:02}';

type Choice = {
  id: string;
  name: string;
  layout: PlaceTemplateLayout;
  adjustable: boolean;
  compartmentName: string | null;
  codePattern: string | null;
  template: FromTemplateBody['template'];
};

export function FurnitureForm({ locationId, parentId, onDone }: FurnitureFormProps) {
  const { t } = useLingui();
  const fmt = useFormat();
  const builtinName = useBuiltinTemplateName();
  const defaultName = useDefaultCompartmentName();
  const failedText = useFailedCodeText();
  const invalidate = useInvalidateBrowse();
  const offerUndo = useOfferUndo();
  const own = useQuery({
    queryKey: placeTemplateKeys.usable(locationId),
    queryFn: () => placeTemplateApi.usable(locationId),
  });

  const choices = useMemo<Choice[]>(
    () => [
      ...BUILTIN_PLACE_TEMPLATES.map((b) => ({
        id: `builtin:${b.key}`,
        name: builtinName(b),
        layout: b.layout,
        adjustable: b.adjustable,
        compartmentName: null,
        codePattern: null,
        template: { builtin: b.key },
      })),
      ...(own.data?.items ?? []).map((x) => ({
        id: `own:${x.id}`,
        name: x.name,
        layout: x.layout,
        adjustable: x.layout.kind !== 'grid',
        compartmentName: x.compartmentName,
        codePattern: x.codePattern,
        template: { id: x.id },
      })),
    ],
    [own.data, builtinName],
  );

  const [choiceId, setChoiceId] = useState('builtin:cube_2x4');
  const choice = choices.find((c) => c.id === choiceId) ?? (choices[0] as Choice);
  const [name, setName] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<PlaceOrientation>('upright');
  const [countText, setCountText] = useState<string | null>(null);
  const [compartmentName, setCompartmentName] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codePattern, setCodePattern] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    name?: string;
    count?: string;
    names?: string;
    codes?: string;
  }>({});

  const pick = (id: string) => {
    setChoiceId(id);
    // What follows the template until typed over: the name, the count, the names and codes.
    setName(null);
    setCountText(null);
    setCompartmentName(null);
    setCodePattern(null);
    setOrientation('upright');
    setErrors({});
  };

  const furnitureName = name ?? choice.name;
  const baseCount = choice.layout.kind === 'grid' ? null : choice.layout.count;
  const count = countText === null ? baseCount : Number(countText);
  const layout: PlaceLayout =
    choice.adjustable && count !== null && Number.isInteger(count)
      ? withCount(choice.layout, count)
      : choice.layout;
  const turnable = canTurn(layout);
  const stands: PlaceOrientation = turnable ? orientation : 'upright';
  const namePattern = compartmentName ?? choice.compartmentName ?? defaultName(layout.kind);
  const pattern = codePattern ?? choice.codePattern ?? '';
  const layoutOk = layoutProblem(layout) === null;
  const cells = layoutOk ? cellsOf(layout, stands) : [];
  const grid = layoutOk ? asItStands(layout, stands) : { columns: 1, rows: 0 };
  const parentCode = code.trim().toUpperCase();
  const codeOf = (cell: (typeof cells)[number]) =>
    pattern ? fillPattern(pattern, { ...cell, parent: parentCode }).toUpperCase() : null;
  const first = cells[0];
  const last = cells.at(-1);

  const make = useMutation({
    mutationFn: () =>
      placeTemplateApi.fromTemplate(locationId, {
        id: newId(),
        ...(parentId ? { parentId } : {}),
        template: choice.template,
        name: furnitureName.trim(),
        ...(turnable ? { orientation: stands } : {}),
        ...(choice.adjustable && count !== null ? { count } : {}),
        compartmentName: namePattern.trim(),
        ...(parentCode ? { code: parentCode } : {}),
        codePattern: pattern.trim() ? pattern.trim() : null,
      }),
    onSuccess: async ({ body, auditEvents }) => {
      await invalidate();
      const added = body.place.name;
      const inside = body.compartments.length;
      offerUndo(
        {
          title: t`Added ${added}`,
          description: plural(inside, {
            one: 'With # place inside',
            other: 'With # places inside',
          }),
        },
        auditEvents,
      );
      onDone();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const n = furnitureName.trim();
    if (!n) next.name = t`Give it a name, like Cube shelf 01.`;
    else if (n.length > 120) next.name = t`Keep the name under 120 characters.`;
    if (choice.adjustable && !layoutOk) {
      const max = fmt.num(PLACE_LAYOUT_LIMITS.count);
      next.count = t`Choose 1 to ${max}.`;
    }
    if (patternProblem(namePattern, { code: false })) {
      next.names = t`Use ${N} for the number, or ${ROW} and ${COL}.`;
    }
    if (pattern.trim()) {
      if (patternProblem(pattern, { code: true, distinct: true })) {
        next.codes = t`Use ${N}, or ${ROW} and ${COL}, so each one gets its own code.`;
      } else if (usesParent(pattern) && !parentCode) {
        next.codes = t`Give the furniture its own code first: these codes start with it.`;
      }
    }
    setErrors(next);
    if (Object.keys(next).length === 0) make.mutate();
  };

  const across = fmt.num(grid.columns);
  const up = fmt.num(grid.rows);
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Select<Choice>
        label={t`Template`}
        items={choices}
        value={choice.id}
        onChange={(key) => pick(String(key))}
      >
        {(item) => (
          <SelectItem id={item.id} textValue={item.name}>
            <bdi>{item.name}</bdi>
          </SelectItem>
        )}
      </Select>
      <TextField
        label={t`Name`}
        value={furnitureName}
        maxLength={120}
        onChange={(v) => {
          setName(v);
          setErrors((x) => ({ ...x, name: undefined }));
        }}
        isInvalid={!!errors.name}
        errorMessage={errors.name}
        inputProps={{ dir: 'auto' }}
      />
      {choice.adjustable ? (
        <TextField
          label={layout.kind === 'drawers' ? t`Drawers` : t`Shelves`}
          value={countText ?? String(baseCount ?? '')}
          onChange={(v) => {
            setCountText(v.replace(/\D/g, ''));
            setErrors((x) => ({ ...x, count: undefined }));
          }}
          isInvalid={!!errors.count}
          errorMessage={errors.count}
          inputProps={{ inputMode: 'numeric', dir: 'ltr' }}
        />
      ) : null}
      {turnable ? (
        <Segmented
          label={t`How it stands`}
          value={stands}
          onChange={setOrientation}
          options={[
            { id: 'upright', label: t`Upright` },
            { id: 'side', label: t`On its side` },
          ]}
        />
      ) : null}
      {layoutOk ? (
        <figure className="m-0 grid gap-2">
          <figcaption className="text-small text-ink-2">
            <Trans>
              {across} across, {up} up, counted from the top left, row by row
            </Trans>
          </figcaption>
          {/* Numbered as the furniture stands in the room, top left first, in every language. */}
          <ol
            dir="ltr"
            aria-label={t`Compartments`}
            className="m-0 grid list-none gap-1 p-0"
            style={{ gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))` }}
          >
            {cells.map((cell) => (
              <li
                key={cell.n}
                className="grid min-h-9 place-items-center rounded-md border border-line bg-sunken px-1 text-small tabular-nums"
              >
                {fmt.num(cell.n)}
              </li>
            ))}
          </ol>
        </figure>
      ) : null}
      <TextField
        label={t`Compartment names`}
        value={namePattern}
        maxLength={120}
        description={t`${N} is the number, ${ROW} and ${COL} where it sits.`}
        onChange={(v) => {
          setCompartmentName(v);
          setErrors((x) => ({ ...x, names: undefined }));
        }}
        isInvalid={!!errors.names}
        errorMessage={errors.names}
        inputProps={{ dir: 'auto' }}
      />
      {first && last && !patternProblem(namePattern, { code: false }) ? (
        <p className="m-0 text-small text-ink-2 [overflow-wrap:anywhere]">
          <bdi>{fillPattern(namePattern, first)}</bdi>
          {' … '}
          <bdi>{fillPattern(namePattern, last)}</bdi>
        </p>
      ) : null}
      <TextField
        label={t`Its own code (optional)`}
        value={code}
        maxLength={100}
        placeholder="KX01"
        onChange={(v) => {
          setCode(v);
          setErrors((x) => ({ ...x, codes: undefined }));
        }}
        inputProps={{ dir: 'ltr', autoCapitalize: 'characters' }}
      />
      <TextField
        label={t`Compartment codes (optional)`}
        value={pattern}
        maxLength={100}
        placeholder="{parent}-F{col:02}{row:02}"
        description={t`${PARENT} is its own code; ${PADDED} pads to two digits.`}
        onChange={(v) => {
          setCodePattern(v);
          setErrors((x) => ({ ...x, codes: undefined }));
        }}
        isInvalid={!!errors.codes}
        errorMessage={errors.codes}
        inputProps={{ dir: 'ltr' }}
      />
      {first &&
      last &&
      pattern.trim() &&
      !errors.codes &&
      !patternProblem(pattern, { code: true }) ? (
        <p className="m-0 text-small text-ink-2 [overflow-wrap:anywhere]" dir="ltr">
          {codeOf(first)}
          {' … '}
          {codeOf(last)}
        </p>
      ) : null}
      {make.error ? <Notice tone="danger">{failedText(make.error)}</Notice> : null}
      <DialogFooter>
        <Button variant="secondary" onPress={onDone}>
          <Trans>Cancel</Trans>
        </Button>
        <Button type="submit" isPending={make.isPending}>
          <Trans>Add</Trans>
        </Button>
      </DialogFooter>
    </form>
  );
}
