/**
 * RFC 6238 TOTP (SHA-1, 30 s, 6 digits): what an authenticator app shows for a base32 secret, for
 * the e2e journeys (the server tests' twin is apps/server/test/auth.ts `totp`).
 */
import { createHmac } from 'node:crypto';
import type { Page } from '@playwright/test';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of input.replace(/=+$/, '').toUpperCase()) {
    const value = BASE32.indexOf(char);
    if (value < 0) throw new Error(`bad base32 character ${char}`);
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

export function totp(secretBase32: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const mac = createHmac('sha1', base32Decode(secretBase32)).update(counter).digest();
  const offset = (mac[mac.length - 1] ?? 0) & 0x0f;
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, '0');
}

const usedSteps = new Map<string, number>();

/**
 * The code of a 30-second step `account` hasn't used yet: the server accepts each step once per
 * account, whichever app it came from. Waits for the next step when the current one is used, or
 * has under 5 s left (the code could expire on its way).
 */
export async function freshCode(page: Page, secret: string, account: string): Promise<string> {
  for (;;) {
    const now = Date.now();
    const step = Math.floor(now / 30_000);
    const left = 30_000 - (now % 30_000);
    if (step > (usedSteps.get(account) ?? -1) && left >= 5_000) {
      usedSteps.set(account, step);
      return totp(secret, now);
    }
    await page.waitForTimeout(left + 250);
  }
}
