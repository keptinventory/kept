import { createHmac, timingSafeEqual } from 'node:crypto';
import type pg from 'pg';

// TOTP as Better Auth's two-factor plugin makes and checks it (@better-auth/utils/otp):
// HMAC-SHA1 keyed with the secret string's bytes, 6 digits, 30 s, one step either side; the URI
// carries the secret in base32 without padding.
//
// A code is accepted once (RFC 6238 §5.2): the last accepted step is kept per account, and a code
// of that step or an earlier one is refused, whichever secret it came from. It lives in
// auth.verification (`totp-step:<user id>`, value the step), written under the row lock of the
// account's auth.two_factor row, so two requests with the same code can't both pass.

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

/**
 * Records `step` as the account's last accepted one, unless that step or a later one already
 * was: then false, and the code must be refused. Atomic per account (the auth.two_factor row's
 * lock); without a two_factor row (two-factor off) there is nothing to replay, so true.
 */
export async function claimTotpStep(pool: pg.Pool, userId: string, step: number): Promise<boolean> {
  const identifier = `${TOTP_STEP_PREFIX}:${userId}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '2s'");
    const locked = await client.query(
      'SELECT 1 FROM auth.two_factor WHERE user_id = $1 FOR UPDATE',
      [userId],
    );
    if (!locked.rowCount) {
      await client.query('ROLLBACK');
      return true;
    }
    const { rows } = await client.query<{ value: string }>(
      `SELECT value FROM auth.verification WHERE identifier = $1
        ORDER BY created_at DESC LIMIT 1`,
      [identifier],
    );
    const last = rows[0] ? Number(rows[0].value) : null;
    if (last !== null && Number.isFinite(last) && step <= last) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query('DELETE FROM auth.verification WHERE identifier = $1', [identifier]);
    // Kept past the window in which the step's code is accepted (one step either side).
    await client.query(
      `INSERT INTO auth.verification (identifier, value, expires_at)
       VALUES ($1, $2, now() + make_interval(secs => $3))`,
      [identifier, String(step), TOTP_PERIOD_SECONDS * 4],
    );
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
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
