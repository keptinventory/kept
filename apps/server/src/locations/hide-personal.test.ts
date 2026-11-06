import { beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { draft } from '../../test/inbox.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import { ownerTx } from '../../test/tenancy.js';
import { createLocation, createThing, type Loc, ok } from '../../test/things.js';
import { buildFeed } from '../calendar/feed.js';
import { withScope } from '../db/scope.js';
import { runTool, toolsFor } from '../tools/context.js';
import type { ToolContext } from '../tools/types.js';

// Hide the Personal location (#392) through the front door: the preference, what it takes out of
// the lists, what it leaves alone, and that it can't leave someone with nothing to look at.

let db: TestDb;
let t: TestApp;

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  // https: making a token needs it.
  t = await peopleApp(db, { publicUrl: 'https://kept.example' });
});

const own = <R extends object>(text: string, values: unknown[] = []) =>
  ownerTx(db, async (c) => (await c.query(text, values)).rows as R[]);

/** Someone with their Personal location as a Loc, and a second one to hide it behind. */
async function someone(label: string, preset: 'household' | 'complete' = 'complete') {
  const me = await person(t, db, label);
  const [row] = await own<{ unplaced: string; account: string }>(
    `SELECT p.id AS unplaced, l.owner_account_id AS account
       FROM public.locations l JOIN public.places p ON p.location_id = l.id AND p.is_unplaced
      WHERE l.id = $1`,
    [me.personalLocationId],
  );
  const personal: Loc = {
    id: me.personalLocationId,
    unplacedId: row?.unplaced as string,
    accountId: row?.account as string,
  };
  const home = await createLocation(t, db, me, preset, 'Home');
  return { me, personal, home };
}

const hide = (as: Person, on = true) =>
  call(t, '/api/v1/me', { as, method: 'PATCH', body: { hidePersonal: on } });
const meOf = async (as: Person) =>
  ok(await call(t, '/api/v1/me', { as })) as unknown as {
    personalHidden: boolean;
    personalLocationId: string;
    profile: { hidePersonal: boolean };
  };
const locationsOf = async (as: Person) =>
  (
    ok(await call(t, '/api/v1/locations', { as })) as unknown as {
      locations: { id: string; hidden: boolean }[];
    }
  ).locations;
const isHidden = async (as: Person) => {
  const me = await meOf(as);
  const row = (await locationsOf(as)).find((l) => l.id === as.personalLocationId);
  expect(row?.hidden).toBe(me.personalHidden);
  return me.personalHidden;
};
const thingNames = async (as: Person, query = '') =>
  (
    ok(await call(t, `/api/v1/things${query}`, { as })) as unknown as {
      items: { name: string }[];
    }
  ).items.map((x) => x.name);

describe('PATCH /api/v1/me {hidePersonal}', () => {
  it('hides Personal and shows it again, audited, with nothing lost', async () => {
    const { me, personal } = await someone('hider');
    await createThing(t, me, personal, { name: 'Passport' });
    expect(await isHidden(me)).toBe(false);

    const hidden = await hide(me);
    expect(hidden.statusCode, hidden.body).toBe(200);
    expect(hidden.json()).toMatchObject({ suggestLocation: false, hidePersonal: true });
    expect(await isHidden(me)).toBe(true);
    expect((await meOf(me)).profile.hidePersonal).toBe(true);

    const shown = await hide(me, false);
    expect(shown.statusCode, shown.body).toBe(200);
    expect(await isHidden(me)).toBe(false);
    expect(await thingNames(me)).toContain('Passport');

    const events = await own<{ diff: unknown }>(
      `SELECT diff FROM public.audit_events
        WHERE action = 'me.preferences' AND entity_id = $1 ORDER BY at`,
      [me.userId],
    );
    expect(events).toHaveLength(2);
  });

  it('keeps suggestLocation working on its own', async () => {
    const { me } = await someone('suggester');
    const res = await call(t, '/api/v1/me', {
      as: me,
      method: 'PATCH',
      body: { suggestLocation: true },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ suggestLocation: true, hidePersonal: false });
    expect((await hide(me)).json()).toMatchObject({ suggestLocation: true, hidePersonal: true });
  });

  it('refuses an empty body', async () => {
    const { me } = await someone('empty');
    const res = await call(t, '/api/v1/me', { as: me, method: 'PATCH', body: {} });
    expect(res.statusCode).toBe(400);
  });

  it('refuses while Personal is the only location', async () => {
    const me = await person(t, db, 'alone');
    const res = await hide(me);
    expect(res.statusCode, res.body).toBe(409);
    expect((await meOf(me)).profile.hidePersonal).toBe(false);
    expect(await isHidden(me)).toBe(false);
  });

  it('can be turned off while Personal is showing because nothing else is left', async () => {
    const { me, home } = await someone('leaver');
    await hide(me);
    await call(t, `/api/v1/locations/${home.id}`, { method: 'DELETE', as: me });
    expect(await isHidden(me)).toBe(false);
    const off = await hide(me, false);
    expect(off.statusCode, off.body).toBe(200);
    expect((await meOf(me)).profile.hidePersonal).toBe(false);
  });
});

