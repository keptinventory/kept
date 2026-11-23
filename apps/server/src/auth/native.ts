import { createHash, randomBytes } from 'node:crypto';
import { newId } from '@kept/shared';
import { makeSignature } from 'better-auth/crypto';
import type { FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type pg from 'pg';
import { z } from 'zod';
import { auditAccountEvent } from '../accounts/account-audit.js';
import type { KeptApp } from '../http/app.js';
import { conflict, forbidden, invalid, unauthenticated } from '../http/errors.js';
import type { Auth } from './auth.js';
import { assertFromThisSite, authHeaders, reserveTokenAttempt } from './http.js';

const connectPath = '/native/connect';
const epochKey = 'kept-native-sync-epoch';
const grantPrefix = 'kept-native-grant:';
const randomToken = () => randomBytes(32).toString('base64url');
const digest = (value: string) => createHash('sha256').update(value).digest('base64url');
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const Handshake = z.strictObject({ challenge: token, state: token });
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

/** Stock inventory routes keep their normal auth and RLS. Native work asserts its own context
 * on each request so a restored database or a changed session cannot accept a queued write. */
export async function nativeContextHook(req: FastifyRequest): Promise<void> {
  const account = req.headers['x-kept-native-account'];
  const epoch = req.headers['x-kept-native-epoch'];
  if (account === undefined && epoch === undefined) return;
  const parsed = NativeContext.safeParse({ account, epoch });
  if (!parsed.success) throw invalid('Both native sync context headers are required.');
  if (
    req.authSession?.userId !== parsed.data.account ||
    req.scope?.userId !== parsed.data.account
  ) {
    throw unauthenticated();
  }
  if ((await nativeSyncEpoch(req.server.pools.auth)) !== parsed.data.epoch) {
    throw conflict(
      'This Kept was restored or replaced. Review the pending captures before syncing.',
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
): Promise<{ account: string; id: string; sessionToken: string }> {
  const client = await pool.connect();
  const identifier = `${grantPrefix}${digest(input.code)}:${digest(input.verifier)}`;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ value: string }>(
      'DELETE FROM auth.verification WHERE id = $1 AND expires_at > now() RETURNING value',
      [identifier],
    );
    const grant = rows[0];
    if (!grant) throw unauthenticated();
    const source = await eligibleSession(client, grant.value, true);
    if (!source) throw unauthenticated();
    const id = newId();
    const sessionToken = randomToken();
    // Preserve sign-in age. Exchanging a grant must not make an old login eligible for
    // sensitive routes that require a recent authentication.
    await client.query(
      `INSERT INTO auth.session (id, user_id, token, created_at, updated_at, expires_at, user_agent)
       VALUES ($1, $2, $3, $4, now(), $5, 'Kept for iPhone')`,
      [id, source.user_id, sessionToken, source.created_at, source.expires_at],
    );
    if (source.method) {
      await client.query(
        'INSERT INTO auth.session_mfa (session_id, method, satisfied_at) VALUES ($1, $2, $3)',
        [id, source.method, source.satisfied_at],
      );
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

export async function nativeAuthRoutes(app: KeptApp, auth: Auth, publicUrl: string): Promise<void> {
  const { pools } = app;
  const url = new URL(publicUrl);
  // Loopback lets a simulator work against the documented local development server.
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    return;

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
        reply.header('cache-control', 'no-store').header('referrer-policy', 'same-origin');
        if (!req.scope || !req.authSession) {
          const next = `${connectPath}?${new URLSearchParams(req.query)}`;
          const signin = req.authSession?.mfaPending ? '/signin/two-factor' : '/signin';
          return reply.redirect(`${signin}?${new URLSearchParams({ next })}`, 303);
        }
        const source = await eligibleSession(pools.auth, req.authSession.sessionId);
        if (!source) throw forbidden();
        const { challenge, state } = req.query;
        return reply.type('text/html; charset=utf-8').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect Kept for iPhone</title></head><body><main><h1>Connect Kept for iPhone</h1>
<p>Allow the app on this iPhone to use your Kept account.</p>
<form method="post" action="${connectPath}">
<input type="hidden" name="challenge" value="${challenge}"><input type="hidden" name="state" value="${state}">
<button type="submit">Continue as ${htmlText(source.email)}</button></form>
</main></body></html>`);
      },
    );
    browser.post(connectPath, { schema: { hide: true, body: Handshake } }, async (req, reply) => {
      if (req.ingress) throw forbidden();
      assertFromThisSite(req, url.origin);
      if (!req.authSession) throw unauthenticated();
      const source = await eligibleSession(pools.auth, req.authSession.sessionId);
      if (!source) throw forbidden();
      const { challenge, state } = req.body;
      const code = randomToken();
      const identifier = `${grantPrefix}${digest(code)}:${challenge}`;
      await pools.auth.query(
        'DELETE FROM auth.verification WHERE identifier LIKE $1 AND expires_at <= now()',
        [`${grantPrefix}%`],
      );
      await pools.auth.query(
        `INSERT INTO auth.verification (id, identifier, value, expires_at)
           VALUES ($1, $1, $2, now() + interval '2 minutes')`,
        [identifier, source.id],
      );
      return reply
        .header('cache-control', 'no-store')
        .header('referrer-policy', 'no-referrer')
        .redirect(`kept-nfc://auth/callback?${new URLSearchParams({ code, state })}`, 303);
    });
  });

  app.post(
    '/api/v1/native/exchange',
    {
      config: { auth: 'none' },
      schema: { hide: true, body: Exchange, response: { 200: NativeContext } },
      bodyLimit: 256,
    },
    async (req, reply) => {
      reply.header('cache-control', 'no-store');
      if (req.headers.origin !== url.origin || req.headers.cookie || req.ingress) throw forbidden();
      await reserveTokenAttempt(
        pools.auth,
        authHeaders(req, app.env.KEPT_TRUSTED_PROXIES ?? []),
        reply,
        'native-token-ip',
      );
      const epoch = await nativeSyncEpoch(pools.auth);
      const { account, id, sessionToken } = await redeem(pools.auth, req.body);
      const { secret, authCookies } = await auth.$context;
      const value = encodeURIComponent(
        `${sessionToken}.${await makeSignature(sessionToken, secret)}`,
      );
      await auditAccountEvent(pools.app, account, {
        action: 'session.native_connected',
        entity: { type: 'session', id },
        requestId: req.id,
      });
      const secure = url.protocol === 'https:' ? '; Secure' : '';
      reply.header(
        'set-cookie',
        `${authCookies.sessionToken.name}=${value}; Path=/; HttpOnly; SameSite=Lax${secure}`,
      );
      return { account, epoch };
    },
  );
}
