import { isAPIError } from 'better-auth/api';
import { generateRandomString, symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import { auditAccountEvent } from '../accounts/account-audit.js';
import type { Pools } from '../db/pools.js';
import { withSystem } from '../db/scope.js';
import type { KeptApp } from '../http/app.js';
import { AppError, conflict, forbidden, invalid, notFound, pgErrorOf } from '../http/errors.js';
import type { Auth } from './auth.js';
import { isUndeliverableEmail } from './emails.js';
import { authHeaders, forwardCookies, rateLimited, requireScope } from './http.js';
import { requireReauthentication } from './reauth.js';
import {
  lockAccount,
  PASSKEY_ADD_PREFIX,
  PASSKEY_ADD_SECONDS,
  PASSKEY_NAME_MAX,
  TWO_FACTOR_SETUP_PREFIX,
  waysInLeft,
} from './security.js';
import {
  clearSignInFailures,
  limiterKey,
  reserveInWindow,
  reserveSignInAttempt,
} from './sign-in-limiter.js';
import { claimTotpStep, totpStep, totpUri } from './totp.js';

// Settings → Sign-in and security: the person's passkeys and authenticator app.
//
//   GET    /api/v1/me/sign-in                        → what signs this account in (never a
//                                                       secret, a public key or a backup code)
//   POST   /api/v1/me/passkeys/confirm               {password?} → 204: lets this session add one
//                                                       passkey in the next five minutes
//   PATCH  /api/v1/me/passkeys/:id                   {name, password?} → the passkey
//   DELETE /api/v1/me/passkeys/:id                   {password?} → 204
//   DELETE /api/v1/me/linked/:id                     {password?} → 204: unlinks an outside
//                                                       sign-in (Better Auth's /unlink-account is
//                                                       off over HTTP)
//   POST   /api/v1/me/two-factor/enable              {password?} → {totpURI, backupCodes}
//   POST   /api/v1/me/two-factor/disable             {password?} → 204
//   POST   /api/v1/me/two-factor/backup-codes        {password?} → {backupCodes}
//   POST   /api/v1/me/two-factor/set-up-again        {password?} → {totpURI}
//   POST   /api/v1/me/two-factor/set-up-again/verify {code} → {backupCodes}
//
// Every change first confirms it's you (auth/reauth.ts): the password on an account with one,
// otherwise a sign-in in the last ten minutes. Adding a passkey goes through Better Auth's own
// ceremony, which needs a sign-in in the last ten minutes on every account and, on an account
// with a password, a confirmation from POST …/passkeys/confirm too (security.ts). Better Auth's
// own management routes are off over HTTP (auth.ts SIGN_IN_MANAGEMENT_PATHS); the two-factor
// ones are called through `auth.api`, so its hooks still sign out the other sessions and mail the
// owner (auth/security.ts). Removing a passkey and unlinking are Kept's own SQL, in one
// transaction under the account's row lock (inAccountLock), doing the same.
//
// Two refusals are the server's, whatever the screen shows:
// - the last way in: a passkey can't go when nothing else signs the account in (409
//   `last_sign_in_method`): a password, another passkey, a linked outside sign-in this server
//   offers, or an email link (mail delivered, the address verified, not a managed account),
//   counted in one transaction holding the account's row lock, which removing a passkey and
//   unlinking an outside sign-in both take, with a short lock_timeout (409 `conflict` when
//   another change holds it); unlinking the last way in is refused the same way;
// - two-factor a location asks for: it can't be turned off while one of the person's locations
//   requires it and no passkey can stand in for it (409 `two_factor_required`), and the last
//   passkey can't go while such a location's two-factor rests on it. Every passkey Kept adds
//   verified its user (auth.ts), so any passkey can.
//
// "Set up again" never goes through Better Auth's /two-factor/enable, which refuses an account
// that has two-factor on, and would replace the secret at once if it didn't. The new secret is
// staged (encrypted, for this session, 15 minutes) and the old one keeps signing in until a code
// from the new app is proven; only then are the secret and the backup codes swapped.

/** How long a staged "Set up again" waits for its first code. */
export const SET_UP_AGAIN_SECONDS = 15 * 60;
/** How long a passkey removal or an unlink waits for the account's row lock (`lock_timeout`). */
export const LOCK_WAIT_MS = 2000;
/** Postgres's lock_not_available: the lock wasn't free within `lock_timeout`. */
const LOCK_NOT_AVAILABLE = '55P03';
/** Starts of "Set up again" per person per hour. */
export const SET_UP_AGAIN_PER_HOUR = 10;

const ISSUER = 'Kept';
const BACKUP_CODES = 10;

const Password = z.string().max(128).optional();
const ReauthBody = z.object({ password: Password });
const Params = z.object({ id: z.uuid() });
const PasskeyName = z.string().trim().min(1).max(PASSKEY_NAME_MAX);

const PasskeyView = z.object({
  id: z.string(),
  name: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }).nullable(),
  /** Synced by a password manager or the platform (iCloud Keychain, Google Password Manager). */
  backedUp: z.boolean(),
  /** `singleDevice` or `multiDevice`, as the authenticator said at registration. */
  deviceType: z.string(),
});

