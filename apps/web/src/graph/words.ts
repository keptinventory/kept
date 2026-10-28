/**
 * The graph view's words (#207): a node's kind, how much is in it and its pins, as the card shows
 * them and as each node's accessible name says them ("Garage, Room, 9 things, 1 lent out").
 */
import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import type { GraphFlag, GraphTag } from '@/api/graph/types';
import { usePlaceKindName, usePlaceName, useTypeName } from '@/components/places/labels';
import { FLAGS, type GNode } from './tree';

/** The parts of an accessible name, joined as the language lists them. */
export function joinName(parts: readonly string[], locale: string): string {
  return parts.filter(Boolean).join(locale.startsWith('ar') ? '، ' : ', ');
}

export function useGraphWords() {
  const { t, i18n } = useLingui();
  const kindName = usePlaceKindName();
  const placeName = usePlaceName();
  const typeName = useTypeName();

  const name = (n: GNode) =>
    n.isUnplaced ? placeName({ name: n.name, isUnplaced: true }) : n.name;

  const kind = (n: GNode): string => {
    if (n.kind === 'location') return t`Location`;
    if (n.kind === 'box' || n.kind === 'thing')
      return (
        typeName({ name: n.typeName ?? '', builtinKey: n.typeKey }) ??
        (n.kind === 'box' ? t`Container` : t`Thing`)
      );
    return kindName(n.kindKey ?? 'room');
  };

  const things = (count: number) => plural(count, { one: '# thing', other: '# things' });

  const flagWord: Record<GraphFlag, string> = {
    low: t`low on stock`,
    lent: t`lent out`,
    due: t`due soon`,
  };
  const flagCount = (k: GraphFlag, count: number): string => {
    if (k === 'low') return plural(count, { one: '# low on stock', other: '# low on stock' });
    if (k === 'lent') return plural(count, { one: '# lent out', other: '# lent out' });
    return plural(count, { one: '# due soon', other: '# due soon' });
  };
  /** A thing's own pins as words; a place's or a box's as counts of what's in it. */
  const flags = (n: GNode): string[] =>
    FLAGS.filter((k) => n.flags[k] > 0).map((k) =>
      n.kind === 'thing' ? flagWord[k] : flagCount(k, n.flags[k]),
    );

  const legend: Record<GraphFlag, string> = {
    low: t`Low stock`,
    lent: t`Lent out`,
    due: t`Due soon`,
  };

  /** "Garage, Room, 9 things, 1 lent out" */
  const label = (n: GNode): string =>
    joinName(
      [name(n), kind(n), n.kind === 'thing' ? '' : things(n.things), ...flags(n)],
      i18n.locale,
    );

  const more = (count: number, of: GNode) => {
    const where = name(of);
    return plural(count, { one: `# more in ${where}`, other: `# more in ${where}` });
  };

  const tag = (g: GraphTag, count: number) =>
    joinName([g.name, t`Tag`, things(count)], i18n.locale);

  return { name, kind, things, flagWord, flagCount, flags, legend, label, more, tag };
}

export type GraphWords = ReturnType<typeof useGraphWords>;
