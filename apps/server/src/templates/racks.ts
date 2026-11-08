import {
  type Gear,
  isHalfStep,
  parseRackPosition,
  type RackPosition,
  rackProblem,
  type StoredRackPosition,
  shownUnit,
} from '@kept/shared';
import type pg from 'pg';
import { AppError, invalid } from '../http/errors.js';
import { lockTree } from '../places/service.js';
import { gearRows, rackOf } from './rack-view.js';

// Racks measured in rack units (#373; the rules are packages/shared racks.ts). A rack is a place
// made from a rack template (place-templates.ts): `places.layout` is `{kind: 'rack', units, width,
// numbering, mount}`, and it has no compartment places. Gear is a thing directly in it: its height
// in units (`things.rack_units`) and where it is mounted (`things.rack_at`), both set through
// PATCH /things/:id (`rackUnits`, `rackAt`), audited in `thing.update`'s image and undone with it.
//
// A position is checked under the location's tree lock, so two people putting gear in the same
// unit at once can't both win: two pieces sharing a half unit on a face (a full-depth one is on
// both) are refused (409, `rack.reason = 'taken'`, naming the piece), as is a position past the
// rack's top or below U1, or not in half units (400). Only gear directly in a rack has a position;
// a position given in one rack never counts in another, and a move clears it (0172's trigger).

const FACE_WORD: Record<string, string> = { front: 'front', rear: 'rear' };

/**
 * What a thing's rack columns become for PATCH /things/:id's `rackUnits` and `rackAt`, checked
 * under the location's tree lock: `rack_at` as stored (undefined: leave it), or a 400/409 naming
 * what's wrong. A height changed on placed gear is checked at its position too.
 */
export async function rackWrite(
  client: pg.ClientBase,
  thing: { id: string; location_id: string; place_id: string | null; container_id: string | null },
  body: { rackUnits?: number | null; rackAt?: RackPosition | null },
): Promise<StoredRackPosition | null | undefined> {
  if (body.rackUnits !== undefined && body.rackUnits !== null && !isHalfStep(body.rackUnits)) {
    throw invalid('Check body.rackUnits: half units only, like 1, 1.5 or 2.');
  }
  if (body.rackAt === null) return null;
  await lockTree(client, thing.location_id);
  const { rows } = await client.query<{ units: number | null; rack_at: unknown }>(
    'SELECT rack_units::float8 AS units, rack_at FROM public.things WHERE id = $1',
    [thing.id],
  );
  const stored = parseRackPosition(rows[0]?.rack_at ?? null);
  const placed = stored && stored.rackId === thing.place_id && !thing.container_id ? stored : null;
  const at: RackPosition | null =
    body.rackAt ?? (placed ? { u: placed.u, face: placed.face, full: placed.full } : null);
  if (!at) return undefined;
  const rack = thing.place_id && !thing.container_id ? await rackOf(client, thing.place_id) : null;
  if (!rack || !thing.place_id) {
    throw invalid('Put it in a rack first: only gear directly in a rack has a unit.');
  }
  const units = body.rackUnits !== undefined ? body.rackUnits : (rows[0]?.units ?? null);
  // 0U gear sits beside the rails: a height of 0 takes it off its unit.
  if (units === 0 && !body.rackAt) return null;
  const gear: Gear = { id: thing.id, units, at };
  const others = await gearRows(client, thing.place_id);
  const problem = rackProblem(rack, gear, others);
  if (problem) {
    const top = rack.units;
    if (problem.reason === 'taken') {
      const by = others.find((o) => o.id === problem.by);
      const shown = shownUnit(rack, problem.u);
      throw new AppError(
        'conflict',
        409,
        `U${shown} is taken by ${by?.name ?? 'something else'} (${FACE_WORD[problem.face]}).`,
        {
          rack: {
            reason: 'taken',
            u: shown,
            face: problem.face,
            by: { id: problem.by, name: by?.name ?? '' },
          },
        },
      );
    }
    if (problem.reason === 'outside') {
      throw new AppError('validation', 400, `It doesn't fit: the rack has ${top} units.`, {
        rack: { reason: 'outside', top },
      });
    }
    if (problem.reason === 'zero') {
      throw new AppError('validation', 400, '0U gear sits beside the rails: it has no unit.', {
        rack: { reason: 'zero' },
      });
    }
    throw new AppError('validation', 400, 'Half units only: 1, 1.5, 2 …', {
      rack: { reason: 'half' },
    });
  }
  if (!body.rackAt) return undefined;
  return { rackId: thing.place_id, u: at.u, face: at.face, full: at.full };
}
