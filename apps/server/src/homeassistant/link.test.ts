import { describe, expect, it, vi } from 'vitest';
import { HomeAssistantLinks, LINK_CLAIM_MS, LINK_REQUEST_MS, LINK_REQUESTS_OPEN } from './link.js';

const SECRET = 'a'.repeat(43);

/** A way to make the token that counts its calls: an approval makes nothing until collected. */
const issuer = (secret = 'kpt_secret') => vi.fn(async (_requestId: string) => secret);

function clock(start = 1_800_000_000_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe('HomeAssistantLinks', () => {
  it('refuses a link secret shorter than 32 characters', () => {
    expect(() => new HomeAssistantLinks('short')).toThrow(/32/);
  });

  it('knows its link secret and nothing else', () => {
    const links = new HomeAssistantLinks(SECRET);
    expect(links.isLinkSecret(SECRET)).toBe(true);
    expect(links.isLinkSecret(`${SECRET}x`)).toBe(false);
    expect(links.isLinkSecret('')).toBe(false);
  });

  it('opens a request with a code a person can read, and a claim key only the asker gets', () => {
    const links = new HomeAssistantLinks(SECRET);
    const opened = links.open();
    expect(opened.code).toMatch(/^[ACDEFGHJKMNPQRTWXY34679]{4}-[ACDEFGHJKMNPQRTWXY34679]{4}$/);
    expect(opened.claimKey.length).toBeGreaterThanOrEqual(43);
    const listed = links.pending();
    expect(listed).toEqual([
      {
        id: opened.id,
        code: opened.code,
        createdAt: expect.any(String),
        expiresAt: opened.expiresAt,
      },
    ]);
    expect(JSON.stringify(listed)).not.toContain(opened.claimKey);
  });

  it('answers pending until a person decides, then hands an approval out once, to make the token', async () => {
    const links = new HomeAssistantLinks(SECRET);
    const { id, claimKey } = links.open();
    const issue = issuer();
    expect(links.claim(id, claimKey)).toEqual({ state: 'pending' });
    expect(links.approve(id, issue)).toBe(true);
    expect(links.pending()).toEqual([]);
    expect(links.claim(id, 'wrong key')).toBeNull();
    expect(issue).not.toHaveBeenCalled();
    const got = links.claim(id, claimKey);
    expect(got).toEqual({ state: 'approved', issue });
    expect(links.claim(id, claimKey)).toBeNull();
    if (got?.state === 'approved') expect(await got.issue('req-1')).toBe('kpt_secret');
    expect(issue).toHaveBeenCalledTimes(1);
  });

  it('says declined once, and a decided request takes no other decision', () => {
    const links = new HomeAssistantLinks(SECRET);
    const { id, claimKey } = links.open();
    expect(links.decline(id)).toBe(true);
    expect(links.approve(id, issuer())).toBe(false);
    expect(links.decline(id)).toBe(false);
    expect(links.claim(id, claimKey)).toEqual({ state: 'declined' });
    expect(links.claim(id, claimKey)).toBeNull();
  });

  it('forgets a request after ten minutes, and an approved one at least two minutes after approval', () => {
    const c = clock();
    const links = new HomeAssistantLinks(SECRET, c.now);
    const first = links.open();
    c.advance(LINK_REQUEST_MS);
    expect(links.isPending(first.id)).toBe(false);
    expect(links.claim(first.id, first.claimKey)).toBeNull();

    const second = links.open();
    c.advance(LINK_REQUEST_MS - 1000);
    const issue = issuer();
    expect(links.approve(second.id, issue)).toBe(true);
    c.advance(LINK_CLAIM_MS - 1);
    expect(links.claim(second.id, second.claimKey)).toEqual({ state: 'approved', issue });
  });

  // #489: no token exists before Home Assistant collects one, so an approval it never collects
  // (the time ran out, or Kept restarted and forgot it) leaves nothing to revoke.
  it('an approval nobody collects in time ends without ever making the token', () => {
    const c = clock();
    const links = new HomeAssistantLinks(SECRET, c.now);
    const req = links.open();
    const issue = issuer();
    expect(links.approve(req.id, issue)).toBe(true);
    c.advance(LINK_REQUEST_MS + LINK_CLAIM_MS);
    expect(links.pending()).toEqual([]);
    expect(links.claim(req.id, req.claimKey)).toBeNull();
    expect(issue).not.toHaveBeenCalled();
  });

  it('a restarted Kept knows nothing of an earlier approval', () => {
    const before = new HomeAssistantLinks(SECRET);
    const req = before.open();
    const issue = issuer();
    expect(before.approve(req.id, issue)).toBe(true);
    const after = new HomeAssistantLinks(SECRET);
    expect(after.claim(req.id, req.claimKey)).toBeNull();
    expect(issue).not.toHaveBeenCalled();
  });

  it('keeps a few open at a time: a new one drops the oldest still waiting, never an approved one', () => {
    const links = new HomeAssistantLinks(SECRET);
    const approved = links.open();
    const issue = issuer();
    links.approve(approved.id, issue);
    const waiting = Array.from({ length: LINK_REQUESTS_OPEN }, () => links.open());
    expect(links.pending().map((p) => p.id)).toEqual(waiting.slice(1).map((w) => w.id));
    expect(links.claim(approved.id, approved.claimKey)).toEqual({ state: 'approved', issue });
  });
});