const SignInView = z.object({
  password: z.boolean(),
  passkeys: z.array(PasskeyView),
  twoFactor: z.object({ enabled: z.boolean(), backupCodesLeft: z.number().int().nullable() }),
  /** Outside sign-ins linked to the account (Google, the instance's OIDC provider). */
  linked: z.array(z.object({ providerId: z.string() })),
  /** A link mailed to the address signs in: mail is delivered and the address is verified. */
  emailLink: z.boolean(),
});

const TotpStart = z.object({ totpURI: z.string() });
const TotpEnabled = z.object({ totpURI: z.string(), backupCodes: z.array(z.string()) });
const BackupCodes = z.object({ backupCodes: z.array(z.string()) });

type PasskeyRow = {
  id: string;
  name: string | null;
  created_at: Date | null;
  backed_up: boolean;
  device_type: string;
};

const passkeyView = (r: PasskeyRow) => ({
  id: r.id,
  name: r.name,
  createdAt: r.created_at ? r.created_at.toISOString() : null,
  backedUp: r.backed_up,
  deviceType: r.device_type,
});

/** Ten backup codes in Better Auth's shape (`abcde-12345`). */
function newBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODES }, () => {
    const code = generateRandomString(10, 'a-z', '0-9', 'A-Z');
    return `${code.slice(0, 5)}-${code.slice(5)}`;
  });
}

type Staged = { userId: string; sessionId: string; secret: string };

const stagedIdentifier = (userId: string) => `${TWO_FACTOR_SETUP_PREFIX}:${userId}`;

// -------------------------------------------------------------------------------------------------

export type SignInSecurityOptions = {
  auth: Auth;
  pools: Pick<Pools, 'app' | 'auth' | 'system'>;
  trustedProxies: readonly string[];
  /** Mail is delivered (KEPT_SMTP_URL), so an email link is a way in for a verified address. */
  mailConfigured: boolean;
};

