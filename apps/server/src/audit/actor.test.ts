import { randomBytes } from 'node:crypto';
import { newId } from '@kept/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { draftPurchase, inboxItem } from '../../test/inbox.js';
import { call, type Person, peopleApp, person } from '../../test/people.js';
import { builtinType, createLocation, createThing, type Loc, ok, own } from '../../test/things.js';
import { fixedSecretKeys, keyringOf } from '../crypto/keyring.js';
import { type Scope, type Tx, withScope } from '../db/scope.js';
import { logFuel } from '../fuel/service.js';
import { confirmReceipt } from '../inbox/receipt.js';
import { putRate } from '../money/fx.js';
import { deleteValuation } from '../money/valuations.js';
import type { WriteCtx } from '../registries/account.js';
import { clearSecret, subjectOf } from '../secrets/service.js';
import { CreatePlaceTemplateBody, createPlaceTemplate } from '../templates/place-templates.js';
import { CreateTemplateBody, createTemplate } from '../templates/service.js';
import { convertField } from '../types/convert.js';
import { createPlaceKind } from '../types/place-kinds.js';
import { createType } from '../types/service.js';
import { CreateTypeBody } from '../types/view.js';
import { createClaim, deleteClaim } from '../warranties/claims.js';
import { deleteWarranty } from '../warranties/service.js';

// The paths that build a registry write context or an audit actor by hand, called as each kind
// of principal. None is open to a token yet (tokens/access.ts), so the token case calls the
// operation directly in a token-scoped transaction, as a route opened to tokens would. Each audit
// row the call writes must name the caller: the token for a token (0070's audit policy refuses a
// user actor while a token is the principal), the user for a session, as before.

let db: TestDb;
let t: TestApp;
let ibrahim: Person; // owner of Home
let home: Loc; // complete: every module
let tokenId: string;
let seq = 0;

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  // Token creation is https only; the secret below needs a key.
  t = await peopleApp(db, {
    publicUrl: 'https://kept.example',
    secretKeys: fixedSecretKeys(
      keyringOf({ version: 1, key: randomBytes(32), retired: new Map() }),
    ),
  });
  ibrahim = await person(t, db, 'ibrahim');
  home = await createLocation(t, db, ibrahim, 'complete');
  const made = ok(
    await call(t, '/api/v1/tokens', {
      as: ibrahim,
      body: { name: 'Home write', scope: 'write', locationIds: [home.id] },
    }),
    201,
  ) as unknown as { token: { id: string } };
  tokenId = made.token.id;
  // The field conversion is refused until the recovery kit is acknowledged.
  await own(
    db,
    `INSERT INTO public.instance_settings (key, value)
     VALUES ('recovery_kit_acknowledged_at', to_jsonb(now())) ON CONFLICT (key) DO NOTHING`,
  );
});

afterAll(async () => {
  await t.app.close();
});

type Who = 'token' | 'session';
type Run = {
  tx: Tx;
  client: Parameters<Parameters<typeof withScope>[2]>[1];
  scope: Scope;
  requestId: string;
  jobs: null;
  files: null;
  /** The registry write context, as registries/routes.ts writeCtx() builds it. */
  write: WriteCtx;
};

/** Runs `fn` as `who` and answers the audit rows the call wrote. */
async function as(who: Who, fn: (r: Run) => Promise<unknown>) {
  seq += 1;
  const requestId = `actor-test-${seq}`;
  const scope: Scope =
    who === 'token'
      ? { userId: ibrahim.userId, mfa: false, tokenId }
      : { userId: ibrahim.userId, mfa: false };
  await withScope(db.pools.app, scope, (tx, client) =>
    fn({
      tx,
      client,
      scope,
      requestId,
      jobs: null,
      files: null,
      write: {
        tx,
        client,
        userId: scope.userId,
        tokenId: scope.tokenId ?? null,
        requestId,
        jobs: null,
      },
    }),
  );
  return own<{ action: string; actor_type: string; actor_id: string }>(
    db,
    'SELECT action, actor_type, actor_id FROM public.audit_events WHERE request_id = $1 ORDER BY id',
    [requestId],
  );
}

const actor = (who: Who) =>
  who === 'token'
    ? { actor_type: 'token', actor_id: tokenId }
    : { actor_type: 'user', actor_id: ibrahim.userId };

