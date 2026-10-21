import { createHmac, timingSafeEqual } from 'node:crypto';
import type pg from 'pg';

// TOTP as Better Auth's two-factor plugin makes and checks it (@better-auth/utils/otp):
// HMAC-SHA1 keyed with the secret string's bytes, 6 digits, 30 s, one step either side; the URI
// carries the secret in base32 without padding.
//
// A code is accepted once (RFC 6238 §5.2): the last accepted step is kept per account, and a code
// of that step or an earlier one is refused, whichever secret it came from. It lives in
// auth.verification (`totp-step:<user id>`, value the step), written under the row lock of the
// account's auth.two_factor row, so two requests with the same code can't both pass. A code
// refused for another reason after its step was claimed gives the step back (releaseTotpStep).

export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SECONDS = 30;
/** auth.verification identifier prefix of an account's last accepted step. */
export const TOTP_STEP_PREFIX = 'totp-step';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32(bytes: Buffer): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32[(buffer >> bits) & 31];
    }
  }
  if (bits > 0) out += BASE32[(buffer << (5 - bits)) & 31];
  return out;
}

function hotp(secret: string, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', Buffer.from(secret, 'utf8')).update(message).digest();
  const offset = (mac[mac.length - 1] ?? 0) & 0x0f;
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** TOTP_DIGITS;
  return code.toString().padStart(TOTP_DIGITS, '0');
}

/** The step whose code `code` is (now, or one step before or after), or null. */
export function totpStep(secret: string, code: string, now = Date.now()): number | null {
  const given = Buffer.from(code.replace(/\s+/g, ''));
  const counter = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
  let found: number | null = null;
  for (const step of [counter - 1, counter, counter + 1]) {
    const expected = Buffer.from(hotp(secret, step));
    if (given.length === expected.length && timingSafeEqual(given, expected)) found = step;
  }
  return found;
}

/** Whether `code` is this secret's code now, or one step before or after. */
export function totpMatches(secret: string, code: string, now = Date.now()): boolean {
  return totpStep(secret, code, now) !== null;
}

/** The account's two_factor row was locked past LOCK_WAIT: the caller answers 429. */
export class TotpBusyError extends Error {
  constructor() {
    super('Another code for this account is being checked');
    this.name = 'TotpBusyError';
  }
}

/** How long a claim waits for the account's two_factor row (`lock_timeout`). */
const LOCK_WAIT = '1s';
const LOCK_NOT_AVAILABLE = '55P03';

export type TotpClaim = {
  /** False: that step or a later one was already accepted, and the code must be refused. */
  claimed: boolean;
  /** The step recorded before this claim (its text), for releaseTotpStep. */
  previous: string | null;
};

/** Runs `fn` in one transaction holding the account's two_factor row; false: no such row. */
async function underTwoFactorLock<T>(
  pool: pg.Pool,
  userId: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<{ row: false } | { row: true; value: T }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL lock_timeout = '${LOCK_WAIT}'`);
    const locked = await client.query(
      'SELECT 1 FROM auth.two_factor WHERE user_id = $1 FOR UPDATE',
      [userId],
    );
    if (!locked.rowCount) {
      await client.query('ROLLBACK');
      return { row: false };
    }
    const value = await fn(client);
    await client.query('COMMIT');
    return { row: true, value };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if ((err as { code?: unknown }).code === LOCK_NOT_AVAILABLE) throw new TotpBusyError();
    throw err;
  } finally {
    client.release();
  }
}

async function writeStep(client: pg.ClientBase, identifier: string, step: string) {
  await client.query('DELETE FROM auth.verification WHERE identifier = $1', [identifier]);
  // Kept past the window in which the step's code is accepted (one step either side).
  await client.query(
    `INSERT INTO auth.verification (identifier, value, expires_at)
     VALUES ($1, $2, now() + make_interval(secs => $3))`,
    [identifier, step, TOTP_PERIOD_SECONDS * 4],
  );
}

/**
 * Records `step` as the account's last accepted one, unless that step or a later one already
 * was (claimed: false). Atomic per account (the auth.two_factor row's lock, waited for at most a
 * second: TotpBusyError); without a two_factor row (two-factor off) there is nothing to replay. A
 * record past its expiry counts for nothing.
 */
export async function claimTotpStep(
  pool: pg.Pool,
  userId: string,
  step: number,
): Promise<TotpClaim> {
  const identifier = `${TOTP_STEP_PREFIX}:${userId}`;
  const done = await underTwoFactorLock(pool, userId, async (client) => {
    const { rows } = await client.query<{ value: string }>(
      `SELECT value FROM auth.verification
        WHERE identifier = $1 AND expires_at > now()
        ORDER BY created_at DESC LIMIT 1`,
      [identifier],
    );
    const previous = rows[0]?.value ?? null;
    const last = previous === null ? null : Number(previous);
    if (last !== null && Number.isFinite(last) && step <= last) {
      return { claimed: false, previous };
    }
    await writeStep(client, identifier, String(step));
    return { claimed: true, previous };
  });
  return done.row ? done.value : { claimed: true, previous: null };
}

/**
 * Gives `step` back when the code that claimed it was refused after all (Better Auth's lockout,
 * attempt limit or an expired sign-in): the record returns to `previous`, unless another claim
 * has moved it on since.
 */
export async function releaseTotpStep(
  pool: pg.Pool,
  userId: string,
  step: number,
  previous: string | null,
): Promise<void> {
  const identifier = `${TOTP_STEP_PREFIX}:${userId}`;
  await underTwoFactorLock(pool, userId, async (client) => {
    const { rows } = await client.query<{ value: string }>(
      `SELECT value FROM auth.verification WHERE identifier = $1
        ORDER BY created_at DESC LIMIT 1`,
      [identifier],
    );
    if (rows[0]?.value !== String(step)) return;
    if (previous === null) {
      await client.query('DELETE FROM auth.verification WHERE identifier = $1', [identifier]);
    } else {
      await writeStep(client, identifier, previous);
    }
  });
}

/** The otpauth:// URI an authenticator app scans. */
export function totpUri(secret: string, account: string, issuer: string): string {
  const params = new URLSearchParams({
    secret: base32(Buffer.from(secret, 'utf8')),
    issuer,
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?${params}`;
}
