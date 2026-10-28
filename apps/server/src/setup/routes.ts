import { isAPIError } from 'better-auth/api';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import { ensureAccount } from '../accounts/ensure-account.js';
import { NewAccount } from '../accounts/sign-up.js';
import { audited } from '../audit/audited.js';
import type { Auth } from '../auth/auth.js';
import { requestClientIp } from '../auth/client-ip.js';
import { isUndeliverableEmail } from '../auth/emails.js';
import { googleStatus } from '../auth/google.js';
import {
  ANONYMOUS_BODY_LIMIT,
  assertSameOrigin,
  authHeaders,
  forwardCookies,
  rateLimited,
} from '../auth/http.js';
import { oidcStatus } from '../auth/oidc.js';
import { clearSignInFailures, limiterKey, reserveWithLockout } from '../auth/sign-in-limiter.js';
import type { Pools } from '../db/pools.js';
import { withSystem } from '../db/scope.js';
import type { KeptApp } from '../http/app.js';
import { AppError, conflict, invalid } from '../http/errors.js';
import { isHomeAssistantAdmin } from '../http/ingress.js';
import {
  readStoredSetupCode,
  SETUP_ALL_KEY,
  SETUP_CODE_KEY,
  SETUP_LOCK,
  setupCodeMatches,
  setupNeeded,
} from './setup-code.js';

// First run (D32, D190, D193; task 22). Until the instance has an instance admin:
// - GET /api/v1/setup says so ({needed});
// - POST /api/v1/setup {code, email, password, displayName} creates the first account with the
//   setup code from the logs: the Better Auth user (server-side; public sign-up is off), its
//   Kept account (ensureAccount), and its instance-admin row; deletes the code; audits; and signs
//   the new admin in, so the next screen (instance options) can follow at once.
// Wrong codes: 10 per client IP, then 15 minutes locked out; and 200 across all IPs in the same
// shape, so a botnet can't walk the code space (30 bits). `kept admin setup-code` re-issues the
// code and lifts that instance-wide lockout.
// In the Home Assistant app (D272, D273) GET also says `homeAssistant: {codeNeeded}`, and a
// request through ingress from a member of Home Assistant's `system-admin` group sets up without
// the code: Home Assistant has already signed that person in as its administrator. The audit row
// names their Home Assistant user id. A setup through ingress must carry Home Assistant's Origin.

export const SETUP_ATTEMPTS_PER_IP = 10;
export const SETUP_ATTEMPTS_ALL = 200;
export const SETUP_LOCKOUT_SECONDS = 15 * 60;

const SetupBody = NewAccount.extend({ code: z.string().trim().min(1).max(32) });
// In the Home Assistant app (KEPT_HA), a Home Assistant administrator through ingress sends no code
// (§8.4 of the app spec, D273); everyone else still must. Outside app mode the schema is the one
// above, unchanged.
const AppModeSetupBody = NewAccount.extend({ code: z.string().trim().min(1).max(32).optional() });

export type SetupDeps = {
  auth: Auth;
  pools: Pools;
  trustedProxies: readonly string[];
  log: FastifyBaseLogger;
};

