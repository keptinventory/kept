import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { jar, setCookies, type TestApp, testApp } from '../../test/app.js';
import { signUp } from '../../test/auth.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, freshIp, PASSWORD, person } from '../../test/people.js';
import { asOwner, ownerTx } from '../../test/tenancy.js';
import { AUTH_BASE_PATH } from '../auth/auth.js';
import { ensureSetupCode } from '../setup/setup-code.js';
import { requireHttps } from './https-only.js';
import { HA_CORE_ADDRESS, HA_SUPERVISOR_ADDRESS } from './ingress.js';
import { loadWebBundle, type WebBundle } from './web.js';

// Home Assistant ingress through the front door (D273): an ingress request is served under its
// prefix, framed only by Home Assistant's own page, checked against Home Assistant's origin, and its
// cookies scoped to the prefix. Outside app mode (every install that isn't the Home Assistant app),
// and in app mode on the port, every one of these stays exactly as it was.

const TOKEN = 'Xy7_dT9-kLmN0pQrStUvWxYz0123456789abcdEFGH';
const PREFIX = `/api/hassio_ingress/${TOKEN}`;
const HA = 'http://homeassistant.local:8123';
const HA_HTTPS = 'https://ha.example.org';
// As the app's start script sets it: the Supervisor only; Core is a hop behind it (proxiesFor).
const PROXIES = [HA_SUPERVISOR_ADDRESS];

const INDEX = `<!doctype html>
<html lang="en"><head>
    <base href="/" />
    <link rel="icon" href="./favicon.svg" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <script>document.documentElement.dataset.x = '1';</script>
    <script type="module" crossorigin src="./assets/index-abc123.js"></script>
</head><body><div id="root"></div></body></html>
`;

let dir: string;
let web: WebBundle;
let db: TestDb;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'kept-ingress-'));
  await mkdir(path.join(dir, 'assets'));
  await writeFile(path.join(dir, 'index.html'), INDEX);
  await writeFile(path.join(dir, 'assets', 'index-abc123.js'), 'console.log(1);\n');
  web = (await loadWebBundle(dir)) as WebBundle;
  db = await testDb();
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Headers as the Supervisor sends them (Core's forwarded host and proto, the ingress path). */
function viaIngress(
  extra: Record<string, string> = {},
  user: { id: string; groups: string } | null = null,
  ha = HA,
): Record<string, string> {
  const u = new URL(ha);
  return {
    'x-ingress-path': PREFIX,
    'x-hass-source': 'core.ingress',
    'x-forwarded-host': u.host,
    'x-forwarded-proto': u.protocol.replace(':', ''),
    'x-forwarded-for': `${freshIp()}, ${HA_CORE_ADDRESS}`,
    ...(user
      ? {
          'x-remote-user-id': user.id,
          'x-remote-user-name': 'ha-person',
          'x-remote-user-groups': user.groups,
        }
      : {}),
    ...extra,
  };
}

const CSRF_HINT = 'The request did not come from this site.';

const ADMIN = { id: 'a1b2c3d4e5f6', groups: 'system-admin,system-users' };
const MEMBER = { id: 'f6e5d4c3b2a1', groups: 'system-users' };

function cspOf(res: LightMyRequestResponse): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const part of String(res.headers['content-security-policy'] ?? '').split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) out.set(name, sources);
  }
  return out;
}

/** A request from the Supervisor's address (an ingress request when its headers are right). */
const fromSupervisor = (t: TestApp, opts: InjectOptions) =>
  t.app.inject({ remoteAddress: HA_SUPERVISOR_ADDRESS, ...opts });

async function signedUpEmail(t: TestApp): Promise<string> {
  const email = `ingress-${randomUUID()}@example.com`;
  await signUp(t.auth, email, PASSWORD);
  return email;
}

function signIn(t: TestApp, email: string, headers: Record<string, string>, remote: string) {
  return t.app.inject({
    method: 'POST',
    url: `${AUTH_BASE_PATH}/sign-in/email`,
    headers,
    remoteAddress: remote,
    payload: { email, password: PASSWORD },
  });
}

/** The behaviour every non-ingress request keeps: base `/`, the manifest, no framing, cookies on `/`. */
async function expectUnchanged(t: TestApp, remote: string, headers: Record<string, string>) {
  const page = await t.app.inject({ url: '/things/abc', headers, remoteAddress: remote });
  expect(page.statusCode).toBe(200);
  expect(page.body).toBe(INDEX);
  expect(cspOf(page).get('frame-ancestors')).toEqual(["'none'"]);

  const email = await signedUpEmail(t);
  const fromHa = await signIn(t, email, { ...headers, origin: HA }, remote);
  expect(fromHa.statusCode).toBe(403);
  expect(fromHa.json()).toMatchObject({ code: 'origin_mismatch' });

  const ok = await signIn(t, email, { ...headers, origin: t.publicUrl }, remote);
  expect(ok.statusCode).toBe(200);
  const cookies = setCookies(ok);
  expect(cookies.length).toBeGreaterThan(0);
  for (const c of cookies) expect(c).toMatch(/; Path=\/(;|$)/);

  const share = await t.app.inject({
    method: 'POST',
    url: '/share',
    headers,
    remoteAddress: remote,
  });
  expect(share.headers.location).toBe('/capture?share=unavailable');
}

