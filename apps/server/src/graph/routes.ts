import { z } from 'zod';
import type { KeptApp } from '../http/app.js';
import type { InventoryDeps } from '../http/routes.js';
import { scopedRead } from '../http/write.js';
import { GraphViewSchema, graphView } from './view.js';

// The graph view (#207). The web's contract is apps/web/src/api/graph/{types,paths}.ts.
//
// GET /api/v1/locations/:id/graph → GraphView (every role that sees the location; read only)

const Params = z.object({ id: z.uuid() });

export async function graphRoutes(app: KeptApp, deps: InventoryDeps): Promise<void> {
  const { pools } = deps;
  app.get(
    '/api/v1/locations/:id/graph',
    { schema: { params: Params, response: { 200: GraphViewSchema } } },
    (req) =>
      scopedRead(pools, req, (tx, client) => graphView(tx, client, req.params.id.toLowerCase())),
  );
}
