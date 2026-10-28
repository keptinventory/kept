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
      expect(env(v), String(v)).not.toHaveProperty('KEPT_HA_TRUST_GROUPS');
    }
    expect(appEnv({ options: {}, info: null, self }).env).not.toHaveProperty(
      'KEPT_HA_TRUST_GROUPS',
    );
  });

  it('says so in the log when it stays off', () => {
    const { lines } = appEnv({ options: {}, info: { ...info, supervisor: '2026.10.3' }, self });
    expect(lines.join('\n')).toMatch(/2026\.10\.4/);
  });
});
