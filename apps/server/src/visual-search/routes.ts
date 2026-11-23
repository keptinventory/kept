import {
  VISUAL_IMAGE_MAX_BYTES,
  VISUAL_IMAGE_MIMES,
  VISUAL_LOCATION_LIMIT,
  VisualSearchCoverageSchema,
  VisualSearchInputResponseSchema,
  VisualSearchReindexResponseSchema,
  VisualSearchReindexSchema,
  VisualSearchRequestSchema,
  VisualSearchResultSchema,
} from '@kept/shared';
import type { FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audited } from '../audit/audited.js';
import { requireScope } from '../auth/http.js';
import type { KeptApp } from '../http/app.js';
import { forbidden, invalid } from '../http/errors.js';
import type { InventoryDeps } from '../http/routes.js';
import { scopedWrite } from '../http/write.js';
import { requireMembership } from '../locations/access.js';
import { enqueueVisualIndex } from './job.js';
import { localVisualProvider } from './provider.js';
import { VisualQueries, visualUnavailable } from './query.js';
import { pendingVisualAttachments } from './store.js';

const LocationQuery = z.object({
  locationIds: z
    .string()
    .max(VISUAL_LOCATION_LIMIT * 37)
    .transform((value) => value.split(','))
    .pipe(z.array(z.uuid().toLowerCase()).min(1).max(VISUAL_LOCATION_LIMIT))
    .optional(),
});

function principal(req: FastifyRequest): string {
  const scope = requireScope(req);
  if (scope.tokenId) return `token:${scope.tokenId}`;
  if (req.authSession) return `session:${req.authSession.sessionId}`;
  throw forbidden('A signed-in session is required for a temporary photo input.');
}

export async function visualSearchRoutes(app: KeptApp, deps: InventoryDeps): Promise<void> {
  const provider = deps.visualProvider === undefined ? localVisualProvider() : deps.visualProvider;
  const queries = new VisualQueries(deps.pools.app, provider);
  app.addHook('onClose', async () => queries.close());

  app.get(
    '/api/v1/visual-search/status',
    {
      schema: { querystring: LocationQuery, response: { 200: VisualSearchCoverageSchema } },
    },
    (req, reply) => {
      reply.header('cache-control', 'no-store');
      return queries.status(requireScope(req), req.query.locationIds);
    },
  );

  app.post(
    '/api/v1/visual-search',
    {
      schema: { body: VisualSearchRequestSchema, response: { 200: VisualSearchResultSchema } },
    },
    (req, reply) => {
      reply.header('cache-control', 'no-store');
      return queries.search(
        requireScope(req),
        'inputId' in req.body ? principal(req) : '',
        req.body,
      );
    },
  );

  await app.register(async (raw) => {
    const scoped = raw.withTypeProvider<ZodTypeProvider>();
    scoped.addContentTypeParser(
      [...VISUAL_IMAGE_MIMES],
      { parseAs: 'buffer' },
      (_req, body, done) => done(null, body),
    );
    scoped.post(
      '/api/v1/visual-search/input',
      {
        bodyLimit: VISUAL_IMAGE_MAX_BYTES,
        schema: { querystring: LocationQuery, response: { 201: VisualSearchInputResponseSchema } },
      },
      async (req, reply) => {
        const bytes = req.body;
        reply.header('cache-control', 'no-store');
        if (!Buffer.isBuffer(bytes) || bytes.byteLength === 0) throw invalid('Send an image.');
        try {
          const input = await queries.input(
            requireScope(req),
            principal(req),
            bytes,
            req.query.locationIds,
          );
          reply.code(201);
          return input;
        } finally {
          // Also clear parser-owned data on preflight rejection, including disabled inference.
          bytes.fill(0);
        }
      },
    );
  });

  app.delete(
    '/api/v1/visual-search/input/:id',
    {
      schema: { params: z.object({ id: z.uuid().toLowerCase() }) },
    },
    (req, reply) => {
      queries.cancel(requireScope(req), principal(req), req.params.id);
      reply.header('cache-control', 'no-store').code(204).send();
    },
  );

  app.post(
    '/api/v1/admin/visual-search/reindex',
    {
      schema: {
        body: VisualSearchReindexSchema,
        response: { 202: VisualSearchReindexResponseSchema },
      },
    },
    (req, reply) =>
      scopedWrite(deps.pools, req, reply, async (tx, client, scope) => {
        const locationId = req.body.locationId.toLowerCase();
        const member = await requireMembership(client, locationId);
        if (scope.tokenId || (member.role !== 'owner' && member.role !== 'admin'))
          throw forbidden();
        if (!provider || !deps.jobs || !deps.files) throw visualUnavailable();
        const attachments = await pendingVisualAttachments(client, locationId, provider.generation);
        await enqueueVisualIndex(deps.jobs, client, attachments, true);
        await audited(tx, {
          locationId,
          actor: { type: 'user', id: scope.userId },
          action: 'visual_search.reindex',
          entity: { type: 'visual_search', id: locationId },
          after: { generation: provider.generation, queued: attachments.length },
          requestId: req.id,
        });
        return { status: 202, body: { queued: attachments.length } };
      }),
  );
}
