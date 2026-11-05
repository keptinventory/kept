import type pg from 'pg';
import { z } from 'zod';
import type { Pools } from '../db/pools.js';
import { DIGITS, THEMES, UNITS } from '../db/schema/index.js';
import { withSystem } from '../db/scope.js';
import type { KeptApp } from '../http/app.js';
import { conflict, unauthenticated } from '../http/errors.js';
import { scopedRead, scopedWrite } from '../http/write.js';
import { hiddenLocationIds } from '../locations/hidden.js';
import { Iso, LocationKind, RoleSchema } from '../locations/views.js';
import { auditMine } from '../notify/prefs.js';
import { RECOVERY_KIT_KEY } from '../setup/recovery-kit.js';

// GET /api/v1/me (the web shell's first query): who is signed in, their
// display preferences, whether they are an instance admin, and the locations they belong to.
//
// PATCH /api/v1/me {suggestLocation?, hidePersonal?}: "Suggest where I am" (the phone's
// location suggestion) and "Hide Personal" (#392) are the person's, across devices, in
// user_profiles. Audited `me.preferences` on the person's own account.
// → 200 {suggestLocation, hidePersonal}. Hiding Personal while it is the only location the session
// can see is 409; hidden already and left with nothing else, it shows by itself
// (kept.hidden_location_ids, read on every request), and that is what `personalHidden` reports.
//
// GET /me also answers an account in its 30 days before deletion (D225), with `deletion` set: the
// web shows only "this account will be deleted" with Keep it and Sign out (accounts/deletion.ts).

const Me = z.object({
  user: z.object({
    id: z.uuid(),
    displayName: z.string(),
    /** Null for a managed account (its address is synthetic and never shown, D47). */
    email: z.string().nullable(),
    /** A managed account's sign-in name; null otherwise. */
    username: z.string().nullable(),
    twoFactorEnabled: z.boolean(),
    managed: z.boolean(),
    instanceAdmin: z.boolean(),
  }),
  /** A second factor was proven in this session (TOTP, backup code, passkey with UV). */
  mfa: z.boolean(),
  /** Null only while it is hidden from this session (require_2fa without a second factor). */
  personalLocationId: z.uuid().nullable(),
  /** Personal is out of this person's lists right now: they asked, and they have another. */
  personalHidden: z.boolean(),
  profile: z.object({
    timezone: z.string(),
    locale: z.string(),
    units: z.enum(UNITS),
    theme: z.enum(THEMES),
    digits: z.enum(DIGITS),
    /** "Suggest where I am" (D39's phone suggestion), off by default. */
    suggestLocation: z.boolean(),
    /** "Hide Personal" as they set it; `personalHidden` is whether it applies right now. */
    hidePersonal: z.boolean(),
  }),
  /** The locations this session can see, with the user's role and end date in each. */
  memberships: z.array(
    z.object({
      locationId: z.uuid(),
      name: z.string(),
      kind: LocationKind,
      role: RoleSchema,
      expiresAt: Iso.nullable(),
    }),
  ),
  instance: z.object({
    /** Instance admins only; null for everyone else (task 22 writes it, D193). */
    recoveryKitAcknowledged: z.boolean().nullable(),
  }),
  /** Set while the account waits to be deleted (D225): the moment it goes. */
  deletion: z.object({ purgeAfter: Iso }).nullable(),
  /** The person's own locations that ask for two-factor and that this session can't open yet,
   * because it hasn't proven a second factor (row-level security hides them everywhere else).
   * Empty once it has. Only the person's memberships: nobody learns of a location they aren't in. */
  twoFactorHidden: z.array(
    z.object({ locationId: z.uuid(), name: z.string(), kind: LocationKind }),
  ),
});

