import { describe, expect, it } from 'vitest';
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
      'OIDC sign-in is on. Redirect URL to register: https://kept.example.org/api/v1/auth/callback/oidc',
    );
    expect(lines).toContain(
      'Google sign-in is on. Redirect URL to register: https://kept.example.org/api/v1/auth/callback/google',
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
