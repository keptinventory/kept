import { z } from 'zod';
import type { KeptApp } from '../http/app.js';
import { paginate } from '../http/conventions.js';
import { invalid } from '../http/errors.js';
import type { InventoryDeps } from '../http/routes.js';
import { scopedRead, scopedWrite } from '../http/write.js';
import {
  BoxCheckDetailSchema,
  boxCheckDetail,
  CountResultSchema,
  CountsPageSchema,
  CountsQuery,
  countCsv,
  countResult,
  listCounts,
  OpenCountSchema,
  openCount,
  SessionLinesSchema,
  sessionLines,
} from './counts.js';
import {
  registerScanSessionUndo,
  ScanSessionViewSchema,
  StartCountBody,
  sessionView,
  startCount,
} from './service.js';

// Scan sessions (1.12, #168) and the counts they keep (1.14, #172). sessions/service.ts has the
// rules; a session is saved by the `scan_session_lines` and `scan_session_finish` sync ops
// (sync/handlers/scan-session.ts), online and offline alike. A count may also be opened online
// first, so that others counting the same target join it; counts.ts has the reads.
//
// POST /api/v1/scan-sessions {id, target, startedAt?, countedPlaceIds?} → 201 {id}
//     (a count, opened for others to join; a retry answers the same session)
// GET  /api/v1/scan-sessions/open?placeId|containerId|locationId → {session: {…} | null}
// GET  /api/v1/scan-sessions/:id → {id, mode, locationId, startedAt, finishedAt, expected, seen,
//                                  notHere, moved, skipped, undo?: {eventId, until}}
//     (404 for a session the caller can't see; `undo` while its 7 days last and it isn't undone)
// GET  /api/v1/scan-sessions/:id/lines → {finishedAt, countedPlaceIds, lines}
// GET  /api/v1/scan-sessions/:id/result → {session, lines, previous, compare}
// GET  /api/v1/scan-sessions/:id/result.csv → text/csv
// GET  /api/v1/box-checks/:id → {id, at, by, container, lines}
// GET  /api/v1/locations/:id/counts?q&kind&placeId&by&had&from&to&limit&cursor
//     → {items: CountSummary[], next_cursor}

const Params = z.object({ id: z.uuid() });
const OpenQuery = z.object({
  placeId: z.uuid().optional(),
  containerId: z.uuid().optional(),
  locationId: z.uuid().optional(),
});

export async function scanSessionRoutes(app: KeptApp, deps: InventoryDeps): Promise<void> {
  const { pools } = deps;
  registerScanSessionUndo();

  app.post(
    '/api/v1/scan-sessions',
    {
      schema: { body: StartCountBody, response: { 201: z.object({ id: z.uuid() }) } },
    },
    (req, reply) =>
      scopedWrite(pools, req, reply, async (tx, client, scope) => ({
        status: 201,
        body: await startCount(
          { tx, client, scope, requestId: req.id, jobs: deps.jobs, files: deps.files },
          req.body,
        ),
      })),
  );

  app.get(
    '/api/v1/scan-sessions/open',
    { schema: { querystring: OpenQuery, response: { 200: OpenCountSchema } } },
    (req) => {
      const { placeId, containerId, locationId } = req.query;
      const given = [placeId, containerId, locationId].filter((x) => x !== undefined);
      if (given.length !== 1) throw invalid('Give one of placeId, containerId or locationId.');
      const target = placeId
        ? { placeId, inside: true }
        : containerId
          ? { containerId }
          : { locationId: locationId as string };
      return scopedRead(pools, req, (_tx, client) => openCount(client, target));
    },
  );

  app.get(
    '/api/v1/scan-sessions/:id',
    { schema: { params: Params, response: { 200: ScanSessionViewSchema } } },
    (req) =>
      scopedRead(pools, req, (_tx, client) => sessionView(client, req.params.id.toLowerCase())),
  );

  app.get(
    '/api/v1/scan-sessions/:id/lines',
    { schema: { params: Params, response: { 200: SessionLinesSchema } } },
    (req) =>
      scopedRead(pools, req, (_tx, client) => sessionLines(client, req.params.id.toLowerCase())),
  );

  app.get(
    '/api/v1/scan-sessions/:id/result',
    { schema: { params: Params, response: { 200: CountResultSchema } } },
    (req) =>
      scopedRead(pools, req, (_tx, client) => countResult(client, req.params.id.toLowerCase())),
  );

  app.get(
    '/api/v1/scan-sessions/:id/result.csv',
    { schema: { params: Params } },
    async (req, reply) => {
      const csv = await scopedRead(pools, req, (_tx, client) =>
        countCsv(client, req.params.id.toLowerCase()),
      );
      reply
        .type('text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="kept-count-${req.params.id}.csv"`)
        .header('cache-control', 'no-store');
      return `﻿${csv}`;
    },
  );

  app.get(
    '/api/v1/box-checks/:id',
    { schema: { params: Params, response: { 200: BoxCheckDetailSchema } } },
    (req) =>
      scopedRead(pools, req, (_tx, client) => boxCheckDetail(client, req.params.id.toLowerCase())),
  );

  app.get(
    '/api/v1/locations/:id/counts',
    { schema: { params: Params, querystring: CountsQuery, response: { 200: CountsPageSchema } } },
    (req) =>
      scopedRead(pools, req, (_tx, client) =>
        listCounts(
          client,
          req.params.id.toLowerCase(),
          req.query,
          paginate<[string, string]>(req.query),
        ),
      ),
  );
}