describe('Personal comes back when nothing else is left', () => {
  /** A member of someone else's location, with Personal hidden and nothing of their own. */
  async function memberOnly(label: string) {
    const owner = await person(t, db, `${label}-owner`);
    const home = await createLocation(t, db, owner, 'household', 'Their home');
    const me = await person(t, db, label);
    const membership = await join(db, home.id, me.userId, 'member');
    expect((await hide(me)).statusCode).toBe(200);
    expect(await isHidden(me)).toBe(true);
    return { me, owner, home, membership };
  }

  it('when an owner removes them', async () => {
    const { me, owner, home, membership } = await memberOnly('removed');
    const res = await call(t, `/api/v1/locations/${home.id}/members/${membership}`, {
      method: 'DELETE',
      as: owner,
    });
    expect(res.statusCode, res.body).toBe(204);
    expect(await isHidden(me)).toBe(false);
    expect((await locationsOf(me)).map((l) => l.id)).toEqual([me.personalLocationId]);
  });

  it('when they leave', async () => {
    const { me, home, membership } = await memberOnly('left');
    const res = await call(t, `/api/v1/locations/${home.id}/members/${membership}`, {
      method: 'DELETE',
      as: me,
    });
    expect(res.statusCode, res.body).toBe(204);
    expect(await isHidden(me)).toBe(false);
  });

  it('when their membership runs out, before any job has run', async () => {
    const { me, membership } = await memberOnly('expired');
    await own(
      `UPDATE public.memberships SET expires_at = now() - interval '1 minute' WHERE id = $1`,
      [membership],
    );
    expect(await isHidden(me)).toBe(false);
  });

  it('when the other location is deleted, and it hides again if that is undone', async () => {
    const { me, owner, home } = await memberOnly('deleted');
    await call(t, `/api/v1/locations/${home.id}`, { method: 'DELETE', as: owner });
    expect(await isHidden(me)).toBe(false);
    const back = await call(t, `/api/v1/locations/${home.id}/restore`, { as: owner, body: {} });
    expect(back.statusCode, back.body).toBe(200);
    expect(await isHidden(me)).toBe(true);
  });

  it('when they delete their own other location', async () => {
    const { me, home } = await someone('own-deleted');
    await hide(me);
    const res = await call(t, `/api/v1/locations/${home.id}`, { method: 'DELETE', as: me });
    expect(res.statusCode, res.body).toBe(200);
    expect(await isHidden(me)).toBe(false);
  });

  it('when the only other location needs a second factor this session has not given', async () => {
    const { me, owner, home } = await memberOnly('two-factor');
    await own('UPDATE public.locations SET require_2fa = true WHERE id = $1', [home.id]);
    expect(owner.userId).toBeTruthy();
    expect(await isHidden(me)).toBe(false);
  });

  it('and hides again when they have another', async () => {
    const { me, home } = await someone('again');
    await hide(me);
    await call(t, `/api/v1/locations/${home.id}`, { method: 'DELETE', as: me });
    expect(await isHidden(me)).toBe(false);
    await createLocation(t, db, me, 'household', 'New home');
    expect(await isHidden(me)).toBe(true);
  });
});

