import { randomBytes } from 'node:crypto';
import {
  NATIVE_CAPTURE_PAYLOAD_VERSION,
  NATIVE_INVENTORY_PAYLOAD_VERSION,
  NativeCaptureCapabilitiesSchema,
  newId,
} from '@kept/shared';
import { makeSignature } from 'better-auth/crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { JWTVerifyGetKey } from 'jose';
import type pg from 'pg';
import { z } from 'zod';
import { auditAccountEvent } from '../accounts/account-audit.js';
import type { KeptApp } from '../http/app.js';
import { AppError, forbidden, invalid, unauthenticated } from '../http/errors.js';
import { type Auth, FRESH_SESSION_SECONDS, sessionPolicy } from './auth.js';
import { isUndeliverableEmail } from './emails.js';
import { assertFromThisSite, authHeaders, reserveTokenAttempt } from './http.js';
import {
  APPLE_PROVIDER,
  type AppleIdentity,
  appleNonce,
  digest,
  verifyNativeApple,
} from './native-apple.js';

const connectPath = '/native/connect';
const epochKey = 'kept-native-sync-epoch';
const applePrefix = 'kept-native-apple:';
const grantPrefix = 'kept-native-apple:grant:';
const setupAgent = 'Kept for iPhone setup';
const randomToken = () => randomBytes(32).toString('base64url');
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const AppleStart = z.strictObject({
  identityToken: z.string().min(1).max(8192),
  verifier: token,
  state: token,
});
const Handshake = z.strictObject({ appleToken: token });
const Approval = Handshake.extend({ confirmLink: z.literal('yes').optional() });
const Exchange = z.strictObject({ code: token, verifier: token });
const NativeContext = z.object({ account: z.uuid(), epoch: z.uuid() });

type AuthQuery = Pick<pg.Pool, 'query'>;

