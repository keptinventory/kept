import { z } from 'zod';
import type { KeptApp } from '../http/app.js';
import { requireIfMatch } from '../http/conventions.js';
import { notFound } from '../http/errors.js';
import type { InventoryDeps } from '../http/routes.js';
import { scopedRead, scopedWrite } from '../http/write.js';
import { callerMembership } from '../locations/access.js';
import {
  dissolveKit,
  KitBody,
  KitSchema,
  kitView,
  listKits,
  makeKit,
  registerKitUndo,
  updateKit,
} from './service.js';

// Kits (1.14, #170); kits/service.ts has the rules.
//
// GET    /api/v1/things/:id/kit            → {kit: Kit | null}
// POST   /api/v1/things/:id/kit {parts}    → 201 Kit                kit.create, undoable
// PUT    /api/v1/things/:id/kit (If-Match) {parts} → Kit           kit.update, undoable
// DELETE /api/v1/things/:id/kit            → 204                    kit.dissolve, undoable
// GET    /api/v1/locations/:id/kits?incomplete=1 → {items: [{thing, summary}]}

const Params = z.object({ id: z.uuid() });
const ListQuery = z.object({ incomplete: z.enum(['1', 'true']).optional() });
const KitList = z.object({
  items: z.array(
    z.object({
      thing: z.object({ id: z.uuid(), name: z.string().nullable() }),
      summary: KitSchema.shape.summary,
    }),
  ),
});

export async function kitRoutes(app: KeptApp, deps: InventoryDeps): Promise<void> {
  const { pools } = deps;
  registerKitUndo();
  const lower = (id: string) => id.toLowerCase();

  app.get(
    '/api/v1/things/:id/kit',
    { schema: { params: Params, response: { 200: z.object({ kit: KitSchema.nullable() }) } } },
    (req) =>
      scopedRead(pools, req, async (_tx, client) => ({
        kit: await kitView(client, lower(req.params.id)),
      })),
  );

  app.post(
    '/api/v1/things/:id/kit',
    { schema: { params: Params, body: KitBody, response: { 201: KitSchema } } },
    (req, reply) =>
      scopedWrite(pools, req, reply, async (tx, client, scope) => ({
        status: 201,
        body: await makeKit(
          { tx, client, scope, requestId: req.id },
          lower(req.params.id),
          req.body,
        ),
      })),
  );

  app.put(
    '/api/v1/things/:id/kit',
    { schema: { params: Params, body: KitBody, response: { 200: KitSchema } } },
    (req, reply) => {
      const expected = requireIfMatch(req);
      return scopedWrite(pools, req, reply, async (tx, client, scope) => ({
        status: 200,
        body: await updateKit(
          { tx, client, scope, requestId: req.id },
          lower(req.params.id),
          expected,
          req.body,
        ),
      }));
    },
  );

  app.delete('/api/v1/things/:id/kit', { schema: { params: Params } }, (req, reply) =>
    scopedWrite(pools, req, reply, async (tx, client, scope) => {
      await dissolveKit({ tx, client, scope, requestId: req.id }, lower(req.params.id));
      return { status: 204, body: undefined };
    }),
  );

  app.get(
    '/api/v1/locations/:id/kits',
    { schema: { params: Params, querystring: ListQuery, response: { 200: KitList } } },
    (req) =>
      scopedRead(pools, req, async (_tx, client) => {
        const id = lower(req.params.id);
        if (!(await callerMembership(client, id))) throw notFound();
        return listKits(client, id, req.query.incomplete !== undefined);
      }),
  );
}
