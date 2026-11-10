import { z } from 'zod';
import { requireScope } from '../auth/http.js';
import { withScope } from '../db/scope.js';
import type { KeptApp } from '../http/app.js';
import { AppError, forbidden, notFound } from '../http/errors.js';
import { scopedRead, scopedWrite } from '../http/write.js';
import {
  type ClientNames,
  CreateTokenBody,
  CrossLocationWarningSchema,
  checkNewToken,
  createToken,
} from '../tokens/service.js';
import { type HomeAssistantLinks, LINK_TOKEN_NAME } from './link.js';

// Linking the Kept integration from the Home Assistant app (#376; link.ts says how it works).
//
// Home Assistant (the integration, on the Supervisor's internal network):
// POST /api/v1/home-assistant/link-requests            {linkSecret}
//                                                      → 201 {id, code, claimKey, expiresAt}
// POST /api/v1/home-assistant/link-requests/:id/claim  {claimKey}
//                                                      → 200 {state: 'pending' | 'declined'}
//                                                      | 200 {state: 'approved', token} (once)
// No session: the link secret (from the discovery message) and the claim key are the credentials.
// A wrong link secret is 403; an unknown, expired or wrongly keyed request is 404.
//
// The person, signed in to Kept (Settings → Connections; never a token, tokens/access.ts):
// GET  /api/v1/home-assistant/link-requests            → {available, items: [PendingLink]}
// POST /api/v1/home-assistant/link-requests/:id/approve {scope, locationIds,
//                                                       confirmCrossLocation?}
//                                                      → 202 {state: 'approved'} | 200 {warning}
//                                                        (D179)
// POST /api/v1/home-assistant/link-requests/:id/decline → 204
//
// The approval runs New token's checks (each location's `tokens.manage-own`, a viewer reads only,
// D179's warning) and makes nothing (202): the claim that collects it makes a personal token named
// "Home Assistant" through createToken, as the person who approved, with the checks again and its
// audit row (token.create). An approval nobody collects, because the request ended or Kept
// restarted, leaves no token that nobody holds (#489). A claim whose person can no longer make
// the token (a membership ended) is told `declined`. Unlike New token it is allowed over plain
// http (D181 refuses http where a secret would reach the browser): the secret is only ever in the
// claim's answer. Outside the Home Assistant app (no link secret) every route here is 404, and the
// list says `available: false`.

const Params = z.object({ id: z.uuid() });

const OpenBody = z.object({ linkSecret: z.string().min(1).max(512) });
const OpenedSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  claimKey: z.string(),
  expiresAt: z.string(),
});

const ClaimBody = z.object({ claimKey: z.string().min(1).max(512) });
const ClaimSchema = z.object({
  state: z.enum(['pending', 'approved', 'declined']),
  token: z.string().optional(),
});

const PendingSchema = z.object({
  available: z.boolean(),
  items: z.array(
    z.object({ id: z.uuid(), code: z.string(), createdAt: z.string(), expiresAt: z.string() }),
  ),
});

export const ApproveLinkBody = CreateTokenBody.pick({
  scope: true,
  locationIds: true,
  confirmCrossLocation: true,
});
const ApprovedSchema = z.object({ state: z.literal('approved') });

export type HomeAssistantLinkDeps = {
  pools: Parameters<typeof scopedRead>[0];
  /** The open requests, or null outside the Home Assistant app. */
  links: HomeAssistantLinks | null;
  tokenKey: Buffer;
  publicUrl: string;
  names: ClientNames;
};

const GONE = 'This request has ended. Start again from Home Assistant.';

export async function homeAssistantLinkRoutes(
  app: KeptApp,
  deps: HomeAssistantLinkDeps,
): Promise<void> {
  const { pools, links } = deps;
  const required = () => {
    if (!links) throw notFound();
    return links;
  };

  app.post(
    '/api/v1/home-assistant/link-requests',
    {
      config: { auth: 'none' },
      schema: { body: OpenBody, response: { 201: OpenedSchema } },
    },
    async (req, reply) => {
      const l = required();
      if (!l.isLinkSecret(req.body.linkSecret)) throw forbidden();
      reply.code(201);
      return l.open();
    },
  );

  app.post(
    '/api/v1/home-assistant/link-requests/:id/claim',
    {
      config: { auth: 'none' },
      schema: { params: Params, body: ClaimBody, response: { 200: ClaimSchema } },
    },
    async (req) => {
      const result = required().claim(req.params.id.toLowerCase(), req.body.claimKey);
      if (!result) throw notFound(GONE);
      if (result.state !== 'approved') return result;
      try {
        return { state: 'approved' as const, token: await result.issue(req.id) };
      } catch (err) {
        // The person can no longer make it (a membership ended, a role changed): nothing was made.
        if (err instanceof AppError && err.status < 500) return { state: 'declined' as const };
        throw err;
      }
    },
  );

  app.get(
    '/api/v1/home-assistant/link-requests',
    { schema: { response: { 200: PendingSchema } } },
    // Signed in only (the default auth), so the codes are a person's to see, never a stranger's.
    (req) =>
      scopedRead(pools, req, async () =>
        links ? { available: true, items: links.pending() } : { available: false, items: [] },
      ),
  );

  app.post(
    '/api/v1/home-assistant/link-requests/:id/approve',
    {
      schema: {
        params: Params,
        body: ApproveLinkBody,
        response: { 200: CrossLocationWarningSchema, 202: ApprovedSchema },
      },
    },
    (req, reply) => {
      const l = required();
      const id = req.params.id.toLowerCase();
      return scopedWrite<z.infer<typeof ApprovedSchema> | { warning: 'cross_location_write' }>(
        pools,
        req,
        reply,
        async (_tx, client, scope) => {
          if (!l.isPending(id)) throw notFound(GONE);
          const body = { name: LINK_TOKEN_NAME, ...req.body };
          const checked = await checkNewToken(client, body);
          if (checked.kind === 'warning') return { status: 200, body: checked.body };
          // The token is made only when Home Assistant collects it, as this person; the approval
          // already passed D179, so collecting doesn't ask again.
          const person = { userId: scope.userId, mfa: scope.mfa };
          const approved = l.approve(id, (requestId) =>
            withScope(pools.app, person, async (tx2, client2) => {
              const made = await createToken(
                { tx: tx2, client: client2, scope: person, requestId },
                { ...body, confirmCrossLocation: true },
                { key: deps.tokenKey, publicUrl: deps.publicUrl, names: deps.names },
              );
              if (made.kind !== 'created') throw forbidden();
              return made.body.secret;
            }),
          );
          if (!approved) throw notFound(GONE);
          return { status: 202, body: { state: 'approved' as const } };
        },
      );
    },
  );

  app.post(
    '/api/v1/home-assistant/link-requests/:id/decline',
    { schema: { params: Params } },
    async (req, reply) => {
      const l = required();
      // A person signed in (the route's default auth), like the list.
      requireScope(req);
      if (!l.decline(req.params.id.toLowerCase())) throw notFound(GONE);
      reply.code(204).send();
    },
  );
}