/** This marker lives in the auth database and changes whenever Kept restores a backup. */
export async function resetNativeSyncEpoch(db: AuthQuery): Promise<void> {
  await db.query(
    `INSERT INTO auth.verification (id, identifier, value, expires_at)
     VALUES ($1, $1, $2, 'infinity')
     ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [epochKey, newId()],
  );
}

async function nativeSyncEpoch(db: AuthQuery): Promise<string> {
  let { rows } = await db.query<{ value: string }>(
    'SELECT value FROM auth.verification WHERE id = $1',
    [epochKey],
  );
  if (rows[0]) return rows[0].value;
  await db.query(
    `INSERT INTO auth.verification (id, identifier, value, expires_at)
     VALUES ($1, $1, $2, 'infinity') ON CONFLICT (id) DO NOTHING`,
    [epochKey, newId()],
  );
  ({ rows } = await db.query<{ value: string }>(
    'SELECT value FROM auth.verification WHERE id = $1',
    [epochKey],
  ));
  if (!rows[0]) throw new Error('Native sync epoch was unavailable');
  return rows[0].value;
}

export function requireNativeContext(req: FastifyRequest): z.infer<typeof NativeContext> {
  const parsed = NativeContext.safeParse({
    account: req.headers['x-kept-native-account'],
    epoch: req.headers['x-kept-native-epoch'],
  });
  if (!parsed.success) throw invalid('Both native sync context headers are required.');
  if (
    req.authSession?.userId !== parsed.data.account ||
    req.scope?.userId !== parsed.data.account
  ) {
    throw unauthenticated();
  }
  return parsed.data;
}

/** Check native context before dispatch. Stock inventory routes keep their usual auth and RLS. */
export async function nativeContextHook(req: FastifyRequest): Promise<void> {
  if (
    req.headers['x-kept-native-account'] === undefined &&
    req.headers['x-kept-native-epoch'] === undefined
  )
    return;
  const { epoch } = requireNativeContext(req);
  if ((await nativeSyncEpoch(req.server.pools.auth)) !== epoch) {
    throw new AppError(
      'conflict',
      409,
      'This Kept was restored or replaced. Review the pending captures before syncing.',
      { reason: 'restore_epoch_mismatch' },
    );
  }
}

type Source = {
  id: string;
  user_id: string;
  email: string;
  created_at: Date;
  expires_at: Date;
  method: string | null;
  satisfied_at: Date | null;
};

async function eligibleSession(
  db: AuthQuery,
  id: string,
  lock = false,
): Promise<Source | undefined> {
  const { rows } = await db.query<Source>(
    `SELECT s.id, s.user_id, u.email, s.created_at, s.expires_at, m.method, m.satisfied_at
       FROM auth.session s JOIN auth."user" u ON u.id = s.user_id
       LEFT JOIN auth.session_mfa m ON m.session_id = s.id
      WHERE s.id = $1 AND s.expires_at > now() AND s.impersonated_by IS NULL
        AND (u.banned IS NOT TRUE OR u.ban_expires <= now())
        AND (u.two_factor_enabled IS NOT TRUE OR m.session_id IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM auth.user_deletion WHERE user_id = u.id)
      ${lock ? 'FOR UPDATE OF s, u' : ''}`,
    [id],
  );
  return rows[0];
}

async function redeem(
  pool: pg.Pool,
  input: z.infer<typeof Exchange>,
  epoch: string,
  expiresIn: number,
): Promise<{ account: string; id: string; sessionToken: string }> {
  const client = await pool.connect();
  const identifier = `${grantPrefix}${epoch}:${digest(input.code)}:${digest(input.verifier)}`;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ value: string }>(
      'DELETE FROM auth.verification WHERE id = $1 AND expires_at > now() RETURNING value',
      [identifier],
    );
    const grant = rows[0];
    if (!grant) throw unauthenticated();
    const { session, subject, setup } = JSON.parse(grant.value) as {
      session: string;
      subject: string;
      setup: boolean;
    };
    const source = await eligibleSession(client, session, true);
    if (!source || source.user_id !== (await appleOwner(client, subject))) throw unauthenticated();
    const id = newId();
    const sessionToken = randomToken();
    // Preserve sign-in age. Exchanging a grant must not make an old login eligible for
    // sensitive routes that require a recent authentication.
    const expiresAt = setup
      ? new Date(source.created_at.getTime() + expiresIn * 1000)
      : source.expires_at;
    await client.query(
      `INSERT INTO auth.session (id, user_id, token, created_at, updated_at, expires_at, user_agent)
       VALUES ($1, $2, $3, $4, now(), $5, 'Kept for iPhone')`,
      [id, source.user_id, sessionToken, source.created_at, expiresAt],
    );
    if (source.method) {
      await client.query(
        'INSERT INTO auth.session_mfa (session_id, method, satisfied_at) VALUES ($1, $2, $3)',
        [id, source.method, source.satisfied_at],
      );
    }
    if (setup) {
      await client.query('DELETE FROM auth.session WHERE id = $1', [source.id]);
    }
    await client.query('COMMIT');
    return { account: source.user_id, id, sessionToken };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function htmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

type AppleTicket = AppleIdentity & { challenge: string; state: string; setupSession?: string };

async function appleOwner(db: AuthQuery, subject: string): Promise<string | undefined> {
  const { rows } = await db.query<{ user_id: string }>(
    `SELECT user_id FROM auth.account WHERE provider_id = $1 AND account_id = $2`,
    [APPLE_PROVIDER, subject],
  );
  return rows.length === 1 ? rows[0]?.user_id : undefined;
}

function ticketId(epoch: string, appleToken: string): string {
  return `${applePrefix}ticket:${epoch}:${digest(appleToken)}`;
}

async function readTicket(db: AuthQuery, id: string, lock = false): Promise<AppleTicket> {
  const { rows } = await db.query<{ value: string }>(
    `SELECT value FROM auth.verification WHERE id = $1 AND expires_at > now()
     ${lock ? 'FOR UPDATE' : ''}`,
    [id],
  );
  if (!rows[0]) throw unauthenticated();
  return JSON.parse(rows[0].value) as AppleTicket;
}

async function sessionCookie(auth: Auth, sessionToken: string, maxAge?: number): Promise<string> {
  const { secret, authCookies } = await auth.$context;
  const value = encodeURIComponent(`${sessionToken}.${await makeSignature(sessionToken, secret)}`);
  const secure = authCookies.sessionToken.attributes.secure ? '; Secure' : '';
  return `${authCookies.sessionToken.name}=${value}; Path=/; HttpOnly; SameSite=Lax${secure}${maxAge ? `; Max-Age=${maxAge}` : ''}`;
}

function connectPage(content: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect Kept for iPhone</title></head><body><main><h1>Connect Kept for iPhone</h1>
${content}</main></body></html>`;
}

export async function nativeAuthRoutes(
  app: KeptApp,
  auth: Auth,
  publicUrl: string,
  appleKeys?: JWTVerifyGetKey,
): Promise<void> {
  const { pools } = app;
  const url = new URL(publicUrl);
  // Loopback lets a simulator work against the documented local development server.
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    return;

  function authorizeNativeRequest(req: FastifyRequest, reply: FastifyReply) {
    reply.header('cache-control', 'no-store');
    if (req.headers.origin !== url.origin || req.headers.cookie || req.ingress) throw forbidden();
    return reserveTokenAttempt(
      pools.auth,
      authHeaders(req, app.env.KEPT_TRUSTED_PROXIES ?? []),
      reply,
      'native-token-ip',
    );
  }

  app.post(
    '/api/v1/native/apple',
    {
      config: { auth: 'none' },
      schema: { hide: true, body: AppleStart, response: { 200: Handshake } },
      bodyLimit: 9_216,
    },
    async (req, reply) => {
      await authorizeNativeRequest(req, reply);
      const { verifier, state, identityToken } = req.body;
      const challenge = digest(verifier);
      const nonce = appleNonce(url.origin, challenge);
      const identity = await verifyNativeApple(identityToken, nonce, appleKeys);
      const epoch = await nativeSyncEpoch(pools.auth);
      const appleToken = randomToken();
      const id = ticketId(epoch, appleToken);
      const claim = `${applePrefix}nonce:${nonce}`;
      await pools.auth.query(
        'DELETE FROM auth.verification WHERE identifier LIKE $1 AND expires_at <= now()',
        [`${applePrefix}%`],
      );
      const { rowCount } = await pools.auth.query(
        `WITH claimed AS (
           INSERT INTO auth.verification (id, identifier, value, expires_at)
           VALUES ($1, $1, '', now() + interval '10 minutes')
           ON CONFLICT (id) DO NOTHING RETURNING id
         )
         INSERT INTO auth.verification (id, identifier, value, expires_at)
         SELECT $2, $2, $3, now() + interval '10 minutes' FROM claimed`,
        [claim, id, JSON.stringify({ ...identity, challenge, state } satisfies AppleTicket)],
      );
      if (rowCount !== 1) throw unauthenticated();
      return { appleToken };
    },
  );

  await app.register(async (scope) => {
    const browser = scope.withTypeProvider<ZodTypeProvider>();
    browser.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string', bodyLimit: 256 },
      (_req, body, done) => done(null, Object.fromEntries(new URLSearchParams(String(body)))),
    );
    browser.get(
      connectPath,
      { config: { auth: 'optional' }, schema: { hide: true, querystring: Handshake } },
      async (req, reply) => {
        if (req.ingress) throw forbidden();
        reply.header('cache-control', 'no-store').header('referrer-policy', 'same-origin');
        const { appleToken } = req.query;
        const id = ticketId(await nativeSyncEpoch(pools.auth), appleToken);
        const ticket = await readTicket(pools.auth, id);
        const owner = await appleOwner(pools.auth, ticket.subject);
        const next = `${connectPath}?${new URLSearchParams(req.query)}`;
        const signin = req.authSession?.mfaPending ? '/signin/two-factor' : '/signin';
        const login = `${signin}?${new URLSearchParams({ next })}`;
        const sameAccount = !owner || owner === req.authSession?.userId;
        if (req.authSession?.mfaPending && sameAccount) return reply.redirect(login, 303);
        const source =
          sameAccount && req.scope && req.authSession
            ? await eligibleSession(pools.auth, req.authSession.sessionId)
            : undefined;
        const form = (
          label: string,
          confirmsLink = false,
        ) => `<form method="post" action="${connectPath}">
<input type="hidden" name="appleToken" value="${appleToken}">
${confirmsLink ? '<input type="hidden" name="confirmLink" value="yes">' : ''}
<button type="submit">${htmlText(label)}</button></form>`;

        let content: string;
        if (owner) {
          content = source
            ? `<p>Allow the iPhone app to use your Kept account.</p>${form(`Continue as ${source.email}`)}`
            : `<p>Continue with the Apple Account you just verified.</p>${form('Continue with Apple')}`;
        } else if (!ticket.email) {
          content =
            '<p>Apple did not provide a verified email address. Restart Sign in with Apple and share an email address to link your account.</p>';
        } else if (source) {
          content = `<p>Link Apple Account ${htmlText(ticket.email)} to Kept account ${htmlText(source.email)}. Only continue if both accounts are yours.</p>${form('Link Apple Account and connect', true)}`;
        } else {
          content = `<p>This Apple Account has not been linked to Kept. Sign in to your existing Kept account once to approve the link. You’ll use Apple for future iPhone sign-ins.</p>
<a href="${login}">Sign in to link your Kept account</a>`;
        }
        return reply.type('text/html; charset=utf-8').send(connectPage(content));
      },
    );

    browser.post(
      connectPath,
      { config: { auth: 'optional' }, schema: { hide: true, body: Approval } },
      async (req, reply) => {
        if (req.ingress) throw forbidden();
        assertFromThisSite(req, url.origin);
        reply.header('cache-control', 'no-store');
        const epoch = await nativeSyncEpoch(pools.auth);
        const { appleToken, confirmLink } = req.body;
        const id = ticketId(epoch, appleToken);
        const client = await pools.auth.connect();
        let linked: { userId: string; linkId: string } | undefined;
        try {
          await client.query('BEGIN');
          const ticket = await readTicket(client, id, true);
          // Serialize first links for the same Apple identity, even across distinct Kept users.
          await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
            `${applePrefix}link:${ticket.subject}`,
          ]);
          const owner = await appleOwner(client, ticket.subject);
          const source =
            req.authSession && (!owner || owner === req.authSession.userId)
              ? await eligibleSession(client, req.authSession.sessionId, true)
              : undefined;
          if (owner && !source) {
            // An Apple proof can start exactly one short-lived browser session for Kept MFA.
            if (ticket.setupSession) throw unauthenticated();
            const setupId = newId();
            const sessionToken = randomToken();
            const result = await client.query(
              `INSERT INTO auth.session (id, token, user_id, user_agent, expires_at, updated_at, created_at)
               SELECT $1, $2, u.id, $3, now() + interval '10 minutes', now(), now()
                 FROM auth."user" u
                WHERE u.id = $4 AND (u.banned IS NOT TRUE OR u.ban_expires <= now())
                  AND NOT EXISTS (SELECT 1 FROM auth.user_deletion WHERE user_id = u.id)`,
              [setupId, sessionToken, setupAgent, owner],
            );
            if (result.rowCount !== 1) throw forbidden();
            await client.query('UPDATE auth.verification SET value = $2 WHERE id = $1', [
              id,
              JSON.stringify({ ...ticket, setupSession: setupId }),
            ]);
            const cookie = await sessionCookie(auth, sessionToken, 600);
            await client.query('COMMIT');
            return reply
              .header('set-cookie', cookie)
              .redirect(`${connectPath}?${new URLSearchParams({ appleToken })}`, 303);
          }
          if (!source) throw unauthenticated();
          if (!owner) {
            if (!confirmLink || !ticket.email || isUndeliverableEmail(source.email))
              throw forbidden();
            if (Date.now() - source.created_at.getTime() >= FRESH_SESSION_SECONDS * 1000) {
              throw new AppError(
                'forbidden',
                403,
                'Sign in to Kept again before linking your Apple Account.',
              );
            }
            const alreadyLinked = await client.query(
              'SELECT 1 FROM auth.account WHERE user_id = $1 AND provider_id = $2',
              [source.user_id, APPLE_PROVIDER],
            );
            if (alreadyLinked.rowCount) {
              throw new AppError(
                'conflict',
                409,
                'This Kept account already has an Apple Account linked.',
              );
            }
            const linkId = newId();
            await client.query(
              `INSERT INTO auth.account (id, user_id, provider_id, account_id, updated_at)
               VALUES ($1, $2, $3, $4, now())`,
              [linkId, source.user_id, APPLE_PROVIDER, ticket.subject],
            );
            linked = { userId: source.user_id, linkId };
          }
          const code = randomToken();
          const identifier = `${grantPrefix}${epoch}:${digest(code)}:${ticket.challenge}`;
          await client.query('DELETE FROM auth.verification WHERE id = $1', [id]);
          await client.query(
            `INSERT INTO auth.verification (id, identifier, value, expires_at)
             VALUES ($1, $1, $2, now() + interval '2 minutes')`,
            [
              identifier,
              JSON.stringify({
                session: source.id,
                subject: ticket.subject,
                setup: source.id === ticket.setupSession,
              }),
            ],
          );
          await client.query('COMMIT');
          if (linked) {
            await auditAccountEvent(pools.app, linked.userId, {
              action: 'sign_in.apple_linked',
              entity: { type: 'account', id: linked.linkId },
              requestId: req.id,
            });
          }
          return reply
            .header('referrer-policy', 'no-referrer')
            .redirect(
              `kept-nfc://auth/callback?${new URLSearchParams({ code, state: ticket.state })}`,
              303,
            );
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          throw error;
        } finally {
          client.release();
        }
      },
    );
  });

  app.get(
    '/api/v1/native/capture-capabilities',
    { schema: { hide: true, response: { 200: NativeCaptureCapabilitiesSchema } } },
    async (req, reply) => {
      const context = requireNativeContext(req);
      reply.header('cache-control', 'no-store');
      return {
        contractVersion: 1 as const,
        capturePayloadVersions: [NATIVE_CAPTURE_PAYLOAD_VERSION, NATIVE_INVENTORY_PAYLOAD_VERSION],
        ...context,
      };
    },
  );

  app.post(
    '/api/v1/native/exchange',
    {
      config: { auth: 'none' },
      schema: { hide: true, body: Exchange, response: { 200: NativeContext } },
      bodyLimit: 256,
    },
    async (req, reply) => {
      await authorizeNativeRequest(req, reply);
      const epoch = await nativeSyncEpoch(pools.auth);
      const lifetime = sessionPolicy(publicUrl, app.env.KEPT_HTTP_SIGN_IN_DAYS);
      const { account, id, sessionToken } = await redeem(
        pools.auth,
        req.body,
        epoch,
        lifetime.expiresIn,
      );
      await auditAccountEvent(pools.app, account, {
        action: 'session.native_connected',
        entity: { type: 'session', id },
        requestId: req.id,
      });
      reply.header('set-cookie', await sessionCookie(auth, sessionToken));
      return { account, epoch };
    },
  );
}
