/**
 * "Try the map" (D241): Kept's shipped location map on the docs site, with a sample home.
 *
 * The scene is the app's own: MapEngine, the plan, the label declutter and map.css come straight
 * from apps/web/src/map (1.6.0, D237), and so do the 21 Poly Haven models, bundled from the same
 * files. What the app wraps around the engine is a React component tied to its router, queries,
 * auth and Lingui catalogues; this is that component's controls and card again in plain DOM, fed
 * by the sample instead of the server, so the page needs no framework and no app code beyond the
 * map's. Arrange works in memory: Done keeps the changes while the page is open, Cancel throws the
 * session away, and Reset puts the sample back. A selected room moves by its floor or, as in the
 * app, by the arrow keys (#301). It shows what the app shows (#301): What's in under the map,
 * names first (the amber tape only on a printed label), the card's type, tags, photo and label QR,
 * Cancel's question and Done's Undo; the links into Kept lead to Install Kept. Nothing is saved or sent; only the Detailed models
 * choice is remembered, as the app remembers it.
 */
import {
  baseModel,
  builtinTypeName,
  canBeCarried,
  capacityOf,
  carryOf,
  hangRange,
  levelShort,
  MAP_MODEL_KEYS,
  MAP_ROOM_KINDS,
  MAP_SURFACES,
  type MapModelKey,
  type MapRoomKind,
  type MapSurface,
  printedCode,
  ROOM_KIND_SURFACE,
  SHAPE_GROUP,
  SHAPE_GROUPS,
  type ShapeInput,
  STAIR_MODELS,
  searchShapes,
  suggestShapes,
} from '@kept/shared';
import type {
  MapAttention,
  MapAttentionKind,
  MapThingView,
} from '../../../../web/src/api/map/types';
import { qrPath } from '../../../../web/src/components/ui/qr-path';
import {
  type EngineState,
  type EngineStats,
  type Hint,
  MapEngine,
  type Quality,
  type Tool,
} from '../../../../web/src/map/engine/engine';
import { modelStats } from '../../../../web/src/map/engine/models';
import {
  addableOn,
  allUnder,
  childrenOn,
  contentsOf,
  countIn,
  flagsOf,
  holdersFor,
  type Item,
  isArrow,
  type Level,
  OWN_ARROWS,
  type Plan,
  planOf,
  putOn,
  type Room,
  reshape,
  roomOn,
  seated,
  setHang,
  takeOff,
  thingItem,
} from '../../../../web/src/map/layout';
import {
  addOn,
  type ListQuery,
  matches,
  offMapFor,
  offMapIn,
  whereOf,
} from '../../../../web/src/map/list';
// Inline, not imported as stylesheets: Astro would link those from every page of the site.
import mapCss from '../../../../web/src/map/map.css?inline';
import { SHAPE_LIBRARY_URL, SHAPE_REQUEST_URL } from '../../../../web/src/map/shape-links';
// D249: the shape picker's pictures, the app's own sprite (fetched when the picker first opens).
import spriteUrl from '../../../../web/src/map/thumbs/shapes.webp?url';
import { THUMB_CELLS, THUMB_COLS } from '../../../../web/src/map/thumbs/sprite';
import { cardPath } from '../../../../web/src/map/where';
import demoCss from './demo.css?inline';
import { esc, idChip, labelTape } from './html';
import { PHOTOS } from './photos';
import { sampleHome } from './sample';
import {
  formatter,
  GROUP_NAMES,
  type Lang,
  MODEL_NAMES,
  ROOM_KIND_NAMES,
  SURFACE_NAMES,
  WORDS,
} from './strings';
import { whatsInHtml } from './whats-in';

const QUALITY_KEY = 'kept.map.quality';
/** The Height field's step, in metres (apps/web/src/map/height.tsx). */
const HEIGHT_STEP = 0.05;
const KINDS = ['low', 'lent', 'due'] as const;
/** A list longer than this gets a search (apps/web/src/map/put-on.tsx). */
const SEARCH_FROM = 8;
/** How long Done's Undo stays (apps/web/src/components/history/undo.ts UNDO_TOAST_MS). */
const UNDO_MS = 10_000;
/** The address a printed label carries is its own Kept's (D120); the sample's is a stand-in. */
const LABEL_ORIGIN = 'https://kept.example';

const clone = (p: Plan): Plan => ({
  levels: p.levels.map((l) => ({ ...l })),
  rooms: p.rooms.map((r) => ({ ...r })),
  items: p.items.map((i) => ({ ...i })),
});

function storedQuality(): Quality {
  try {
    return localStorage.getItem(QUALITY_KEY) === 'simple' ? 'simple' : 'detailed';
  } catch {
    return 'detailed';
  }
}

const ICON = {
  turnLeft:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>',
  turnRight:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4h-4"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 11l8-7 8 7v9H4z"/></svg>',
  camera:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h3l2-3h4l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>',
};

export type MountOptions = {
  lang: Lang;
  /** Where "Install Kept" goes (the site's install page, with its base path). */
  installHref: string;
};

