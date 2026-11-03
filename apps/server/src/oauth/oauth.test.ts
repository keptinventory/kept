import { createHash, randomBytes } from 'node:crypto';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import { createLocation, createThing, type Json, type Loc, ok, own } from '../../test/things.js';
import { withScope } from '../db/scope.js';
import { cimdFetch } from './cimd-fetch.js';
import { decide } from './consent.js';

// OAuth connectors with Client ID Metadata Documents, end to end through the app: authorize
// (as Louis, signed in) → Kept's consent (read, Home only) → the token endpoint with PKCE → `/mcp`
// with the JWT → revoke in Connections. The client's metadata document is served by an in-memory
// transport for one allowed URL (isMetadataDocumentUrlAllowed): a fixture can't pass the real
// SSRF guard on a laptop, which only reaches loopback; the guard's refusals
// are tested on the real transport below.

const CLIENT_ID = 'https://client.example/oauth/kept-client.json';
const REDIRECT = 'https://client.example/callback';
const METADATA = {
  client_id: CLIENT_ID,
  client_name: 'Murdock’s notebook',
  redirect_uris: [REDIRECT],
  token_endpoint_auth_method: 'none',
  grant_types: ['authorization_code'],
  response_types: ['code'],
};
// A second client, registered the same way, for the consent that names one and posts the other.
const OTHER_ID = 'https://other.example/oauth/kept-client.json';
const OTHER_REDIRECT = 'https://other.example/callback';
const OTHER_METADATA = {
  ...METADATA,
  client_id: OTHER_ID,
  client_name: 'Talia’s planner',
  redirect_uris: [OTHER_REDIRECT],
};
// A connector as Claude.ai registers itself: refresh_token among its grant types (#411).
const CONNECTOR_ID = 'https://connector.example/oauth/kept-client.json';
const CONNECTOR_REDIRECT = 'https://connector.example/callback';
const CONNECTOR_METADATA = {
  ...METADATA,
  client_id: CONNECTOR_ID,
  client_name: 'Gordon’s assistant',
  redirect_uris: [CONNECTOR_REDIRECT],
  grant_types: ['authorization_code', 'refresh_token'],
};
// A connector whose metadata document declares its scopes (they're the only ones it may request),
// and only the authorization_code grant.
const DECLARED_ID = 'https://declared.example/oauth/kept-client.json';
const DECLARED_REDIRECT = 'https://declared.example/callback';
const DECLARED_METADATA = {
  ...CONNECTOR_METADATA,
  client_id: DECLARED_ID,
  client_name: 'Selina’s list',
  redirect_uris: [DECLARED_REDIRECT],
  scope: 'kept:read kept:write',
  grant_types: ['authorization_code'],
};

let db: TestDb;
let t: TestApp;
let ibrahim: Person;
let louis: Person;
let home: Loc;
let garage: Loc;
let fetched = 0;
const clients: Client[] = [];

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db, {
    oauth: {
      publicUrl: 'http://localhost:5173',
      isMetadataDocumentUrlAllowed: (url) =>
        url === CLIENT_ID || url === OTHER_ID || url === CONNECTOR_ID || url === DECLARED_ID,
      fetchClientMetadataResource: async (input) => {
        fetched += 1;
        const url = input instanceof Request ? input.url : String(input);
        if (url === CLIENT_ID) return Response.json(METADATA);
        if (url === OTHER_ID) return Response.json(OTHER_METADATA);
        if (url === CONNECTOR_ID) return Response.json(CONNECTOR_METADATA);
        if (url === DECLARED_ID) return Response.json(DECLARED_METADATA);
        return new Response('not found', { status: 404 });
      },
    },
  });
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  home = await createLocation(t, db, ibrahim, 'complete');
  garage = await createLocation(t, db, ibrahim, 'complete', 'Garage');
  await join(db, home.id, louis.userId, 'member');
  await join(db, garage.id, louis.userId, 'member');
  await createThing(t, ibrahim, home, { name: 'HDMI cable' });
});

afterAll(async () => {
  for (const c of clients) await c.close().catch(() => {});
});

const host = () => new URL(t.publicUrl).host;

