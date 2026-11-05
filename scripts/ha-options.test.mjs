import { describe, expect, it } from 'vitest';
import { parseExtraAddresses } from '../apps/server/src/auth/addresses.ts';
import { appEnv, shellExports } from '../docker/ha/options.mjs';

// The Home Assistant app's options (homeassistant/kept/config.yaml `schema`) as Kept's environment,
// and the address Kept is told it has (D272, spec §5.4, §7). docker/ha/kept-ha-start sources what
// shellExports() prints.

const info = { hostname: 'homeassistant' };
const self = { network: { '8080/tcp': 8080 } };

describe('appEnv()', () => {
  it('derives the address from Home Assistant’s host name and the app’s host port', () => {
    const { env, lines } = appEnv({ options: { log_level: 'info' }, info, self });
    expect(env).toEqual({
      KEPT_PUBLIC_URL: 'http://homeassistant.local:8080',
      KEPT_HA_TRUST_GROUPS: '0',
      KEPT_LOG_LEVEL: 'info',
    });
    expect(lines).toContain(
      'Kept is at http://homeassistant.local:8080 (change it in Configuration: "Kept\'s address")',
    );
  });

  it('follows a changed host port', () => {
    const { env } = appEnv({ options: {}, info, self: { network: { '8080/tcp': 18480 } } });
    expect(env.KEPT_PUBLIC_URL).toBe('http://homeassistant.local:18480');
  });

  it('takes the address the person set, without a trailing slash', () => {
    const { env, lines } = appEnv({
      options: { public_url: 'https://kept.example.org/ ' },
      info,
      self,
    });
    expect(env.KEPT_PUBLIC_URL).toBe('https://kept.example.org');
    expect(lines[0]).toBe('Kept is at https://kept.example.org');
  });

  it('refuses an address with a path, which Kept does not support', () => {
    const { env, lines } = appEnv({
      options: { public_url: 'http://ha.local:8080/kept' },
      info,
      self,
    });
    expect(env.KEPT_PUBLIC_URL).toBe('http://homeassistant.local:8080');
    expect(lines.join('\n')).toMatch(/ignored/);
  });

  it('says so when the port is off, and still gives Kept an address', () => {
    const { env, lines } = appEnv({ options: {}, info, self: { network: { '8080/tcp': null } } });
    expect(env.KEPT_PUBLIC_URL).toBe('http://homeassistant.local:8080');
    expect(lines.join('\n')).toMatch(/port is off/);
  });

  it('falls back to homeassistant.local when the Supervisor could not be asked', () => {
    const { env } = appEnv({ options: {}, info: null, self: null });
    expect(env.KEPT_PUBLIC_URL).toBe('http://homeassistant.local:8080');
  });

  it('passes the log level, and nothing outside the list', () => {
    expect(appEnv({ options: { log_level: 'debug' }, info, self }).env.KEPT_LOG_LEVEL).toBe(
      'debug',
    );
    expect(appEnv({ options: { log_level: 'trace' }, info, self }).env.KEPT_LOG_LEVEL).toBe('info');
  });

  it('passes outgoing mail only when set', () => {
    const { env } = appEnv({
      options: {
        smtp_url: 'smtps://kept:secret@mail.example.org',
        smtp_from: 'Kept <kept@example.org>',
      },
      info,
      self,
    });
    expect(env.KEPT_SMTP_URL).toBe('smtps://kept:secret@mail.example.org');
    expect(env.KEPT_SMTP_FROM).toBe('Kept <kept@example.org>');
    expect(appEnv({ options: { smtp_url: '' }, info, self }).env).not.toHaveProperty(
      'KEPT_SMTP_URL',
    );
  });

  it('never names the mail password in a log line', () => {
    const { lines } = appEnv({
      options: { smtp_url: 'smtps://kept:secret@mail.example.org' },
      info,
      self,
    });
    expect(lines.join('\n')).not.toContain('secret');
  });

  it('serves https with Home Assistant’s certificate from /ssl when ssl is on', () => {
    const { env } = appEnv({ options: { ssl: true }, info, self });
    expect(env).toMatchObject({
      KEPT_PUBLIC_URL: 'https://homeassistant.local:8080',
      KEPT_TLS_CERT_FILE: '/ssl/fullchain.pem',
      KEPT_TLS_KEY_FILE: '/ssl/privkey.pem',
    });
    expect(
      appEnv({ options: { ssl: true, certfile: 'my.crt', keyfile: 'my.key' }, info, self }).env,
    ).toMatchObject({ KEPT_TLS_CERT_FILE: '/ssl/my.crt', KEPT_TLS_KEY_FILE: '/ssl/my.key' });
  });

  it('keeps the certificate files inside /ssl', () => {
    const { env, lines } = appEnv({
      options: { ssl: true, certfile: '../data/config/secrets.json', keyfile: 'privkey.pem' },
      info,
      self,
    });
    expect(env).not.toHaveProperty('KEPT_TLS_CERT_FILE');
    expect(env).not.toHaveProperty('KEPT_TLS_KEY_FILE');
    expect(env.KEPT_PUBLIC_URL).toBe('http://homeassistant.local:8080');
    expect(lines.join('\n')).toMatch(/certfile/);
  });
});