export function mount(root: HTMLElement, { lang, installHref }: MountOptions): () => void {
  const w = WORDS[lang];
  const f = formatter(lang);
  const pick = (two: readonly [string, string]) => (lang === 'ar' ? two[1] : two[0]);
  const debug = new URLSearchParams(location.search).get('debug') === 'map';

  const sample = sampleHome(lang);
  const view = sample.view;
  const name = sample.location;
  const contents = contentsOf(view);
  const samplePlan = planOf(view, { noFloor: w.noFloor, location: name });

  // ---- The page ------------------------------------------------------------------------------

  const host = root.querySelector<HTMLElement>('[data-try-map]');
  if (!host) throw new Error('try-map: no [data-try-map] element');
  const style = document.createElement('style');
  style.textContent = `${mapCss}\n${demoCss}`;
  document.head.append(style);
  host.innerHTML = `
    <div class="kmap kd-map">
      <section class="kmap-stage" data-card="false" aria-label="${esc(w.mapOf(name))}">
        <canvas></canvas>
        <div class="kmap-labels" aria-hidden="true"></div>
        <div class="kmap-tip" hidden></div>
        <div class="kd-overlay" data-slot="overlay"></div>
        <p class="kd-sr" role="status" aria-live="polite" data-slot="said"></p>
      </section>
      <section class="kd-sr" data-slot="places" aria-label="${esc(w.placesHere)}"></section>
      <section class="kd-list" data-slot="list" aria-labelledby="kd-whats-in"></section>
      <div class="kd-toasts" data-slot="toasts"></div>
    </div>`;
  const stage = host.querySelector<HTMLElement>('.kmap-stage') as HTMLElement;
  const canvas = host.querySelector<HTMLCanvasElement>('canvas') as HTMLCanvasElement;
  const labels = host.querySelector<HTMLElement>('.kmap-labels') as HTMLElement;
  const tip = host.querySelector<HTMLElement>('.kmap-tip') as HTMLElement;
  const overlay = host.querySelector<HTMLElement>('[data-slot="overlay"]') as HTMLElement;
  const places = host.querySelector<HTMLElement>('[data-slot="places"]') as HTMLElement;
  const said = host.querySelector<HTMLElement>('[data-slot="said"]') as HTMLElement;
  const list = host.querySelector<HTMLElement>('[data-slot="list"]') as HTMLElement;
  const toasts = host.querySelector<HTMLElement>('[data-slot="toasts"]') as HTMLElement;

  // ---- State, as the app's MapBody keeps it ---------------------------------------------------

  let saved = clone(samplePlan);
  let plan = clone(saved);
  let es: EngineState = {
    levelKey: plan.levels[0]?.key ?? '_',
    allFloors: false,
    focused: null,
    selected: null,
    planView: false,
    arranging: false,
    tool: 'move',
  };
  let hint: Hint = 'move';
  let dirty = false;
  let quality = storedQuality();
  let pins: Record<MapAttentionKind, boolean> = { low: true, lent: true, due: true };
  let detail = false;
  let inner: string | null = null;
  let filter = '';
  let adding = '';
  let glError = false;
  let selKey = '';
  let seq = 0;
  let engine: MapEngine | null = null;
  /** What's in: its search, floor and grouping, and the cards showing all their rows. */
  let query: ListQuery = { q: '', floor: 'all', show: 'room' };
  let opened = new Set<string>();

  // ---- Words for a thing ---------------------------------------------------------------------

  const attentionWords = (a: MapAttention): string => {
    if (a.kind === 'low') return w.low(f.num(a.quantity ?? 0), f.num(a.min ?? 0));
    if (a.kind === 'lent') {
      const who = a.person ?? w.someone;
      return a.dueOn ? w.lentBack(who, f.day(a.dueOn)) : w.lentTo(who);
    }
    const what = a.title ?? w.dueWord;
    if (!a.dueOn) return what;
    return a.state === 'overdue' ? w.overdue(what, f.day(a.dueOn)) : w.dueOn(what, f.day(a.dueOn));
  };
  const dots = (flags: MapAttentionKind[]) =>
    flags.map((k) => `<span class="kmap-dot ${k}" aria-hidden="true"></span>`).join('');
  const statusRows = (rows: MapAttention[]) =>
    rows.length
      ? `<div class="kmap-status">${rows
          .map(
            (a) =>
              `<div><span class="kmap-dot ${a.kind}" aria-hidden="true"></span><span>${esc(attentionWords(a))}</span></div>`,
          )
          .join('')}</div>`
      : '';
  /** The label: Kept's own QR (the address a printed label carries) and the short ID, as the
   * app's card draws them (the QR from the same code, components/ui/qr-path.ts). */
  const idBlock = (code: string | null, place: boolean) => {
    if (!code) return '';
    const url = `${LABEL_ORIGIN}/l/${code}`;
    const printed = printedCode(code);
    const qr = qrPath(url);
    return `<div class="kmap-idrow">
      <div class="kmap-qr"><svg role="img" aria-label="${esc(w.qrLabel(printed))}" viewBox="0 0 ${qr.n} ${qr.n}" width="72" height="72" shape-rendering="crispEdges"><rect width="${qr.n}" height="${qr.n}" fill="#FFFFFF"/><path d="${qr.d}" fill="#1C1B19"/></svg></div>
      <div class="kd-idtext"><span class="kmap-sub">${esc(place ? w.labelPlace : w.labelThing)}</span><span class="kmap-code" dir="ltr">${esc(printed)}</span><small class="kd-url" dir="ltr">${esc(url.replace(/^https?:\/\//, ''))}</small></div>
    </div>`;
  };
  /** A tag as the app's chip (components/tags/chip.tsx): its colour's dot, on a tint of it. */
  const tagChips = (tags: { name: string; colour: string }[]) =>
    `<span class="kd-tags">${tags
      .map(
        (g) =>
          `<span class="kd-tag" style="--tag:${esc(g.colour)}"><span class="kd-tag-dot" aria-hidden="true"></span><bdi>${esc(g.name)}</bdi></span>`,
      )
      .join('')}</span>`;
  /** A thing's photo, or the camera of one not taken yet. */
  const photo = (id: string | null) => {
    const key = id ? sample.facts.get(id)?.photo : undefined;
    return key
      ? `<div class="kmap-photo kd-has-photo"><img src="${esc(PHOTOS[key])}" alt="" width="64" height="64"></div>`
      : `<div class="kmap-photo" title="${esc(w.noPhoto)}">${ICON.camera}</div>`;
  };
  /** The card's links into Kept: here they lead to Install Kept. */
  const kept = (label: string) =>
    `<a class="kmap-btn" href="${esc(installHref)}">${esc(label)}</a>`;
  const factsOf = (id: string) => {
    const x = sample.facts.get(id);
    if (!x) return '';
    // [label, value as HTML]
    const rows: [string, string][] = [];
    rows.push([w.facts.type, esc(x.type ? (builtinTypeName(x.type, lang) ?? w.noType) : w.noType)]);
    if (x.quantity !== undefined && x.quantity !== 1)
      rows.push([w.facts.quantity, esc(f.num(x.quantity))]);
    if (x.brand) rows.push([w.facts.brand, esc(x.brand)]);
    if (x.model) rows.push([w.facts.model, esc(x.model)]);
    if (x.serial)
      rows.push([w.facts.serial, `<span dir="ltr" class="kd-mono">${esc(x.serial)}</span>`]);
    if (x.condition) rows.push([w.facts.condition, esc(x.condition)]);
    // #209: its tags.
    if (x.tags?.length) rows.push([w.facts.tags, tagChips(x.tags)]);
    return `<dl class="kmap-facts">${rows.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${b}</dd>`).join('')}</dl>`;
  };
  const head = (title: string, meta: string) =>
    `<div class="kmap-peek"><div class="kd-col"><h2>${esc(title)}</h2><div class="kmap-meta">${meta}</div></div><button type="button" class="kmap-x" data-act="close" data-k="close" aria-label="${esc(w.close)}">×</button></div>`;
  /** #138: Height, as the app's (apps/web/src/map/height.tsx): − and + by 5 cm, arrow keys, or a
   * typed height, kept to where the thing can hang. */
  const heightField = (it: Item) => {
    if (it.hang === undefined) return '';
    const r = hangRange(it.model);
    const lowest = it.hang <= Math.ceil(r.min / HEIGHT_STEP - 1e-9) * HEIGHT_STEP + 1e-9;
    const highest = it.hang >= Math.floor(r.max / HEIGHT_STEP + 1e-9) * HEIGHT_STEP - 1e-9;
    return `<div class="kmap-height">
      <label class="kmap-sub" for="kd-height">${esc(w.height.label)}</label>
      <div class="kmap-height-row" role="group" aria-label="${esc(w.height.label)}">
        <button type="button" data-act="height" data-arg="-1" data-k="height:-" aria-label="${esc(w.height.lower)}"${lowest ? ' disabled' : ''}>−</button>
        <input id="kd-height" class="kmap-input" inputmode="decimal" autocomplete="off" data-input="height" data-k="height" data-id="${esc(it.id)}" value="${esc(w.height.value(f.num(it.hang)))}" aria-describedby="kd-height-help">
        <button type="button" data-act="height" data-arg="1" data-k="height:+" aria-label="${esc(w.height.higher)}"${highest ? ' disabled' : ''}>+</button>
      </div>
      <span id="kd-height-help" class="kmap-height-help">${esc(w.height.help)}</span>
    </div>`;
  };
  const btn = (act: string, label: string, cls = '', arg = '') =>
    `<button type="button" class="kmap-btn${cls ? ` ${cls}` : ''}" data-act="${act}"${arg ? ` data-arg="${esc(arg)}"` : ''} data-k="${esc(`${act}:${arg}`)}">${esc(label)}</button>`;

  // ---- The card (apps/web/src/map/card.tsx) ---------------------------------------------------

  function insideList(things: MapThingView[]) {
    const rows = things.filter((x) => matches(filter, x.name, x.shortCode));
    if (!rows.length) return `<p class="kmap-empty">${esc(w.nothingMatches)}</p>`;
    return `<ul class="kmap-inv">${rows
      .map(
        (x) =>
          `<li><button type="button" data-act="inner" data-arg="${esc(x.id)}" data-k="inner:${esc(x.id)}"><span>${esc(x.name)}${dots(flagsOf(contents, x.id))}</span><small>${labelTape(x.shortCode, x.labelPrinted) || ' '}</small><span class="q">×${esc(f.num(x.quantity))}</span></button></li>`,
      )
      .join('')}</ul>`;
  }

  function card(): string {
    const sel = es.selected;
    if (!sel) return '';
    const rooms = new Map(plan.rooms.map((r) => [r.id, r]));

    if (inner) {
      const thing = view.things.find((x) => x.id === inner);
      const node = plan.items.find((x) => x.id === inner);
      const title = node?.name ?? thing?.name ?? '';
      const code = node?.shortCode ?? thing?.shortCode ?? null;
      const printed = node?.labelPrinted === true || thing?.labelPrinted === true;
      const where = whereOf(plan, view, inner).path;
      const back =
        sel.type === 'item'
          ? plan.items.find((x) => x.id === sel.id)?.name
          : rooms.get(sel.id)?.name;
      return `<aside data-map-obstacle class="kmap-panel full" aria-live="polite">
        <div class="kmap-row"><button type="button" class="kmap-btn ghost" data-act="back" data-k="back"><span class="kd-flip" aria-hidden="true">‹</span> ${esc(back ?? '')}</button></div>
        ${head(title, `<span>${esc(where.join(' › '))}</span>${idChip(code, printed)}`)}
        ${statusRows(contents.rows.get(inner) ?? [])}
        ${idBlock(code, false)}
        ${factsOf(inner)}
        <div class="kmap-row kmap-open">${kept(w.openThing)}</div>
      </aside>`;
    }

    if (sel.type === 'room') {
      const r = rooms.get(sel.id);
      if (!r) return '';
      const inside = plan.items.filter((i) => i.roomId === r.id);
      const total = allUnder(contents, r.id).length;
      const full = detail || es.arranging;
      const level = plan.levels.find((l) => l.key === es.levelKey);
      const meta = [
        `<span>${esc(pick(ROOM_KIND_NAMES[r.kind]))}</span>`,
        level ? `<span>${esc(level.name)}</span>` : '',
        `<span>${esc(w.size(f.num(Math.round(r.w * 10) / 10), f.num(Math.round(r.d * 10) / 10)))}</span>`,
        `<span>${esc(w.things(total, f.num(total)))}</span>`,
      ].join('');
      let body = `<div class="kmap-row">${es.focused === r.id ? '' : btn('drill', w.open, 'primary', r.id)}${full ? '' : btn('detail', w.whatsHere(f.num(inside.length)))}${kept(w.openPlace)}${es.arranging ? '' : kept(w.photograph)}${kept(w.countRoom)}</div>`;
      if (es.arranging) {
        const addable = offMapIn(plan, view, r.id)
          .filter((x) => matches(adding, x.name, x.shortCode))
          .slice(0, 30);
        body += `<div class="kmap-sub">${esc(w.kind)}</div>
          <fieldset class="kmap-seg" aria-label="${esc(w.kind)}">${MAP_ROOM_KINDS.map(
            (k) =>
              `<button type="button" aria-pressed="${r.kind === k}" data-act="kind" data-arg="${k}" data-k="kind:${k}">${esc(pick(ROOM_KIND_NAMES[k]))}</button>`,
          ).join('')}</fieldset>
          <div class="kmap-sub">${esc(w.surface)}</div>
          <fieldset class="kmap-seg" aria-label="${esc(w.surface)}">${MAP_SURFACES.map(
            (k) =>
              `<button type="button" aria-pressed="${r.surface === k}" data-act="surface" data-arg="${k}" data-k="surface:${k}">${esc(pick(SURFACE_NAMES[k]))}</button>`,
          ).join('')}</fieldset>
          <div class="kmap-sub">${esc(w.putOnMap)}</div>
          <input type="search" class="kmap-input" data-input="adding" data-k="adding" value="${esc(adding)}" placeholder="${esc(w.findThingIn(r.name))}" aria-label="${esc(w.findThingLabel)}">
          ${
            addable.length
              ? `<ul class="kmap-inv">${addable
                  .map(
                    (x) =>
                      `<li><button type="button" data-act="add" data-arg="${esc(x.id)}" data-k="add:${esc(x.id)}"><span>${esc(x.name)}</span><small>${labelTape(x.shortCode, x.labelPrinted) || ' '}</small><span class="q">+</span></button></li>`,
                  )
                  .join('')}</ul>`
              : `<p class="kmap-empty">${esc(w.everythingOnMap)}</p>`
          }`;
      }
      if (full && !es.arranging) {
        body += `<ul class="kmap-inv">${inside
          .map((i) => {
            const n = countIn(contents, i);
            const on = i.on ? plan.items.find((x) => x.id === i.on)?.name : null;
            return `<li><button type="button" data-act="select" data-arg="${esc(i.id)}" data-k="select:${esc(i.id)}"><span>${esc(i.name)}${dots(flagsOf(contents, i.id))}</span><small>${labelTape(i.shortCode, i.labelPrinted)}${on ? ` · ${esc(w.onHost(on))}` : ''}</small><span class="q">${n !== null ? esc(f.num(n)) : ''}</span></button></li>`;
          })
          .join('')}</ul>`;
      }
      return `<aside data-map-obstacle class="kmap-panel${full ? ' full' : ''}" aria-live="polite">${head(r.name, meta)}${body}</aside>`;
    }

    const it = plan.items.find((x) => x.id === sel.id);
    if (!it) return '';
    const room = rooms.get(it.roomId);
    const n = countIn(contents, it);
    const under = contents.under.get(it.id) ?? [];
    const onIt = plan.items.filter((x) => x.on === it.id);
    const meta = cardPath(plan, view, it).join(' › ');
    const levels = plan.levels;
    const li = levels.findIndex((l) => l.key === room?.levelKey);
    const stairs = STAIR_MODELS.has(baseModel(it.model))
      ? [levels[li + 1], levels[li - 1]].filter((l): l is Level => !!l)
      : [];
    const within = KINDS.map(
      (k) =>
        [
          k,
          allUnder(contents, it.id).filter((x) => contents.own.get(x.id)?.has(k)).length,
        ] as const,
    ).filter(([, c]) => c > 0);
    const own = contents.rows.get(it.id) ?? [];
    const buttons = `<div class="kmap-row">
      ${stairs
        .map((l) =>
          btn(
            'level',
            levels.indexOf(l) > li ? w.upTo(l.name) : w.downTo(l.name),
            'primary',
            l.key,
          ),
        )
        .join('')}
      ${n !== null && !detail ? btn('detail', w.insideN(f.num(n)), stairs.length ? '' : 'primary') : ''}
      ${detail ? '' : btn('detail', w.details)}
      ${es.arranging && canBeCarried(it.model) && (it.on || holdersFor(plan.items, it).length) ? btn('puton', w.put.putOn, '', it.id).replace('<button ', '<button aria-haspopup="dialog" ') : ''}
      ${es.arranging && carryOf(it.model) ? btn('addon', w.put.addOn, '', it.id).replace('<button ', '<button aria-haspopup="dialog" ') : ''}
      ${es.arranging && !seated(plan.items, it) && it.hang === undefined ? btn('turn', w.turn, '', it.id) : ''}
      ${es.arranging && !it.auto ? btn('remove', w.takeOff, '', it.id) : ''}
      ${detail ? btn('less', w.less, 'ghost') : ''}
    </div>`;
    const headEl = head(
      it.name,
      `<span>${esc(meta)}</span>${idChip(it.shortCode, it.labelPrinted === true)}`,
    );
    const insideLine = within.length
      ? `<div class="kmap-status"><div>${within
          .map(
            ([k, c]) =>
              `<span class="kd-within"><span class="kmap-dot ${k}" aria-hidden="true"></span><span>${esc(w.within[k](f.num(c)))}</span></span>`,
          )
          .join('')}</div></div>`
      : '';
    const shape = es.arranging
      ? `<div class="kmap-shape"><span>${esc(w.shapeLine(pick(MODEL_NAMES[baseModel(it.model)]), it.shapeFrom))}</span>${btn(
          'shapes',
          it.shapeFrom === 'guess' ? w.pickShape : w.change,
          it.shapeFrom === 'guess' ? 'primary' : '',
          it.id,
        ).replace('<button ', '<button aria-haspopup="dialog" ')}</div>${heightField(it)}`
      : '';
    if (!detail) {
      return `<aside data-map-obstacle class="kmap-panel" aria-live="polite">${headEl}${statusRows(own)}${insideLine}${buttons}${shape}</aside>`;
    }
    const places = it.subject === 'place' ? (sample.facts.get(it.id)?.places ?? 0) : 0;
    const placesLine = places ? `<span>${esc(w.placesIn(places, f.num(places)))}</span>` : '';
    const insideSection =
      n !== null
        ? `<div class="kmap-sub">${esc(w.insideN(f.num(n)))}</div>
          ${under.length > 5 ? `<input type="search" class="kmap-input" data-input="filter" data-k="filter" value="${esc(filter)}" placeholder="${esc(w.findInside(it.name))}" aria-label="${esc(w.findInsideLabel)}">` : ''}
          ${under.length ? insideList(under) : `<p class="kmap-empty">${esc(w.nothingYet)}</p>`}`
        : '';
    const onItSection = onIt.length
      ? `<div class="kmap-sub">${esc(w.onIt)}</div><ul class="kmap-inv">${onIt
          .map(
            (c) =>
              `<li><button type="button" data-act="select" data-arg="${esc(c.id)}" data-k="select:${esc(c.id)}"><span>${esc(c.name)}${dots(flagsOf(contents, c.id))}</span><small>${labelTape(c.shortCode, c.labelPrinted) || ' '}</small><span class="q">${esc(countIn(contents, c) ?? '')}</span></button></li>`,
          )
          .join('')}</ul>`
      : '';
    return `<aside data-map-obstacle class="kmap-panel full" aria-live="polite">
      ${headEl}
      <div class="kmap-card-head">
        ${photo(it.subject === 'thing' ? it.id : null)}
        <div class="kd-col kd-small">
          <span>${esc(pick(MODEL_NAMES[baseModel(it.model)]))}${n !== null ? ` · ${esc(w.thingsInside(n, f.num(n)))}` : ''}</span>
          <span class="kd-wrap">${esc(meta)}</span>
          ${it.hang === undefined ? '' : `<span>${esc(w.height.onWall(f.num(it.hang)))}</span>`}
          ${placesLine}
        </div>
      </div>
      ${statusRows(own)}
      ${buttons}
      ${shape}
      ${idBlock(it.shortCode, it.subject === 'place' || it.isContainer)}
      ${it.subject === 'thing' ? factsOf(it.id) : ''}
      <div class="kmap-row kmap-open">${kept(it.subject === 'thing' ? w.openThing : w.openPlace)}</div>
      ${onItSection}
      ${insideSection}
    </aside>`;
  }

  // ---- The controls (apps/web/src/map/map-view.tsx) ------------------------------------------

  function controls(): string {
    const levels = plan.levels;
    const levelName = levels.find((l) => l.key === es.levelKey)?.name ?? '';
    const focusedRoom = es.focused ? plan.rooms.find((r) => r.id === es.focused) : undefined;
    const crumb = `<nav data-map-obstacle class="kmap-crumb" aria-label="${esc(w.where)}">
        <button type="button" data-act="all" data-k="crumb-all">${esc(name)}</button>
        ${!es.allFloors && levels.length > 1 ? `<span aria-hidden="true">›</span><button type="button" data-act="up" data-k="crumb-up">${esc(levelName)}</button>` : ''}
        ${focusedRoom ? `<span aria-hidden="true">›</span><span>${esc(focusedRoom.name)}</span>` : ''}
      </nav>`;
    const seg = `<fieldset data-map-obstacle class="kmap-seg" aria-label="${esc(w.view)}">
        <button type="button" aria-pressed="${!es.planView}" data-act="view3d" data-k="view3d">${esc(w.threeD)}</button>
        <button type="button" aria-pressed="${es.planView}" data-act="viewplan" data-k="viewplan">${esc(w.plan)}</button>
      </fieldset>`;
    const arrange = es.arranging
      ? `<button type="button" class="kmap-btn primary" data-act="done" data-k="done">${esc(w.done)}</button>`
      : `<button type="button" data-map-obstacle class="kmap-btn" data-act="arrange" data-k="arrange">${esc(w.arrange)}</button>`;
    const chips = `<fieldset data-map-obstacle class="kmap-chips" aria-label="${esc(w.pins)}">${KINDS.map(
      (k) =>
        `<button type="button" class="kmap-chip" aria-pressed="${pins[k]}" data-act="pin" data-arg="${k}" data-k="pin:${k}"><span class="kmap-dot ${k}" aria-hidden="true"></span><span class="kmap-long">${esc(w.pin[k].long)}</span><span class="kmap-short">${esc(w.pin[k].short)}</span></button>`,
    ).join('')}</fieldset>`;
    const tools = es.arranging
      ? `<div class="kmap-tools" data-map-obstacle data-map-reserve="top">
          <fieldset class="kmap-seg" aria-label="${esc(w.arrangeTool)}">
            <button type="button" aria-pressed="${es.tool === 'move'}" data-act="tool" data-arg="move" data-k="tool:move">${esc(w.move)}</button>
            <button type="button" aria-pressed="${es.tool === 'room'}" data-act="tool" data-arg="room" data-k="tool:room">${esc(w.drawRoom)}</button>
          </fieldset>
          ${btn('floor', w.addFloor)}
          ${btn('cancel', w.cancel)}
          <div class="kmap-hint">${esc(w.hints[hint])}</div>
        </div>`
      : '';
    const floors =
      levels.length > 1
        ? `<fieldset class="kmap-floors" aria-label="${esc(w.floor)}">${[...levels]
            .reverse()
            .map(
              (l) =>
                `<button type="button" style="--o:${levels.indexOf(l)}" aria-label="${esc(l.name)}" title="${esc(l.name)}" aria-pressed="${!es.allFloors && l.key === es.levelKey}" data-act="level" data-arg="${esc(l.key)}" data-k="level:${esc(l.key)}">${esc(l.short)}</button>`,
            )
            .join(
              '',
            )}<button type="button" class="all" style="--o:99" aria-label="${esc(w.allFloors)}" title="${esc(w.allFloors)}" aria-pressed="${es.allFloors}" data-act="all" data-k="all">${esc(w.all)}</button></fieldset>`
        : '';
    const ctl = `<div class="kmap-ctl" data-map-obstacle data-map-reserve="bottom">
        ${floors}
        <button type="button" aria-label="${esc(w.zoomIn)}" data-act="zoomin" data-k="zoomin">+</button>
        <button type="button" aria-label="${esc(w.zoomOut)}" data-act="zoomout" data-k="zoomout">−</button>
        ${
          es.planView
            ? ''
            : `<button type="button" aria-label="${esc(w.turnLeft)}" data-act="turnleft" data-k="turnleft">${ICON.turnLeft}</button>
               <button type="button" class="kmap-turn-end" aria-label="${esc(w.turnRight)}" data-act="turnright" data-k="turnright">${ICON.turnRight}</button>`
        }
        <button type="button" aria-label="${esc(w.home)}" data-act="home" data-k="home">${ICON.home}</button>
      </div>`;
    const readout = `<div class="kmap-readout" data-map-obstacle data-map-reserve="bottom">
        ${debug ? '<div data-slot="stats"></div>' : ''}
        <div class="kmap-toggles">
          <button type="button" role="switch" class="kd-switch" aria-checked="${quality === 'detailed'}" data-act="quality" data-k="quality"><span class="kd-track" aria-hidden="true"><span class="kd-thumb"></span></span>${esc(w.detailed)}</button>
        </div>
      </div>`;
    const gl = glError ? `<div class="kd-glerror">${esc(w.glError)}</div>` : '';
    // #330: the bar, Arrange's tools and the card in one column, as the app has them (map.css).
    return `${gl}<div class="kmap-stack"><div class="kmap-bar" data-map-reserve="top">${crumb}${seg}${arrange}${chips}</div>${tools}${card()}</div>${ctl}${readout}`;
  }

  /** M9: the floor's rooms and what stands in them, for screen readers and keyboards. */
  function placesList(): string {
    const here = plan.rooms.filter((r) => r.levelKey === es.levelKey);
    return `<h2>${esc(w.placesHere)}</h2><ul>${here
      .map((r) => {
        const inRoom = plan.items.filter((i) => i.roomId === r.id && !i.on);
        return `<li><button type="button" class="kmap-nm" data-act="show-room" data-arg="${esc(r.id)}">${esc(r.name)}</button>${
          inRoom.length
            ? `<ul class="kmap-crows">${inRoom
                .map((i) => {
                  const n = countIn(contents, i);
                  return `<li><button type="button" data-act="show-item" data-arg="${esc(i.id)}">${esc(i.name)}${n !== null ? ` · ${esc(f.num(n))}` : ''}</button></li>`;
                })
                .join('')}</ul>`
            : ''
        }</li>`;
      })
      .join('')}</ul>`;
  }

  /** Redraws `into`, keeping the focus (and a search's caret) where it was. */
  function redraw(into: HTMLElement, html: string): void {
    const active = document.activeElement as HTMLElement | null;
    const key = active && into.contains(active) ? active.dataset.k : undefined;
    const caret = active instanceof HTMLInputElement ? active.selectionStart : null;
    into.innerHTML = html;
    if (key) {
      const el = into.querySelector<HTMLElement>(`[data-k="${CSS.escape(key)}"]`);
      el?.focus({ preventScroll: true });
      if (el instanceof HTMLInputElement && caret !== null) el.setSelectionRange(caret, caret);
    }
  }

  /** Redraws the controls and the card. */
  function render(): void {
    stage.dataset.card = es.selected ? 'true' : 'false';
    redraw(overlay, controls());
    places.innerHTML = placesList();
    resetButton.hidden = !changed();
  }

  /** Redraws What's in: when its own controls change, and when the plan does. */
  function renderList(): void {
    redraw(list, whatsInHtml({ name, plan, view, contents, query, opened, w, f, attentionWords }));
  }

  const resetButton = root.querySelector<HTMLButtonElement>(
    '[data-act="reset"]',
  ) as HTMLButtonElement;
  const sampleJson = JSON.stringify(samplePlan);
  const changed = () => dirty || JSON.stringify(saved) !== sampleJson;

  // ---- Arranging, in memory ------------------------------------------------------------------

  const mutate = (fn: (p: Plan) => void) => {
    if (!engine) return;
    fn(engine.plan);
    engine.changed();
  };

  function drawRoom(rect: { x: number; z: number; w: number; d: number }, levelKey: string) {
    if (!engine) return;
    const n = engine.plan.rooms.filter((r) => r.levelKey === levelKey).length + 1;
    const room: Room = {
      id: `new-room-${++seq}`,
      levelKey,
      name: w.roomN(String(n)),
      shortCode: null,
      kindKey: 'room',
      ...rect,
      kind: 'room',
      surface: ROOM_KIND_SURFACE.room,
    };
    engine.plan.rooms.push(room);
    engine.changed();
    engine.setTool('move');
    engine.selectRoom(room.id);
  }

  function addFloor() {
    if (!engine) return;
    const n = engine.plan.levels.length + 1;
    const key = `new-floor-${++seq}`;
    const floorName = w.floorN(String(n));
    engine.plan.levels.push({ key, id: key, name: floorName, short: levelShort(floorName, n - 1) });
    engine.plan.rooms.push({
      id: `new-room-${++seq}`,
      levelKey: key,
      name: w.roomN('1'),
      shortCode: null,
      kindKey: 'room',
      x: 0,
      z: 0,
      w: 4,
      d: 4,
      kind: 'room',
      surface: 'wood',
    });
    engine.changed();
    engine.setLevel(key);
  }

  /** Shapes picked in this session, kept if the thing goes off the map and back on (D249). */
  const chosen = new Map<string, MapModelKey>();

  const chosenShape = (id: string) => chosen.get(id) ?? null;

  function addThing(roomId: string, id: string) {
    const x = view.things.find((t) => t.id === id);
    if (!x) return;
    mutate((p) => {
      const room = p.rooms.find((r) => r.id === roomId);
      if (room) p.items.push(thingItem(x, room, chosenShape(x.id)));
    });
    engine?.select({ type: 'item', id: x.id });
  }

  function setShape(id: string, model: MapModelKey) {
    mutate((p) => {
      const it = p.items.find((i) => i.id === id);
      if (!it) return;
      chosen.set(id, model);
      // A wall shape hangs it (#138); what it can no longer carry goes on the floor (#137).
      reshape(p.items, p.rooms, it, model);
    });
    engine?.select({ type: 'item', id });
  }

  // ---- Put on… and Add on it (apps/web/src/map/put-on.tsx), as native modal dialogs (#137) ---

  /** A dialog in the shape picker's frame: a title, then `body`. */
  function sheet(title: string, body: string, back: string): HTMLDialogElement {
    const dlg = document.createElement('dialog');
    dlg.className = 'kd-shapes kd-put';
    dlg.dir = lang === 'ar' ? 'rtl' : 'ltr';
    dlg.setAttribute('aria-labelledby', 'kd-put-title');
    dlg.innerHTML = `<div class="kd-shapes-head"><h2 id="kd-put-title">${esc(title)}</h2><button type="button" class="kmap-x" data-put="close" aria-label="${esc(w.close)}">×</button></div><div class="kput">${body}</div>`;
    dlg.querySelector('[data-put="close"]')?.addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (ev) => {
      if (ev.target === dlg) dlg.close();
    });
    dlg.addEventListener('close', () => {
      dlg.remove();
      overlay.querySelector<HTMLElement>(`[data-k="${CSS.escape(back)}"]`)?.focus();
    });
    root.append(dlg);
    dlg.showModal();
    return dlg;
  }
  const putRow = (it: Item, sub: string, selected = false, disabled = false) =>
    `<div role="option" class="kput-option" tabindex="-1" data-id="${esc(it.id)}" aria-selected="${selected}"${disabled ? ' aria-disabled="true"' : ''}>${thumb(baseModel(it.model), 44)}<span class="kput-text"><span>${esc(it.name)}</span><small>${esc(sub)}</small></span></div>`;
  /** Arrow keys, Home and End move through a listbox's options. */
  function listKeys(list: HTMLElement, onPick: (el: HTMLElement) => void) {
    const opts = () =>
      [...list.querySelectorAll<HTMLElement>('[role="option"]')].filter((o) => !o.hidden);
    const first = opts()[0];
    if (first) first.tabIndex = 0;
    list.addEventListener('click', (ev) => {
      const o = (ev.target as HTMLElement).closest<HTMLElement>('[role="option"]');
      if (o && o.getAttribute('aria-disabled') !== 'true') onPick(o);
    });
    list.addEventListener('keydown', (ev) => {
      const cur = (ev.target as HTMLElement).closest<HTMLElement>('[role="option"]');
      if (!cur) return;
      const all = opts();
      const i = all.indexOf(cur);
      const to = { ArrowDown: all[i + 1], ArrowUp: all[i - 1], Home: all[0], End: all.at(-1) }[
        ev.key
      ];
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        if (cur.getAttribute('aria-disabled') !== 'true') onPick(cur);
      } else if (to) {
        ev.preventDefault();
        for (const o of all) o.tabIndex = -1;
        to.tabIndex = 0;
        to.focus();
      }
    });
  }

  /**
   * A list longer than eight gets a search (put-on.tsx): typing hides the options that don't
   * match by name or short ID, and says so when none does.
   */
  function searchable(dlg: HTMLDialogElement, count: number, label: string, room: string) {
    const lb = dlg.querySelector<HTMLElement>('[role="listbox"]');
    if (!lb || count <= SEARCH_FROM) return;
    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'kmap-input';
    input.enterKeyHint = 'search';
    input.setAttribute('aria-label', label);
    input.placeholder = w.put.findIn(room);
    const none = document.createElement('p');
    none.className = 'kmap-empty';
    none.hidden = true;
    none.textContent = w.nothingMatches;
    lb.before(input);
    lb.after(none);
    input.addEventListener('input', () => {
      const q = input.value;
      let shown = 0;
      for (const o of lb.querySelectorAll<HTMLElement>('[role="option"]')) {
        const it = plan.items.find((x) => x.id === o.dataset.id);
        const thing = it ? undefined : view.things.find((x) => x.id === o.dataset.id);
        const name = it?.name ?? thing?.name ?? '';
        const code = it?.shortCode ?? thing?.shortCode ?? null;
        o.hidden = !matches(q, name, code);
        if (!o.hidden) shown++;
      }
      for (const g of lb.querySelectorAll<HTMLElement>('[role="group"]'))
        g.hidden = !g.querySelector('[role="option"]:not([hidden])');
      none.hidden = shown > 0;
      // The first one shown is the one Tab reaches.
      const all = [...lb.querySelectorAll<HTMLElement>('[role="option"]')];
      for (const o of all) o.tabIndex = -1;
      const first = all.find((o) => !o.hidden);
      if (first) first.tabIndex = 0;
    });
    input.addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowDown') return;
      ev.preventDefault();
      lb.querySelector<HTMLElement>('[role="option"][tabindex="0"]')?.focus();
    });
  }

  function openPutOn(id: string) {
    const it = plan.items.find((x) => x.id === id);
    if (!it) return;
    const room = plan.rooms.find((r) => r.id === it.roomId)?.name ?? '';
    const holders = holdersFor(plan.items, it);
    const current = it.on ? plan.items.find((x) => x.id === it.on) : undefined;
    const sub = (h: Item) => {
      const on = h.on ? plan.items.find((x) => x.id === h.on)?.name : undefined;
      return on ? w.put.shapeOn(names[baseModel(h.model)], on) : names[baseModel(h.model)];
    };
    const now = current
      ? `<div class="kput-now"><span>${esc(w.put.onNow(current.name))}</span><button type="button" class="kmap-btn" data-put="off">${esc(w.put.takeOff)}</button></div>`
      : '';
    const list = holders.length
      ? `<div class="kput-list" role="listbox" aria-label="${esc(w.put.list)}">${holders.map((h) => putRow(h, sub(h))).join('')}</div>`
      : `<p class="kmap-empty">${esc(current ? w.put.nothingElse(room) : w.put.nothing(room))}</p>`;
    const dlg = sheet(w.put.putTitle(it.name), now + list, `puton:${id}`);
    searchable(dlg, holders.length, w.put.findPlace, room);
    dlg.querySelector('[data-put="off"]')?.addEventListener('click', () => {
      dlg.close();
      mutate((p) => {
        const t = p.items.find((x) => x.id === id);
        if (t) takeOff(p.items, p.rooms, t);
      });
      engine?.select({ type: 'item', id });
    });
    const lb = dlg.querySelector<HTMLElement>('[role="listbox"]');
    if (lb)
      listKeys(lb, (o) => {
        dlg.close();
        mutate((p) => {
          const t = p.items.find((x) => x.id === id);
          const h = p.items.find((x) => x.id === o.dataset.id);
          if (t && h) putOn(p.items, t, h);
        });
        engine?.select({ type: 'item', id });
      });
    (
      dlg.querySelector<HTMLElement>('[role="option"][tabindex="0"]') ??
      dlg.querySelector<HTMLElement>('[data-put="off"]')
    )?.focus();
  }

  function openAddOn(id: string) {
    const host = plan.items.find((x) => x.id === id);
    if (!host) return;
    const room = plan.rooms.find((r) => r.id === host.roomId)?.name ?? '';
    const things = addableOn(plan.items, host);
    // #152: the room's things not on the map yet, with the shape each would get.
    const offMap = offMapFor(plan, view, host, chosenShape);
    const max = capacityOf(host.model);
    const limited = Number.isFinite(max);
    const left = roomOn(plan.items, host);
    const full = limited && left <= 0;
    const onNow = childrenOn(plan.items, host.id)
      .map((c) => c.name)
      .join(', ');
    const cap = limited
      ? `<p class="kput-cap">${esc(full ? w.put.full(max, f.num(max)) : w.put.left(left, f.num(left)))}</p>`
      : '';
    const sub = (c: Item) =>
      c.shortCode
        ? `${names[baseModel(c.model)]} · ${printedCode(c.shortCode)}`
        : names[baseModel(c.model)];
    const group = (label: string, list: Item[], heading: boolean) =>
      list.length
        ? `<div role="group" class="kput-section" aria-label="${esc(label)}">${heading ? `<div class="kput-head" aria-hidden="true">${esc(label)}</div>` : ''}${list.map((c) => putRow(c, sub(c))).join('')}</div>`
        : '';
    const body = full
      ? ''
      : things.length || offMap.length
        ? `<div class="kput-list" role="listbox" aria-multiselectable="true" aria-label="${esc(w.put.toAdd)}">${group(w.put.onMap, things, offMap.length > 0)}${group(w.put.notOnMap, offMap, true)}</div>
           <div class="kput-actions"><button type="button" class="kmap-btn primary" data-put="add" disabled>${esc(w.put.pick)}</button>${btn('putcancel', w.cancel)}</div>`
        : `<p class="kmap-empty">${esc(carryOf(host.model) === 'arm' ? w.put.noMonitor(room) : w.put.allOn(room))}</p>`;
    const dlg = sheet(
      w.put.addTitle(host.name),
      `${cap}${body}${onNow ? `<p class="kput-cap">${esc(w.put.onItNow(onNow))}</p>` : ''}`,
      `addon:${id}`,
    );
    if (!full) searchable(dlg, things.length + offMap.length, w.put.findThing, room);
    const picked = new Set<string>();
    const add = dlg.querySelector<HTMLButtonElement>('[data-put="add"]');
    const refresh = () => {
      for (const o of dlg.querySelectorAll<HTMLElement>('[role="option"]')) {
        const on = picked.has(o.dataset.id ?? '');
        o.setAttribute('aria-selected', String(on));
        // An arm takes no more than its places.
        if (limited && picked.size >= left && !on) o.setAttribute('aria-disabled', 'true');
        else o.removeAttribute('aria-disabled');
      }
      if (add) {
        add.disabled = !picked.size;
        add.textContent = picked.size ? w.put.putN(picked.size, f.num(picked.size)) : w.put.pick;
      }
    };
    const lb = dlg.querySelector<HTMLElement>('[role="listbox"]');
    if (lb)
      listKeys(lb, (o) => {
        const k = o.dataset.id ?? '';
        if (picked.has(k)) picked.delete(k);
        else picked.add(k);
        refresh();
      });
    dlg.querySelector('[data-act="putcancel"]')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      dlg.close();
    });
    add?.addEventListener('click', () => {
      const ids = [...picked];
      dlg.close();
      mutate((p) => addOn(p, view, id, ids, chosenShape));
      engine?.select({ type: 'item', id });
    });
    dlg.querySelector<HTMLElement>('[role="option"][tabindex="0"]')?.focus();
  }

  /** #138: Height, by a step (±1) or to a typed height, in metres. */
  function setHeight(id: string, to: { by?: number; at?: number }) {
    mutate((p) => {
      const it = p.items.find((i) => i.id === id);
      if (!it || it.hang === undefined) return;
      const next =
        to.at ?? Math.round((it.hang + (to.by ?? 0) * HEIGHT_STEP) / HEIGHT_STEP) * HEIGHT_STEP;
      setHang(it, next);
    });
    engine?.select({ type: 'item', id });
  }

  function removeItem(id: string) {
    mutate((p) => {
      p.items = p.items.filter((i) => i.id !== id);
      for (const c of p.items) if (c.on === id) c.on = null;
    });
    engine?.select(null);
  }

  function setRoom(id: string, change: { kind?: MapRoomKind; surface?: MapSurface }) {
    mutate((p) => {
      const r = p.rooms.find((x) => x.id === id);
      if (!r) return;
      if (change.kind) {
        r.kind = change.kind;
        r.surface = ROOM_KIND_SURFACE[change.kind];
      }
      if (change.surface) r.surface = change.surface;
    });
    engine?.select({ type: 'room', id });
  }

  function endArranging(keep: boolean) {
    if (!engine) return;
    const before = clone(saved);
    const offerUndo = keep && dirty;
    if (keep) saved = clone(engine.plan);
    engine.setArranging(false);
    if (!keep) engine.setPlan(clone(saved));
    plan = clone(saved);
    dirty = false;
    render();
    renderList();
    // Done offers Undo, as the app's toast does: the map as it was before the session.
    if (offerUndo)
      toast(w.arranged, () => {
        saved = before;
        plan = clone(saved);
        engine?.select(null, false);
        engine?.setPlan(clone(saved));
        render();
        renderList();
        toast(w.undone);
      });
  }

  /** Cancel: asked first when something changed (the app's useConfirm), never window.confirm. */
  function cancelArranging() {
    if (!dirty) return endArranging(false);
    const dlg = document.createElement('dialog');
    dlg.className = 'kd-shapes kd-confirm';
    dlg.dir = lang === 'ar' ? 'rtl' : 'ltr';
    dlg.setAttribute('role', 'alertdialog');
    dlg.setAttribute('aria-labelledby', 'kd-confirm-title');
    dlg.setAttribute('aria-describedby', 'kd-confirm-body');
    dlg.innerHTML = `<h2 id="kd-confirm-title">${esc(w.confirm.title)}</h2>
      <p id="kd-confirm-body">${esc(w.confirm.body)}</p>
      <div class="kd-confirm-actions"><button type="button" class="kmap-btn" data-confirm="no" autofocus>${esc(w.cancel)}</button><button type="button" class="kmap-btn danger" data-confirm="yes">${esc(w.confirm.throwAway)}</button></div>`;
    let yes = false;
    dlg.querySelector('[data-confirm="no"]')?.addEventListener('click', () => dlg.close());
    dlg.querySelector('[data-confirm="yes"]')?.addEventListener('click', () => {
      yes = true;
      dlg.close();
    });
    dlg.addEventListener('close', () => {
      dlg.remove();
      if (yes) endArranging(false);
      else overlay.querySelector<HTMLElement>('[data-k="cancel:"]')?.focus();
    });
    root.append(dlg);
    dlg.showModal();
    dlg.querySelector<HTMLElement>('[data-confirm="no"]')?.focus();
  }

  let toastTimer: number | undefined;
  /** A toast at the foot of the window, as the app's: a title, and an action (Undo) if any. */
  function toast(title: string, undo?: () => void) {
    window.clearTimeout(toastTimer);
    toasts.innerHTML = `<div class="kd-toast" role="status"><span>${esc(title)}</span>${undo ? `<button type="button" class="kd-toast-act" data-toast="undo">${esc(w.undo)}</button>` : ''}<button type="button" class="kmap-x" data-toast="close" aria-label="${esc(w.close)}">×</button></div>`;
    const close = () => {
      window.clearTimeout(toastTimer);
      toasts.innerHTML = '';
    };
    toasts.querySelector('[data-toast="close"]')?.addEventListener('click', close);
    toasts.querySelector('[data-toast="undo"]')?.addEventListener('click', () => {
      close();
      undo?.();
    });
    toastTimer = window.setTimeout(close, UNDO_MS);
  }

  function reset() {
    saved = clone(samplePlan);
    plan = clone(saved);
    dirty = false;
    seq = 0;
    if (engine) {
      if (engine.state.arranging) engine.setArranging(false);
      engine.select(null, false);
      engine.setPlan(clone(saved));
      engine.setLevel(saved.levels[0]?.key ?? '_');
    }
    toasts.innerHTML = '';
    render();
    renderList();
  }

  function setQuality(q: Quality) {
    quality = q;
    try {
      localStorage.setItem(QUALITY_KEY, q);
    } catch {
      // Remembering the choice is a convenience: the map works without it.
    }
    engine?.setQuality(q);
    render();
  }

  const showOnMap = (
    target: { type: 'room' | 'item'; id: string },
    innerId: string | null = null,
  ) => {
    if (!engine) return;
    const roomId =
      target.type === 'room' ? target.id : plan.items.find((i) => i.id === target.id)?.roomId;
    const room = plan.rooms.find((r) => r.id === roomId);
    if (room && (es.allFloors || room.levelKey !== es.levelKey)) engine.setLevel(room.levelKey);
    else if (es.focused && es.focused !== roomId) engine.up();
    engine.select(target);
    if (innerId) {
      inner = innerId;
      detail = true;
      render();
    }
    stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  /** A What's in row: a node shows itself; a thing shows the node or room it is in, with its card
   * (map-view.tsx pickThing). */
  const pickThing = (id: string) => {
    if (plan.items.some((i) => i.id === id)) return showOnMap({ type: 'item', id });
    const thing = view.things.find((x) => x.id === id);
    if (!thing) return;
    const parent = thing.parentId;
    if (plan.items.some((i) => i.id === parent)) showOnMap({ type: 'item', id: parent }, id);
    else showOnMap({ type: 'room', id: parent }, id);
  };

  // ---- The shape picker (apps/web/src/map/shapes.tsx), as a native modal dialog ---------------

  const names = Object.fromEntries(MAP_MODEL_KEYS.map((k) => [k, pick(MODEL_NAMES[k])])) as Record<
    MapModelKey,
    string
  >;
  const thumb = (m: MapModelKey, size = 52) => {
    const i = THUMB_CELLS[m];
    const x = -(i % THUMB_COLS) * size;
    const y = -Math.floor(i / THUMB_COLS) * size;
    return `<span class="kshape-thumb" aria-hidden="true" style="width:${size}px;height:${size}px;background-image:url(${spriteUrl});background-size:${THUMB_COLS * size}px auto;background-position:${x}px ${y}px"></span>`;
  };
  const shapeInputOf = (it: Item): ShapeInput => {
    const t = view.things.find((x) => x.id === it.id);
    return {
      name: it.name,
      typeKey: t?.typeKey ?? null,
      typeName: t?.typeName ?? null,
      isContainer: it.subject === 'place' || it.isContainer,
    };
  };

  function openShapes(id: string) {
    const it = plan.items.find((x) => x.id === id);
    if (!it) return;
    const input = shapeInputOf(it);
    const dlg = document.createElement('dialog');
    dlg.className = 'kd-shapes';
    dlg.dir = lang === 'ar' ? 'rtl' : 'ltr';
    dlg.setAttribute('aria-labelledby', 'kd-shapes-title');
    dlg.innerHTML = `<div class="kd-shapes-head"><h2 id="kd-shapes-title">${esc(w.shapeFor(it.name))}</h2><button type="button" class="kmap-x" data-shapes="close" aria-label="${esc(w.close)}">×</button></div>
      <input type="search" class="kmap-input" enterkeyhint="search" aria-label="${esc(w.findShape)}" placeholder="${esc(w.findShapeHint)}">
      <div class="kshape-list" role="listbox" aria-label="${esc(w.shapes)}"></div>
      <p class="kshape-more">${esc(w.shapesMore[0])}<a href="${esc(SHAPE_REQUEST_URL)}" target="_blank" rel="noopener noreferrer">${esc(w.shapesMore[1])}</a>${esc(w.shapesMore[2])}<a href="${esc(SHAPE_LIBRARY_URL)}" target="_blank" rel="noopener noreferrer">${esc(w.shapesMore[3])}</a>${esc(w.shapesMore[4])}</p>`;
    const search = dlg.querySelector('input') as HTMLInputElement;
    const list = dlg.querySelector<HTMLElement>('[role="listbox"]') as HTMLElement;
    const option = (m: MapModelKey) =>
      `<div role="option" class="kshape-option" tabindex="-1" data-model="${m}" aria-selected="${m === it.model}"${m === it.model ? ' data-selected' : ''}>${thumb(m)}<span>${esc(names[m])}</span></div>`;
    const fill = () => {
      const q = search.value.trim();
      list.scrollTop = 0;
      list.classList.toggle('kshape-found', !!q);
      // While searching: only the matches, best first, in one grid (#130).
      if (q) {
        const found = searchShapes(q, names, lang);
        list.innerHTML = found.length
          ? found.map(option).join('')
          : `<p class="kd-shapes-empty">${esc(w.noShape(q))}</p>`;
        const opts = [...list.querySelectorAll<HTMLElement>('[role="option"]')];
        const first = opts.find((o) => o.dataset.model === it.model) ?? opts[0];
        if (first) first.tabIndex = 0;
        return;
      }
      const sections: [string, MapModelKey[]][] = [
        [w.suggested, suggestShapes(input).shapes.map((x) => x.model)],
        ...SHAPE_GROUPS.map(
          (g) =>
            [pick(GROUP_NAMES[g]), MAP_MODEL_KEYS.filter((m) => SHAPE_GROUP[m] === g)] as [
              string,
              MapModelKey[],
            ],
        ),
      ];
      list.innerHTML = sections
        .filter(([, ms]) => ms.length)
        .map(
          ([title, ms], i) =>
            `<div role="group" class="kshape-section" aria-labelledby="kd-sh-${i}"><div class="kshape-head" id="kd-sh-${i}" role="presentation">${esc(title)}</div>${ms.map(option).join('')}</div>`,
        )
        .join('');
      const opts = [...list.querySelectorAll<HTMLElement>('[role="option"]')];
      const first = opts.find((o) => o.dataset.model === it.model) ?? opts[0];
      if (first) first.tabIndex = 0;
    };
    const choose = (m: MapModelKey) => {
      dlg.close();
      if (m !== it.model || it.shapeFrom) setShape(it.id, m);
    };
    const focusOption = (to: HTMLElement | undefined) => {
      if (!to) return;
      for (const o of list.querySelectorAll<HTMLElement>('[role="option"]')) o.tabIndex = -1;
      to.tabIndex = 0;
      to.focus();
    };
    list.addEventListener('click', (ev) => {
      const o = (ev.target as HTMLElement).closest<HTMLElement>('[role="option"]');
      if (o?.dataset.model) choose(o.dataset.model as MapModelKey);
    });
    list.addEventListener('keydown', (ev) => {
      const cur = (ev.target as HTMLElement).closest<HTMLElement>('[role="option"]');
      if (!cur) return;
      const opts = [...list.querySelectorAll<HTMLElement>('[role="option"]')];
      const i = opts.indexOf(cur);
      const rtl = dlg.dir === 'rtl';
      const vertical = (down: boolean) => {
        const r = cur.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const rows = opts.filter((o) => {
          const top = o.getBoundingClientRect().top;
          return down ? top > r.top + 4 : top < r.top - 4;
        });
        if (!rows.length) return undefined;
        const tops = rows.map((o) => o.getBoundingClientRect().top);
        const row = down ? Math.min(...tops) : Math.max(...tops);
        return rows
          .filter((o) => Math.abs(o.getBoundingClientRect().top - row) < 4)
          .sort((a, b) => {
            const da = Math.abs(a.getBoundingClientRect().left + a.offsetWidth / 2 - cx);
            const db = Math.abs(b.getBoundingClientRect().left + b.offsetWidth / 2 - cx);
            return da - db;
          })[0];
      };
      const next: Record<string, () => HTMLElement | undefined> = {
        ArrowRight: () => opts[rtl ? i - 1 : i + 1],
        ArrowLeft: () => opts[rtl ? i + 1 : i - 1],
        ArrowDown: () => vertical(true),
        ArrowUp: () => vertical(false),
        Home: () => opts[0],
        End: () => opts[opts.length - 1],
      };
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        if (cur.dataset.model) choose(cur.dataset.model as MapModelKey);
      } else if (next[ev.key]) {
        ev.preventDefault();
        focusOption(next[ev.key]?.());
      }
    });
    search.addEventListener('input', fill);
    search.addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowDown') return;
      ev.preventDefault();
      focusOption(list.querySelector<HTMLElement>('[role="option"][tabindex="0"]') ?? undefined);
    });
    dlg.querySelector('[data-shapes="close"]')?.addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (ev) => {
      if (ev.target === dlg) dlg.close();
    });
    dlg.addEventListener('close', () => {
      dlg.remove();
      overlay.querySelector<HTMLElement>(`[data-k="${CSS.escape(`shapes:${id}`)}"]`)?.focus();
    });
    // On a phone the sheet stays above the on-screen keyboard and the browser's form bar: it
    // follows the visual viewport, as the app's Sheet does (#130).
    const vv = window.visualViewport;
    const fit = () => {
      if (!vv || vv.scale > 1.01) return;
      dlg.style.setProperty('--kd-vv-top', `${Math.round(vv.offsetTop)}px`);
      dlg.style.setProperty('--kd-vv-h', `${Math.round(vv.height)}px`);
    };
    fit();
    vv?.addEventListener('resize', fit);
    vv?.addEventListener('scroll', fit);
    dlg.addEventListener('close', () => {
      vv?.removeEventListener('resize', fit);
      vv?.removeEventListener('scroll', fit);
    });
    fill();
    root.append(dlg);
    dlg.showModal();
  }

  // ---- Events --------------------------------------------------------------------------------

  const onClick = (ev: MouseEvent) => {
    const el = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-act]');
    if (!el || !root.contains(el)) return;
    const arg = el.dataset.arg ?? '';
    const e = engine;
    const sel = es.selected;
    switch (el.dataset.act) {
      case 'reset':
        return reset();
      case 'quality':
        return setQuality(quality === 'detailed' ? 'simple' : 'detailed');
      case 'pin':
        pins = { ...pins, [arg]: !pins[arg as MapAttentionKind] };
        e?.setPins(pins);
        return render();
      case 'list-more':
        opened = new Set(opened);
        if (opened.has(arg)) opened.delete(arg);
        else opened.add(arg);
        return renderList();
      case 'list-floor':
        query = { ...query, floor: arg };
        return renderList();
      case 'list-show':
        query = { ...query, show: arg === 'attention' ? 'attention' : 'room' };
        return renderList();
    }
    if (!e) return;
    switch (el.dataset.act) {
      case 'all':
        return e.showAll();
      case 'up':
        return e.up();
      case 'view3d':
        return e.setPlanView(false);
      case 'viewplan':
        return e.setPlanView(true);
      case 'arrange':
        dirty = false;
        return e.setArranging(true);
      case 'done':
        return endArranging(true);
      case 'cancel':
        return cancelArranging();
      case 'tool':
        return e.setTool(arg as Tool);
      case 'floor':
        return addFloor();
      case 'level':
        return e.setLevel(arg);
      case 'zoomin':
        return e.zoomBy(1.4);
      case 'zoomout':
        return e.zoomBy(1 / 1.4);
      case 'turnleft':
        return e.turnBy(1);
      case 'turnright':
        return e.turnBy(-1);
      case 'home':
        return e.home();
      case 'close':
        return e.select(null);
      case 'select':
        return e.select({ type: 'item', id: arg });
      case 'drill':
        return e.drill(arg);
      case 'detail':
        detail = true;
        return render();
      case 'less':
        detail = false;
        return render();
      case 'inner':
        inner = arg;
        detail = true;
        return render();
      case 'back':
        inner = null;
        return render();
      case 'turn':
        return e.turnItem(arg);
      case 'height':
        if (sel?.type === 'item') setHeight(sel.id, { by: Number(arg) });
        return;
      case 'remove':
        return removeItem(arg);
      case 'shapes':
        return openShapes(arg);
      case 'puton':
        return openPutOn(arg);
      case 'addon':
        return openAddOn(arg);
      case 'kind':
        if (sel?.type === 'room') setRoom(sel.id, { kind: arg as MapRoomKind });
        return;
      case 'surface':
        if (sel?.type === 'room') setRoom(sel.id, { surface: arg as MapSurface });
        return;
      case 'add':
        if (sel?.type === 'room') addThing(sel.id, arg);
        return;
      case 'show-room':
        return showOnMap({ type: 'room', id: arg });
      case 'show-item':
        return showOnMap({ type: 'item', id: arg });
      case 'list-room':
        return showOnMap({ type: 'room', id: arg });
      case 'list-thing':
        return pickThing(arg);
    }
  };
  /** A typed height, in either language's digits, with a comma or the Arabic decimal mark. */
  const typedHeight = (text: string): number | null => {
    const latin = text
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[٫,]/g, '.');
    const m = /\d+(\.\d+)?/.exec(latin);
    return m ? Number(m[0]) : null;
  };
  const onHeightKey = (ev: KeyboardEvent) => {
    const el = ev.target as HTMLInputElement;
    if (el.dataset?.input !== 'height' || !el.dataset.id) return;
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      ev.preventDefault();
      setHeight(el.dataset.id, { by: ev.key === 'ArrowUp' ? 1 : -1 });
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      el.blur();
    }
  };
  const onChange = (ev: Event) => {
    const el = ev.target as HTMLInputElement;
    if (el.dataset?.input !== 'height' || !el.dataset.id) return;
    const at = typedHeight(el.value);
    if (at === null) render();
    else setHeight(el.dataset.id, { at });
  };
  const onInput = (ev: Event) => {
    const el = ev.target as HTMLInputElement;
    if (el.dataset.input === 'list-q') {
      query = { ...query, q: el.value };
      return renderList();
    }
    if (el.dataset.input === 'filter') filter = el.value;
    else if (el.dataset.input === 'adding') adding = el.value;
    else return;
    render();
  };
  /** #301: with a room selected in Arrange, an arrow key moves it a metre and Shift-arrow 10 cm
   * (D267), as in the app (map-view.tsx), and says where it went. */
  const nudge = (ev: KeyboardEvent): boolean => {
    if (!engine || ev.defaultPrevented || !es.arranging || es.selected?.type !== 'room')
      return false;
    if (!isArrow(ev.key) || ev.altKey || ev.ctrlKey || ev.metaKey) return false;
    if ((ev.target as HTMLElement | null)?.closest?.(OWN_ARROWS)) return false;
    const done = engine.nudgeRoom(ev.key, ev.shiftKey);
    if (!done) return false;
    ev.preventDefault();
    const words = done.moved
      ? w.movedRoom[ev.key](`\u2068${done.room.name}\u2069`)
      : w.hints.blocked;
    // A held key moves the room on but is said once. The same words again (a second step the
    // same way) are said again: they differ by a space.
    if (!ev.repeat) said.textContent = said.textContent === words ? `${words}\u00a0` : words;
    return true;
  };
  const onKey = (ev: KeyboardEvent) => {
    if (nudge(ev)) return;
    if ((ev.target as HTMLElement | null)?.closest?.('input, textarea, dialog')) return;
    if (ev.key !== 'Escape' || !engine) return;
    if (inner) {
      inner = null;
      render();
    } else if (detail) {
      detail = false;
      render();
    } else if (es.selected) engine.select(null);
    else if (es.focused) engine.up();
  };
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  root.addEventListener('keydown', onHeightKey);
  addEventListener('keydown', onKey);

  // The map fills the window below the site's own bar, as the app fills the screen down to its
  // tab bar (map-view.tsx): the whole map and its controls in view at once, on a phone too.
  const size = () => {
    const tall = window.visualViewport?.height ?? window.innerHeight;
    const bar = document.querySelector<HTMLElement>('header.header');
    const top = bar && getComputedStyle(bar).position !== 'static' ? bar.offsetHeight : 0;
    stage.style.height = `${Math.max(320, Math.round(tall - top - 24))}px`;
  };
  size();
  window.addEventListener('resize', size);
  window.visualViewport?.addEventListener('resize', size);

  // The controls are drawn before the engine is made, so its first fit leaves them clear.
  render();
  renderList();
  try {
    engine = new MapEngine({
      stage,
      canvas,
      labels,
      tip,
      plan: clone(saved),
      quality,
      levelKey: saved.levels[0]?.key ?? '_',
      info: {
        countIn: (it) => countIn(contents, it),
        flags: (id) => flagsOf(contents, id),
        preview: (it) =>
          (contents.under.get(it.id) ?? []).slice(0, 2).map((x) => ({
            name: x.name,
            quantity: x.quantity,
          })),
        insideCount: (it) => (contents.under.get(it.id) ?? []).length,
        text: w.engine,
      },
      events: {
        onState: (s) => {
          // A new selection starts as the strip.
          const k = s.selected ? `${s.selected.type}:${s.selected.id}` : '';
          if (k !== selKey) {
            selKey = k;
            detail = false;
            inner = null;
            filter = '';
            adding = '';
          }
          es = s;
          render();
        },
        onChange: () => {
          dirty = true;
          if (engine) plan = clone(engine.plan);
          render();
          renderList();
        },
        onDrawRoom: drawRoom,
        onHint: (h) => {
          if (h === hint) return;
          hint = h;
          render();
        },
        ...(debug
          ? {
              onStats: (s: EngineStats) => {
                const el = overlay.querySelector<HTMLElement>('[data-slot="stats"]');
                if (!el) return;
                const m = modelStats();
                el.textContent = `${s.fps ?? '–'} fps · worst ${s.worst ? s.worst.toFixed(0) : '–'} ms · ${s.calls} draw calls · ${(s.triangles / 1000).toFixed(0)}k tris · ${quality === 'detailed' ? `${m.count} models · ${(m.bytes / 1024).toFixed(0)} KB${m.loading ? ` · loading ${m.loading}` : ''}${m.failed ? ` · ${m.failed} failed` : ''}` : 'simple: nothing downloaded'} · first draw ${s.firstDraw ? s.firstDraw.toFixed(0) : '–'} ms`;
              },
            }
          : {}),
      },
    });
    es = engine.state;
    engine.setPins(pins);
  } catch (err) {
    console.warn(err);
    glError = true;
  }
  render();
  root.dataset.ready = 'true';

  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('input', onInput);
    root.removeEventListener('change', onChange);
    root.removeEventListener('keydown', onHeightKey);
    removeEventListener('keydown', onKey);
    window.removeEventListener('resize', size);
    window.visualViewport?.removeEventListener('resize', size);
    window.clearTimeout(toastTimer);
    engine?.dispose();
    style.remove();
  };
}