/** Every row names `who`, and the call wrote each action in `actions`. */
function expectBy(
  who: Who,
  rows: { action: string; actor_type: string; actor_id: string }[],
  actions: string[],
) {
  expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(actions));
  for (const r of rows) expect({ action: r.action, ...actor(who) }).toEqual(r);
}

/** A URL document on a warranty, claim or valuation, added by Ibrahim. */
async function doc(subject: Record<string, string>, role: string) {
  ok(
    await call(t, '/api/v1/attachments', {
      as: ibrahim,
      body: { locationId: home.id, url: `https://maker.example/${newId()}`, subject, role },
    }),
    201,
  );
}

describe.each<Who>(['token', 'session'])('audited as the caller: %s', (who) => {
  it('a fill naming a new station makes the vendor (fuel stationFor)', async () => {
    const car = await createThing(t, ibrahim, home, {
      name: 'Toyota Corolla',
      typeId: await builtinType(db, 'car'),
    });
    const rows = await as(who, (r) =>
      logFuel(r, car.id, {
        takenAt: new Date().toISOString(),
        amount: '20',
        unit: 'L',
        isFull: true,
        vendor: { name: `Ring Road Station ${who}` },
      }),
    );
    expectBy(who, rows, ['vendor.create', 'fuel.create']);
  });

  it('a claim naming a new service center makes the vendor (claims vendorFor)', async () => {
    const oven = await createThing(t, ibrahim, home, { name: 'Oven' });
    const rows = await as(who, (r) =>
      createClaim(r, oven.id, { openedOn: '2026-01-10', vendor: { name: `Oven Fixers ${who}` } }),
    );
    expectBy(who, rows, ['vendor.create', 'claim.create']);
  });

  it('confirming a receipt from a new shop makes the vendor (confirmReceipt)', async () => {
    const purchaseId = await draftPurchase(db, home, [{ description: 'Kettle' }]);
    const itemId = await inboxItem(db, home, ibrahim, { kind: 'receipt', purchaseId });
    const rows = await as(who, (r) =>
      confirmReceipt(r, itemId, 1, {
        vendor: { name: `Souq Bab ${who}` },
        purchasedOn: '2026-01-10',
        currency: 'EGP',
        lines: [{ index: 0, description: 'Kettle', quantity: '1', action: 'skip' }],
      }),
    );
    expectBy(who, rows, ['vendor.create', 'purchase.confirm']);
  });

  it('a new type (types/service)', async () => {
    const rows = await as(who, (r) =>
      createType(
        r.write,
        home.accountId,
        CreateTypeBody.parse({
          parentId: null,
          name: `Lamp ${who}`,
          icon: 'lucide:lamp',
          capabilities: [],
        }),
      ),
    );
    expectBy(who, rows, ['type.create']);
  });

  it('a new place kind (types/place-kinds)', async () => {
    const rows = await as(who, (r) =>
      createPlaceKind(r.write, home.accountId, {
        key: `shed_${who}`,
        name: `Shed ${who}`,
        icon: 'lucide:warehouse',
      }),
    );
    expectBy(who, rows, ['place_kind.create']);
  });

  it('a field converted to a number (types/convert)', async () => {
    const typeId = newId();
    const fieldId = newId();
    const key = `width_${who}`;
    await own(
      db,
      `INSERT INTO public.types (id, owner_account_id, name, icon)
       VALUES ($1, $2, $3, 'lucide:door-open')`,
      [typeId, home.accountId, `Door ${who}`],
    );
    await own(
      db,
      `INSERT INTO public.type_fields (id, owner_account_id, type_id, key, label, kind)
       VALUES ($1, $2, $3, $4, $4, 'text')`,
      [fieldId, home.accountId, typeId, key],
    );
    await own(
      db,
      `INSERT INTO public.things (id, location_id, place_id, name, type_id, custom)
       VALUES ($1, $2, $3, 'Front door', $4, $5)`,
      [newId(), home.id, home.unplacedId, typeId, JSON.stringify({ [key]: '90' })],
    );
    const rows = await as(who, (r) =>
      convertField(
        r.write,
        {
          keys: () => {
            throw new Error('no secret in a number conversion');
          },
        },
        fieldId,
        1,
        { kind: 'number', unit: 'cm' },
      ),
    );
    expectBy(who, rows, ['type.field_convert']);
  });

  it('a new template (templates/service)', async () => {
    const rows = await as(who, (r) =>
      createTemplate(
        r.write,
        home.accountId,
        CreateTemplateBody.parse({
          name: `Kitchen chair ${who}`,
          payload: {},
          locationIds: [home.id],
        }),
      ),
    );
    expectBy(who, rows, ['template.create']);
  });

  it('a new place template (templates/place-templates)', async () => {
    const rows = await as(who, (r) =>
      createPlaceTemplate(
        r.write,
        home.accountId,
        CreatePlaceTemplateBody.parse({
          name: `Wide cube shelf ${who}`,
          layout: { kind: 'grid', across: 3, up: 2 },
          kindKey: 'furniture',
          compartmentKindKey: 'cube',
          compartmentName: 'Cube {n}',
          codePattern: '{parent}-C{col:02}{row:02}',
          locationIds: [home.id],
        }),
      ),
    );
    expectBy(who, rows, ['template.create']);
  });

  it('deleting a warranty deletes its documents (auditDeletedDocuments)', async () => {
    const kettle = await createThing(t, ibrahim, home, { name: 'Kettle' });
    const w = ok(
      await call(t, `/api/v1/things/${kettle.id}/warranties`, {
        as: ibrahim,
        body: { kind: 'manufacturer', startsOn: '2026-01-01', termMonths: 12 },
      }),
      201,
    );
    await doc({ warrantyId: w.id }, 'warranty_doc');
    const rows = await as(who, (r) => deleteWarranty(r, w.id, 1));
    expectBy(who, rows, ['attachment.delete', 'warranty.delete']);
  });

  it('deleting a claim deletes its documents (auditDeletedDocuments)', async () => {
    const fridge = await createThing(t, ibrahim, home, { name: 'Fridge' });
    const c = ok(
      await call(t, `/api/v1/things/${fridge.id}/claims`, {
        as: ibrahim,
        body: { openedOn: '2026-01-10' },
      }),
      201,
    );
    await doc({ claimId: c.id }, 'proof');
    const rows = await as(who, (r) => deleteClaim(r, c.id, 1));
    expectBy(who, rows, ['attachment.delete', 'claim.delete']);
  });

  it('deleting a valuation deletes its documents (auditDeletedDocuments)', async () => {
    const watch = await createThing(t, ibrahim, home, { name: 'Watch' });
    const v = ok(
      await call(t, `/api/v1/things/${watch.id}/valuations`, {
        as: ibrahim,
        body: { value: '5000', currency: 'EGP', valuedOn: '2026-01-10', source: 'appraisal' },
      }),
      201,
    );
    await doc({ valuationId: v.id }, 'document');
    const rows = await as(who, (r) => deleteValuation(r, v.id, 1));
    expectBy(who, rows, ['attachment.delete', 'valuation.delete']);
  });

  // One of the session-only routes that wrote `{type: 'user'}` by hand.
  it('an exchange rate (money/fx)', async () => {
    const rows = await as(who, (r) =>
      putRate(
        r,
        home.accountId,
        {
          fromCcy: 'USD',
          toCcy: 'EGP',
          rate: '48.5',
          validFrom: who === 'token' ? '2026-03-01' : '2026-03-02',
        },
        null,
      ),
    );
    expectBy(who, rows, ['fx_rate.set']);
  });
});

