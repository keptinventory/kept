import { readFileSync } from 'node:fs';
import path from 'node:path';
import { newId } from '@kept/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { testDb } from '../../test/db.js';
import { asOwner, seedTenant, type Tenant } from '../../test/tenancy.js';
import { migrationsFolder } from './migrate.js';

// 1.14 (#170): every loan becomes a one-line hand-over, and nothing of it is lost. The loans are
// made as a 1.13 server left them (no hand-over, no outcome; the columns 0151 added empty), on a
// realistic mix: an open loan out with a due date and a lead, a returned one with a note that was
// split off a quantity, a borrowed one still here, a borrowed one given back. Then 0152's two
// backfill statements run, read from the migration itself, and its constraints are put back: each
// loan has a hand-over of its own id with its person, dates, lead and note, and an outcome where
// it came back. In a transaction rolled back, so the shared test database is left as it was. A
// loan written later without a hand-over (a borrow) gets one the same way, by the trigger.

const db = await testDb();

const backfill = (() => {
  const text = readFileSync(path.join(migrationsFolder, '0152_handovers_kits_rls.sql'), 'utf8');
  const section = text.slice(
    text.indexOf('-- 2. Existing loans'),
    text.indexOf('ALTER TABLE public.loans ALTER COLUMN handover_id SET NOT NULL'),
  );
  return section
    .split('--> statement-breakpoint')
    .map((s) =>
      s
        .split('\n')
        .filter((l) => !l.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter(Boolean);
})();

let tenant: Tenant;

beforeAll(async () => {
  await db.reset();
  tenant = await seedTenant(db, 'migrate');
});

describe('existing loans become one-line hand-overs', () => {
  it('keeps every loan as it was, each with a hand-over of its own id', async () => {
    expect(backfill).toHaveLength(2);
    await asOwner(db, async (c) => {
      await c.query('BEGIN');
      try {
        const one = async (sql: string, values: unknown[]) =>
          (await c.query<{ id: string }>(sql, values)).rows[0]?.id as string;
        const { locationId: loc, userId: user, accountId: acct, unplacedId } = tenant;
        const person = await one(
          `INSERT INTO public.people (owner_account_id, display_name) VALUES ($1, 'Murdock')
           RETURNING id`,
          [acct],
        );
        const thing = (name: string, quantity = 1) =>
          one(
            `INSERT INTO public.things (location_id, place_id, name, quantity, created_by)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [loc, unplacedId, name, quantity, user],
          );
        const drill = await thing('Drill');
        const pens = await thing('Pens', 6);
        const part = await thing('Pens', 2);
        const ladder = await thing('Ladder');
        const tent = await thing('Tent');
        // As a 1.13 server wrote them: no hand-over, no outcome.
        await c.query('ALTER TABLE public.loans DROP CONSTRAINT loans_closed_outcome_chk');
        await c.query('ALTER TABLE public.loans ALTER COLUMN handover_id DROP NOT NULL');
        await c.query('ALTER TABLE public.loans DISABLE TRIGGER loans_handover');
        const loans = {
          open: newId(),
          back: newId(),
          borrowed: newId(),
          given: newId(),
        };
        await c.query(
          `INSERT INTO public.loans (id, location_id, thing_id, direction, person_id, started_at,
                                     due_on, returned_at, lead_days, notes, split_from_thing_id,
                                     created_by)
           VALUES ($1, $9, $5, 'out', $11, now() - interval '3 days', current_date + 4, NULL, 3,
                   'Charger included', NULL, $12),
                  ($2, $9, $10, 'out', $11, now() - interval '20 days', current_date - 10,
                   now() - interval '9 days', 0, 'One chipped', $6, $12),
                  ($3, $9, $7, 'in', $11, now() - interval '5 days', NULL, NULL, 0, NULL, NULL, $12),
                  ($4, $9, $8, 'in', $11, now() - interval '60 days', NULL,
                   now() - interval '30 days', 0, NULL, NULL, $12)`,
          [
            loans.open,
            loans.back,
            loans.borrowed,
            loans.given,
            drill,
            pens,
            ladder,
            tent,
            loc,
            part,
            person,
            user,
          ],
        );
        const before = await c.query(
          `SELECT id, thing_id, direction, person_id, started_at, due_on, returned_at, lead_days,
                  notes, split_from_thing_id, row_version
             FROM public.loans WHERE location_id = $1 ORDER BY id`,
          [loc],
        );
        for (const sql of backfill) await c.query(sql);
        await c.query('ALTER TABLE public.loans ENABLE TRIGGER loans_handover');
        await c.query('ALTER TABLE public.loans ALTER COLUMN handover_id SET NOT NULL');
        await c.query(
          `ALTER TABLE public.loans ADD CONSTRAINT loans_closed_outcome_chk
             CHECK ((returned_at IS NULL) = (outcome IS NULL))`,
        );

        const after = await c.query(
          `SELECT id, thing_id, direction, person_id, started_at, due_on, returned_at, lead_days,
                  notes, split_from_thing_id, handover_id, outcome
             FROM public.loans WHERE location_id = $1 ORDER BY id`,
          [loc],
        );
        // Nothing of a loan changed but its hand-over and outcome.
        expect(after.rows.map(({ handover_id: _h, outcome: _o, ...rest }) => rest)).toEqual(
          before.rows.map(({ row_version: _v, ...rest }) => rest),
        );
        for (const r of after.rows) expect(r.handover_id).toBe(r.id);
        expect(Object.fromEntries(after.rows.map((r) => [r.id, r.outcome]))).toEqual({
          [loans.open]: null,
          [loans.back]: 'returned',
          [loans.borrowed]: null,
          [loans.given]: 'returned',
        });
        const handovers = await c.query(
          `SELECT h.id, h.direction, h.person_id, h.root_thing_id, h.started_at, h.due_on,
                  h.lead_days, h.notes, h.created_by
             FROM public.handovers h WHERE h.location_id = $1 ORDER BY h.id`,
          [loc],
        );
        expect(handovers.rows).toEqual(
          before.rows.map((l) => ({
            id: l.id,
            direction: l.direction,
            person_id: l.person_id,
            root_thing_id: l.thing_id,
            started_at: l.started_at,
            due_on: l.due_on,
            lead_days: l.lead_days,
            notes: l.notes,
            created_by: user,
          })),
        );

        // Written later without one (a borrow, an older export): the trigger makes it.
        const later = newId();
        await c.query(
          `INSERT INTO public.loans (id, location_id, thing_id, direction, person_id, started_at,
                                     returned_at, created_by)
           VALUES ($1, $2, $3, 'out', $4, now() - interval '1 day', now(), $5)`,
          [later, loc, pens, person, user],
        );
        const [made] = (
          await c.query(
            `SELECT o.handover_id, o.outcome, h.root_thing_id FROM public.loans o
               JOIN public.handovers h ON h.id = o.handover_id WHERE o.id = $1`,
            [later],
          )
        ).rows;
        expect(made).toEqual({ handover_id: later, outcome: 'returned', root_thing_id: pens });
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });
});
