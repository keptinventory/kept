import { describe, expect, it } from 'vitest';
import { HomeAssistantLinks, LINK_CLAIM_MS, LINK_REQUEST_MS, LINK_REQUESTS_OPEN } from './link.js';

const SECRET = 'a'.repeat(43);

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

  it('answers pending until a person decides, then hands an approved token out once', () => {
    const links = new HomeAssistantLinks(SECRET);
    const { id, claimKey } = links.open();
    expect(links.claim(id, claimKey)).toEqual({ state: 'pending' });
    expect(links.approve(id, 'kpt_secret')).toBe(true);
    expect(links.pending()).toEqual([]);
    expect(links.claim(id, 'wrong key')).toBeNull();
    expect(links.claim(id, claimKey)).toEqual({ state: 'approved', token: 'kpt_secret' });
    expect(links.claim(id, claimKey)).toBeNull();
  });

  it('says declined once, and a decided request takes no other decision', () => {
    const links = new HomeAssistantLinks(SECRET);
    const { id, claimKey } = links.open();
    expect(links.decline(id)).toBe(true);
    expect(links.approve(id, 'kpt_secret')).toBe(false);
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
    expect(links.approve(second.id, 'kpt_secret')).toBe(true);
    c.advance(LINK_CLAIM_MS - 1);
    expect(links.claim(second.id, second.claimKey)).toEqual({
      state: 'approved',
      token: 'kpt_secret',
    });
  });

  it('keeps a few open at a time: a new one drops the oldest still waiting, never an approved one', () => {
    const links = new HomeAssistantLinks(SECRET);
    const approved = links.open();
    links.approve(approved.id, 'kpt_secret');
    const waiting = Array.from({ length: LINK_REQUESTS_OPEN }, () => links.open());
    expect(links.pending().map((p) => p.id)).toEqual(waiting.slice(1).map((w) => w.id));
    expect(links.claim(approved.id, approved.claimKey)).toEqual({
      state: 'approved',
      token: 'kpt_secret',
    });
  });
});
