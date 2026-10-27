import { randomUUID } from 'node:crypto';
import { TOKEN_SCOPES, type TokenScope } from '@kept/shared';
import type pg from 'pg';
import { hiddenForTwoFactor } from '../accounts/me.js';
import { findAuthUserByLogin, mailableAddress } from '../admin/account-ops.js';
import { CliError } from '../admin/cli.js';
import { loadEnv } from '../config/env.js';
import { closePools, createPools, type Pools } from '../db/pools.js';
import { withScope } from '../db/scope.js';
import { AppError, pgErrorOf } from '../http/errors.js';
import type { Mailer } from '../mail/mailer.js';
import { createMailer, profileLocaleLookup } from '../mail/transport.js';
import { createToken, type TokenRow } from '../tokens/service.js';
import { tokenHashKey } from '../tokens/verify.js';

// `kept admin token create`: a personal token made on the server, for the MCP clients and Home
// Assistant of a Kept on plain HTTP, where the browser can't make one (D181: tokens are made only
// over HTTPS in the app). Whoever can run this already holds the server's keys.
//
// It runs as the person, through the token service and their row-level security, exactly as
// Settings → Connections would, except that it has no second factor: a location that asks for
// two-factor is left out (or refused when named), and a viewer's location is left out of a write
// token. The token is printed once; Kept keeps only its fingerprint. The person is mailed, as for
// every `kept admin` change to an account (D180).
//
// It needs KEPT_AUTH_SECRET (the token fingerprint's key, from the config volume) and the
// serving logins, so under Compose it runs in the `kept` container:
//   docker compose exec kept kept admin token create --user <login> --scope read --name "Home Assistant"

export type TokenCreateInput = {
  /** The person's email address, or a managed account's username. */
  user: string;
  scope: string;
  name: string;
  /** Days until it stops working; none: it works until revoked. */
  expires?: string;
  /** Location ids or names; none: every location the token can reach. */
  location?: string[];
  confirmCrossLocation?: boolean;
};

export type TokenCreateDeps = {
  /** kept_app (the token, as the person), kept_auth (the account), kept_system (the locations
   * that ask for two-factor, which the person's own scope can't see without a second factor). */
  pools: Pick<Pools, 'app' | 'auth' | 'system'>;
  /** tokens/verify.ts tokenHashKey(KEPT_AUTH_SECRET): the key the server checks tokens with. */
  key: Buffer;
  publicUrl: string;
  mailer: Mailer;
  now?: Date;
};

export type LeftOut = { name: string; why: 'two_factor' | 'viewer' };

export type CliToken = {
  login: string;
  secret: string;
  token: TokenRow;
  mcpUrl: string;
  leftOut: LeftOut[];
};

const MAX_DAYS = 3650;
const DAY_MS = 86_400_000;

type Membership = { id: string; name: string; require_2fa: boolean; role: string };

function parsed(input: TokenCreateInput, now: Date) {
  if (!(TOKEN_SCOPES as readonly string[]).includes(input.scope)) {
    throw new CliError(`--scope is read or write, not ${input.scope}`);
  }
  const name = input.name.trim();
  if (name.length < 1 || name.length > 80) {
    throw new CliError(
      '--name is 1 to 80 characters: what the token is for, e.g. "Home Assistant"',
    );
  }
  let expiresAt: string | undefined;
  if (input.expires !== undefined) {
    const days = /^\d{1,4}$/.test(input.expires) ? Number(input.expires) : Number.NaN;
    if (!(days >= 1 && days <= MAX_DAYS)) {
      throw new CliError(`--expires is a number of days, 1 to ${MAX_DAYS}`);
    }
    expiresAt = new Date(now.getTime() + days * DAY_MS).toISOString();
  }
  return { scope: input.scope as TokenScope, name, expiresAt };
}

async function membershipsOf(client: pg.ClientBase): Promise<Membership[]> {
  const { rows } = await client.query<Membership>(
    `SELECT l.id, l.name, l.require_2fa, m.role
       FROM public.memberships m
       JOIN public.locations l ON l.id = m.location_id
      WHERE m.user_id = kept.current_user_id()
        AND l.deleted_at IS NULL
        AND (m.expires_at IS NULL OR m.expires_at > now())
      ORDER BY lower(l.name), l.id`,
  );
  return rows;
}

/** The locations named with --location, by id or (case-insensitive) name. */
function named(all: Membership[], wanted: string[], login: string): Membership[] {
  const out = new Map<string, Membership>();
  for (const raw of wanted) {
    const w = raw.trim().toLowerCase();
    const hits = all.filter((m) => m.id === w || m.name.trim().toLowerCase() === w);
    if (hits.length === 0) throw new CliError(`${login} doesn't belong to ${raw.trim()}`);
    if (hits.length > 1) {
      throw new CliError(`${login} has more than one location called ${raw.trim()}: use its id`);
    }
    const hit = hits[0] as Membership;
    out.set(hit.id, hit);
  }
  return [...out.values()];
}

const TWO_FACTOR = (name: string) =>
  `${name} asks for two-factor, which a token made on the server doesn't have: make that one in Settings → Connections, signed in with two-factor, over HTTPS`;

