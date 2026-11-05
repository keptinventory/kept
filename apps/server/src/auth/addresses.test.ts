import { describe, expect, it } from 'vitest';
import {
  isExtraAddress,
  isMainAddressOnly,
  mixedSchemes,
  parseExtraAddresses,
  withoutMainAddress,
} from './addresses.js';

// KEPT_EXTRA_ADDRESSES (#405, D275): what a value is read as, once, at startup. Whatever comes out
// of here is compared whole against the browser's Origin, so each entry must come out as exactly
// what a browser would send, or stop startup.

describe('parseExtraAddresses', () => {
  it('reads nothing as nothing', () => {
    expect(parseExtraAddresses(undefined)).toEqual([]);
    expect(parseExtraAddresses('')).toEqual([]);
    expect(parseExtraAddresses('  ')).toEqual([]);
    expect(parseExtraAddresses(' , ,')).toEqual([]);
  });

  it('normalises each address to the origin a browser sends', () => {
    const cases: [string, string][] = [
      ['http://kept.lan', 'http://kept.lan'],
      ['http://kept.lan/', 'http://kept.lan'],
      ['HTTP://KEPT.LAN:8080', 'http://kept.lan:8080'],
      ['http://kept.lan:80', 'http://kept.lan'],
      ['https://kept.lan:443/', 'https://kept.lan'],
      ['https://kept.lan:80', 'https://kept.lan:80'],
      ['http://kept.lan:443', 'http://kept.lan:443'],
      ['http://192.0.2.20:8080', 'http://192.0.2.20:8080'],
      ['http://[2001:DB8::1]:8080', 'http://[2001:db8::1]:8080'],
      // A browser sends the punycode form, never the Unicode one.
      ['http://küche.lan:8080', 'http://xn--kche-0ra.lan:8080'],
      ['  http://kept.lan:8080  ', 'http://kept.lan:8080'],
    ];
    for (const [value, origin] of cases) {
      expect(parseExtraAddresses(value), value).toEqual([origin]);
    }
  });

  it('takes a comma list, and one address listed twice counts once', () => {
    expect(
      parseExtraAddresses(
        'http://kept.lan:8080, http://100.64.0.7:8080,,HTTP://kept.lan:8080/ ,http://kept.lan:8081',
      ),
    ).toEqual(['http://kept.lan:8080', 'http://100.64.0.7:8080', 'http://kept.lan:8081']);
  });

  it.each([
    ['*', 'wildcard'],
    ['http://*', 'wildcard'],
    ['http://*.lan', 'wildcard'],
    ['*.lan', 'wildcard'],
    ['http://kept.*', 'wildcard'],
    ['http://kept.lan:*', 'wildcard'],
    ['https://*.ts.net', 'wildcard'],
    ['http://ke?t.lan', 'wildcard'],
    // Forms IDNA maps to `*` while parsing, which Better Auth would then read as a wildcard.
    ['http://＊.example.com', 'wildcard'],
    ['http://﹡.example.com', 'wildcard'],
    ['https://＊.kept.lan:8443', 'wildcard'],
    ['http://？.example.com', 'valid'],
    ['http://﹖.example.com', 'valid'],
    // Forms IDNA maps to `,`: Better Auth and the env list both read that as two addresses.
    ['http://a，b.lan', 'valid'],
    ['http://a﹐b.lan', 'valid'],
    ['http://user@kept.lan', 'login'],
    ['http://user:secret@kept.lan', 'login'],
    ['http://kept.lan@evil.example', 'login'],
    ['http://kept.lan/app', 'path'],
    ['http://kept.lan//', 'path'],
    ['http://kept.lan/?a=1', 'path'],
    ['http://kept.lan/?', 'path'],
    ['http://kept.lan#top', 'path'],
    ['http://kept.lan\\', 'path'],
    ['http://kept.lan.', 'dot'],
    ['http://kept.lan.:8080', 'dot'],
    ['http://kept.lan。', 'dot'],
    ['kept.lan', 'http'],
    ['kept.lan:8080', 'http'],
    ['//kept.lan', 'http'],
    ['null', 'http'],
    ['ftp://kept.lan', 'http'],
    ['file:///etc/passwd', 'http'],
    ['chrome-extension://abc', 'http'],
    ['javascript:alert(1)', 'http'],
    ['http:kept.lan', 'http'],
    ['http:/kept.lan', 'http'],
    ['http:\\\\kept.lan', 'http'],
    ['http://', 'valid'],
    ['http://kept lan', 'valid'],
    ['http://kept\t.lan', 'valid'],
    ['http://ke%70t.lan', 'valid'],
    ['http://kept.lan:99999', 'valid'],
    ['http://[::1', 'valid'],
  ])('stops startup on %j (%s)', (value, word) => {
    expect(() => parseExtraAddresses(value)).toThrow(word);
    // One bad entry among good ones stops it too.
    expect(() => parseExtraAddresses(`http://kept.lan,${value}`)).toThrow(word);
  });

  it('never repeats a login in its message', () => {
    let message = '';
    try {
      parseExtraAddresses('http://alfred:hunter2@kept.lan');
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain('login');
    expect(message).not.toContain('alfred');
    expect(message).not.toContain('hunter2');
  });

  const messageOf = (value: string) => {
    try {
      parseExtraAddresses(value);
    } catch (err) {
      return (err as Error).message;
    }
    throw new Error(`${value} was accepted`);
  };

  it.each([
    'http://alfred:hun,ter2@kept.lan',
    // The part before the comma would be an address of its own: port 80 on a host named alfred.
    'http://alfred:80,ter2@kept.lan',
    'http://kept.lan,http://alfred:hun,ter2@kept.lan',
    // Forms IDNA maps to `@`.
    'http://alfred:hun,ter2＠kept.lan',
    'http://alfred:hun,ter2﹫kept.lan',
  ])('refuses all of %j without printing any of it', (value) => {
    const message = messageOf(value);
    expect(message).toContain('login');
    for (const word of ['alfred', 'hun', 'ter2', 'kept.lan']) expect(message).not.toContain(word);
  });

  it.each([
    'http://alfred:hunter2',
    'alfred:hunter2',
    'http://alfred:hunter2/',
    'http://alfred:hunter2/x',
    'http://*.alfred:hunter2',
    'http://alfred.hunter2.',
  ])('names the entry by its place, never its text: %j', (value) => {
    const message = messageOf(`http://kept.lan,${value}`);
    expect(message).toMatch(/^address 2: /);
    expect(message).not.toContain('alfred');
    expect(message).not.toContain('hunter2');
  });
});

describe('mixedSchemes', () => {
  it('names the first address on another scheme than the public URL', () => {
    expect(mixedSchemes('http://kept.lan', ['http://a.lan', 'http://b.lan'])).toBeNull();
    expect(mixedSchemes('https://kept.lan', ['https://a.lan'])).toBeNull();
    expect(mixedSchemes('http://kept.lan', ['http://a.lan', 'https://b.lan'])).toBe(
      'https://b.lan',
    );
    expect(mixedSchemes('https://kept.lan', ['http://a.lan'])).toBe('http://a.lan');
    expect(mixedSchemes('https://kept.lan', [])).toBeNull();
  });
});

describe('withoutMainAddress', () => {
  it('drops the public URL’s own origin however it was written', () => {
    expect(
      withoutMainAddress('http://kept.lan:8080/', ['http://kept.lan:8080', 'http://a.lan']),
    ).toEqual(['http://a.lan']);
    expect(withoutMainAddress('https://KEPT.lan:443', ['https://kept.lan'])).toEqual([]);
  });
});

describe('isExtraAddress: the comparison, whole origins only', () => {
  const extras = parseExtraAddresses('http://kept.lan:8080,http://100.64.0.7:8080');
  it('is true for exactly what is listed', () => {
    expect(isExtraAddress('http://kept.lan:8080', extras)).toBe(true);
    expect(isExtraAddress('http://100.64.0.7:8080', extras)).toBe(true);
  });
  it.each([
    'http://kept.lan',
    'http://kept.lan:80',
    'http://kept.lan:81',
    'http://kept.lan:8081',
    'https://kept.lan:8080',
    'HTTP://KEPT.LAN:8080',
    'http://kept.lan:8080/',
    'http://kept.lan.:8080',
    'http://kept.lan.example.com:8080',
    'http://evil.kept.lan:8080',
    'http://kept.lan:8080.evil.example',
    'http://kept.lan@evil.example',
    'http://kept.lan:8080@evil.example',
    'http://evil.example#http://kept.lan:8080',
    // Cyrillic е, as written and as a browser sends it.
    'http://kеpt.lan:8080',
    'http://xn--kpt-rdd.lan:8080',
    'null',
    '',
  ])('is false for %j', (origin) => {
    expect(isExtraAddress(origin, extras)).toBe(false);
  });
  it('is false for no header at all', () => {
    expect(isExtraAddress(undefined, extras)).toBe(false);
  });
});

describe('isMainAddressOnly', () => {
  it('covers passkeys and every outside sign-in', () => {
    for (const path of [
      '/passkey/generate-register-options',
      '/passkey/verify-registration',
      '/passkey/generate-authenticate-options',
      '/passkey/verify-authentication',
      '/sign-in/social',
      '/link-social',
      '/oauth2/authorize',
      '/oauth2/consent',
      '/oauth2/token',
    ]) {
      expect(isMainAddressOnly(path), path).toBe(true);
    }
  });
  it('leaves the ways in an extra address has', () => {
    for (const path of [
      '/sign-in/email',
      '/sign-in/username',
      '/sign-in/magic-link',
      '/request-password-reset',
      '/reset-password',
      '/sign-out',
      '/get-session',
      '/two-factor/verify-totp',
      '/two-factor/verify-backup-code',
      '/change-password',
      // A provider comes back by a GET with no Origin: nothing to go by, so nothing listed.
      '/callback/google',
    ]) {
      expect(isMainAddressOnly(path), path).toBe(false);
    }
  });
});
