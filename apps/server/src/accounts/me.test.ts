import { beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, peopleApp, person } from '../../test/people.js';
import { ownerTx } from '../../test/tenancy.js';

// GET /api/v1/me: the web shell's first query.

let db: TestDb;
let t: TestApp;

beforeEach(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
});

describe('GET /api/v1/me', () => {
  it('answers with the user, preferences, the Personal location and every membership', async () => {
    const me = await person(t, db, 'me');
    const other = await person(t, db, 'other');
    const home = await call(t, '/api/v1/locations', {
      as: other,
      body: { name: 'Their home', kind: 'home', timezone: 'UTC', currency: 'USD' },
    });
    const until = new Date(Date.now() + 86_400_000);
    await join(db, home.json().id, me.userId, 'viewer', until);

    const res = await call(t, '/api/v1/me', { as: me });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({
      user: {
        id: me.userId,
        displayName: me.email.split('@')[0],
        email: me.email,
        username: null,
        twoFactorEnabled: false,
        managed: false,
        instanceAdmin: false,
      },
      mfa: false,
      personalLocationId: me.personalLocationId,
      profile: {
        timezone: 'UTC',
        locale: 'en',
        units: 'metric',
        theme: 'system',
        digits: 'western',
        suggestLocation: false,
      },
      memberships: [
        {
          locationId: me.personalLocationId,
          name: 'Personal',
          kind: 'personal',
          role: 'owner',
          expiresAt: null,
        },
        {
          locationId: home.json().id,
          name: 'Their home',
          kind: 'home',
          role: 'viewer',
          expiresAt: until.toISOString(),
        },
      ],
      instance: { recoveryKitAcknowledged: null },
      deletion: null,
      twoFactorHidden: [],
    });
  });

  it("names the member's locations hidden for want of a second factor, and nothing to anyone else", async () => {
    const owner = await person(t, db, 'owner');
    const member = await person(t, db, 'member');
    const viaTotp = await person(t, db, 'totp');
    const viaPasskey = await person(t, db, 'passkey');
    const outsider = await person(t, db, 'outsider');
    const make = async (name: string) =>
      (
        await call(t, '/api/v1/locations', {
          as: owner,
          body: { name, kind: 'home', timezone: 'UTC', currency: 'USD' },
        })
      ).json().id as string;
    const workshop = await make('Workshop');
    const open = await make('Cabin');
    const gone = await make('Old flat');
    for (const p of [member, viaTotp, viaPasskey]) {
      for (const id of [workshop, open, gone]) await join(db, id, p.userId, 'member');
    }
    await ownerTx(db, (c) =>
      c.query('UPDATE public.locations SET require_2fa = true WHERE id = ANY($1)', [
        [workshop, gone],
      ]),
    );
    await ownerTx(db, (c) =>
      c.query('UPDATE public.locations SET deleted_at = now() WHERE id = $1', [gone]),
    );
    // A second factor proven in the session: the authenticator app, or a passkey with UV.
    for (const [p, method] of [
      [viaTotp, 'totp'],
      [viaPasskey, 'passkey'],
    ] as const) {
      await db.pools.auth.query(
        `INSERT INTO auth.session_mfa (session_id, method)
         SELECT id, $2 FROM auth.session WHERE user_id = $1`,
        [p.userId, method],
      );
    }
    const me = async (as: typeof member) => (await call(t, '/api/v1/me', { as })).json();
    const mine = await me(member);
    expect(mine.twoFactorHidden).toEqual([
      { locationId: workshop, name: 'Workshop', kind: 'home' },
    ]);
    expect(mine.memberships.map((m: { name: string }) => m.name)).toContain('Cabin');
    expect(mine.memberships.map((m: { name: string }) => m.name)).not.toContain('Workshop');
    // The location itself stays the same 404 as an id nobody has, for the member and anyone else.
    const nothing = await call(t, '/api/v1/locations/00000000-0000-7000-8000-000000000000', {
      as: outsider,
    });
    const hidden = await call(t, `/api/v1/locations/${workshop}`, { as: member });
    const theirs = await call(t, `/api/v1/locations/${workshop}`, { as: outsider });
    expect([hidden.statusCode, theirs.statusCode]).toEqual([404, 404]);
    expect(hidden.body).toBe(nothing.body);
    expect(theirs.body).toBe(nothing.body);
    expect((await me(outsider)).twoFactorHidden).toEqual([]);
    // With a second factor in the session, nothing is hidden and the location opens.
    for (const p of [viaTotp, viaPasskey]) {
      expect((await me(p)).twoFactorHidden).toEqual([]);
      expect((await call(t, `/api/v1/locations/${workshop}`, { as: p })).statusCode).toBe(200);
    }
  });

  it('says instance admin, and whether the recovery kit was acknowledged (admins only)', async () => {
    const me = await person(t, db, 'admin');
    await ownerTx(db, (c) =>
      c.query('INSERT INTO public.instance_admins (user_id) VALUES ($1)', [me.userId]),
    );
    const body = (await call(t, '/api/v1/me', { as: me })).json();
    expect(body.user.instanceAdmin).toBe(true);
    expect(body.instance.recoveryKitAcknowledged).toBe(false);
  });

  it('hides a managed account’s synthetic email and shows its username', async () => {
    const me = await person(t, db, 'kid');
    await ownerTx(db, async (c) => {
      await c.query('UPDATE public.user_profiles SET managed = true WHERE user_id = $1', [
        me.userId,
      ]);
      await c.query(`UPDATE auth."user" SET username = 'kiddo' WHERE id = $1`, [me.userId]);
    });
    const body = (await call(t, '/api/v1/me', { as: me })).json();
    expect(body.user).toMatchObject({ email: null, username: 'kiddo', managed: true });
  });

  // catalogue: PATCH /api/v1/me
  it('PATCH keeps "Suggest where I am" on the person, across devices, and audits it', async () => {
    const me = await person(t, db, 'me');
    const on = await call(t, '/api/v1/me', {
      as: me,
      method: 'PATCH',
      body: { suggestLocation: true },
    });
    expect(on.statusCode, on.body).toBe(200);
    expect(on.json()).toEqual({ suggestLocation: true });
    const read = await call(t, '/api/v1/me', { as: me });
    expect(read.json().profile.suggestLocation).toBe(true);
    const events = await ownerTx(
      db,
      async (c) =>
        (
          await c.query<{ action: string; diff: unknown }>(
            `SELECT action, diff FROM public.audit_events WHERE actor_id = $1 AND action = 'me.preferences'`,
            [me.userId],
          )
        ).rows,
    );
    expect(events).toEqual([
      {
        action: 'me.preferences',
        diff: { suggest_location: { before: false, after: true, class: 'plain' } },
      },
    ]);
    // The same value again changes nothing and writes nothing.
    await call(t, '/api/v1/me', { as: me, method: 'PATCH', body: { suggestLocation: true } });
    expect(
      (
        await ownerTx(db, (c) =>
          c.query(
            `SELECT 1 FROM public.audit_events WHERE actor_id = $1 AND action = 'me.preferences'`,
            [me.userId],
          ),
        )
      ).rowCount,
    ).toBe(1);
    const bad = await call(t, '/api/v1/me', { as: me, method: 'PATCH', body: { theme: 'dark' } });
    expect(bad.statusCode).toBe(400);
  });

  it('needs a session', async () => {
    expect((await call(t, '/api/v1/me')).statusCode).toBe(401);
  });
});