/** Makes the token. Throws CliError with a sentence for whatever stops it. */
export async function createCliToken(
  deps: TokenCreateDeps,
  input: TokenCreateInput,
): Promise<CliToken> {
  const now = deps.now ?? new Date();
  const opts = parsed(input, now);
  const user = await findAuthUserByLogin(deps.pools.auth, input.user);
  if (!user) throw new CliError(`no account signs in as ${input.user}`);
  if (user.banned) throw new CliError(`${input.user}'s account is disabled`);
  const login = input.user.trim();
  // Hidden from a scope without a second factor, so read apart: named, never reached.
  const asksTwoFactor: Membership[] = (await hiddenForTwoFactor(deps.pools, user.id)).map((l) => ({
    id: l.locationId,
    name: l.name,
    require_2fa: true,
    role: 'member',
  }));

  const made = await withScope(
    deps.pools.app,
    { userId: user.id, mfa: false },
    async (tx, client) => {
      const all = [...(await membershipsOf(client)), ...asksTwoFactor];
      const leftOut: LeftOut[] = [];
      let chosen: Membership[];
      if (input.location?.length) {
        chosen = named(all, input.location, login);
        for (const m of chosen) {
          if (m.require_2fa) throw new CliError(TWO_FACTOR(m.name));
          if (opts.scope === 'write' && m.role === 'viewer') {
            throw new CliError(
              `${login} is a viewer of ${m.name}: a viewer's token can only read. Use --scope read`,
            );
          }
        }
      } else {
        chosen = all.filter((m) => {
          if (m.require_2fa) leftOut.push({ name: m.name, why: 'two_factor' });
          else if (opts.scope === 'write' && m.role === 'viewer')
            leftOut.push({ name: m.name, why: 'viewer' });
          else return true;
          return false;
        });
      }
      if (chosen.length === 0) {
        throw new CliError(`there is no location a ${opts.scope} token for ${login} could reach`);
      }
      try {
        const result = await createToken(
          { tx, client, scope: { userId: user.id, mfa: false }, requestId: randomUUID() },
          {
            name: opts.name,
            scope: opts.scope,
            locationIds: chosen.map((m) => m.id),
            ...(opts.expiresAt ? { expiresAt: opts.expiresAt } : {}),
            ...(input.confirmCrossLocation ? { confirmCrossLocation: true } : {}),
          },
          { key: deps.key, publicUrl: deps.publicUrl, names: async () => new Map(), now },
        );
        if (result.kind === 'warning') {
          throw new CliError(
            'these locations have different members, so a change made with this token in one would show to the people of another; pass --confirm-cross-location to make it anyway, or --location for one location',
          );
        }
        return { ...result.body, leftOut };
      } catch (err) {
        if (pgErrorOf(err)?.constraint === 'token_locations_mfa') {
          throw new CliError(TWO_FACTOR('A location'));
        }
        if (err instanceof AppError && err.code === 'internal') {
          throw new CliError(`${login} has never signed in: sign in to Kept once, then try again`);
        }
        throw err;
      }
    },
  );

  const to = mailableAddress(user);
  if (to)
    await deps.mailer.send({ kind: 'admin-action', to, action: 'token-created' }).catch(() => {});
  return {
    login,
    secret: made.secret,
    token: made.token,
    mcpUrl: made.clientConfigs.generic.url,
    leftOut: made.leftOut,
  };
}

/** What the command prints: the token once, then how to use it. */
export function tokenCreateLines(made: CliToken): string[] {
  const where = made.token.locations.map((l) => l.name || l.id).join(', ');
  const until = made.token.expiresAt
    ? `until ${made.token.expiresAt.slice(0, 10)}`
    : 'until revoked';
  return [
    `A ${made.token.scope} token "${made.token.name}" for ${made.login}, ${until}, reaching: ${where}`,
    `KEPT TOKEN: ${made.secret}`,
    'It is shown only now: Kept keeps a fingerprint, not the token. Revoke it in Settings → Connections.',
    `MCP server address: ${made.mcpUrl}, with the header "Authorization: Bearer" and the token above.`,
  ];
}

const LEFT_OUT: Record<LeftOut['why'], string> = {
  two_factor: 'asks for two-factor',
  viewer: 'a viewer’s token can only read',
};

/** `kept admin token create`, from the server's environment. */
export async function tokenCreateCommand(
  source: NodeJS.ProcessEnv,
  input: TokenCreateInput,
  io: { write: (line: string) => void; warn: (line: string) => void },
): Promise<number> {
  const env = await loadEnv(source, { logger: io.warn });
  const pools = createPools(env);
  const logger = {
    warn: (obj: object, msg?: string) => io.warn(JSON.stringify({ ...obj, msg })),
  } as Parameters<typeof createMailer>[1]['logger'];
  const mail = createMailer(env, { localeOf: profileLocaleLookup(pools.system), logger });
  try {
    const made = await createCliToken(
      {
        pools,
        key: tokenHashKey(env.authSecret),
        publicUrl: env.KEPT_PUBLIC_URL,
        mailer: mail.mailer,
      },
      input,
    );
    for (const l of made.leftOut) io.warn(`Left out ${l.name}: ${LEFT_OUT[l.why]}.`);
    for (const line of tokenCreateLines(made)) io.write(line);
    return 0;
  } finally {
    mail.close();
    await closePools(pools);
  }
}
