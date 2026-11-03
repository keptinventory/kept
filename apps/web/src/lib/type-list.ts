/**
 * An account's type list as people pick from it. `GET /accounts/:id/types` answers the built-ins
 * and the account's own types together, so a built-in the account has customised arrives twice:
 * the original and the copy (`copiedFromId`), both with the same `builtinKey` (#357). The copy
 * stands in for the original everywhere a type is chosen; customising moved the account's things
 * onto it (kept.customise_type).
 */
import type { TypeNode } from '@/api/inventory/types';

/** The types without each built-in the list also holds a copy of. */
export function withoutCustomised<T extends Pick<TypeNode, 'id' | 'copiedFromId'>>(
  types: readonly T[],
): T[] {
  const replaced = new Set(types.map((t) => t.copiedFromId).filter((x): x is string => !!x));
  return types.filter((t) => !replaced.has(t.id));
}

/** The type a built-in key names: the account's copy first, then the built-in itself. */
export function typeOfKey<T extends Pick<TypeNode, 'builtinKey' | 'copiedFromId'>>(
  types: readonly T[] | undefined,
  key: string,
  usable: (t: T) => boolean = () => true,
): T | undefined {
  const matches = (types ?? []).filter((t) => t.builtinKey === key && usable(t));
  return matches.find((t) => t.copiedFromId) ?? matches[0];
}
