/**
 * "What's in <location>" under the map, as the app's (apps/web/src/map/whats-in.tsx): a summary, a
 * search by name or short ID, a floor filter, By room or Needs attention, and Show more on each
 * card. The rows are the app's own (map/list.ts); this draws them in plain DOM. Picking a row
 * shows it on the map (demo.ts).
 */
import type { MapAttention, MapAttentionKind, MapView } from '../../../../web/src/api/map/types';
import type { Contents, Plan } from '../../../../web/src/map/layout';
import {
  ATTENTION_ROWS,
  attentionGroups,
  type ListQuery,
  ROOM_ROWS,
  type Row,
  roomCards,
  summaryOf,
} from '../../../../web/src/map/list';
import { esc, idChip, labelTape } from './html';
import type { WORDS } from './strings';

type Words = (typeof WORDS)['en'];
type Format = { num: (n: number) => string };

export type WhatsInArgs = {
  name: string;
  plan: Plan;
  view: MapView;
  contents: Contents;
  query: ListQuery;
  /** Cards showing all their rows (room ids, or `flag:<kind>`). */
  opened: ReadonlySet<string>;
  w: Words;
  f: Format;
  attentionWords: (a: MapAttention) => string;
};

const dots = (flags: MapAttentionKind[]) =>
  `<span class="kmap-dots">${flags.map((k) => `<span class="kmap-dot ${k}" aria-hidden="true"></span>`).join('')}</span>`;

const pressed = (on: boolean) => `aria-pressed="${on}"`;