export async function meRoutes(
  app: KeptApp,
  opts: { pools: Pick<Pools, 'app' | 'auth' | 'system'> },
): Promise<void> {
  const { pools } = opts;

  app.get(
    '/api/v1/me',
    { config: { allowDeletionPending: true }, schema: { response: { 200: Me } } },
    async (req) => {
      const kept = await scopedRead(pools, req, async (_tx, client) => {
        const profile = await client.query<{
          display_name: string;
          timezone: string;
          locale: string;
          units: (typeof UNITS)[number];
          theme: (typeof THEMES)[number];
          digits: (typeof DIGITS)[number];
          suggest_location: boolean;
          hide_personal: boolean;
          managed: boolean;
        }>(
          `SELECT display_name, timezone, locale, units, theme, digits, suggest_location,
                  hide_personal, managed
           FROM public.user_profiles WHERE user_id = kept.current_user_id()`,
        );
        const memberships = await client.query<{
          location_id: string;
          name: string;
          kind: z.infer<typeof LocationKind>;
          role: z.infer<typeof RoleSchema>;
          expires_at: Date | null;
        }>(
          `SELECT l.id AS location_id, l.name, l.kind, m.role, m.expires_at
           FROM public.memberships m JOIN public.locations l ON l.id = m.location_id
          WHERE m.user_id = kept.current_user_id()
          ORDER BY (l.kind = 'personal') DESC, lower(l.name), l.id`,
        );
        const admin = await client.query<{ admin: boolean }>(
          'SELECT kept.is_instance_admin() AS admin',
        );
        const instanceAdmin = admin.rows[0]?.admin === true;
        let recoveryKitAcknowledged: boolean | null = null;
        if (instanceAdmin) {
          const kit = await client.query('SELECT 1 FROM public.instance_settings WHERE key = $1', [
            RECOVERY_KIT_KEY,
          ]);
          recoveryKitAcknowledged = (kit.rowCount ?? 0) > 0;
        }
        return {
          profile: profile.rows[0],
          hidden: await hiddenLocationIds(client),
          memberships: memberships.rows,
          instanceAdmin,
          recoveryKitAcknowledged,
        };
      });
      const scope = req.scope;
      if (!scope) throw unauthenticated();
      const { rows } = await pools.auth.query<{
        email: string;
        username: string | null;
        two_factor_enabled: boolean | null;
      }>('SELECT email, username, two_factor_enabled FROM auth."user" WHERE id = $1', [
        scope.userId,
      ]);
      const user = rows[0];
      if (!user) throw unauthenticated();
      const twoFactorHidden = scope.mfa ? [] : await hiddenForTwoFactor(pools, scope.userId);
      const managed = kept.profile?.managed === true;
      const personal = kept.memberships.find((m) => m.kind === 'personal' && m.role === 'owner');
      return {
        user: {
          id: scope.userId,
          displayName: kept.profile?.display_name ?? '',
          email: managed ? null : user.email,
          username: managed ? user.username : null,
          twoFactorEnabled: user.two_factor_enabled === true,
          managed,
          instanceAdmin: kept.instanceAdmin,
        },
        mfa: scope.mfa,
        personalLocationId: personal?.location_id ?? null,
        personalHidden: personal ? kept.hidden.includes(personal.location_id) : false,
        profile: {
          timezone: kept.profile?.timezone ?? 'UTC',
          locale: kept.profile?.locale ?? 'en',
          units: kept.profile?.units ?? 'metric',
          theme: kept.profile?.theme ?? 'system',
          digits: kept.profile?.digits ?? 'western',
          suggestLocation: kept.profile?.suggest_location === true,
          hidePersonal: kept.profile?.hide_personal === true,
        },
        memberships: kept.memberships.map((m) => ({
          locationId: m.location_id,
          name: m.name,
          kind: m.kind,
          role: m.role,
          expiresAt: m.expires_at?.toISOString() ?? null,
        })),
        instance: { recoveryKitAcknowledged: kept.recoveryKitAcknowledged },
        deletion: req.authSession?.deletionPending
          ? { purgeAfter: req.authSession.deletionPending }
          : null,
        twoFactorHidden,
      };
    },
  );

  const Patch = z
    .object({ suggestLocation: z.boolean().optional(), hidePersonal: z.boolean().optional() })
    .strict()
    .refine((b) => b.suggestLocation !== undefined || b.hidePersonal !== undefined, {
      message: 'Send suggestLocation or hidePersonal.',
    });
  app.patch(
    '/api/v1/me',
    {
      schema: {
        body: Patch,
        response: { 200: z.object({ suggestLocation: z.boolean(), hidePersonal: z.boolean() }) },
      },
    },
    (req, reply) =>
      scopedWrite(pools, req, reply, async (tx, client, scope) => {
        const { rows } = await client.query<{ suggest_location: boolean; hide_personal: boolean }>(
          `SELECT suggest_location, hide_personal FROM public.user_profiles
            WHERE user_id = kept.current_user_id() FOR UPDATE`,
        );
        const before = rows[0];
        if (!before) throw unauthenticated();
        const want = {
          suggest_location: req.body.suggestLocation ?? before.suggest_location,
          hide_personal: req.body.hidePersonal ?? before.hide_personal,
        };
        if (want.hide_personal && !before.hide_personal && !(await hasAnotherLocation(client))) {
          throw conflict('Personal is your only location, so it stays. Add or join another first.');
        }
        if (
          before.suggest_location !== want.suggest_location ||
          before.hide_personal !== want.hide_personal
        ) {
          await client.query(
            `UPDATE public.user_profiles SET suggest_location = $1, hide_personal = $2
              WHERE user_id = kept.current_user_id()`,
            [want.suggest_location, want.hide_personal],
          );
          await auditMine(tx, scope.userId, {
            action: 'me.preferences',
            entity: { type: 'user', id: scope.userId },
            before: changed(before, want),
            after: changed(want, before),
            requestId: req.id,
          });
        }
        return {
          status: 200,
          body: { suggestLocation: want.suggest_location, hidePersonal: want.hide_personal },
        };
      }),
  );
}