// The sign-in, sign-up and upload options, under Kept's own rules (apps/server/src/config/env.ts):
// what Kept would refuse at boot is left out and said in the Log tab, so the app still starts.
describe('sign-in, sign-up and uploads', () => {
  const run = (options) => appEnv({ options, info, self });
  const oidc = {
    oidc_issuer: 'https://id.example.org/realms/home',
    oidc_client_id: 'kept',
    oidc_client_secret: 'oidc-s3cret-value',
  };
  const google = {
    google_client_id: '123.apps.googleusercontent.com',
    google_client_secret: 'google-s3cret-value',
  };

  it('passes none of them when unset or empty', () => {
    const empty = {
      oidc_issuer: '',
      oidc_client_id: ' ',
      oidc_client_secret: '',
      oidc_name: '',
      oidc_autoprovision_domains: '',
      oidc_autoprovision_groups: '',
      oidc_groups_claim: '',
      oidc_scopes: '',
      google_client_id: '',
      google_client_secret: '',
    };
    for (const options of [{}, empty]) {
      const { env, lines } = run(options);
      expect(Object.keys(env).filter((k) => /OIDC|GOOGLE|SIGNUP|MAX_FILE/.test(k))).toEqual([]);
      expect(lines.join('\n')).not.toMatch(/OIDC|Google|sign-up|upload/i);
    }
  });

  it('turns OIDC on with the issuer and the client id, and passes its other options', () => {
    const { env } = run({
      ...oidc,
      oidc_name: ' Authentik ',
      oidc_autoprovision_domains: 'example.org, example.net',
      oidc_autoprovision_groups: 'kept-users',
      oidc_groups_claim: 'roles',
      oidc_scopes: 'openid email profile groups',
    });
    expect(env).toMatchObject({
      KEPT_OIDC_ISSUER: 'https://id.example.org/realms/home',
      KEPT_OIDC_CLIENT_ID: 'kept',
      KEPT_OIDC_CLIENT_SECRET: 'oidc-s3cret-value',
      KEPT_OIDC_NAME: 'Authentik',
      KEPT_OIDC_AUTOPROVISION_DOMAINS: 'example.org, example.net',
      KEPT_OIDC_AUTOPROVISION_GROUPS: 'kept-users',
      KEPT_OIDC_GROUPS_CLAIM: 'roles',
      KEPT_OIDC_SCOPES: 'openid email profile groups',
    });
  });

  it('a public client needs no secret', () => {
    const { env } = run({ oidc_issuer: oidc.oidc_issuer, oidc_client_id: 'kept' });
    expect(env.KEPT_OIDC_CLIENT_ID).toBe('kept');
    expect(env).not.toHaveProperty('KEPT_OIDC_CLIENT_SECRET');
  });

  it('names the redirect URL to register, on Kept’s own address', () => {
    const { lines } = appEnv({
      options: { ...oidc, ...google, public_url: 'https://kept.example.org' },
      info,
      self,
    });
    expect(lines).toContain(
      'OIDC sign-in is configured. Redirect URL to register: https://kept.example.org/api/v1/auth/callback/oidc',
    );
    expect(lines).toContain(
      'Google sign-in is configured. Redirect URL to register: https://kept.example.org/api/v1/auth/callback/google',
    );
  });

  it('leaves OIDC off, and says why, without the issuer or the client id', () => {
    for (const options of [
      { oidc_issuer: oidc.oidc_issuer, oidc_client_secret: 'x' },
      { oidc_client_id: 'kept', oidc_name: 'Authentik' },
    ]) {
      const { env, lines } = run(options);
      expect(Object.keys(env).filter((k) => k.startsWith('KEPT_OIDC_'))).toEqual([]);
      expect(lines.join('\n')).toMatch(/OIDC sign-in is off: it needs .*issuer.* and .*client id/);
    }
  });

  it('refuses an issuer that is not an http(s) URL', () => {
    const { env, lines } = run({ ...oidc, oidc_issuer: 'ftp://id.example.org' });
    expect(env).not.toHaveProperty('KEPT_OIDC_ISSUER');
    expect(env).not.toHaveProperty('KEPT_OIDC_CLIENT_ID');
    expect(lines.join('\n')).toMatch(/OIDC sign-in is off/);
  });

  it('refuses an issuer zod would refuse: http(s) and two slashes, or Kept would not boot', () => {
    for (const bad of ['http:foo', 'https:/id.example.org', 'HTTPS:id.example.org']) {
      const { env, lines } = run({ ...oidc, oidc_issuer: bad });
      expect(env, bad).not.toHaveProperty('KEPT_OIDC_ISSUER');
      expect(lines.join('\n')).toMatch(/OIDC sign-in is off/);
    }
    expect(run({ ...oidc, oidc_issuer: 'HTTPS://id.example.org' }).env.KEPT_OIDC_ISSUER).toBe(
      'HTTPS://id.example.org',
    );
  });

  it('warns that Google refuses a redirect URL on http, a .local name or an IP address', () => {
    const at = (public_url) => appEnv({ options: { ...google, public_url }, info, self }).lines;
    for (const url of [
      'http://kept.example.org',
      'https://homeassistant.local:8080',
      'https://192.168.1.20:8080',
      'https://[fd00::1]:8080',
    ]) {
      expect(at(url).join('\n'), url).toMatch(
        /Google refuses this redirect URL: .*https.*public domain name.*Kept's address/,
      );
    }
    // The derived address is http://homeassistant.local:8080: warned too.
    expect(run(google).lines.join('\n')).toMatch(/Google refuses this redirect URL/);
    expect(at('https://kept.example.org').join('\n')).not.toMatch(/Google refuses/);
    // Only when Google is on.
    expect(
      appEnv({ options: { public_url: 'http://x.local' }, info, self }).lines.join('\n'),
    ).not.toMatch(/Google/);
  });

  it('passes the Apprise API server, an http(s) URL, and never logs it', () => {
    const url = 'https://user:apprise-s3cret@apprise.example.org:8000';
    const { env, lines } = run({ apprise_url: ` ${url} ` });
    expect(env.KEPT_APPRISE_URL).toBe(url);
    expect(lines.join('\n')).not.toContain('apprise-s3cret');
    expect(run({ apprise_url: '' }).env).not.toHaveProperty('KEPT_APPRISE_URL');
    for (const bad of ['apprise.lan:8000', 'ftp://apprise.lan', 'http:apprise.lan']) {
      const out = run({ apprise_url: bad });
      expect(out.env, bad).not.toHaveProperty('KEPT_APPRISE_URL');
      expect(out.lines.join('\n')).toMatch(/Apprise server is ignored/);
      expect(out.lines.join('\n')).not.toContain(bad);
    }
  });

  it('drops a provider name over 60 characters, as Kept would refuse it', () => {
    const { env, lines } = run({ ...oidc, oidc_name: 'x'.repeat(61) });
    expect(env.KEPT_OIDC_ISSUER).toBe(oidc.oidc_issuer);
    expect(env).not.toHaveProperty('KEPT_OIDC_NAME');
    expect(lines.join('\n')).toMatch(/60/);
    expect(run({ ...oidc, oidc_name: 'x'.repeat(60) }).env.KEPT_OIDC_NAME).toHaveLength(60);
  });

  it('turns Google on only with the client id and the secret together', () => {
    expect(run(google).env).toMatchObject({
      KEPT_GOOGLE_CLIENT_ID: google.google_client_id,
      KEPT_GOOGLE_CLIENT_SECRET: google.google_client_secret,
    });
    for (const options of [
      { google_client_id: google.google_client_id },
      { google_client_secret: google.google_client_secret },
    ]) {
      const { env, lines } = run(options);
      expect(Object.keys(env).filter((k) => k.startsWith('KEPT_GOOGLE_'))).toEqual([]);
      expect(lines.join('\n')).toMatch(/Google sign-in is off: it needs .*client id and .*secret/);
    }
  });

  it('never names a client secret or the mail password in a log line, whatever else is wrong', () => {
    const secrets = ['oidc-s3cret-value', 'google-s3cret-value', 'mail-s3cret-value'];
    for (const options of [
      { ...oidc, ...google, smtp_url: 'smtps://kept:mail-s3cret-value@mail.example.org' },
      { oidc_client_secret: 'oidc-s3cret-value', google_client_secret: 'google-s3cret-value' },
      {
        ...oidc,
        oidc_issuer: 'not a url',
        google_client_id: '',
        ...{ google_client_secret: 'google-s3cret-value' },
      },
      { ...oidc, oidc_name: 'y'.repeat(70), public_url: 'http://bad/path' },
    ]) {
      const log = run(options).lines.join('\n');
      for (const secret of secrets) expect(log).not.toContain(secret);
    }
  });

  it('locks sign-up open or closed only when set', () => {
    expect(run({ signup_open: 'true' }).env.KEPT_SIGNUP_OPEN).toBe('true');
    expect(run({ signup_open: 'false' }).env.KEPT_SIGNUP_OPEN).toBe('false');
    expect(run({ signup_open: true }).env.KEPT_SIGNUP_OPEN).toBe('true');
    for (const value of [undefined, '', 'yes', 'unset']) {
      expect(run({ signup_open: value }).env, String(value)).not.toHaveProperty('KEPT_SIGNUP_OPEN');
    }
  });

  // #403: Kept's HSTS covers the host name on every port, Home Assistant's own 8123 included.
  it('turns HSTS off only when asked, and leaves Kept’s default otherwise', () => {
    expect(run({ hsts: 'off' }).env.KEPT_HSTS).toBe('off');
    expect(run({ hsts: false }).env.KEPT_HSTS).toBe('off');
    expect(run({ hsts: 'on' }).env.KEPT_HSTS).toBe('on');
    expect(run({ hsts: true }).env.KEPT_HSTS).toBe('on');
    for (const value of [undefined, '', 'maybe', 'OFF']) {
      expect(run({ hsts: value }).env, String(value)).not.toHaveProperty('KEPT_HSTS');
    }
  });

  // #404: Kept stops at startup on a bad value, so a bad option is left out and said in the Log tab.
  it('passes the sign-in length within Kept’s bounds, 1 to 30 days', () => {
    expect(run({ http_sign_in_days: 1 }).env.KEPT_HTTP_SIGN_IN_DAYS).toBe('1');
    expect(run({ http_sign_in_days: 7 }).env.KEPT_HTTP_SIGN_IN_DAYS).toBe('7');
    expect(run({ http_sign_in_days: 30 }).env.KEPT_HTTP_SIGN_IN_DAYS).toBe('30');
    for (const value of [undefined, null, '']) {
      const { env, lines } = run({ http_sign_in_days: value });
      expect(env, String(value)).not.toHaveProperty('KEPT_HTTP_SIGN_IN_DAYS');
      expect(lines.join('\n')).not.toContain('sign-in length');
    }
    for (const value of [0, 31, -1, 1.5, '7d']) {
      const { env, lines } = run({ http_sign_in_days: value });
      expect(env, String(value)).not.toHaveProperty('KEPT_HTTP_SIGN_IN_DAYS');
      expect(lines.join('\n')).toContain('The sign-in length is ignored');
    }
  });

  // #405: Kept stops at startup on a bad address or a mix of http and https.
  it('passes extra addresses as Kept reads them, and says what it left out', () => {
    expect(run({ extra_addresses: 'http://100.64.0.7:8080' }).env.KEPT_EXTRA_ADDRESSES).toBe(
      'http://100.64.0.7:8080',
    );
    const many = run({
      extra_addresses: ' HTTP://Kept-TS.lan:8080/ , http://a.lan,, http://a.lan',
    });
    expect(many.env.KEPT_EXTRA_ADDRESSES).toBe('http://kept-ts.lan:8080,http://a.lan');
    expect(many.lines.join('\n')).toContain(
      'Kept also answers at http://kept-ts.lan:8080, http://a.lan',
    );
    for (const value of [undefined, null, '', ' , ']) {
      const { env, lines } = run({ extra_addresses: value });
      expect(env, String(value)).not.toHaveProperty('KEPT_EXTRA_ADDRESSES');
      expect(lines.join('\n')).not.toContain('xtra address');
    }
    const some = run({ extra_addresses: 'http://*.lan,http://a.lan,http://b.lan/app' });
    expect(some.env.KEPT_EXTRA_ADDRESSES).toBe('http://a.lan');
    expect(some.lines.join('\n')).toContain('Extra address 1 is ignored');
    expect(some.lines.join('\n')).toContain('Extra address 3 is ignored');
    expect(some.lines.join('\n')).not.toContain('b.lan');
  });

  it('leaves out an address on another scheme than Kept’s, and Kept’s own', () => {
    const http = run({
      public_url: 'http://kept.lan:8080',
      extra_addresses: 'https://a.lan,http://kept.lan:8080,http://b.lan',
    });
    expect(http.env.KEPT_EXTRA_ADDRESSES).toBe('http://b.lan');
    expect(http.lines.join('\n')).toContain('Extra address 1 is ignored');
    const https = run({ public_url: 'https://kept.lan', extra_addresses: 'http://a.lan' });
    expect(https.env).not.toHaveProperty('KEPT_EXTRA_ADDRESSES');
    expect(https.lines.join('\n')).toContain('Extra address 1 is ignored');
  });

  it('never repeats a login in a log line', () => {
    const { env, lines } = run({ extra_addresses: 'http://alfred:hunter2@kept.lan' });
    expect(env).not.toHaveProperty('KEPT_EXTRA_ADDRESSES');
    expect(lines.join('\n')).toContain('Extra addresses are ignored: one has a login');
    expect(lines.join('\n')).not.toMatch(/alfred|hunter2/);
  });

  it.each([
    'http://alfred:pa,ss@kept.lan',
    // The part before the comma would be an address of its own.
    'http://alfred:80,ss@kept.lan',
    'http://a.lan,http://alfred:pa,ss@kept.lan',
    'http://alfred:80,ss＠kept.lan',
  ])('leaves out all of %j and prints none of it', (value) => {
    const { env, lines } = run({ extra_addresses: value });
    expect(env).not.toHaveProperty('KEPT_EXTRA_ADDRESSES');
    expect(lines.join('\n')).toContain('Extra addresses are ignored: one has a login');
    expect(lines.join('\n')).not.toMatch(/alfred|pa,ss|80,ss|a\.lan/);
  });

  it('prints no entry it leaves out, by its place only', () => {
    const { env, lines } = run({ extra_addresses: 'http://a.lan,http://alfred:hunter2' });
    expect(env.KEPT_EXTRA_ADDRESSES).toBe('http://a.lan');
    expect(lines.join('\n')).toContain('Extra address 2 is ignored');
    expect(lines.join('\n')).not.toMatch(/alfred|hunter2/);
  });

  it.each(['http://＊.example.com', 'http://﹡.example.com', 'https://＊.kept.lan'])(
    'leaves out %s, which IDNA would turn into a wildcard',
    (value) => {
      const { env, lines } = run({ public_url: 'http://other.lan', extra_addresses: value });
      expect(env).not.toHaveProperty('KEPT_EXTRA_ADDRESSES');
      expect(lines.join('\n')).toContain('Extra address 1 is ignored');
      expect(lines.join('\n')).not.toContain('*');
    },
  );

  it.each(['http://a，b.lan', 'http://a﹐b.lan', 'http://kept，evil.lan'])(
    'leaves out %s, which IDNA would turn into a comma and so two addresses',
    (value) => {
      const { env, lines } = run({ public_url: 'http://other.lan', extra_addresses: value });
      expect(env).not.toHaveProperty('KEPT_EXTRA_ADDRESSES');
      expect(lines.join('\n')).toContain('Extra address 1 is ignored');
      expect(lines.join('\n')).not.toContain('b.lan');
    },
  );

  // The app must never hand Kept what stops it at startup: the two readers agree, entry by entry.
  it('accepts exactly what Kept accepts', () => {
    for (const value of [
      'http://kept.lan',
      'http://kept.lan/',
      'HTTP://KEPT.LAN:8080',
      'http://kept.lan:80',
      'http://192.0.2.20:8080',
      'http://[2001:db8::1]:8080',
      'http://küche.lan',
      '*',
      'http://*.lan',
      'http://kept.*',
      'http://ke?t.lan',
      'http://＊.example.com',
      'http://﹡.example.com',
      'http://？.example.com',
      'http://﹖.example.com',
      'http://a，b.lan',
      'http://a﹐b.lan',
      'http://user@kept.lan',
      'http://user:pa,ss@kept.lan',
      'http://user:80,ss@kept.lan',
      'http://user:80,ss＠kept.lan',
      'http://kept.lan/app',
      'http://kept.lan//',
      'http://kept.lan/?',
      'http://kept.lan#top',
      'http://kept.lan\\',
      'http://kept.lan.',
      'http://kept.lan。',
      'kept.lan',
      'null',
      'ftp://kept.lan',
      'http:kept.lan',
      'http:/kept.lan',
      'http://',
      'http://kept lan',
      'http://ke%70t.lan',
      'http://kept.lan:99999',
      'http://[::1',
    ]) {
      let kept = null;
      try {
        kept = parseExtraAddresses(value).join(',');
      } catch {}
      const { env } = run({ public_url: 'http://other.lan', extra_addresses: value });
      expect(env.KEPT_EXTRA_ADDRESSES ?? null, value).toBe(kept);
    }
  });

  it('passes the upload limit within Kept’s bounds, 1 to 2048 MB', () => {
    expect(run({ max_file_mb: 100 }).env.KEPT_MAX_FILE_MB).toBe('100');
    expect(run({ max_file_mb: 1 }).env.KEPT_MAX_FILE_MB).toBe('1');
    expect(run({ max_file_mb: 2048 }).env.KEPT_MAX_FILE_MB).toBe('2048');
    for (const value of [0, 2049, 12.5, 'lots', -3]) {
      const { env, lines } = run({ max_file_mb: value });
      expect(env, String(value)).not.toHaveProperty('KEPT_MAX_FILE_MB');
      expect(lines.join('\n')).toMatch(/upload limit/);
    }
    expect(run({}).env).not.toHaveProperty('KEPT_MAX_FILE_MB');
  });
});

