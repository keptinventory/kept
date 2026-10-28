import type { KeptApp } from '../http/app.js';
import type { InventoryDeps } from '../http/routes.js';
import { scopedRead, scopedWrite } from '../http/write.js';
import { guardOnLoan } from '../lending/guard.js';
import {
  BulkEditBody,
  BulkEditResultSchema,
  BulkTrashBody,
  BulkTrashResultSchema,
  bulkEdit,
  bulkTrash,
  listSheet,
  SheetPageSchema,
  SheetQuery,
} from './sheet.js';
import { TagThingsBody, TagThingsResult, tagThings } from './tags.js';

// The spreadsheet view's routes (1.x, D250; sheet.ts has the decisions), registered from
// things/routes.ts:
//
// GET  /api/v1/things/sheet       → {items: SheetRow[], next_cursor}
// POST /api/v1/things/bulk-edit   {edits (≤ 200)} → {results, rows, events}
// POST /api/v1/things/bulk-trash  {thingIds (≤ 200), contents?, onLoan?} → {trashed, moved, events}
//                                 (409 on_loan for something with someone, as one thing's trash)
// POST /api/v1/things/tags        {thingIds (≤ 200), add?, remove?} → {changed, events} (tags.ts)

export async function sheetRoutes(app: KeptApp, deps: InventoryDeps): Promise<void> {
  const { pools } = deps;

  app.get(
    '/api/v1/things/sheet',
    { schema: { querystring: SheetQuery, response: { 200: SheetPageSchema } } },
    (req) =>
      scopedRead(pools, req, (tx, client, scope) => listSheet({ tx, client, scope }, req.query)),
  );

  app.post(
    '/api/v1/things/bulk-edit',
    { schema: { body: BulkEditBody, response: { 200: BulkEditResultSchema } } },
    (req, reply) =>
      scopedWrite(pools, req, reply, async (tx, client, scope) => ({
        status: 200,
        body: await bulkEdit(
          { tx, client, scope, requestId: req.id, jobs: deps.jobs, files: deps.files },
          req.body,
        ),
      })),
  );

  app.post(
    '/api/v1/things/tags',
    { schema: { body: TagThingsBody, response: { 200: TagThingsResult } } },
    (req, reply) =>
      scopedWrite(pools, req, reply, async (tx, client, scope) => ({
        status: 200,
        body: await tagThings(
          { tx, client, scope, requestId: req.id, jobs: deps.jobs, files: deps.files },
          req.body,
        ),
      })),
  );

  app.post(
    '/api/v1/things/bulk-trash',
    { schema: { body: BulkTrashBody, response: { 200: BulkTrashResultSchema } } },
    (req, reply) =>
      scopedWrite(pools, req, reply, async (tx, client, scope) => {
        // With someone: asked first (1.14), as POST /things/:id/trash asks.
        await guardOnLoan(
          client,
          req.body.thingIds.map((x) => x.toLowerCase()),
          null,
          req.body.onLoan === 'confirm',
        );
        return {
          status: 200,
          body: await bulkTrash(
            { tx, client, scope, requestId: req.id, jobs: deps.jobs, files: deps.files },
            req.body,
          ),
        };
      }),
  );
}