/** fetch() into the app (as mcp.test.ts). */
function injectFetch(): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      headers[k] = v;
    });
    headers.host = url.host;
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();
    const res = await t.app.inject({
      method: req.method as 'POST',
      url: `${url.pathname}${url.search}`,
      headers,
      ...(body ? { payload: body } : {}),
    });
    const out = new Headers();
    for (const [k, v] of Object.entries(res.headers)) {
      if (v === undefined) continue;
      for (const one of Array.isArray(v) ? v : [String(v)]) out.append(k, one);
    }
    return new Response(
      res.statusCode === 202 || res.statusCode === 204 ? null : new Uint8Array(res.rawPayload),
      { status: res.statusCode, headers: out },
    );
  }) as typeof fetch;
}

async function mcpClient(accessToken: string): Promise<Client> {
  const client = new Client(
    { name: 'kept-oauth-test', version: '0.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${t.publicUrl}/mcp`), {
      fetch: injectFetch(),
      requestInit: { headers: { authorization: `Bearer ${accessToken}` } },
    }),
  );
  clients.push(client);
  return client;
}

/** authorize → the consent page's signed query (Better Auth answers a script with JSON). */
async function authorize(
  verifier: string,
  client: { id: string; redirect: string } = { id: CLIENT_ID, redirect: REDIRECT },
): Promise<string> {
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: client.id,
    redirect_uri: client.redirect,
    scope: 'kept:read kept:write',
    state: 'state-1',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: `${t.publicUrl}/mcp`,
  });
  const res = await call(t, `/api/v1/auth/oauth2/authorize?${q}`, {
    as: louis,
    headers: { accept: 'application/json' },
  });
  expect(res.statusCode, res.body).toBeLessThan(400);
  const target =
    (res.headers.location as string | undefined) ?? (res.json() as { url: string }).url;
  const consent = new URL(target, t.publicUrl);
  expect(consent.pathname).toBe('/oauth/consent');
  return consent.search.slice(1);
}

type TokenResponse = { access_token: string; refresh_token?: string; scope?: string };

/** The token endpoint, as a public client posts to it. */
const tokenEndpoint = (form: Record<string, string>) =>
  t.app.inject({
    method: 'POST',
    url: '/api/v1/auth/oauth2/token',
    headers: { host: host(), 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ ...form, resource: `${t.publicUrl}/mcp` }).toString(),
  });

