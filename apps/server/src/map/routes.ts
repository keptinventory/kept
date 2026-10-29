import { z } from 'zod';
import type { KeptApp } from '../http/app.js';
import type { InventoryDeps } from '../http/routes.js';
import { scopedRead, scopedWrite } from '../http/write.js';
import {
  ApplyBody,
  ApplyResultSchema,
  applyFloorPlan,
  discardFloorPlan,
  FloorPlanViewSchema,
  floorPlanView,
  registerFloorPlanUndo,
  retryFloorPlan,
  StartBody,
  startFloorPlan,
} from './floor-plans.js';
import { AddNodesBody, addNodes, LayoutBody, putLayout } from './service.js';
import { registerMapUndo } from './undo.js';
import { MapViewSchema, mapView } from './view.js';

// The location map (1.x, D237). The web's contract is apps/web/src/api/map/{types,paths}.ts.
//
// GET /api/v1/locations/:id/map     → MapView (every role that sees the location)
// PUT /api/v1/locations/:id/layout  {version, rooms, nodes} → {version} (members and up;
//                                   audited `place.arrange`, undoable for ten minutes)
// POST /api/v1/locations/:id/layout/nodes {nodes: [{id, model?}]} → {added, version} (members and
//                                   up; Kept places things on free floor, audited `map.place`)
// Floor plan to map (1.14.3, D266; floor-plans.ts):
// POST /api/v1/locations/:id/floor-plans {fileId, sha256?, turn?} → 201 FloorPlanView
// GET  /api/v1/floor-plans/:id → FloorPlanView (members and up)
// POST /api/v1/floor-plans/:id/retry · /discard · /apply

const Params = z.object({ id: z.uuid() });

export async function mapRoutes(app: KeptApp, deps: InventoryDeps): Promise<void> {
  const { pools } = deps;
  registerMapUndo();
  registerFloorPlanUndo();
  const ctx = (
    req: { id: string },
    tx: Parameters<typeof startFloorPlan>[0]['tx'],
    client: Parameters<typeof startFloorPlan>[0]['client'],
    scope: Parameters<typeof startFloorPlan>[0]['scope'],
  ) => ({ tx, client, scope, requestId: req.id, jobs: deps.jobs, files: deps.files });

  app.get(
    '/api/v1/locations/:id/map',
    { schema: { params: Params, response: { 200: MapViewSchema } } },
    (req) =>
      scopedRead(pools, req, (tx, client) => mapView(tx, client, req.params.id.toLowerCase())),
  );

  app.put(
    '/api/v1/locations/:id/layout',
    {
      schema: {
        params: Params,
        body: LayoutBody,
        response: { 200: z.object({ version: z.string().nullable() }) },
      },
    },
    (req, reply) =>
      scopedWrite(pools, req, reply, async (tx, client, scope) => ({
        status: 200,
        body: await putLayout(
          { tx, client, scope, requestId: req.id },
          req.params.id.toLowerCase(),
          req.body,
        ),
      })),
  );

  app.post(
    '/api/v1/locations/:id/layout/nodes',
    {
      schema: {
        params: Params,
        body: AddNodesBody,
        response: {
          200: z.object({ added: z.array(z.uuid()), version: z.string().nullable() }),
        },
      },
    },
    (req, reply) =>
      scopedWrite(pools, req, reply, async (tx, client, scope) => ({
        status: 200,
        body: await addNodes(
          { tx, client, scope, requestId: req.id },
          req.params.id.toLowerCase(),
          req.body,
        ),
      })),
  );

  app.post(
    '/api/v1/locations/:id/floor-plans',
    { schema: { params: Params, body: StartBody, response: { 201: FloorPlanViewSchema } } },
    (req, reply) =>
      scopedWrite(pools, req, reply, async (tx, client, scope) => ({
        status: 201,
        body: await startFloorPlan(
          ctx(req, tx, client, scope),
          req.params.id.toLowerCase(),
          req.body,
        ),
      })),
  );

  app.get(
    '/api/v1/floor-plans/:id',
    { schema: { params: Params, response: { 200: FloorPlanViewSchema } } },
    (req) => scopedRead(pools, req, (_tx, client) => floorPlanView(client, req.params.id)),
  );

  app.post(
    '/api/v1/floor-plans/:id/retry',
    { schema: { params: Params, response: { 200: FloorPlanViewSchema } } },
    (req, reply) =>
      scopedWrite(pools, req, reply, async (tx, client, scope) => ({
        status: 200,
        body: await retryFloorPlan(ctx(req, tx, client, scope), req.params.id),
      })),
  );

  app.post(
    '/api/v1/floor-plans/:id/discard',
    {
      schema: {
        params: Params,
        response: { 200: z.object({ status: z.literal('discarded') }) },
      },
    },
    (req, reply) =>
      scopedWrite(pools, req, reply, async (tx, client, scope) => ({
        status: 200,
        body: await discardFloorPlan(ctx(req, tx, client, scope), req.params.id),
      })),
  );

  app.post(
    '/api/v1/floor-plans/:id/apply',
    { schema: { params: Params, body: ApplyBody, response: { 200: ApplyResultSchema } } },
    (req, reply) =>
      scopedWrite(pools, req, reply, async (tx, client, scope) => ({
        status: 200,
        body: await applyFloorPlan(ctx(req, tx, client, scope), req.params.id, req.body),
      })),
  );
}