describe('outside app mode (KEPT_HA unset): ingress headers change nothing', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await testApp(db, { authOriginCheck: true, web, trustedProxies: PROXIES });
  });
  afterAll(() => t.app.close());

  it('serves the page, framing, origin and cookies as always, even from 172.30.32.2', async () => {
    await expectUnchanged(t, HA_SUPERVISOR_ADDRESS, viaIngress({}, ADMIN));
  });

  it('says nothing about Home Assistant at /api/v1/setup', async () => {
    const res = await fromSupervisor(t, { url: '/api/v1/setup', headers: viaIngress({}, ADMIN) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).not.toHaveProperty('homeAssistant');
  });
});

describe('app mode (KEPT_HA=1) on the port: unchanged too', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await testApp(db, { authOriginCheck: true, web, appMode: true, trustedProxies: PROXIES });
  });
  afterAll(() => t.app.close());

  it('is not ingress from any other address, whatever the headers say', async () => {
    await expectUnchanged(t, '192.168.1.20', viaIngress({}, ADMIN));
    await expectUnchanged(t, HA_CORE_ADDRESS, viaIngress({}, ADMIN));
  });

  it('is not ingress with a malformed X-Ingress-Path, even from the Supervisor', async () => {
    await expectUnchanged(
      t,
      HA_SUPERVISOR_ADDRESS,
      // Not ingress, so Core isn't skipped as a hop: a client address of its own per request,
      // or every sign-in here would share Core's.
      viaIngress(
        { 'x-ingress-path': '/api/hassio_ingress/../../evil', 'x-forwarded-for': freshIp() },
        ADMIN,
      ),
    );
  });
});