async function redeemTokens(
  redirectTo: string,
  verifier: string,
  client: { id: string; redirect: string } = { id: CLIENT_ID, redirect: REDIRECT },
): Promise<TokenResponse> {
  const code = new URL(redirectTo).searchParams.get('code');
  expect(code).toBeTruthy();
  const res = await tokenEndpoint({
    grant_type: 'authorization_code',
    code: code as string,
    redirect_uri: client.redirect,
    client_id: client.id,
    code_verifier: verifier,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as TokenResponse;
}

async function redeem(redirectTo: string, verifier: string): Promise<string> {
  return (await redeemTokens(redirectTo, verifier)).access_token;
}

/** tools/list at /mcp with a bearer: 200 while the grant stands, 401 once it doesn't. */
const listToolsWith = (bearer: string) =>
  t.app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      host: host(),
      authorization: `Bearer ${bearer}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
  });

describe('OAuth connectors', () => {
  it('serves the discovery documents at the root, with CIMD and no registration endpoint', async () => {
    const as = await t.app.inject({
      url: '/.well-known/oauth-authorization-server/api/v1/auth',
      headers: { host: host() },
    });
    expect(as.statusCode).toBe(200);
    const meta = as.json() as Record<string, unknown>;
    expect(meta).toMatchObject({
      issuer: `${t.publicUrl}/api/v1/auth`,
      client_id_metadata_document_supported: true,
    });
    expect(meta.registration_endpoint).toBeUndefined();
    const prm = await t.app.inject({
      url: '/.well-known/oauth-protected-resource/mcp',
      headers: { host: host() },
    });
    expect(prm.statusCode).toBe(200);
    expect(prm.json()).toMatchObject({ resource: `${t.publicUrl}/mcp` });
    // Dynamic Client Registration is off, and the jwt plugin's session JWT isn't served.
    const dcr = await call(t, '/api/v1/auth/oauth2/register', {
      body: { redirect_uris: [REDIRECT], client_name: 'Talia’s app' },
    });
    expect(dcr.statusCode).toBeGreaterThanOrEqual(400);
    expect((await call(t, '/api/v1/auth/token', { as: louis })).statusCode).toBe(404);
  });

  // Security review step 6 (M1): the provider's session-authenticated client management
  // would let any signed-in person register a client with any redirect URI and name, DCR by
  // another door. None of it is served.
  it('serves none of the provider’s client or consent management to a signed-in person', async () => {
    const made = await call(t, '/api/v1/auth/oauth2/create-client', {
      as: louis,
      body: { redirect_uris: ['https://evil.example/cb'], client_name: 'Claude' },
    });
    expect(made.statusCode, made.body).toBe(404);
    const posts = [
      '/oauth2/update-client',
      '/oauth2/client/rotate-secret',
      '/oauth2/delete-client',
      '/oauth2/update-consent',
      '/oauth2/delete-consent',
    ];
    for (const path of posts) {
      const res = await call(t, `/api/v1/auth${path}`, { as: louis, body: { client_id: 'x' } });
      expect(res.statusCode, path).toBe(404);
    }
    const gets = ['/oauth2/get-client?client_id=x', '/oauth2/get-clients', '/oauth2/get-consents'];
    for (const path of gets) {
      expect((await call(t, `/api/v1/auth${path}`, { as: louis })).statusCode, path).toBe(404);
    }
    const rows = await own(db, 'SELECT 1 FROM auth.oauth_client WHERE name = $1', ['Claude']);
    expect(rows).toHaveLength(0);
  });

  // catalogue: POST /api/v1/oauth/consent
  it('consents to Home, read only, and the app reads Home and nothing else until revoked', async () => {
    const verifier = randomBytes(32).toString('base64url');
    const query = await authorize(verifier);
    expect(fetched).toBeGreaterThan(0);
    const view = ok(await call(t, `/api/v1/oauth/consent?${query}`, { as: louis }));
    expect(view.client).toMatchObject({ name: 'Murdock’s notebook' });
    expect((view.locations as Json[]).map((l) => l.id)).toEqual(
      expect.arrayContaining([home.id, garage.id]),
    );
    const decided = ok(
      await call(t, `/api/v1/oauth/consent?${query}`, {
        as: louis,
        body: { accept: true, scope: 'read', locationIds: [home.id] },
      }),
    );
    const events = await own<{ action: string; actor_id: string }>(
      db,
      `SELECT action, actor_id FROM public.audit_events WHERE action = 'oauth.grant'`,
    );
    expect(events).toEqual([{ action: 'oauth.grant', actor_id: louis.userId }]);
    const access = await redeem(decided.redirectTo as string, verifier);

    const client = await mcpClient(access);
    const tools = (await client.listTools()).tools.map((x) => x.name);
    expect(tools).toContain('where_is');
    expect(tools).not.toContain('create_place');
    const found = await client.callTool({ name: 'where_is', arguments: { query: 'HDMI' } });
    expect(found.isError).toBeFalsy();
    const elsewhere = await client.callTool({
      name: 'where_is',
      arguments: { query: 'HDMI', location_id: garage.id },
    });
    expect(elsewhere.isError).toBe(true);
    expect(JSON.stringify(elsewhere.content)).toContain('tool_unavailable');

    // Connections lists the app; revoking it refuses the next call though the JWT is unexpired.
    const tokens = ok(await call(t, '/api/v1/tokens?kind=oauth', { as: louis }));
    const grant = (tokens.items as Json[])[0] as Json;
    expect(grant).toMatchObject({ kind: 'oauth', clientName: 'Murdock’s notebook', scope: 'read' });
    expect(
      (await call(t, `/api/v1/tokens/${grant.id}`, { as: louis, method: 'DELETE' })).statusCode,
    ).toBe(204);
    const after = await t.app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        host: host(),
        authorization: `Bearer ${access}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    });
    expect(after.statusCode).toBe(401);
    expect(String(after.headers['www-authenticate'])).toContain('resource_metadata=');
  });

  it('ends the grant when the app revokes its access token, and only for that app', async () => {
    const verifier = randomBytes(32).toString('base64url');
    const query = await authorize(verifier);
    const decided = ok(
      await call(t, `/api/v1/oauth/consent?${query}`, {
        as: louis,
        body: { accept: true, scope: 'read', locationIds: [home.id] },
      }),
    );
    const access = await redeem(decided.redirectTo as string, verifier);
    const listTools = () =>
      t.app.inject({
        method: 'POST',
        url: '/mcp',
        headers: {
          host: host(),
          authorization: `Bearer ${access}`,
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
      });
    const revoke = (clientId: string) =>
      t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/oauth2/revoke',
        headers: { host: host(), 'content-type': 'application/x-www-form-urlencoded' },
        payload: new URLSearchParams({
          token: access,
          token_type_hint: 'access_token',
          client_id: clientId,
        }).toString(),
      });
    expect((await listTools()).statusCode).toBe(200);

    // Another registered app can't end this one's grant with a token it got hold of.
    await authorize(randomBytes(32).toString('base64url'), {
      id: OTHER_ID,
      redirect: OTHER_REDIRECT,
    });
    await revoke(OTHER_ID);
    expect((await listTools()).statusCode).toBe(200);

    const res = await revoke(CLIENT_ID);
    expect(res.statusCode, res.body).toBe(200);
    expect((await listTools()).statusCode).toBe(401);
    const tokens = ok(await call(t, '/api/v1/tokens?kind=oauth', { as: louis }));
    const live = (tokens.items as Json[]).filter((x) => x.revokedAt === null);
    expect(live).toEqual([]);
    // The app asks for consent again: Better Auth's side of the grant is gone too.
    const consents = await own(
      db,
      'SELECT 1 FROM auth.oauth_consent WHERE user_id = $1 AND client_id = $2',
      [louis.userId, CLIENT_ID],
    );
    expect(consents).toHaveLength(0);
    // …and so is its refresh token (#411): the app can't renew what it revoked.
    const refresh = await own(
      db,
      'SELECT 1 FROM auth.oauth_refresh_token WHERE user_id = $1 AND client_id = $2',
      [louis.userId, CLIENT_ID],
    );
    expect(refresh).toHaveLength(0);
  });

  it('records a refusal and sends the client back without a code', async () => {
    const verifier = randomBytes(32).toString('base64url');
    const query = await authorize(verifier);
    const decided = ok(
      await call(t, `/api/v1/oauth/consent?${query}`, {
        as: louis,
        body: { accept: false, scope: 'read', locationIds: [] },
      }),
    );
    expect(new URL(decided.redirectTo as string).searchParams.get('code')).toBeNull();
    const events = await own(db, `SELECT 1 FROM public.audit_events WHERE action = 'oauth.deny'`);
    expect(events).toHaveLength(1);
  });

  it('refuses a consent whose posted client is not the one its signed request names', async () => {
    // Both clients are registered; the signed request is the first one's.
    await authorize(randomBytes(32).toString('base64url'), {
      id: OTHER_ID,
      redirect: OTHER_REDIRECT,
    });
    const query = await authorize(randomBytes(32).toString('base64url'));
    const pools = db.pools;
    const consent = (oauthQuery: string, clientId: string) =>
      withScope(pools.app, { userId: louis.userId, mfa: false }, (tx, client) =>
        decide(
          {
            tx,
            client,
            scope: { userId: louis.userId, mfa: false },
            requestId: 'consent-mismatch',
            auth: t.auth as never,
            authPool: pools.auth,
            publicUrl: t.publicUrl,
            headers: new Headers({ cookie: louis.cookie }),
          },
          oauthQuery,
          clientId,
          { accept: true, scope: 'write', locationIds: [home.id] },
        ),
      );
    await expect(consent(query, OTHER_ID)).rejects.toMatchObject({ code: 'validation' });
    // A query naming the client twice is refused too, whichever one is posted.
    await expect(
      consent(`${query}&client_id=${encodeURIComponent(OTHER_ID)}`, CLIENT_ID),
    ).rejects.toMatchObject({ code: 'validation' });
    const grants = await own(
      db,
      `SELECT 1 FROM public.audit_events WHERE action = 'oauth.grant' AND actor_id = $1
          AND diff::text LIKE '%' || $2 || '%'`,
      [louis.userId, 'write'],
    );
    expect(grants).toHaveLength(0);
  });

  it('refuses an access token signed here for another resource, and accepts the same claims for /mcp', async () => {
    const verifier = randomBytes(32).toString('base64url');
    const query = await authorize(verifier);
    const decided = ok(
      await call(t, `/api/v1/oauth/consent?${query}`, {
        as: louis,
        body: { accept: true, scope: 'read', locationIds: [home.id] },
      }),
    );
    const access = await redeem(decided.redirectTo as string, verifier);
    const claims = JSON.parse(
      Buffer.from(access.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    expect(claims.aud).toBe(`${t.publicUrl}/mcp`);
    // Re-signed with this instance's own key: only the audience differs between the two.
    const sign = t.auth.api as unknown as {
      signJWT: (o: { body: { payload: Record<string, unknown> } }) => Promise<{ token: string }>;
    };
    const resigned = async (aud: string) =>
      (await sign.signJWT({ body: { payload: { ...claims, aud } } })).token;
    const listTools = (bearer: string) =>
      t.app.inject({
        method: 'POST',
        url: '/mcp',
        headers: {
          host: host(),
          authorization: `Bearer ${bearer}`,
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
      });
    expect((await listTools(await resigned(`${t.publicUrl}/mcp`))).statusCode).toBe(200);
    for (const aud of ['https://other.example/mcp', t.publicUrl, `${t.publicUrl}/api/v1`]) {
      const res = await listTools(await resigned(aud));
      expect(res.statusCode, aud).toBe(401);
      expect(String(res.headers['www-authenticate']), aud).toContain('invalid_token');
    }
  });

  it('gives a connector that may refresh a refresh token, which renews access until revoked (#411)', async () => {
    const connector = { id: CONNECTOR_ID, redirect: CONNECTOR_REDIRECT };
    const verifier = randomBytes(32).toString('base64url');
    // The connector asks for Kept's own scopes only, as Claude.ai does.
    const query = await authorize(verifier, connector);
    expect(new URLSearchParams(query).get('scope')?.split(' ')).toContain('offline_access');
    const decided = ok(
      await call(t, `/api/v1/oauth/consent?${query}`, {
        as: louis,
        body: { accept: true, scope: 'read', locationIds: [home.id] },
      }),
    );
    const first = await redeemTokens(decided.redirectTo as string, verifier, connector);
    expect(first.refresh_token).toBeTruthy();
    // The scope stays what the person chose: read was granted, write was not.
    expect(first.scope?.split(' ')).not.toContain('kept:write');
    expect((await listToolsWith(first.access_token)).statusCode).toBe(200);

    const refreshed = await tokenEndpoint({
      grant_type: 'refresh_token',
      refresh_token: first.refresh_token as string,
      client_id: CONNECTOR_ID,
    });
    expect(refreshed.statusCode, refreshed.body).toBe(200);
    const second = refreshed.json() as TokenResponse;
    expect(second.access_token).toBeTruthy();
    expect(second.refresh_token).toBeTruthy();
    const client = await mcpClient(second.access_token);
    const tools = (await client.listTools()).tools.map((x) => x.name);
    expect(tools).toContain('where_is');
    expect(tools).not.toContain('create_place');

    // Revoking in Connections ends the refresh too, not only the access token in hand.
    const tokens = ok(await call(t, '/api/v1/tokens?kind=oauth', { as: louis }));
    const grant = (tokens.items as Json[]).find(
      (x) => x.clientName === 'Gordon’s assistant' && x.revokedAt === null,
    ) as Json;
    expect(
      (await call(t, `/api/v1/tokens/${grant.id}`, { as: louis, method: 'DELETE' })).statusCode,
    ).toBe(204);
    const again = await tokenEndpoint({
      grant_type: 'refresh_token',
      refresh_token: second.refresh_token as string,
      client_id: CONNECTOR_ID,
    });
    expect(again.statusCode, again.body).toBe(400);
    expect((again.json() as { error?: string }).error).toBe('invalid_grant');
    expect((await listToolsWith(second.access_token)).statusCode).toBe(401);
    const left = await own(
      db,
      'SELECT 1 FROM auth.oauth_refresh_token WHERE user_id = $1 AND client_id = $2',
      [louis.userId, CONNECTOR_ID],
    );
    expect(left).toHaveLength(0);
  });

  it('starts a new refresh token lineage with every consent, so an orphaned one never comes back', async () => {
    // A grant can end without Better Auth's refresh token going with it (an account claim
    // revokes Kept's tokens only, D197). The next consent for that client must not revive it.
    const connector = { id: CONNECTOR_ID, redirect: CONNECTOR_REDIRECT };
    const consentOnce = async () => {
      const verifier = randomBytes(32).toString('base64url');
      const query = await authorize(verifier, connector);
      const decided = ok(
        await call(t, `/api/v1/oauth/consent?${query}`, {
          as: louis,
          body: { accept: true, scope: 'read', locationIds: [home.id] },
        }),
      );
      return redeemTokens(decided.redirectTo as string, verifier, connector);
    };
    const orphan = await consentOnce();
    await db.pools.system.query("SELECT kept.revoke_user_tokens($1, 'account_claimed')", [
      louis.userId,
    ]);
    expect((await listToolsWith(orphan.access_token)).statusCode).toBe(401);

    const fresh = await consentOnce();
    expect((await listToolsWith(fresh.access_token)).statusCode).toBe(200);
    const revived = await tokenEndpoint({
      grant_type: 'refresh_token',
      refresh_token: orphan.refresh_token as string,
      client_id: CONNECTOR_ID,
    });
    expect(revived.statusCode, revived.body).toBe(400);
    expect((revived.json() as { error?: string }).error).toBe('invalid_grant');
    // The new lineage still works.
    const renewed = await tokenEndpoint({
      grant_type: 'refresh_token',
      refresh_token: fresh.refresh_token as string,
      client_id: CONNECTOR_ID,
    });
    expect(renewed.statusCode, renewed.body).toBe(200);
  });

  it('gives a refresh token to a connector whose metadata declares its scopes', async () => {
    const declared = { id: DECLARED_ID, redirect: DECLARED_REDIRECT };
    const verifier = randomBytes(32).toString('base64url');
    const query = await authorize(verifier, declared);
    const decided = ok(
      await call(t, `/api/v1/oauth/consent?${query}`, {
        as: louis,
        body: { accept: true, scope: 'read', locationIds: [home.id] },
      }),
    );
    const tokens = await redeemTokens(decided.redirectTo as string, verifier, declared);
    const stored = await own<{ scopes: unknown }>(
      db,
      'SELECT scopes FROM auth.oauth_client WHERE client_id = $1',
      [DECLARED_ID],
    );
    // Its declared scopes are what Better Auth validates the request against.
    expect(stored[0]?.scopes).toEqual(expect.arrayContaining(['kept:read', 'offline_access']));
    expect(tokens.refresh_token).toBeTruthy();
    expect((await listToolsWith(tokens.access_token)).statusCode).toBe(200);
  });
});

describe('the CIMD transport (cimd-fetch.ts)', () => {
  it('refuses a client id whose name resolves to a private address, and logs why', async () => {
    const warned: object[] = [];
    const fetcher = cimdFetch({
      log: { warn: (obj) => warned.push(obj) },
      resolve: (_host, cb) => cb(null, [{ address: '10.0.0.5', family: 4 }]),
    });
    await expect(fetcher('https://client.example/oauth/x.json', {})).rejects.toThrow();
    expect(JSON.stringify(warned)).toContain('https://client.example/oauth/x.json');
    const loopback = cimdFetch({
      resolve: (_host, cb) => cb(null, [{ address: '127.0.0.1', family: 4 }]),
    });
    await expect(loopback('https://client.example/oauth/x.json', {})).rejects.toThrow();
  });
});