describe('shellExports()', () => {
  it('quotes every value for the shell, whatever it holds', () => {
    expect(shellExports({ A: 'it\'s $HOME `x` "q"', B: 'plain' })).toBe(
      "export A='it'\\''s $HOME `x` \"q\"'\nexport B='plain'\n",
    );
  });

  it('refuses a name that is not a variable name', () => {
    expect(() => shellExports({ 'A;rm': 'x' })).toThrow();
  });
});

// D273, review finding 3: the Supervisor removes a client's X-Remote-User-Groups and sets its own
// from 2026.10.4 (home-assistant/supervisor #7398). Setup without the code trusts that header, so
// it is on only from that version.
describe('setup without the code, by Supervisor version', () => {
  // `/info`'s `supervisor` (every app may read /info; /supervisor/info needs hassio_api).
  const env = (version) =>
    appEnv({ options: {}, info: { ...info, supervisor: version }, self }).env;

  it('is on from 2026.10.4', () => {
    for (const v of ['2026.10.4', '2026.10.5', '2026.11.0', '2027.1.0', '2026.10.5.dev2810']) {
      expect(env(v).KEPT_HA_TRUST_GROUPS, v).toBe('1');
    }
  });

  it('is off before it, and when the version is unknown', () => {
    for (const v of ['2026.10.3', '2026.9.9', '2025.12.0', 'dev', '', undefined]) {
      expect(env(v).KEPT_HA_TRUST_GROUPS, String(v)).toBe('0');
    }
    // Set to 0, not left out: a value the container was started with never gets through.
    expect(appEnv({ options: {}, info: null, self }).env.KEPT_HA_TRUST_GROUPS).toBe('0');
  });

  it('says so in the log when it stays off', () => {
    const { lines } = appEnv({ options: {}, info: { ...info, supervisor: '2026.10.3' }, self });
    expect(lines.join('\n')).toMatch(/2026\.10\.4/);
  });
});
