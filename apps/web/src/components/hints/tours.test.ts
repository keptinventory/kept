// @vitest-environment node
/**
 * Which tours and steps a person gets (the sidebar's module rule, viewers never get a step that
 * changes something), the shape every tour keeps, and how a step's subject is found or, for a
 * thing or a move, made once as a sample and put in the ledger.
 */
import { type ModuleId, TOUR_IDS } from '@kept/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LocationDetail } from '@/api/types';
import { tourLedger } from './tour-ledger';
import { resolveSubject, type SubjectDeps, tourLocation } from './tour-subjects';
import { availableTours, gatingOf, stepsFor, TOURS, tourById } from './tours';

const loc = (
  id: string,
  role: 'owner' | 'admin' | 'member' | 'viewer',
  modules: ModuleId[] = [],
  kind = 'home',
) => ({ id, name: `Place ${id}`, kind, role, modules }) as unknown as LocationDetail;

const ids = (locations: LocationDetail[]) => availableTours(locations).map((t) => t.tour.id);
const stepIds = (id: Parameters<typeof tourById>[0], locations: LocationDetail[]) =>
  stepsFor(tourById(id), gatingOf(locations)).map((s) => s.id);

describe('TOURS', () => {
  it('has one tour per shared tour id, in Help’s order, Basics first', () => {
    expect(TOURS.map((t) => t.id)).toEqual([...TOUR_IDS]);
    expect(TOURS[0]?.id).toBe('basics');
  });

  it('keeps every tour to three to six steps, each with an anchor', () => {
    for (const tour of TOURS) {
      expect(tour.steps.length, tour.id).toBeGreaterThanOrEqual(3);
      expect(tour.steps.length, tour.id).toBeLessThanOrEqual(6);
      for (const step of tour.steps) expect(step.anchors.length, step.id).toBeGreaterThan(0);
      expect(new Set(tour.steps.map((s) => s.id)).size, tour.id).toBe(tour.steps.length);
    }
  });

  it('names a subject for every `$id` route', () => {
    for (const tour of TOURS)
      for (const step of tour.steps)
        if (step.to?.includes('$id')) expect(step.needs, `${tour.id}.${step.id}`).toBeTruthy();
  });
});

describe('tour gating', () => {
  const EVERYTHING: ModuleId[] = [
    'ai_capture',
    'labels',
    'moving',
    'lending',
    'schedules',
    'paperwork',
    'warranties',
    'vehicles',
    'fuel',
  ];

  it('gives an owner with every module every tour and every step', () => {
    const all = [loc('a', 'owner', EVERYTHING)];
    expect(ids(all)).toEqual([...TOUR_IDS]);
    for (const tour of TOURS) expect(stepIds(tour.id, all)).toEqual(tour.steps.map((s) => s.id));
  });

  it('leaves out a module’s tour while it is off in every location', () => {
    const none = [loc('a', 'owner')];
    expect(ids(none)).toEqual([
      'basics',
      'things',
      'map',
      'capture',
      'search',
      'import-export',
      'settings',
    ]);
    // Labels is one step of Search & labels, not its own tour.
    expect(stepIds('search', none)).toEqual(['field', 'views', 'scan']);
  });

  it('follows a module that is on in any one location', () => {
    const two = [loc('a', 'owner'), loc('b', 'member', ['lending', 'vehicles'])];
    expect(ids(two)).toEqual(expect.arrayContaining(['lending', 'vehicles']));
    // Fuel is off: the vehicle tour has no fuel step.
    expect(stepIds('vehicles', two)).toEqual(['list', 'add', 'log']);
  });

  it('keeps Paperwork & warranties for either module, the claim step for warranties only', () => {
    expect(stepIds('paperwork', [loc('a', 'owner', ['paperwork'])])).toEqual([
      'list',
      'expiring',
      'add',
    ]);
    expect(stepIds('paperwork', [loc('a', 'owner', ['warranties'])])).toContain('claim');
  });

  it('never gives a viewer everywhere a step that changes something', () => {
    const viewer = [loc('a', 'viewer', EVERYTHING)];
    expect(ids(viewer)).not.toContain('capture');
    for (const { tour, steps } of availableTours(viewer)) {
      for (const step of steps) expect(step.writes, `${tour.id}.${step.id}`).toBeFalsy();
    }
    expect(stepIds('things', viewer)).toEqual(['contents', 'where', 'tabs']);
    expect(stepIds('lending', viewer)).toEqual(['list']);
  });

  it('gives a viewer here and a member there the writing steps', () => {
    const mixed = [loc('a', 'viewer'), loc('b', 'member')];
    expect(ids(mixed)).toContain('capture');
  });
});

