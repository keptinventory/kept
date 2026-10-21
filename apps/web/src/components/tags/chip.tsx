/**
 * A tag chip (#209): the tag's name with a dot of its colour, on a tint of it. It links to the
 * tag's page when `link` is on; chips wrap, never cut off (phones never trim).
 */
import { Trans } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type { ThingTag } from '@/api/inventory/types';
import { cn } from '@/lib/utils';
import { shownColour, tagStyle } from './palette';

const base =
  'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12.5px] leading-snug text-ink [overflow-wrap:anywhere]';
const coloured =
  'border-[color-mix(in_oklab,var(--tag)_45%,var(--color-line))] bg-[color-mix(in_oklab,var(--tag)_14%,var(--color-surface))]';
const plain = 'border-line bg-surface';

/** The dot of a tag's colour (nothing for a tag with none). */
export function TagDot({ colour, className }: { colour: string | null; className?: string }) {
  if (!shownColour(colour)) return null;
  return (
    <span
      aria-hidden="true"
      style={tagStyle(colour)}
      className={cn('size-2 shrink-0 rounded-full bg-(--tag)', className)}
    />
  );
}

export function TagChip({
  tag,
  link = false,
  end,
  className,
}: {
  tag: ThingTag;
  /** Opens the tag's page. */
  link?: boolean;
  /** After the name (a remove button). */
  end?: ReactNode;
  className?: string;
}) {
  const cls = cn(base, shownColour(tag.colour) ? coloured : plain, className);
  const inner = (
    <>
      <TagDot colour={tag.colour} />
      <bdi className="min-w-0">{tag.name}</bdi>
    </>
  );
  if (link)
    return (
      <span className={cn(cls, 'p-0')} style={tagStyle(tag.colour)}>
        <Link
          to="/tags/$id"
          params={{ id: tag.id }}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-2 py-0.5 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-info"
        >
          {inner}
        </Link>
        {end}
      </span>
    );
  return (
    <span className={cls} style={tagStyle(tag.colour)}>
      {inner}
      {end}
    </span>
  );
}

/** A thing's chips, wrapping; nothing when it has none. */
export function TagChips({
  tags,
  link = false,
  className,
}: {
  tags: readonly ThingTag[];
  link?: boolean;
  className?: string;
}) {
  if (tags.length === 0) return null;
  return (
    <span className={cn('flex flex-wrap gap-1', className)}>
      {tags.map((g) => (
        <TagChip key={g.id} tag={g} link={link} />
      ))}
    </span>
  );
}

/**
 * The heading a list grouped by tag puts a thing under (#209): its first tag, as the server sorts
 * them (A to Z), so consecutive rows share it; things with none under "No tag".
 */
export function tagGroupOf(thing: { tags?: readonly ThingTag[] }): {
  key: string;
  label: ReactNode;
} {
  const first = thing.tags?.[0];
  return first
    ? { key: first.id, label: <TagChip tag={first} /> }
    : { key: '__untagged', label: <Trans>No tag</Trans> };
}
