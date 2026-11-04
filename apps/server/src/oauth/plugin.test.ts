import { describe, expect, it } from 'vitest';
import { OFFLINE_ACCESS, withOfflineAccess } from './plugin.js';

// Which authorization requests get `offline_access` added (#411); the end-to-end flow, with the
// refresh and its revocation, is in oauth.test.ts.

const pkce = { code_challenge: 'abc', code_challenge_method: 'S256' };

describe('withOfflineAccess', () => {
  it("adds offline_access to a PKCE request for Kept's scopes, keeping the other parameters", () => {
    expect(withOfflineAccess({ ...pkce, client_id: 'c', scope: 'kept:read kept:write' })).toEqual({
      ...pkce,
      client_id: 'c',
      scope: `kept:read kept:write ${OFFLINE_ACCESS}`,
    });
    expect(withOfflineAccess({ ...pkce, scope: 'kept:read' })?.scope).toBe(
      `kept:read ${OFFLINE_ACCESS}`,
    );
  });

  it('leaves a request without a PKCE challenge alone', () => {
    expect(withOfflineAccess({ scope: 'kept:read kept:write' })).toBeNull();
    expect(withOfflineAccess({ scope: 'kept:read', code_challenge: '' })).toBeNull();
  });

  it("leaves a request alone that asks for none of Kept's scopes, or for offline_access already", () => {
    expect(withOfflineAccess({ ...pkce, scope: 'openid profile' })).toBeNull();
    expect(withOfflineAccess({ ...pkce })).toBeNull();
    expect(withOfflineAccess({ ...pkce, scope: `kept:read ${OFFLINE_ACCESS}` })).toBeNull();
    expect(withOfflineAccess(undefined)).toBeNull();
  });
});