describe('app mode, through ingress', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await testApp(db, {
      authOriginCheck: true,
      web,
      appMode: true,
      trustedProxies: PROXIES,
      publicUrl: 'http://homeassistant.local:8080',
      routes: (app) => {
        app.get(
          '/test/https-only',
          { config: { auth: 'none' }, preHandler: requireHttps(app.env.KEPT_PUBLIC_URL) },
          async () => ({ ok: true }),
        );
      },
    });
  });
  afterAll(() => t.app.close());

  it('serves the page under the prefix, with no manifest and the public address named', async () => {
    const res = await fromSupervisor(t, { url: '/things/abc', headers: viaIngress() });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain(`<base href="${PREFIX}/" />`);
    expect(res.body).not.toContain('<base href="/"');
    expect(res.body).not.toContain('rel="manifest"');
    expect(res.body).toContain('<meta name="kept-ingress" content="1" />');
    expect(res.body).toContain(
      '<meta name="kept-public-url" content="http://homeassistant.local:8080" />',
    );
    // The inline script is untouched, so its CSP hash still matches.
    expect(res.body).toContain("<script>document.documentElement.dataset.x = '1';</script>");
    expect(res.headers['cache-control']).toBe('no-store');
    const root = await fromSupervisor(t, { url: '/', headers: viaIngress() });
    expect(root.body).toContain(`<base href="${PREFIX}/" />`);
  });

  it('may be framed by Home Assistant’s own page (same origin) and nothing else', async () => {
    const page = await fromSupervisor(t, { url: '/', headers: viaIngress() });
    expect(cspOf(page).get('frame-ancestors')).toEqual(["'self'"]);
    const api = await fromSupervisor(t, { url: '/api/v1/setup', headers: viaIngress() });
    expect(cspOf(api).get('frame-ancestors')).toEqual(["'self'"]);
    // The rest of the policy is the port's.
    expect(cspOf(page).get('default-src')).toEqual(["'self'"]);
    const port = await t.app.inject({ url: '/', remoteAddress: freshIp() });
    expect(cspOf(port).get('frame-ancestors')).toEqual(["'none'"]);
    expect(port.body).toBe(INDEX);
  });

  it('signs in with Home Assistant’s Origin, the cookie scoped to the prefix', async () => {
    const email = await signedUpEmail(t);
    const res = await signIn(t, email, { ...viaIngress(), origin: HA }, HA_SUPERVISOR_ADDRESS);
    expect(res.statusCode).toBe(200);
    const cookies = setCookies(res);
    expect(cookies.length).toBeGreaterThan(0);
    for (const c of cookies) {
      expect(c).toContain(`; Path=${PREFIX}/`);
      expect(c).not.toMatch(/; Path=\/(;|$)/);
    }
    // Another site's sign-in is refused, naming Home Assistant's address.
    const wrong = await signIn(
      t,
      email,
      { ...viaIngress(), origin: 'https://evil.example' },
      HA_SUPERVISOR_ADDRESS,
    );
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json()).toMatchObject({ code: 'origin_mismatch', expectedOrigin: HA });
  });

  it('checks cookie-bearing writes against Home Assistant’s origin', async () => {
    const email = await signedUpEmail(t);
    const cookie = jar(
      await signIn(t, email, { ...viaIngress(), origin: HA }, HA_SUPERVISOR_ADDRESS),
    );
    const write = (origin: string) =>
      fromSupervisor(t, {
        method: 'POST',
        url: '/api/v1/me/email-change',
        headers: { ...viaIngress(), origin, cookie },
        payload: { newEmail: `moved-${randomUUID()}@example.com` },
      });
    const fromHa = await write(HA);
    expect((fromHa.json() as { hint?: string }).hint).not.toBe(CSRF_HINT);
    const elsewhere = await write('https://evil.example');
    expect(elsewhere.statusCode).toBe(403);
    expect(elsewhere.json()).toMatchObject({
      code: 'origin_mismatch',
      hint: CSRF_HINT,
      expectedOrigin: HA,
    });
    // The port's own address is not where this page is: refused too.
    expect((await write(t.publicUrl)).json()).toMatchObject({ code: 'origin_mismatch' });
  });

  it('marks the cookie Secure when Home Assistant is https', async () => {
    const email = await signedUpEmail(t);
    const res = await signIn(
      t,
      email,
      { ...viaIngress({}, null, HA_HTTPS), origin: HA_HTTPS },
      HA_SUPERVISOR_ADDRESS,
    );
    expect(res.statusCode).toBe(200);
    for (const c of setCookies(res)) expect(c).toMatch(/; Secure(;|$)/);
  });

  it('counts as https only when Home Assistant is (Q4)', async () => {
    const http = await fromSupervisor(t, { url: '/test/https-only', headers: viaIngress() });
    expect(http.statusCode).toBe(403);
    expect(http.json()).toMatchObject({ code: 'https_required' });
    const https = await fromSupervisor(t, {
      url: '/test/https-only',
      headers: viaIngress({}, null, HA_HTTPS),
    });
    expect(https.statusCode).toBe(200);
    // The port keeps KEPT_PUBLIC_URL's rule (http here).
    const port = await t.app.inject({ url: '/test/https-only', remoteAddress: freshIp() });
    expect(port.statusCode).toBe(403);
  });

  it('sends a share that reached the server back under the prefix', async () => {
    const res = await fromSupervisor(t, { method: 'POST', url: '/share', headers: viaIngress() });
    expect(res.statusCode).toBe(303);
    expect(res.headers.location).toBe(`${PREFIX}/capture?share=unavailable`);
  });
});

describe('first-run setup in app mode (§8.4)', () => {
  let t: TestApp;
  let code: string;
  beforeEach(async () => {
    await db.reset();
    // The start script sets KEPT_HA_TRUST_GROUPS only on a Supervisor that sets the groups header.
    t = await testApp(db, {
      authOriginCheck: true,
      web,
      appMode: true,
      haTrustGroups: true,
      trustedProxies: PROXIES,
    });
    code = (await ensureSetupCode(db.pools.system)) as string;
    expect(code).toBeTruthy();
  });

  const account = (extra: Record<string, unknown> = {}) => ({
    email: `first-${randomUUID()}@example.com`,
    password: PASSWORD,
    displayName: 'First',
    ...extra,
  });

  const setup = (headers: Record<string, string>, body: object, remote = HA_SUPERVISOR_ADDRESS) =>
    t.app.inject({
      method: 'POST',
      url: '/api/v1/setup',
      headers,
      remoteAddress: remote,
      payload: body,
    });

  it('says it is the Home Assistant app, and that the code is needed, on the port', async () => {
    const res = await t.app.inject({ url: '/api/v1/setup', remoteAddress: freshIp() });
    expect(res.json()).toMatchObject({ needed: true, homeAssistant: { codeNeeded: true } });
  });

  it('needs no code for a Home Assistant administrator through ingress', async () => {
    const status = await fromSupervisor(t, {
      url: '/api/v1/setup',
      headers: viaIngress({}, ADMIN),
    });
    expect(status.json()).toMatchObject({ needed: true, homeAssistant: { codeNeeded: false } });

    const res = await setup({ ...viaIngress({}, ADMIN), origin: HA }, account());
    expect(res.statusCode).toBe(201);
    const { userId } = res.json() as { userId: string };
    for (const c of setCookies(res)) expect(c).toContain(`; Path=${PREFIX}/`);
    const audit = await asOwner(db, (c) =>
      c.query(
        `SELECT actor_id, action, diff FROM public.audit_events WHERE action = 'instance.setup'`,
      ),
    );
    expect(audit.rows).toEqual([
      {
        actor_id: userId,
        action: 'instance.setup',
        diff: {
          instance_admin: { before: null, after: true, class: 'plain' },
          via_home_assistant: { before: null, after: { user_id: ADMIN.id }, class: 'plain' },
        },
      },
    ]);
  });

  it('still needs the code for anyone else', async () => {
    const member = await fromSupervisor(t, {
      url: '/api/v1/setup',
      headers: viaIngress({}, MEMBER),
    });
    expect(member.json()).toMatchObject({ homeAssistant: { codeNeeded: true } });
    expect((await setup({ ...viaIngress({}, MEMBER), origin: HA }, account())).statusCode).toBe(
      400,
    );
    // No Home Assistant user at all.
    expect((await setup({ ...viaIngress(), origin: HA }, account())).statusCode).toBe(400);
    // The port, with the admin's headers but not from the Supervisor.
    expect(
      (await setup({ ...viaIngress({}, ADMIN), origin: t.publicUrl }, account(), freshIp()))
        .statusCode,
    ).toBe(400);
    // And the code still works for them.
    const withCode = await setup({ ...viaIngress({}, MEMBER), origin: HA }, account({ code }));
    expect(withCode.statusCode).toBe(201);
  });

  it('refuses a setup through ingress from another origin', async () => {
    const res = await setup(
      { ...viaIngress({}, ADMIN), origin: 'https://evil.example' },
      account(),
    );
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'origin_mismatch' });
  });
});