// The routes a token must never reach (tokens/access.ts NEVER_FOR_TOKENS) keep the hand-built user
// actor on purpose: should a token scope ever reach one, the audit insert refuses it (0070).
describe('a never-for-tokens route keeps the user actor', () => {
  async function safeWithCombination() {
    const safe = await createThing(t, ibrahim, home, {
      name: 'Safe',
      typeId: await builtinType(db, 'safe'),
    });
    const put = await call(t, `/api/v1/things/${safe.id}/secrets/combination`, {
      as: ibrahim,
      method: 'PUT',
      body: { value: '12-34-56' },
    });
    expect(put.statusCode, put.body).toBe(204);
    return safe.id;
  }
  const clear = (who: Who, safeId: string) =>
    as(who, async (r) => clearSecret(r, await subjectOf(r.client, 'thing', safeId, 'combination')));

  it('clearing a secret audits as the person', async () => {
    const rows = await clear('session', await safeWithCombination());
    expectBy('session', rows, ['secret.clear']);
  });

  it('clearing a secret in a token scope is refused at the audit insert', async () => {
    const safeId = await safeWithCombination();
    await expect(clear('token', safeId)).rejects.toMatchObject({
      cause: { code: '42501', message: expect.stringContaining('"audit_events"') },
    });
  });
});