export function whatsInHtml(a: WhatsInArgs): string {
  const { plan, view, contents, query, opened, w, f } = a;
  const q = query.q.trim();
  const sum = summaryOf(plan, view);
  const titles: Record<MapAttentionKind, string> = {
    low: w.pin.low.long,
    lent: w.pin.lent.long,
    due: w.pin.due.long,
  };
  const qty = (r: Row) => (r.quantity !== 1 ? ` ×${esc(f.num(r.quantity))}` : '');

  const childButton = (c: Row) =>
    `<button type="button" data-act="list-thing" data-arg="${esc(c.id)}">${esc(c.name)}${qty(c)} ${labelTape(c.shortCode, c.labelPrinted)}${dots(c.flags)}</button>`;
  const row = (r: Row, depth: number): string => {
    const line = `<button type="button" class="kmap-nm" data-act="list-thing" data-arg="${esc(r.id)}">${esc(r.name)}${r.kind === 'thing' ? qty(r) : ''}</button>${labelTape(r.shortCode, r.labelPrinted)}<span class="kmap-fill"></span>${dots(r.flags)}<span class="kmap-c">${r.count !== null ? esc(f.num(r.count)) : ''}</span>`;
    if (!r.children.length || depth > 4)
      return `<div class="kmap-orow">${line}<span class="kmap-chev"></span></div>`;
    return `<details${q ? ' open' : ''}><summary class="kmap-orow">${line}<span class="kmap-chev" aria-hidden="true">›</span></summary><ul class="kmap-crows">${r.children
      .map((c) => `<li>${c.children.length ? row(c, depth + 1) : childButton(c)}</li>`)
      .join('')}</ul></details>`;
  };
  const more = (key: string, total: number, all: boolean, shown: number) =>
    total > shown || all
      ? `<button type="button" class="kmap-more" data-act="list-more" data-arg="${esc(key)}" aria-expanded="${all}">${esc(all ? w.list.fewer : w.list.more(f.num(total - shown)))}</button>`
      : '';

  let body: string;
  if (query.show === 'attention') {
    body = `<div class="kmap-grid">${attentionGroups(plan, view, query)
      .map((g) => {
        const all = opened.has(`flag:${g.kind}`);
        const show = all ? g.rows : g.rows.slice(0, ATTENTION_ROWS);
        const rows = g.rows.length
          ? `<ul class="kmap-flist">${show
              .map(
                (r) =>
                  `<li><button type="button" data-act="list-thing" data-arg="${esc(r.id)}"><span>${esc(r.name)}</span><small>${esc(r.where.join(' › '))}${r.shortCode && r.labelPrinted ? ` ${idChip(r.shortCode, true)}` : ''}</small><span class="why">${esc(a.attentionWords(r.attention))}</span></button></li>`,
              )
              .join('')}</ul>`
          : `<p class="kmap-empty">${esc(w.list.nothingHere)}</p>`;
        return `<article class="kmap-rcard"><header><span class="kmap-dot ${g.kind}" aria-hidden="true"></span><h3 class="kd-h3">${esc(titles[g.kind])}</h3><span class="kmap-cnt">${esc(f.num(g.rows.length))}</span></header>${rows}${g.rows.length > ATTENTION_ROWS ? more(`flag:${g.kind}`, g.rows.length, all, ATTENTION_ROWS) : ''}</article>`;
      })
      .join('')}</div>`;
  } else {
    const cards = roomCards(plan, view, contents, query);
    body = cards.length
      ? `<div class="kmap-grid">${cards
          .map((c) => {
            const all = !!q || opened.has(c.room.id);
            const show = all ? c.rows : c.rows.slice(0, ROOM_ROWS);
            const level =
              plan.levels.length > 1 && c.level
                ? `<span class="kmap-lv" title="${esc(c.level.name)}">${esc(c.level.short)}</span>`
                : '';
            return `<article class="kmap-rcard"><header><button type="button" data-act="list-room" data-arg="${esc(c.room.id)}">${esc(c.room.name)}</button>${level}<span class="kmap-cnt">${esc(w.things(c.total, f.num(c.total)))}</span></header>${
              show.length
                ? show.map((r) => row(r, 0)).join('')
                : `<p class="kmap-empty">${esc(w.list.nothingYet)}</p>`
            }${!q && c.rows.length > ROOM_ROWS ? more(c.room.id, c.rows.length, all, ROOM_ROWS) : ''}</article>`;
          })
          .join('')}</div>`
      : `<p class="kmap-empty">${esc(w.nothingMatches)}</p>`;
  }

  const sep = '<span aria-hidden="true">·</span>';
  const flag = (k: MapAttentionKind) =>
    `<span><span class="kmap-dot ${k}" aria-hidden="true"></span><b>${esc(f.num(sum[k]))}</b> ${esc(w.list.sum[k])}</span>`;
  const floors =
    plan.levels.length > 1
      ? `<fieldset class="kmap-seg" aria-label="${esc(w.floor)}"><button type="button" ${pressed(query.floor === 'all')} data-act="list-floor" data-arg="all" data-k="list-floor:all">${esc(w.allFloors)}</button>${plan.levels
          .map(
            (l) =>
              `<button type="button" ${pressed(query.floor === l.key)} data-act="list-floor" data-arg="${esc(l.key)}" data-k="list-floor:${esc(l.key)}">${esc(l.name)}</button>`,
          )
          .join('')}</fieldset>`
      : '';
  return `<div class="kd-list-head">
      <h2 id="kd-whats-in" class="kd-title">${esc(w.list.title(a.name))}</h2>
      <p class="kmap-sum"><span><b>${esc(w.things(sum.things, f.num(sum.things)))}</b>${sep}${esc(w.list.rooms(sum.rooms, f.num(sum.rooms)))}${sum.floors > 1 ? `${sep}${esc(w.list.floors(sum.floors, f.num(sum.floors)))}` : ''}</span>${flag('low')}${flag('lent')}${flag('due')}</p>
    </div>
    <div class="kd-list-tools">
      <input type="search" class="kmap-input kd-list-find" data-input="list-q" data-k="list-q" value="${esc(query.q)}" placeholder="${esc(w.list.find)}" aria-label="${esc(w.list.findLabel)}">
      ${floors}
      <fieldset class="kmap-seg" aria-label="${esc(w.list.show)}"><button type="button" ${pressed(query.show === 'room')} data-act="list-show" data-arg="room" data-k="list-show:room">${esc(w.list.byRoom)}</button><button type="button" ${pressed(query.show === 'attention')} data-act="list-show" data-arg="attention" data-k="list-show:attention">${esc(w.list.attention)}</button></fieldset>
    </div>
    ${body}`;
}