describe('first-run setup on a Supervisor older than 2026.10.4 (no KEPT_HA_TRUST_GROUPS)', () => {
  it("needs the code even for 'system-admin': that Supervisor passes a client's groups header on", async () => {
    await db.reset();
    const t = await testApp(db, { web, appMode: true, trustedProxies: PROXIES });
    try {
      await ensureSetupCode(db.pools.system);
      const status = await fromSupervisor(t, {
        url: '/api/v1/setup',
        headers: viaIngress({}, ADMIN),
      });
      expect(status.json()).toMatchObject({ needed: true, homeAssistant: { codeNeeded: true } });
      const res = await fromSupervisor(t, {
        method: 'POST',
        url: '/api/v1/setup',
        headers: { ...viaIngress({}, ADMIN), origin: HA },
        payload: {
          email: `first-${randomUUID()}@example.com`,
          password: PASSWORD,
          displayName: 'F',
        },
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await t.app.close();
    }
  });
});

describe('Kept on https, Home Assistant on plain http (ingress)', () => {
  it('signs in with plain cookies on the prefix, and reads them back', async () => {
    const t = await testApp(db, {
      authOriginCheck: true,
      web,
      appMode: true,
      trustedProxies: PROXIES,
      publicUrl: 'https://kept.example.org',
    });
    try {
      const email = await signedUpEmail(t);
      const res = await signIn(t, email, { ...viaIngress(), origin: HA }, HA_SUPERVISOR_ADDRESS);
      expect(res.statusCode).toBe(200);
      const cookies = setCookies(res);
      expect(cookies.length).toBeGreaterThan(0);
      for (const c of cookies) {
        expect(c).not.toMatch(/; Secure(;|$)/);
        expect(c).not.toMatch(/^__(Secure|Host)-/);
        expect(c).toContain(`; Path=${PREFIX}/`);
      }
      const me = await fromSupervisor(t, {
        url: '/api/v1/me',
        headers: { ...viaIngress(), cookie: jar(res) },
      });
      expect(me.statusCode).toBe(200);
      // On the port, the same server keeps its __Secure- cookies.
      const port = await signIn(t, email, { origin: t.publicUrl }, freshIp());
      for (const c of setCookies(port)) expect(c).toMatch(/^__Secure-/);
    } finally {
      await t.app.close();
    }
  });
});

describe('Admin → Status in app mode', () => {
  it('says Kept runs as a Home Assistant app; other installs say nothing', async () => {
    await db.reset();
    for (const appMode of [true, false]) {
      const t = await testApp(db, { appMode });
      try {
        const admin = await person(t, db, `status-${appMode}`);
        await ownerTx(db, (c) =>
          c.query('INSERT INTO public.instance_admins (user_id) VALUES ($1)', [admin.userId]),
        );
        const res = await call(t, '/api/v1/admin/status', { as: admin });
        expect(res.statusCode).toBe(200);
        if (appMode) expect(res.json()).toMatchObject({ homeAssistant: true });
        else expect(res.json()).not.toHaveProperty('homeAssistant');
      } finally {
        await t.app.close();
      }
    }
  });
});