describe('what hidden takes out of the lists', () => {
  it('leaves Personal out of every list across locations, until a list names it', async () => {
    const { me, personal, home } = await someone('lists');
    // Personal tracks everything here, so each list below would have a row from it.
    for (const module of ['schedules', 'lending', 'moving', 'warranties', 'vehicles', 'money']) {
      ok(
        await call(t, `/api/v1/locations/${personal.id}/modules`, {
          as: me,
          body: { module, enabled: true },
        }),
      );
    }
    const inPersonal = await createThing(t, me, personal, { name: 'Passport' });
    const trashed = await createThing(t, me, personal, { name: 'Old passport' });
    ok(await call(t, '/api/v1/things/bulk-trash', { as: me, body: { thingIds: [trashed.id] } }));
    await createThing(t, me, home, { name: 'Sofa' });
    const dueOn = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const reminder = ok(
      await call(t, '/api/v1/schedules', {
        as: me,
        body: {
          subject: { thingId: inPersonal.id },
          name: 'Renew passport',
          dueOn,
        },
      }),
      201,
    );
    expect(reminder.id).toBeTruthy();
    const [murdock] = await own<{ id: string }>(
      `INSERT INTO public.people (owner_account_id, display_name) VALUES ($1, 'Murdock') RETURNING id`,
      [personal.accountId],
    );
    const lent = await createThing(t, me, personal, { name: 'Drill' });
    ok(
      await call(t, `/api/v1/things/${lent.id}/lend`, {
        as: me,
        body: { person: { id: murdock?.id } },
      }),
      201,
    );
    ok(
      await call(t, `/api/v1/locations/${personal.id}/moves`, { as: me, body: { name: 'M' } }),
      201,
    );
    ok(
      await call(t, `/api/v1/locations/${personal.id}/condition-reports`, {
        as: me,
        body: { kind: 'move_in', heldOn: '2026-09-01' },
      }),
      201,
    );
    ok(
      await call(t, `/api/v1/locations/${personal.id}/incidents`, {
        as: me,
        body: { kind: 'fire', occurredOn: '2026-09-01' },
      }),
      201,
    );
    await draft(t, db, me, personal, { name: 'A draft' });
    await own('UPDATE public.things SET capture_batch_id = gen_random_uuid() WHERE id = $1', [
      inPersonal.id,
    ]);

    // [what, its URL for every location, its URL naming Personal, whether a row is Personal's].
    const lists: [string, string, string, (body: string) => boolean][] = [
      ['things', '/api/v1/things', `?locationId=${personal.id}`, (b) => b.includes('Passport')],
      [
        'search',
        '/api/v1/search?q=passport',
        `&locationId=${personal.id}`,
        (b) => b.includes('Passport'),
      ],
      [
        'activity',
        '/api/v1/activity',
        `?locationId=${personal.id}`,
        (b) => b.includes(personal.id),
      ],
      ['trash', '/api/v1/trash', `?locationId=${personal.id}`, (b) => b.includes('Old passport')],
      [
        'schedules',
        '/api/v1/schedules',
        `?locationId=${personal.id}`,
        (b) => b.includes('Renew passport'),
      ],
      [
        'agenda',
        '/api/v1/agenda',
        `?locationId=${personal.id}`,
        (b) => b.includes('Renew passport'),
      ],
      ['loans', '/api/v1/loans', `?locationId=${personal.id}`, (b) => b.includes('Drill')],
      ['moves', '/api/v1/moves', `?locationId=${personal.id}`, (b) => b.includes(personal.id)],
      [
        'incidents',
        '/api/v1/incidents',
        `?locationId=${personal.id}`,
        (b) => b.includes(personal.id),
      ],
      [
        'condition reports',
        '/api/v1/condition-reports',
        `?locationId=${personal.id}`,
        (b) => b.includes(personal.id),
      ],
      ['inbox', '/api/v1/inbox', `?locationId=${personal.id}`, (b) => b.includes(personal.id)],
      [
        'captures',
        '/api/v1/captures/batches',
        `?locationId=${personal.id}`,
        (b) => b.includes(personal.id),
      ],
    ];
    for (const [what, all, , hasIt] of lists) {
      const before = await call(t, all, { as: me });
      expect(before.statusCode, `${what}: ${before.body}`).toBe(200);
      expect(hasIt(before.body), `${what} lists Personal before hiding`).toBe(true);
    }
    await hide(me);
    for (const [what, all, named, hasIt] of lists) {
      const after = await call(t, all, { as: me });
      expect(after.statusCode, `${what}: ${after.body}`).toBe(200);
      expect(hasIt(after.body), `${what} leaves Personal out: ${after.body}`).toBe(false);
      const direct = await call(t, `${all}${named}`, { as: me });
      expect(direct.statusCode, `${what}: ${direct.body}`).toBe(200);
      expect(hasIt(direct.body), `${what} shows Personal when named`).toBe(true);
    }
    expect(await thingNames(me)).toEqual(['Sofa']);
    // "None of Home" doesn't bring it back.
    expect(await thingNames(me, `?locationId=${home.id}&not=locationId`)).toEqual([]);
  });

  it('leaves it off Home and the summary, cards, counts and first rows alike', async () => {
    const { me, personal, home } = await someone('home');
    for (const module of ['schedules', 'lending', 'consumables']) {
      ok(
        await call(t, `/api/v1/locations/${personal.id}/modules`, {
          as: me,
          body: { module, enabled: true },
        }),
      );
    }
    const passport = await createThing(t, me, personal, { name: 'Passport' });
    await own('UPDATE public.things SET location_uncertain = true WHERE id = $1', [passport.id]);
    await createThing(t, me, home, { name: 'Sofa' });
    await draft(t, db, me, personal, { name: 'A draft' });
    ok(
      await call(t, '/api/v1/schedules', {
        as: me,
        body: {
          subject: { thingId: passport.id },
          name: 'Renew passport',
          dueOn: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
        },
      }),
      201,
    );
    const [murdock] = await own<{ id: string }>(
      `INSERT INTO public.people (owner_account_id, display_name) VALUES ($1, 'Murdock') RETURNING id`,
      [personal.accountId],
    );
    const drill = await createThing(t, me, personal, { name: 'Drill' });
    ok(
      await call(t, `/api/v1/things/${drill.id}/lend`, {
        as: me,
        body: { person: { id: murdock?.id } },
      }),
      201,
    );
    type Home = {
      attention: Record<string, number>;
      counts: { inbox: number };
    };
    const before = ok(await call(t, '/api/v1/home', { as: me })) as unknown as Home;
    expect(before.attention.uncertain).toBeGreaterThan(0);
    expect(before.attention.unplaced).toBeGreaterThan(0);
    expect(before.attention.overdue).toBeGreaterThan(0);
    expect(before.attention.lentOut).toBeGreaterThan(0);
    expect(before.counts.inbox).toBeGreaterThan(0);
    const urls = ['/api/v1/home', '/api/v1/home/overview', '/api/v1/summary'];
    for (const url of urls) {
      expect((await call(t, url, { as: me })).body).toContain(personal.id);
    }

    await hide(me);
    for (const url of urls) {
      const res = await call(t, url, { as: me });
      expect(res.statusCode, res.body).toBe(200);
      expect(res.body, url).not.toContain(personal.id);
      expect(res.body, url).not.toMatch(/Passport|passport|Drill/);
      expect(res.body, url).toContain(home.id);
    }
    const after = ok(await call(t, '/api/v1/home', { as: me })) as unknown as Home;
    expect(after.counts.inbox).toBe(0);
    // The Sofa is unplaced too; everything else on Home was Personal's.
    expect(after.attention).toMatchObject({
      uncertain: 0,
      unplaced: 1,
      overdue: 0,
      lentOut: 0,
    });
  });

  it('leaves its Vehicles out of the Vehicles list', async () => {
    const { me, personal } = await someone('vehicles');
    ok(
      await call(t, `/api/v1/locations/${personal.id}/modules`, {
        as: me,
        body: { module: 'vehicles', enabled: true },
      }),
    );
    const [type] = await own<{ id: string }>(
      `SELECT id FROM public.types WHERE builtin_key = 'car' AND owner_account_id IS NULL`,
    );
    await createThing(t, me, personal, { name: 'Corolla', typeId: type?.id });
    expect((await call(t, '/api/v1/vehicles', { as: me })).body).toContain('Corolla');
    await hide(me);
    expect((await call(t, '/api/v1/vehicles', { as: me })).body).not.toContain('Corolla');
    expect(
      (await call(t, `/api/v1/vehicles?f.location=${personal.id}`, { as: me })).body,
    ).toContain('Corolla');
  });
});