/** The fields of `a` that differ from `b`, for the audit row. */
function changed<T extends Record<string, unknown>>(a: T, b: T): Partial<T> {
  return Object.fromEntries(Object.entries(a).filter(([k, v]) => v !== b[k])) as Partial<T>;
}

/** Whether this session can see a location other than the caller's Personal one. */
async function hasAnotherLocation(client: pg.ClientBase): Promise<boolean> {
  const { rows } = await client.query<{ other: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM public.locations l
        WHERE l.id IN (SELECT kept.visible_location_ids()) AND l.deleted_at IS NULL
          AND NOT (l.kind = 'personal' AND l.owner_account_id = kept.current_owner_account_id())
     ) AS other`,
  );
  return rows[0]?.other === true;
}

/** The user's live memberships in live locations that ask for two-factor, by name. kept_system
 * reads past row-level security, so the query names the user's own rows only. */
export async function hiddenForTwoFactor(
  pools: Pick<Pools, 'system'>,
  userId: string,
): Promise<{ locationId: string; name: string; kind: z.infer<typeof LocationKind> }[]> {
  return withSystem(pools.system, async (_tx, client) => {
    const { rows } = await client.query<{
      location_id: string;
      name: string;
      kind: z.infer<typeof LocationKind>;
    }>(
      `SELECT l.id AS location_id, l.name, l.kind
         FROM public.memberships m JOIN public.locations l ON l.id = m.location_id
        WHERE m.user_id = $1 AND l.require_2fa AND l.deleted_at IS NULL
          AND (m.expires_at IS NULL OR m.expires_at > now())
        ORDER BY lower(l.name), l.id`,
      [userId],
    );
    return rows.map((r) => ({ locationId: r.location_id, name: r.name, kind: r.kind }));
  });
}
