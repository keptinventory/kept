import { z } from 'zod';
import type { KeptApp } from '../http/app.js';
import type { InventoryDeps } from '../http/routes.js';
import { scopedRead } from '../http/write.js';
import { registerScanSessionUndo, ScanSessionViewSchema, sessionView } from './service.js';

// Scan sessions (1.12, #168). sessions/service.ts has the rules; a session is saved by the
// `scan_session_lines` and `scan_session_finish` sync ops (sync/handlers/scan-session.ts), online
// and offline alike, so the only route reads one back.
//
// GET /api/v1/scan-sessions/:id → {id, mode, locationId, startedAt, finishedAt, expected, seen,
//                                  notHere, moved, skipped, undo?: {eventId, until}}
//     (404 for a session the caller can't see; `undo` while its 7 days last and it isn't undone)

const Params = z.object({ id: z.uuid() });

export async function scanSessionRoutes(app: KeptApp, deps: InventoryDeps): Promise<void> {
  const { pools } = deps;
  registerScanSessionUndo();

  app.get(
    '/api/v1/scan-sessions/:id',
    { schema: { params: Params, response: { 200: ScanSessionViewSchema } } },
    (req) =>
      scopedRead(pools, req, (_tx, client) => sessionView(client, req.params.id.toLowerCase())),
  );
}