// ----- subjects -----

type Call = { method: string; url: string; body: unknown };

function stubApi(answer: (method: string, url: string) => unknown) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({
      method,
      url: String(url),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return new Response(JSON.stringify(answer(method, String(url)) ?? {}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return calls;
}

const names = { thing: 'Sample: Cordless drill', move: 'Sample: Move' };
const deps = (locations: LocationDetail[], context: SubjectDeps['context'] = {}): SubjectDeps => ({
  locations,
  context,
  names,
});

afterEach(() => {
  vi.unstubAllGlobals();
  tourLedger.clear();
});

describe('resolveSubject', () => {
  it('opens the first shared location, or the page’s own', async () => {
    const locations = [loc('p', 'owner', [], 'personal'), loc('h', 'owner'), loc('g', 'owner')];
    expect(tourLocation(locations)?.id).toBe('h');
    expect(await resolveSubject('location', deps(locations))).toMatch(/h$/);
    expect(await resolveSubject('location', deps(locations, { locationId: 'g' }))).toMatch(/g$/);
  });

  it('opens location settings by id, for a location the person manages', async () => {
    const locations = [loc('p', 'owner', [], 'personal'), loc('m', 'member'), loc('a', 'admin')];
    expect(await resolveSubject('adminLocation', deps(locations))).toBe('a');
    expect(await resolveSubject('adminLocation', deps([loc('m', 'member')]))).toBeNull();
  });

  it('opens a thing that is there, by its short ID, and makes nothing', async () => {
    const calls = stubApi((_m, url) =>
      /\/things\?/.test(url) ? { items: [{ id: 'x', shortCode: 'K7D2QX' }] } : {},
    );
    expect(await resolveSubject('thing', deps([loc('h', 'owner')]))).toBe('K7D2QX');
    expect(calls.map((c) => c.method)).toEqual(['GET']);
    expect(calls[0]?.url).toMatch(/locationId=h/);
    expect(tourLedger.list()).toEqual([]);
  });

  it('makes one sample thing in Unplaced where the person can add, and records it', async () => {
    const calls = stubApi((m, url) => {
      if (/\/things\?/.test(url)) return { items: [] };
      if (/\/places$/.test(url))
        return {
          places: [
            { id: 'room', isUnplaced: false },
            { id: 'u', isUnplaced: true },
          ],
        };
      if (m === 'POST') return { id: 'new', shortCode: null };
      return {};
    });
    expect(await resolveSubject('thing', deps([loc('h', 'member')]))).toBe('new');
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.body)).toEqual([
      { locationId: 'h', placeId: 'u', name: 'Sample: Cordless drill' },
    ]);
    expect(tourLedger.list()).toEqual([{ kind: 'thing', id: 'new' }]);
  });

  it('makes nothing for a viewer', async () => {
    const calls = stubApi(() => ({ items: [] }));
    expect(await resolveSubject('thing', deps([loc('h', 'viewer')]))).toBeNull();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    expect(tourLedger.list()).toEqual([]);
  });

  it('opens the first vehicle, and makes none', async () => {
    stubApi(() => ({ items: [{ thing: { id: 'v', shortCode: 'CAR001' } }] }));
    expect(await resolveSubject('vehicle', deps([loc('h', 'owner')]))).toBe('CAR001');
    const calls = stubApi(() => ({ items: [] }));
    expect(await resolveSubject('vehicle', deps([loc('h', 'owner')]))).toBeNull();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('opens the first move, else makes one sample move where Moving is on', async () => {
    stubApi(() => ({ items: [{ id: 'm1' }] }));
    expect(await resolveSubject('move', deps([loc('h', 'owner', ['moving'])]))).toBe('m1');

    const calls = stubApi((m) => (m === 'POST' ? { id: 'm-new' } : { items: [] }));
    const where = [
      loc('v', 'viewer', ['moving']),
      loc('h', 'owner'),
      loc('g', 'member', ['moving']),
    ];
    expect(await resolveSubject('move', deps(where))).toBe('m-new');
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url).toMatch(/\/locations\/g\/moves$/);
    expect(post?.body).toEqual({ name: 'Sample: Move' });
    expect(tourLedger.list()).toEqual([{ kind: 'move', id: 'm-new' }]);
  });
});