export async function setupRoutes(app: KeptApp, deps: SetupDeps): Promise<void> {
  const { auth, pools, trustedProxies } = deps;
  const appMode = app.env.KEPT_HA === true;

  app.get(
    '/api/v1/setup',
    {
      config: { auth: 'none' },
      schema: {
        response: {
          200: z.object({
            needed: z.boolean(),
            // Step 6 (T16, D127): "Sign in with <name>", when OIDC is on (discovery worked at boot).
            oidc: z.object({ name: z.string() }).optional(),
            // 1.2 (D226): "Sign in with Google", when Google's client is configured.
            google: z.boolean().optional(),
            // D272: the Home Assistant app only. `codeNeeded: false` for a Home Assistant
            // administrator through ingress.
            homeAssistant: z.object({ codeNeeded: z.boolean() }).optional(),
          }),
        },
      },
    },
    async (req) => {
      const oidc = oidcStatus();
      return {
        needed: await setupNeeded(pools.system),
        ...(oidc.configured && !oidc.error && oidc.name ? { oidc: { name: oidc.name } } : {}),
        ...(googleStatus().configured ? { google: true } : {}),
        ...(appMode ? { homeAssistant: { codeNeeded: !isHomeAssistantAdmin(req.ingress) } } : {}),
      };
    },
  );

  app.post(
    '/api/v1/setup',
    {
      config: { auth: 'none' },
      bodyLimit: ANONYMOUS_BODY_LIMIT,
      schema: {
        body: appMode ? AppModeSetupBody : SetupBody,
        response: { 201: z.object({ userId: z.uuid() }) },
      },
    },
    async (req, reply) => {
      // Through ingress the page is Home Assistant's: its Origin, nothing else.
      if (req.ingress) assertSameOrigin(req, req.ingress.origin);
      const viaHomeAssistant = isHomeAssistantAdmin(req.ingress) ? req.ingress?.haUser : null;
      if (!(await setupNeeded(pools.system))) throw conflict('Kept is already set up.');
      const headers = authHeaders(req, trustedProxies);
      const ip = requestClientIp(headers);
      if (!ip) throw invalid('The client address could not be determined.');
      const email = req.body.email.trim().toLowerCase();
      if (isUndeliverableEmail(email)) throw invalid('That email address cannot receive mail.');
      const ctx = await auth.$context;
      const { minPasswordLength, maxPasswordLength } = ctx.password.config;
      const { password, displayName } = req.body;
      if (password.length < minPasswordLength || password.length > maxPasswordLength) {
        throw invalid(`Passwords are ${minPasswordLength}–${maxPasswordLength} characters.`);
      }

      const code = req.body.code ?? '';
      const wrongCode = () =>
        new AppError('setup_code_invalid', 400, 'Copy the code from the server logs.');
      if (!viaHomeAssistant) {
        // Every attempt counts until it succeeds; the typo in a password above did not.
        const ipKey = limiterKey('setup-code', ip);
        for (const [key, max] of [
          [ipKey, SETUP_ATTEMPTS_PER_IP],
          [SETUP_ALL_KEY, SETUP_ATTEMPTS_ALL],
        ] as const) {
          const decision = await reserveWithLockout(pools.auth, key, max, SETUP_LOCKOUT_SECONDS);
          if (!decision.allowed) throw rateLimited(reply, decision.retryAfter);
        }
        if (!setupCodeMatches(await readStoredSetupCode(pools.system), code)) {
          throw wrongCode();
        }
        await clearSignInFailures(pools.auth, ipKey);
      }

      // Under the setup lock: the code is checked again and consumed, and the admin row is made,
      // in one kept_system transaction, so two correct requests can't both succeed.
      const result = await withSystem(pools.system, async (tx, client) => {
        await client.query('SELECT pg_advisory_xact_lock($1)', [SETUP_LOCK]);
        if (!(await setupNeeded(client))) throw conflict('Kept is already set up.');
        if (!viaHomeAssistant && !setupCodeMatches(await readStoredSetupCode(client), code)) {
          throw wrongCode();
        }

        let created: { headers: Headers; userId: string };
        try {
          const res = await auth.api.signUpEmail({
            body: { email, password, name: displayName },
            headers,
            returnHeaders: true,
          });
          created = { headers: res.headers, userId: res.response.user.id };
        } catch (err) {
          if (isAPIError(err)) throw invalid(err.body?.message ?? undefined);
          throw err;
        }
        try {
          await ensureAccount(pools, created.userId, { headers, requestId: req.id });
          await client.query('SELECT kept.claim_first_instance_admin($1)', [created.userId]);
          await client.query('DELETE FROM public.instance_settings WHERE key = $1', [
            SETUP_CODE_KEY,
          ]);
          await audited(tx, {
            locationId: null,
            ownerAccountId: null,
            actor: { type: 'user', id: created.userId },
            action: 'instance.setup',
            entity: { type: 'user', id: created.userId },
            after: {
              instance_admin: true,
              ...(viaHomeAssistant ? { via_home_assistant: { user_id: viaHomeAssistant.id } } : {}),
            },
            requestId: req.id,
          });
        } catch (err) {
          // Nothing of the failed setup stays: the user row goes (its Kept rows cascade), so the
          // same address can try again.
          await pools.auth
            .query('DELETE FROM auth."user" WHERE id = $1', [created.userId])
            .catch((cleanupErr: unknown) => req.log.error({ err: cleanupErr }, 'setup cleanup'));
          throw err;
        }
        return created;
      });

      req.log.info({ userId: result.userId }, 'instance set up');
      forwardCookies(reply, result.headers);
      return reply.code(201).send({ userId: result.userId });
    },
  );
}
