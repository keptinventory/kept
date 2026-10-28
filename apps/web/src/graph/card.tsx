/**
 * The graph's card (#207): what was picked, beside the controls on a wide screen and as a sheet
 * at the bottom on a phone, like the map's card. Its path, name, kind and how much is inside, its
 * pins, what's in it (each one picks it), and Go in · Open · Show on the map. A tag's card lists
 * what carries it.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import type { GraphTag } from '@/api/graph/types';
import { LinkButton } from '@/components/page';
import { TagChip } from '@/components/tags/chip';
import { Button } from '@/components/ui/button';
import { addressOf } from '@/lib/address';
import { sep, useFormat } from '@/lib/format';
import { chainOf, FLAGS, type GNode, type GraphTree, placeOf, taggedIn } from './tree';
import type { GraphWords } from './words';

export type Pick = { type: 'node'; node: GNode } | { type: 'tag'; tag: GraphTag };

/** How many of its children the card lists. */
const LISTED = 6;

export function GraphCard({
  pick,
  tree,
  words,
  address,
  focus,
  onPick,
  onGoIn,
  onClose,
}: {
  pick: Pick;
  tree: GraphTree;
  words: GraphWords;
  /** The location's address, for its links. */
  address: string;
  focus: GNode;
  onPick: (n: GNode) => void;
  onGoIn: (n: GNode) => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const f = useFormat();
  const close = (
    <button type="button" className="kgraph-x" aria-label={t`Close`} onClick={onClose}>
      ×
    </button>
  );

  if (pick.type === 'tag') {
    const tagged = taggedIn(tree.root, pick.tag.id);
    return (
      <aside className="kgraph-card" aria-label={t`Selected`} aria-live="polite">
        <div className="kgraph-card-head">
          <div className="grid gap-1">
            <div className="kgraph-path">
              <Trans>Tag</Trans>
            </div>
            <h2>
              <TagChip tag={pick.tag} />
            </h2>
          </div>
          {close}
        </div>
        <div className="kgraph-sub">
          <Trans>
            {words.things(tagged.length)} in <bdi>{tree.root.name}</bdi>
          </Trans>
        </div>
        {tagged.length ? (
          <div className="grid gap-2">
            <div className="kgraph-eyebrow">
              <Trans>Tagged</Trans>
            </div>
            <ul className="kgraph-kids">
              {tagged.slice(0, 12).map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => onPick(n)}>
                    <span>
                      <bdi>{words.name(n)}</bdi>
                    </span>
                    <span>
                      <bdi>
                        {chainOf(n)
                          .slice(1, -1)
                          .map((c) => words.name(c))
                          .join(' › ')}
                      </bdi>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="kgraph-actions">
          <LinkButton variant="primary" size="small" to="/tags/$id" params={{ id: pick.tag.id }}>
            <Trans>Open</Trans>
          </LinkButton>
        </div>
      </aside>
    );
  }

  const n = pick.node;
  const path = chainOf(n).slice(0, -1);
  const kids = n.children;
  const canGoIn = kids.length > 0 && n !== focus;
  const place = placeOf(n);
  const open =
    n.kind === 'location'
      ? ({ to: '/loc/$id', params: { id: address } } as const)
      : n.kind === 'box' || n.kind === 'thing'
        ? ({ to: '/t/$id', params: { id: addressOf(n) } } as const)
        : ({ to: '/p/$id', params: { id: addressOf(n) } } as const);
  // The map draws floors, rooms and what's in them; the Unplaced area isn't on it.
  const onMap =
    n.kind === 'location'
      ? ({ to: '/loc/$id', params: { id: address }, search: { view: 'map' } } as const)
      : place && !place.isUnplaced
        ? ({ to: '/p/$id', params: { id: addressOf(place) }, search: { view: 'map' } } as const)
        : null;

  return (
    <aside className="kgraph-card" aria-label={t`Selected`} aria-live="polite">
      <div className="kgraph-card-head">
        <div className="grid gap-1">
          <div className="kgraph-path">
            {path.length ? (
              <bdi>{path.map((c) => words.name(c)).join(' › ')}</bdi>
            ) : (
              <Trans>Location</Trans>
            )}
          </div>
          <h2>
            <bdi>{words.name(n)}</bdi>
          </h2>
        </div>
        {close}
      </div>
      <div className="kgraph-sub">
        {words.kind(n)}
        {n.kind !== 'thing' && n.things > 0 ? (
          <>
            {sep()}
            <Trans>{words.things(n.things)} inside</Trans>
          </>
        ) : null}
      </div>
      {FLAGS.filter((k) => n.flags[k] > 0).map((k) => (
        <div key={k} className="kgraph-flagline">
          <span className={`kgraph-dot ${k}`} aria-hidden="true" />
          {n.kind === 'thing' ? words.flagWord[k] : words.flagCount(k, n.flags[k])}
        </div>
      ))}
      {n.tagIds.length ? (
        <div className="kgraph-tagline">
          {n.tagIds.map((id) => {
            const g = tree.tags.find((x) => x.id === id);
            return g ? <TagChip key={id} tag={g} link /> : null;
          })}
        </div>
      ) : null}
      {kids.length ? (
        <div className="grid gap-2">
          <div className="kgraph-eyebrow">
            <Trans>Inside it</Trans>
            {sep()}
            {f.num(kids.length)}
          </div>
          <ul className="kgraph-kids">
            {kids.slice(0, LISTED).map((k) => (
              <li key={k.id}>
                <button type="button" onClick={() => onPick(k)}>
                  <span>
                    <bdi>{words.name(k)}</bdi>
                  </span>
                  <span>
                    {words.kind(k)}
                    {k.kind !== 'thing' && k.things > 0 ? `${sep()}${f.num(k.things)}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {kids.length > LISTED ? (
            <div className="kgraph-sub">{words.more(kids.length - LISTED, n)}</div>
          ) : null}
        </div>
      ) : null}
      <div className="kgraph-actions">
        {canGoIn ? (
          <Button variant="secondary" size="small" onPress={() => onGoIn(n)}>
            <Trans>Go in</Trans>
          </Button>
        ) : null}
        <LinkButton variant="primary" size="small" {...open}>
          <Trans>Open</Trans>
        </LinkButton>
        {onMap ? (
          <LinkButton variant="secondary" size="small" {...onMap}>
            <Trans>Show on the map</Trans>
          </LinkButton>
        ) : null}
      </div>
    </aside>
  );
}
