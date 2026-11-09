import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

// Linking the Kept integration from the Home Assistant app (#376; the D-row in the 1.14.7 plan).
//
// The app's start script sends Home Assistant a discovery message through the Supervisor
// (POST /discovery) with Kept's address on Home Assistant's internal network and the app's link
// secret (KEPT_HA_LINK_SECRET_FILE). Only Home Assistant Core reads discovery messages (the
// Supervisor's GET /discovery is Core's alone), so a request that carries the link secret came
// from that Home Assistant. The secret only lets it *ask*: nothing is handed out until a person
// signed in to Kept approves the request in Settings → Connections, as themselves, with the
// locations and access they choose. The approval makes an ordinary personal token (the same kind,
// scope and checks as New token); its secret is never shown to the browser, only held here, in
// this process's memory, until Home Assistant collects it with the claim key that only the
// asking request was given. Nothing of a request is stored in the database: a restart forgets
// every open request, and Home Assistant asks again.

/** How long Home Assistant has to get a request approved and collect the token. */
export const LINK_REQUEST_MS = 10 * 60 * 1000;
/** After an approval, at least this long to collect the token. */
export const LINK_CLAIM_MS = 2 * 60 * 1000;
/** Open requests at a time; a new one past this drops the oldest still waiting. */
export const LINK_REQUESTS_OPEN = 3;
/** The name of the token an approval makes. */
export const LINK_TOKEN_NAME = 'Home Assistant';

/** Letters and digits a person can't confuse (no 0/O, 1/I/L, 5/S, 8/B, 2/Z, U/V). */
const CODE_ALPHABET = 'ACDEFGHJKMNPQRTWXY34679';

export type LinkState = 'pending' | 'approved' | 'declined';

type LinkRequest = {
  id: string;
  /** Shown in Home Assistant and in Kept, so the person approves the request they started. */
  code: string;
  /** SHA-256 of the claim key: only the request that asked can poll or collect. */
  claimHash: Buffer;
  createdAt: number;
  expiresAt: number;
  state: LinkState;
  /** The approved token's secret, until Home Assistant collects it. */
  secret: string | null;
};

export type PendingLink = { id: string; code: string; createdAt: string; expiresAt: string };

export type ClaimResult =
  | { state: 'pending' }
  | { state: 'declined' }
  | { state: 'approved'; token: string };

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest();

function newCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** The open link requests of this process. One per app: the Home Assistant app runs one Kept. */
export class HomeAssistantLinks {
  readonly #secretHash: Buffer;
  readonly #requests = new Map<string, LinkRequest>();
  readonly #now: () => number;

  /** `secret` is the app's link secret, the one its discovery message carries. */
  constructor(secret: string, now: () => number = Date.now) {
    if (secret.length < 32) throw new Error('the link secret is shorter than 32 characters');
    this.#secretHash = sha256(secret);
    this.#now = now;
  }

  /** Whether `candidate` is the link secret, compared in constant time. */
  isLinkSecret(candidate: string): boolean {
    return timingSafeEqual(sha256(candidate), this.#secretHash);
  }

  #sweep(): void {
    const now = this.#now();
    for (const [id, r] of this.#requests) if (r.expiresAt <= now) this.#requests.delete(id);
  }

  /** A new request: its id, the code to show and the claim key, which only the caller gets. */
  open(): { id: string; code: string; claimKey: string; expiresAt: string } {
    this.#sweep();
    const waiting = [...this.#requests.values()].filter((r) => r.state === 'pending');
    if (this.#requests.size >= LINK_REQUESTS_OPEN && waiting[0]) {
      this.#requests.delete(waiting[0].id);
    }
    const now = this.#now();
    const claimKey = randomBytes(32).toString('base64url');
    const request: LinkRequest = {
      id: randomUUID(),
      code: newCode(),
      claimHash: sha256(claimKey),
      createdAt: now,
      expiresAt: now + LINK_REQUEST_MS,
      state: 'pending',
      secret: null,
    };
    this.#requests.set(request.id, request);
    return {
      id: request.id,
      code: request.code,
      claimKey,
      expiresAt: new Date(request.expiresAt).toISOString(),
    };
  }

  /** The requests waiting for a person, oldest first. */
  pending(): PendingLink[] {
    this.#sweep();
    return [...this.#requests.values()]
      .filter((r) => r.state === 'pending')
      .map((r) => ({
        id: r.id,
        code: r.code,
        createdAt: new Date(r.createdAt).toISOString(),
        expiresAt: new Date(r.expiresAt).toISOString(),
      }));
  }

  /** Whether `id` is a request still waiting for a person. */
  isPending(id: string): boolean {
    this.#sweep();
    return this.#requests.get(id)?.state === 'pending';
  }

  /** Hands the approved token's secret to the request; false when it is gone or already decided
   * (the token is then never collected, and the caller revokes it). */
  approve(id: string, secret: string): boolean {
    this.#sweep();
    const r = this.#requests.get(id);
    if (r?.state !== 'pending') return false;
    r.state = 'approved';
    r.secret = secret;
    r.expiresAt = Math.max(r.expiresAt, this.#now() + LINK_CLAIM_MS);
    return true;
  }

  /** Declines a waiting request; false when it is gone or already decided. */
  decline(id: string): boolean {
    this.#sweep();
    const r = this.#requests.get(id);
    if (r?.state !== 'pending') return false;
    r.state = 'declined';
    r.secret = null;
    return true;
  }

  /** The request's state for the holder of its claim key, or null (unknown, expired or the wrong
   * key: the three look the same). An approved token is handed out once, and the request goes. */
  claim(id: string, claimKey: string): ClaimResult | null {
    this.#sweep();
    const r = this.#requests.get(id);
    if (!r || !timingSafeEqual(sha256(claimKey), r.claimHash)) return null;
    if (r.state === 'pending') return { state: 'pending' };
    this.#requests.delete(id);
    if (r.state === 'declined' || !r.secret) return { state: 'declined' };
    return { state: 'approved', token: r.secret };
  }
}