describe('what hidden leaves alone', () => {
  it('a direct link: the location, a thing in it, a place in it', async () => {
    const { me, personal } = await someone('link');
    const thing = await createThing(t, me, personal, { name: 'Passport' });
    await hide(me);
    expect(ok(await call(t, `/api/v1/things/${thing.id}`, { as: me })).name).toBe('Passport');
    const loc = ok(await call(t, `/api/v1/locations/${personal.id}`, { as: me }));
    expect(loc.hidden).toBe(true);
    expect(await thingNames(me, `?placeId=${personal.unplacedId}`)).toEqual(['Passport']);
    const search = await call(t, `/api/v1/search?placeId=${personal.unplacedId}`, { as: me });
    expect(search.body).toContain('Passport');
  });

  it('adding a thing to it, so its things and writes carry on', async () => {
    const { me, personal } = await someone('write');
    await hide(me);
    const made = await createThing(t, me, personal, { name: 'Keys' });
    expect(made.locationId).toBe(personal.id);
  });

  it('nobody else: it opens no door, and the next person sees what they saw', async () => {
    const { me, personal, home } = await someone('door');
    const other = await person(t, db, 'other');
    await join(db, home.id, other.userId, 'member');
    await hide(me);
    expect((await call(t, `/api/v1/locations/${personal.id}`, { as: other })).statusCode).toBe(404);
    expect(await isHidden(other)).toBe(false);
    expect((await locationsOf(other)).map((l) => l.id)).toContain(other.personalLocationId);
  });

  it('a connection: a token sees what it was granted', async () => {
    const { me, personal, home } = await someone('token');
    await createThing(t, me, personal, { name: 'Passport' });
    const made = ok(
      await call(t, '/api/v1/tokens', {
        as: me,
        body: { name: 'Glance', scope: 'read', locationIds: [personal.id, home.id] },
      }),
      201,
    ) as unknown as { secret: string };
    await hide(me);
    const res = await call(t, '/api/v1/things', {
      headers: { authorization: `Bearer ${made.secret}` },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.body).toContain('Passport');
    const summary = await call(t, '/api/v1/summary', {
      headers: { authorization: `Bearer ${made.secret}` },
    });
    expect(summary.body).toContain(personal.id);
  });

  it('reminders: the calendar feed and the notifications keep a hidden location', async () => {
    const { me, personal } = await someone('feed');
    ok(
      await call(t, `/api/v1/locations/${personal.id}/modules`, {
        as: me,
        body: { module: 'schedules', enabled: true },
      }),
    );
    const thing = await createThing(t, me, personal, { name: 'Passport' });
    ok(
      await call(t, '/api/v1/schedules', {
        as: me,
        body: {
          subject: { thingId: thing.id },
          name: 'Renew passport',
          dueOn: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
        },
      }),
      201,
    );
    await hide(me);
    const feed = await withScope(db.pools.app, { userId: me.userId, mfa: false }, (_tx, client) =>
      buildFeed(client, t.publicUrl),
    );
    expect(feed).toContain('Renew passport');
  });
});

describe('the assistant and MCP', () => {
  const reach = (who: Person, opts: { tokenId?: string; also?: string } = {}) =>
    toolsFor(
      {
        deps: { pools: db.pools, jobs: null, files: null, providerResolved: async () => true },
        principal: {
          userId: who.userId,
          mfa: false,
          scope: 'write',
          ...(opts.tokenId ? { tokenId: opts.tokenId } : {}),
        },
        via: opts.tokenId ? 'mcp' : 'assistant',
      },
      undefined,
      opts.also ?? null,
    ).then((rows) => rows.map((r) => r.location.id));

  it('the in-app assistant leaves it out, unless the thread is opened on it', async () => {
    const { me, personal, home } = await someone('assistant');
    expect(await reach(me)).toContain(personal.id);
    await hide(me);
    expect(await reach(me)).toEqual([home.id]);
    expect(await reach(me, { also: personal.id })).toContain(personal.id);
  });

  it('its tools: list_locations and search leave it out, a thing by id still answers', async () => {
    const { me, personal, home } = await someone('tools');
    const passport = await createThing(t, me, personal, { name: 'Passport' });
    await hide(me);
    const ctx: ToolContext = {
      deps: { pools: db.pools, jobs: null, files: null, providerResolved: async () => true },
      principal: { userId: me.userId, mfa: false, scope: 'write' },
      locale: 'en',
      requestId: 'hide-personal-tools',
      via: 'assistant',
    };
    const listed = (await runTool(ctx, 'list_locations', {})) as {
      data: { items: { id: string }[] };
    };
    expect(listed.data.items.map((l) => l.id)).toEqual([home.id]);
    const caps = (await runTool(ctx, 'capabilities', {})) as {
      data: { locations: { id: string }[] };
    };
    expect(caps.data.locations.map((l) => l.id)).toEqual([home.id]);
    const found = await runTool(ctx, 'search_things', { query: 'passport' });
    expect(JSON.stringify(found)).not.toContain('Passport');
    const named = await runTool(ctx, 'search_things', {
      query: 'passport',
      location_id: personal.id,
    });
    expect(JSON.stringify(named)).toContain('Passport');
    const byId = await runTool(ctx, 'get_thing', { thing_id: passport.id });
    expect(JSON.stringify(byId)).toContain('Passport');
  });

  it('MCP, by token, keeps what the token was granted', async () => {
    const { me, personal, home } = await someone('mcp');
    const made = ok(
      await call(t, '/api/v1/tokens', {
        as: me,
        body: { name: 'Claude', scope: 'write', locationIds: [personal.id, home.id] },
      }),
      201,
    ) as unknown as { token: { id: string } };
    await hide(me);
    expect(await reach(me, { tokenId: made.token.id })).toEqual(
      expect.arrayContaining([personal.id, home.id]),
    );
  });
});

describe('a thread opened on a hidden Personal', () => {
  /** runTool as the assistant, from a thread on `thread`, with Home's assistant on or off. */
  const tools = (me: Person, thread: string | null) => {
    const ran: string[][] = [];
    const embedded: unknown[] = [];
    const ctx: ToolContext = {
      deps: {
        pools: db.pools,
        jobs: null,
        files: null,
        providerResolved: async () => true,
        semantic: async (_scope, q, filter) => {
          embedded.push({ q, filter });
          return null;
        },
      },
      principal: { userId: me.userId, mfa: false, scope: 'write' },
      locale: 'en',
      requestId: 'hide-personal-thread',
      via: 'assistant',
      threadLocation: thread,
      onLocations: (ids) => ran.push(ids),
    };
    return { ctx, ran, embedded };
  };
  const assistantOff = async (me: Person, at: Loc) =>
    ok(
      await call(t, `/api/v1/locations/${at.id}/modules`, {
        as: me,
        body: { module: 'ai_assistant', enabled: false },
      }),
    );
  const itemsOf = (env: unknown) =>
    (env as { data: { items: { untrusted: { name: string } }[] } }).data.items;

  it('reaches Personal, and never searches a location where the assistant is off', async () => {
    const { me, personal, home } = await someone('thread-off');
    await createThing(t, me, personal, { name: 'Passport' });
    await createThing(t, me, home, { name: 'Sofa' });
    await hide(me);
    await assistantOff(me, home);

    const { ctx, ran, embedded } = tools(me, personal.id);
    const found = await runTool(ctx, 'search_things', { query: 'passport' });
    expect(itemsOf(found).map((i) => i.untrusted.name)).toEqual(['Passport']);
    expect(ran.at(-1)).toEqual([personal.id]);
    // The stored result has its location, so losing it redacts the result (D164).
    expect(embedded.at(-1)).toEqual({ q: 'passport', filter: { locationIds: [personal.id] } });

    for (const tool of ['search_things', 'where_is'] as const) {
      expect(JSON.stringify(await runTool(ctx, tool, { query: 'sofa' })), tool).not.toContain(
        'Sofa',
      );
    }

    // A read that needs one location takes the thread's, once it is the only candidate.
    const tags = (await runTool(ctx, 'list_tags', {})) as { error?: string };
    expect(tags.error).toBeUndefined();
    expect(ran.at(-1)).toEqual([personal.id]);
  });

  it('with no location to run in, a global tool answers nothing rather than searching', async () => {
    const { me, personal, home } = await someone('nowhere');
    await createThing(t, me, personal, { name: 'Passport' });
    await createThing(t, me, home, { name: 'Sofa' });
    await hide(me);
    await assistantOff(me, home);

    // No thread on Personal: nothing is eligible.
    const { ctx, ran, embedded } = tools(me, null);
    for (const [tool, args] of [
      ['search_things', { query: 'sofa' }],
      ['where_is', { query: 'sofa' }],
      ['find_documents', { query: 'sofa' }],
      ['find_documents', {}],
      ['upcoming', {}],
      ['list_locations', {}],
    ] as const) {
      const env = await runTool(ctx, tool, args);
      expect(env, `${tool} ${JSON.stringify(args)}`).toMatchObject({ data: { items: [] } });
      expect(ran.at(-1)).toEqual([]);
    }
    expect(embedded).toEqual([]);
    const caps = (await runTool(ctx, 'capabilities', {})) as {
      data: { scope: string; locations: unknown[] };
    };
    expect(caps.data).toEqual({ scope: 'write', locations: [] });
  });

  it('with the assistant on in Home too: a call with no location never answers from Home alone', async () => {
    const { me, personal, home } = await someone('thread-on');
    await createThing(t, me, personal, { name: 'Passport' });
    await createThing(t, me, home, { name: 'Sofa' });
    await hide(me);

    const { ctx, ran } = tools(me, personal.id);
    const found = await runTool(ctx, 'search_things', { query: 'passport' });
    expect(itemsOf(found).map((i) => i.untrusted.name)).toEqual(['Passport']);
    expect(new Set(ran.at(-1))).toEqual(new Set([personal.id, home.id]));
    const tags = (await runTool(ctx, 'list_tags', {})) as { error?: string; hint?: string };
    expect(tags.error).toBe('validation');
    expect(tags.hint).toContain('location_id');

    // A thread on Home keeps Personal out, as the menu does.
    const onHome = tools(me, home.id);
    const fromHome = await runTool(onHome.ctx, 'search_things', { query: 'passport' });
    expect(itemsOf(fromHome)).toEqual([]);
    expect(onHome.ran.at(-1)).toEqual([home.id]);
  });
});

describe('Who pays: a personal key with Personal hidden', () => {
  async function addKey(scope: 'user' | 'account', who: Person, account: string) {
    const [row] = await own<{ id: string }>(
      `INSERT INTO public.ai_providers (scope, owner_account_id, user_id, kind, key_ciphertext,
                                        key_version, models, created_by)
       VALUES ($1, $2, $3, 'groq', '{"v": 1}', 1, '{"vision": "m"}', $4) RETURNING id`,
      [
        scope,
        scope === 'account' ? account : null,
        scope === 'user' ? who.userId : null,
        who.userId,
      ],
    );
    return row?.id as string;
  }
  const payer = (who: Person, location: string) =>
    withScope(db.pools.app, { userId: who.userId, mfa: false }, async (_tx, client) => {
      const { rows } = await client.query<{ paying_scope: string; provider_id: string }>(
        `SELECT provider_id, paying_scope FROM kept.ai_provider_for($1, 'extraction')`,
        [location],
      );
      return rows[0]?.provider_id ?? null;
    });

  it('pays for a location its holder owns and uses alone, only while Personal is hidden', async () => {
    const { me, personal, home } = await someone('key');
    const key = await addKey('user', me, personal.accountId);
    expect(await payer(me, home.id)).toBeNull();
    expect(await payer(me, personal.id)).toBe(key);
    await hide(me);
    expect(await payer(me, home.id)).toBe(key);
    expect(await payer(me, personal.id)).toBe(key);
    await hide(me, false);
    expect(await payer(me, home.id)).toBeNull();
  });

  it('comes after the account key, so hiding changes nothing where one pays', async () => {
    const { me, personal, home } = await someone('both');
    await addKey('user', me, personal.accountId);
    const account = await addKey('account', me, personal.accountId);
    await hide(me);
    expect(await payer(me, home.id)).toBe(account);
  });

  it('never pays for a shared location', async () => {
    const { me, personal, home } = await someone('shared');
    await addKey('user', me, personal.accountId);
    const other = await person(t, db, 'housemate');
    await join(db, home.id, other.userId, 'member');
    await hide(me);
    expect(await payer(me, home.id)).toBeNull();
    expect(await payer(other, home.id)).toBeNull();
  });
});