export async function signInSecurityRoutes(
  app: KeptApp,
  opts: SignInSecurityOptions,
): Promise<void> {
  const { auth, pools, trustedProxies } = opts;

  async function confirmItsYou(req: FastifyRequest, reply: FastifyReply, password?: string) {
    return requireReauthentication(req, reply, {
      auth,
      pools,
      trustedProxies,
      password,
      hints: { stale: 'Sign in again, then try again.' },
    });
  }

  /** The account's row and its ways in. */
  async function account(userId: string) {
    const ctx = await auth.$context;
    const { rows } = await pools.auth.query<{
      email: string;
      email_verified: boolean;
      two_factor_enabled: boolean;
    }>(
      `SELECT email, coalesce(email_verified, false) AS email_verified,
              coalesce(two_factor_enabled, false) AS two_factor_enabled
         FROM auth."user" WHERE id = $1`,
      [userId],
    );
    const user = rows[0];
    if (!user) throw forbidden();
    const accounts = await ctx.internalAdapter.findAccounts(userId);
    return {
      ...user,
      password: accounts.some((a) => a.providerId === 'credential' && !!a.password),
      // Only the outside sign-ins this server offers now: a row of one taken off signs nobody in.
      linked: accounts
        .filter((a) => auth.waysIn.outsideProviders.includes(a.providerId))
        .map((a) => ({ providerId: a.providerId })),
      emailLink: opts.mailConfigured && user.email_verified && !isUndeliverableEmail(user.email),
    };
  }

  /** Better Auth's refusal (its status, `{code, message}`), as its own routes would answer. */
  function passOn(reply: FastifyReply, err: unknown): FastifyReply {
    if (!isAPIError(err)) throw err;
    const body = (err.body ?? {}) as { code?: unknown; message?: unknown };
    return reply.code(err.statusCode).send({
      code: typeof body.code === 'string' ? body.code : 'AUTH_ERROR',
      message: typeof body.message === 'string' ? body.message : err.message,
    });
  }

  const audit = (req: FastifyRequest, userId: string, action: AuditAction, id: string) =>
    auditAccountEvent(pools.app, userId, {
      action,
      entity: {
        type: action.startsWith('passkey.')
          ? 'passkey'
          : action === 'sign_in.unlink'
            ? 'account'
            : 'user',
        id,
      },
      requestId: req.id,
    });

  /** Whether one of the person's locations asks for two-factor. Read as kept_system: such a
   * location is hidden from a session without it, so the person's own scope may not see it. */
  async function twoFactorRequired(userId: string): Promise<boolean> {
    return withSystem(pools.system, async (_tx, client) => {
      const { rows } = await client.query<{ required: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM public.memberships m JOIN public.locations l ON l.id = m.location_id
            WHERE m.user_id = $1 AND l.require_2fa AND l.deleted_at IS NULL
              AND (m.expires_at IS NULL OR m.expires_at > now())) AS required`,
        [userId],
      );
      return rows[0]?.required === true;
    });
  }

  /**
   * Runs `fn` in one transaction on one kept_auth connection, holding the account's row lock
   * (security.ts lockAccount), which every passkey removal and unlink takes first. The wait for
   * it is short (LOCK_WAIT): a request that can't have it answers 409 `conflict`, and nothing
   * holds a connection waiting for long.
   */
  async function inAccountLock(
    userId: string,
    fn: (client: pg.PoolClient) => Promise<void>,
  ): Promise<void> {
    const client = await pools.auth.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL lock_timeout = '${LOCK_WAIT_MS}ms'`);
      await lockAccount(client, userId);
      await fn(client);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (pgErrorOf(err)?.code === LOCK_NOT_AVAILABLE) {
        throw conflict('Another change to how you sign in is under way. Try again in a moment.');
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async function dropStaged(userId: string) {
    const ctx = await auth.$context;
    await ctx.internalAdapter.deleteVerificationByIdentifier(stagedIdentifier(userId));
  }

  app.get('/api/v1/me/sign-in', { schema: { response: { 200: SignInView } } }, async (req) => {
    const scope = requireScope(req);
    const me = await account(scope.userId);
    const { rows } = await pools.auth.query<PasskeyRow>(
      `SELECT id, name, created_at, backed_up, device_type FROM auth.passkey
          WHERE user_id = $1 ORDER BY created_at NULLS FIRST, id`,
      [scope.userId],
    );
    let backupCodesLeft: number | null = null;
    if (me.two_factor_enabled) {
      // Decrypted here only to be counted; the codes themselves never leave.
      const viewed = await auth.api
        .viewBackupCodes({ body: { userId: scope.userId } })
        .catch(() => null);
      backupCodesLeft = viewed?.backupCodes.length ?? 0;
    }
    return {
      password: me.password,
      passkeys: rows.map(passkeyView),
      twoFactor: { enabled: me.two_factor_enabled, backupCodesLeft },
      linked: me.linked,
      emailLink: me.emailLink,
    };
  });

  app.post('/api/v1/me/passkeys/confirm', { schema: { body: ReauthBody } }, async (req, reply) => {
    const scope = requireScope(req);
    await confirmItsYou(req, reply, req.body.password);
    const sessionId = req.authSession?.sessionId;
    if (!sessionId) throw forbidden();
    // For this session, for one passkey, for five minutes (security.ts uses it up).
    const ctx = await auth.$context;
    const identifier = `${PASSKEY_ADD_PREFIX}:${sessionId}`;
    await ctx.internalAdapter.deleteVerificationByIdentifier(identifier);
    await ctx.internalAdapter.createVerificationValue({
      identifier,
      value: JSON.stringify({ userId: scope.userId }),
      expiresAt: new Date(Date.now() + PASSKEY_ADD_SECONDS * 1000),
    });
    return reply.code(204).send();
  });

  app.patch(
    '/api/v1/me/passkeys/:id',
    {
      schema: {
        params: Params,
        body: z.object({ name: PasskeyName, password: Password }),
        response: { 200: PasskeyView },
      },
    },
    async (req, reply) => {
      const scope = requireScope(req);
      await confirmItsYou(req, reply, req.body.password);
      const { rows } = await pools.auth.query<PasskeyRow & { before: string | null }>(
        `UPDATE auth.passkey p SET name = $3
           FROM (SELECT id, name FROM auth.passkey WHERE id = $1 AND user_id = $2) old
          WHERE p.id = old.id
          RETURNING p.id, p.name, p.created_at, p.backed_up, p.device_type, old.name AS before`,
        [req.params.id, scope.userId, req.body.name],
      );
      const row = rows[0];
      // Someone else's passkey is as absent as one that never existed.
      if (!row) throw notFound();
      await auditAccountEvent(pools.app, scope.userId, {
        action: 'passkey.rename',
        entity: { type: 'passkey', id: row.id },
        before: { name: row.before },
        after: { name: row.name },
        requestId: req.id,
      });
      return passkeyView(row);
    },
  );

  app.delete(
    '/api/v1/me/passkeys/:id',
    { schema: { params: Params, body: ReauthBody.optional() } },
    async (req, reply) => {
      const scope = requireScope(req);
      // Someone else's passkey, or none, answers 404 before anything waits for a lock.
      const own = await pools.auth.query(
        'SELECT 1 FROM auth.passkey WHERE id = $1 AND user_id = $2',
        [req.params.id, scope.userId],
      );
      if (!own.rowCount) throw notFound();
      await confirmItsYou(req, reply, req.body?.password);
      const me = await account(scope.userId);
      const required = await twoFactorRequired(scope.userId);
      const session = req.authSession?.sessionId ?? null;
      await inAccountLock(scope.userId, async (client) => {
        const { rows } = await client.query<{ id: string; tfa: boolean }>(
          `SELECT p.id, coalesce(u.two_factor_enabled, false) AS tfa
             FROM auth.passkey p JOIN auth."user" u ON u.id = p.user_id
            WHERE p.user_id = $1`,
          [scope.userId],
        );
        if (!rows.some((r) => r.id === req.params.id)) throw notFound();
        const left = await waysInLeft(client, scope.userId, auth.waysIn, {
          passkeyId: req.params.id,
        });
        if (left === 0) throw lastWayIn();
        // The last passkey stands in for two-factor where a location asks for it and the
        // authenticator app is off: as with turning the app off, it stays.
        if (required && rows.length === 1 && !rows[0]?.tfa) {
          throw new AppError(
            'two_factor_required',
            409,
            'A location you belong to asks for two-factor. Turn on the authenticator app first.',
          );
        }
        await client.query('DELETE FROM auth.passkey WHERE id = $1 AND user_id = $2', [
          req.params.id,
          scope.userId,
        ]);
        await signOutOthers(client, scope.userId, session);
      });
      auth.securityNotice({ email: me.email }, 'passkey-removed');
      await audit(req, scope.userId, 'passkey.remove', req.params.id);
      return reply.code(204).send();
    },
  );

  app.delete(
    '/api/v1/me/linked/:id',
    { schema: { params: Params, body: ReauthBody.optional() } },
    async (req, reply) => {
      const scope = requireScope(req);
      // Another person's outside sign-in, an unknown id or the password's own row: 404 before
      // anything waits for a lock.
      const own = await pools.auth.query(
        `SELECT 1 FROM auth.account
          WHERE id = $1 AND user_id = $2 AND provider_id <> 'credential'`,
        [req.params.id, scope.userId],
      );
      if (!own.rowCount) throw notFound();
      await confirmItsYou(req, reply, req.body?.password);
      const me = await account(scope.userId);
      const session = req.authSession?.sessionId ?? null;
      await inAccountLock(scope.userId, async (client) => {
        const left = await waysInLeft(client, scope.userId, auth.waysIn, {
          accountId: req.params.id,
        });
        if (left === 0) throw lastWayIn();
        const gone = await client.query(
          `DELETE FROM auth.account
            WHERE id = $1 AND user_id = $2 AND provider_id <> 'credential'`,
          [req.params.id, scope.userId],
        );
        if (!gone.rowCount) throw notFound();
        await signOutOthers(client, scope.userId, session);
      });
      auth.securityNotice({ email: me.email }, 'sign-in-unlinked');
      await audit(req, scope.userId, 'sign_in.unlink', req.params.id);
      return reply.code(204).send();
    },
  );

  app.post(
    '/api/v1/me/two-factor/enable',
    { schema: { body: ReauthBody, response: { 200: TotpEnabled } } },
    async (req, reply) => {
      const scope = requireScope(req);
      await confirmItsYou(req, reply, req.body.password);
      const headers = authHeaders(req, trustedProxies);
      try {
        const result = await auth.api.enableTwoFactor({
          body: req.body.password === undefined ? {} : { password: req.body.password },
          headers,
          returnHeaders: true,
        });
        forwardCookies(reply, result.headers);
        const enabled = result.response as { totpURI?: string; backupCodes?: string[] };
        await dropStaged(scope.userId);
        // Started; it is on (and audited `two_factor.enable`) once a first code is proven
        // (auth/http.ts).
        await audit(req, scope.userId, 'two_factor.setup', scope.userId);
        return { totpURI: enabled.totpURI ?? '', backupCodes: enabled.backupCodes ?? [] };
      } catch (err) {
        return passOn(reply, err);
      }
    },
  );

  app.post(
    '/api/v1/me/two-factor/disable',
    { schema: { body: ReauthBody } },
    async (req, reply) => {
      const scope = requireScope(req);
      await confirmItsYou(req, reply, req.body.password);
      const required = await twoFactorRequired(scope.userId);
      const keys = await pools.auth.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM auth.passkey WHERE user_id = $1',
        [scope.userId],
      );
      if (required && (keys.rows[0]?.n ?? 0) === 0) {
        throw new AppError(
          'two_factor_required',
          409,
          'A location you belong to asks for two-factor. Add a passkey first, or leave it.',
        );
      }
      try {
        const result = await auth.api.disableTwoFactor({
          body: req.body.password === undefined ? {} : { password: req.body.password },
          headers: authHeaders(req, trustedProxies),
          returnHeaders: true,
        });
        // Better Auth swaps in a new session for this device.
        forwardCookies(reply, result.headers);
      } catch (err) {
        return passOn(reply, err);
      }
      await dropStaged(scope.userId);
      await audit(req, scope.userId, 'two_factor.disable', scope.userId);
      return reply.code(204).send();
    },
  );

  app.post(
    '/api/v1/me/two-factor/backup-codes',
    { schema: { body: ReauthBody, response: { 200: BackupCodes } } },
    async (req, reply) => {
      const scope = requireScope(req);
      await confirmItsYou(req, reply, req.body.password);
      try {
        const made = await auth.api.generateBackupCodes({
          body: req.body.password === undefined ? {} : { password: req.body.password },
          headers: authHeaders(req, trustedProxies),
        });
        await audit(req, scope.userId, 'two_factor.backup_codes', scope.userId);
        return { backupCodes: made.backupCodes };
      } catch (err) {
        return passOn(reply, err);
      }
    },
  );

  app.post(
    '/api/v1/me/two-factor/set-up-again',
    { schema: { body: ReauthBody, response: { 200: TotpStart } } },
    async (req, reply) => {
      const scope = requireScope(req);
      await confirmItsYou(req, reply, req.body.password);
      const me = await account(scope.userId);
      if (!me.two_factor_enabled) throw conflict('Two-factor is off. Turn it on instead.');
      // Per person: it calls Better Auth through auth.api, past its per-address limit.
      const limit = await reserveInWindow(
        pools.auth,
        limiterKey('two-factor-setup', scope.userId),
        SET_UP_AGAIN_PER_HOUR,
        3600,
      );
      if (!limit.allowed) throw rateLimited(reply, limit.retryAfter);
      const sessionId = req.authSession?.sessionId;
      if (!sessionId) throw forbidden();
      const ctx = await auth.$context;
      const secret = generateRandomString(32);
      const staged: Staged = {
        userId: scope.userId,
        sessionId,
        secret: await symmetricEncrypt({ key: ctx.secretConfig, data: secret }),
      };
      // One at a time: starting again replaces what was staged.
      await dropStaged(scope.userId);
      await ctx.internalAdapter.createVerificationValue({
        identifier: stagedIdentifier(scope.userId),
        value: JSON.stringify(staged),
        expiresAt: new Date(Date.now() + SET_UP_AGAIN_SECONDS * 1000),
      });
      return { totpURI: totpUri(secret, me.email, ISSUER) };
    },
  );

  app.post(
    '/api/v1/me/two-factor/set-up-again/verify',
    {
      schema: {
        body: z.object({ code: z.string().min(1).max(16) }),
        response: { 200: BackupCodes },
      },
    },
    async (req, reply) => {
      const scope = requireScope(req);
      const sessionId = req.authSession?.sessionId;
      if (!sessionId) throw forbidden();
      // The same counter as a code tried inside a session (security.ts).
      const key = limiterKey('second-factor', scope.userId);
      const decision = await reserveSignInAttempt(pools.auth, key);
      if (!decision.allowed) throw rateLimited(reply, decision.retryAfter);

      const ctx = await auth.$context;
      const identifier = stagedIdentifier(scope.userId);
      const notStarted = () =>
        invalid('Nothing is being set up on this device. Start again with “Set up again”.');
      // Taken atomically, so two tries can't both swap; a wrong code puts it back.
      const row = await ctx.internalAdapter.consumeVerificationValue(identifier);
      if (!row) throw notStarted();
      const staged = JSON.parse(row.value) as Staged;
      if (staged.userId !== scope.userId || staged.sessionId !== sessionId) {
        if (staged.userId === scope.userId) {
          await ctx.internalAdapter.createVerificationValue({
            identifier,
            value: row.value,
            expiresAt: row.expiresAt,
          });
        }
        throw notStarted();
      }
      const secret = await symmetricDecrypt({ key: ctx.secretConfig, data: staged.secret });
      const putBack = () =>
        ctx.internalAdapter.createVerificationValue({
          identifier,
          value: row.value,
          expiresAt: row.expiresAt,
        });
      const step = totpStep(secret, req.body.code);
      if (step === null) {
        await putBack();
        throw invalid("That code didn't match. Check the time on your phone, then try again.");
      }
      // A code is accepted once per account, whichever app it came from (auth/totp.ts).
      if (!(await claimTotpStep(pools.auth, scope.userId, step))) {
        await putBack();
        throw invalid('That code was used already. Wait for the next one, then enter it.');
      }
      await clearSignInFailures(pools.auth, key);

      const backupCodes = newBackupCodes();
      const encryptedCodes = await symmetricEncrypt({
        key: ctx.secretConfig,
        data: JSON.stringify(backupCodes),
      });
      const me = await account(scope.userId);
      const client = await pools.auth.connect();
      try {
        await client.query('BEGIN');
        const swapped = await client.query(
          `UPDATE auth.two_factor
              SET secret = $2, backup_codes = $3, verified = true,
                  failed_verification_count = 0, locked_until = NULL
            WHERE user_id = $1
              AND EXISTS (SELECT 1 FROM auth."user" u
                           WHERE u.id = $1 AND coalesce(u.two_factor_enabled, false))`,
          [scope.userId, staged.secret, encryptedCodes],
        );
        if (!swapped.rowCount) throw conflict('Two-factor is off. Turn it on instead.');
        // A credential change: every other session is signed out.
        await client.query('DELETE FROM auth.session WHERE user_id = $1 AND id <> $2', [
          scope.userId,
          sessionId,
        ]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
      auth.securityNotice({ email: me.email }, 'two-factor-replaced');
      await audit(req, scope.userId, 'two_factor.replace', scope.userId);
      return { backupCodes };
    },
  );
}

const lastWayIn = () =>
  new AppError('last_sign_in_method', 409, 'Add another passkey or link another sign-in first.');

/** A credential change signs out every other session of the person (the one making it stays). */
async function signOutOthers(client: pg.ClientBase, userId: string, keep: string | null) {
  await client.query(
    'DELETE FROM auth.session WHERE user_id = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)',
    [userId, keep],
  );
}

type AuditAction =
  | 'passkey.remove'
  | 'sign_in.unlink'
  | 'two_factor.setup'
  | 'two_factor.disable'
  | 'two_factor.backup_codes'
  | 'two_factor.replace';
