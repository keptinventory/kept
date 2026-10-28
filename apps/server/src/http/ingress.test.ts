import type { FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import { CLIENT_IP_HEADER } from '../auth/client-ip.js';
import { authHeaders } from '../auth/http.js';
import {
  HA_ADMIN_GROUP,
  HA_CORE_ADDRESS,
  HA_SUPERVISOR_ADDRESS,
  ingressCookieHeader,
  isHomeAssistantAdmin,
  readIngress,
  scopeCookieToIngress,
} from './ingress.js';

// D273: a request is a Home Assistant ingress request only when all of it holds: app mode (KEPT_HA),
// the socket peer is the Supervisor, X-Ingress-Path is well formed, and Core's forwarded host and
// proto are there. Anything else is an ordinary request, whatever headers it carries.

const TOKEN = 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789-_abcde';
const PREFIX = `/api/hassio_ingress/${TOKEN}`;

const headers = (extra: Record<string, string | string[] | undefined> = {}) => ({
  'x-ingress-path': PREFIX,
  'x-forwarded-host': 'homeassistant.local:8123',
  'x-forwarded-proto': 'http',
  ...extra,
});

const ingress = (
  over: Partial<Parameters<typeof readIngress>[0]> & {
    headers?: Record<string, string | string[] | undefined>;
  } = {},
) =>
  readIngress({
    appMode: true,
    remoteAddress: HA_SUPERVISOR_ADDRESS,
    ...over,
    headers: over.headers ?? headers(),
  });

describe('readIngress()', () => {
  it('reads the prefix, Home Assistant’s origin and whether it is https', () => {
    expect(ingress()).toEqual({
      prefix: PREFIX,
      origin: 'http://homeassistant.local:8123',
      secure: false,
      haUser: null,
    });
    expect(ingress({ headers: headers({ 'x-forwarded-proto': 'https' }) })).toMatchObject({
      origin: 'https://homeassistant.local:8123',
      secure: true,
    });
  });

  it('is null outside app mode, whatever the request carries', () => {
    expect(ingress({ appMode: false })).toBeNull();
  });

  it('is null unless the socket peer is the Supervisor (172.30.32.2)', () => {
    expect(ingress({ remoteAddress: '172.30.32.1' })).toBeNull();
    expect(ingress({ remoteAddress: '192.168.1.20' })).toBeNull();
    expect(ingress({ remoteAddress: undefined })).toBeNull();
    // IPv4-mapped IPv6, as a dual-stack socket reports it.
    expect(ingress({ remoteAddress: `::ffff:${HA_SUPERVISOR_ADDRESS}` })).not.toBeNull();
  });

  it('is null when X-Ingress-Path is missing or not an ingress path', () => {
    for (const bad of [
      undefined,
      '',
      '/api/hassio_ingress/',
      '/api/hassio_ingress/short',
      `${PREFIX}/`,
      `${PREFIX}/../x`,
      `/api/hassio_ingress/${TOKEN}?x=1`,
      `/elsewhere/${TOKEN}`,
      `//evil.example/api/hassio_ingress/${TOKEN}`,
      `/api/hassio_ingress/${'a'.repeat(65)}`,
      `/api/hassio_ingress/${TOKEN.slice(0, 20)}"><script>`,
      [PREFIX, PREFIX],
    ]) {
      expect(ingress({ headers: headers({ 'x-ingress-path': bad }) }), String(bad)).toBeNull();
    }
  });

  it('is null without a usable X-Forwarded-Host and X-Forwarded-Proto', () => {
    for (const extra of [
      { 'x-forwarded-host': undefined },
      { 'x-forwarded-proto': undefined },
      { 'x-forwarded-proto': 'ftp' },
      { 'x-forwarded-proto': 'https, http' },
      { 'x-forwarded-host': 'a.example, b.example' },
      { 'x-forwarded-host': 'evil.example/path' },
      { 'x-forwarded-host': 'user@evil.example' },
      { 'x-forwarded-host': '' },
    ]) {
      expect(ingress({ headers: headers(extra) }), JSON.stringify(extra)).toBeNull();
    }
  });

  it('accepts an IP or an [IPv6] host with a port', () => {
    expect(ingress({ headers: headers({ 'x-forwarded-host': '192.168.1.5:8123' }) })?.origin).toBe(
      'http://192.168.1.5:8123',
    );
    expect(ingress({ headers: headers({ 'x-forwarded-host': '[fd00::5]:8123' }) })?.origin).toBe(
      'http://[fd00::5]:8123',
    );
    expect(ingress({ headers: headers({ 'x-forwarded-host': 'HA.Example.org' }) })?.origin).toBe(
      'http://ha.example.org',
    );
  });

  it('reads who Home Assistant says is there, groups split on commas', () => {
    const ctx = ingress({
      headers: headers({
        'x-remote-user-id': 'abc123',
        'x-remote-user-name': 'ibrahim',
        'x-remote-user-display-name': 'Ibrahim',
        'x-remote-user-groups': 'system-admin, system-users',
      }),
    });
    expect(ctx?.haUser).toEqual({
      id: 'abc123',
      name: 'ibrahim',
      displayName: 'Ibrahim',
      groups: ['system-admin', 'system-users'],
    });
    expect(isHomeAssistantAdmin(ctx)).toBe(true);
  });

  it('counts only system-admin as a Home Assistant administrator', () => {
    const as = (groups: string | undefined) =>
      ingress({ headers: headers({ 'x-remote-user-id': 'u1', 'x-remote-user-groups': groups }) });
    expect(HA_ADMIN_GROUP).toBe('system-admin');
    expect(isHomeAssistantAdmin(as('system-users'))).toBe(false);
    expect(isHomeAssistantAdmin(as('system-administrators'))).toBe(false);
    expect(isHomeAssistantAdmin(as(undefined))).toBe(false);
    expect(isHomeAssistantAdmin(null)).toBe(false);
    // No user id: groups alone don't make anyone an administrator.
    expect(
      isHomeAssistantAdmin(
        ingress({ headers: headers({ 'x-remote-user-groups': 'system-admin' }) }),
      ),
    ).toBe(false);
  });
});

describe('scopeCookieToIngress()', () => {
  const ctx = { prefix: PREFIX, origin: 'http://ha.local:8123', secure: false, haUser: null };

  it('replaces the cookie’s Path with the prefix', () => {
    expect(
      scopeCookieToIngress('better-auth.session_token=x; Max-Age=43200; Path=/; HttpOnly', ctx),
    ).toBe(`better-auth.session_token=x; Max-Age=43200; Path=${PREFIX}/; HttpOnly`);
    expect(scopeCookieToIngress('a=b; path=/api; SameSite=Lax', ctx)).toBe(
      `a=b; Path=${PREFIX}/; SameSite=Lax`,
    );
  });

  it('adds a Path when the cookie has none, and Secure under https', () => {
    expect(scopeCookieToIngress('a=b; HttpOnly', ctx)).toBe(`a=b; HttpOnly; Path=${PREFIX}/`);
    expect(scopeCookieToIngress('a=b; Path=/', { ...ctx, secure: true })).toBe(
      `a=b; Path=${PREFIX}/; Secure`,
    );
    expect(scopeCookieToIngress('a=b; Path=/; Secure', { ...ctx, secure: true })).toBe(
      `a=b; Path=${PREFIX}/; Secure`,
    );
  });

  it('drops a Domain, so the cookie stays on Home Assistant’s host only', () => {
    expect(scopeCookieToIngress('a=b; Domain=example.org; Path=/', ctx)).toBe(
      `a=b; Path=${PREFIX}/`,
    );
  });
});

describe('scopeCookieToIngress() when Home Assistant is plain http', () => {
  const ctx = { prefix: PREFIX, origin: 'http://ha.local:8123', secure: false, haUser: null };

  it('drops Secure and the __Secure-/__Host- prefixes, which an http page would never get back', () => {
    expect(
      scopeCookieToIngress('__Secure-better-auth.session_token=x; Path=/; HttpOnly; Secure', ctx),
    ).toBe(`better-auth.session_token=x; Path=${PREFIX}/; HttpOnly`);
    expect(scopeCookieToIngress('__Host-a=b; Path=/; Secure', ctx)).toBe(`a=b; Path=${PREFIX}/`);
  });
});

describe('ingressCookieHeader()', () => {
  it('gives Better Auth its __Secure- names back when it uses secure cookies', () => {
    expect(
      ingressCookieHeader(
        'better-auth.session_token=x; other=1; better-auth.dont_remember=y',
        true,
      ),
    ).toBe('__Secure-better-auth.session_token=x; other=1; __Secure-better-auth.dont_remember=y');
  });

  it('leaves the header alone when Better Auth uses plain cookies, or names already prefixed', () => {
    expect(ingressCookieHeader('better-auth.session_token=x', false)).toBe(
      'better-auth.session_token=x',
    );
    expect(ingressCookieHeader('__Secure-better-auth.session_token=x', true)).toBe(
      '__Secure-better-auth.session_token=x',
    );
  });
});

describe('the client address behind ingress (KEPT_TRUSTED_PROXIES = the Supervisor only)', () => {
  const trusted = [HA_SUPERVISOR_ADDRESS];
  const request = (remoteAddress: string, xff: string, ingressCtx: unknown) =>
    ({
      headers: { 'x-forwarded-for': xff },
      socket: { remoteAddress },
      ingress: ingressCtx,
    }) as unknown as FastifyRequest;
  const ctx = { prefix: PREFIX, origin: 'http://ha.local:8123', secure: false, haUser: null };

  it("skips Core's hop behind the Supervisor: the client is the browser", () => {
    const h = authHeaders(
      request(HA_SUPERVISOR_ADDRESS, `198.51.100.7, ${HA_CORE_ADDRESS}`, ctx),
      trusted,
    );
    expect(h.get(CLIENT_IP_HEADER)).toBe('198.51.100.7');
  });

  it('never trusts Core as a direct peer', () => {
    const h = authHeaders(request(HA_CORE_ADDRESS, '198.51.100.7', null), trusted);
    expect(h.get(CLIENT_IP_HEADER)).toBe(HA_CORE_ADDRESS);
  });

  it("doesn't skip Core's address for a request that isn't ingress", () => {
    const h = authHeaders(
      request(HA_SUPERVISOR_ADDRESS, `198.51.100.7, ${HA_CORE_ADDRESS}`, null),
      trusted,
    );
    expect(h.get(CLIENT_IP_HEADER)).toBe(HA_CORE_ADDRESS);
  });
});
