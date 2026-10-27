import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type InitIO, parseAddress, runInit } from './init.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'kept-init-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** A scripted terminal: each question takes the next answer; everything shown is recorded. */
function terminal(answers: string[], interactive = true) {
  const shown: string[] = [];
  const asked: string[] = [];
  const io: InitIO = {
    interactive,
    print: (line) => shown.push(line),
    ask: async (question) => {
      asked.push(question);
      const next = answers.shift();
      if (next === undefined) throw new Error(`unexpected question: ${question}`);
      return next;
    },
  };
  return { io, shown, asked, all: () => [...shown, ...asked].join('\n') };
}

const envFile = () => readFile(path.join(dir, '.env'), 'utf8');
const line = (text: string, name: string) =>
  text
    .split('\n')
    .find((l) => l.startsWith(`${name}=`))
    ?.slice(name.length + 1);

describe('parseAddress', () => {
  it.each([
    ['http://kept.home.arpa:8080', 'http://kept.home.arpa:8080', 8080, []],
    ['kept.home.arpa:8080', 'http://kept.home.arpa:8080', 8080, ['assumed-http']],
    ['http://kept.lan', 'http://kept.lan', 80, []],
    ['http://kept.lan:80/', 'http://kept.lan', 80, []],
    ['https://kept.example.org', 'https://kept.example.org', null, ['https-proxy']],
    ['http://192.168.1.20:8080', 'http://192.168.1.20:8080', 8080, ['ip']],
    ['http://[fd00::20]:8080', 'http://[fd00::20]:8080', 8080, ['ip']],
    ['http://localhost:8080', 'http://localhost:8080', 8080, ['localhost']],
    ['  HTTP://Kept.Lan:8080  ', 'http://kept.lan:8080', 8080, []],
  ])('%s → %s', (input, url, port, notes) => {
    expect(parseAddress(input)).toEqual({ url, port, notes });
  });

  it.each([
    ['', /address/i],
    ['ftp://kept.lan', /http:\/\/ or https:\/\//],
    ['http://kept.lan:8080/kept', /no path/],
    ['http://kept.lan:8080/?x=1', /no path/],
    ['http://user:pw@kept.lan', /user name or password/],
    ['http://', /address/i],
  ])('refuses %j', (input, why) => {
    expect(() => parseAddress(input)).toThrow(why);
  });
});

describe('kept init', () => {
  it('asks for the address, recommending a name over an IP because labels print it', async () => {
    const t = terminal(['http://kept.home.arpa:8080']);
    const result = await runInit({
      dir,
      version: '1.13.0',
      io: t.io,
      generateCode: () => 'KPT2X9',
    });
    expect(t.asked).toHaveLength(1);
    const intro = t.shown.join('\n');
    expect(intro).toMatch(/label/i);
    expect(intro).toMatch(/IP address/);
    expect(result).toMatchObject({ code: 'KPT-2X9', publicUrl: 'http://kept.home.arpa:8080' });
  });

  it('writes .env with the address, the port, the image and the setup code, readable by its owner only', async () => {
    const t = terminal(['http://kept.home.arpa:8080']);
    await runInit({ dir, version: '1.13.0', io: t.io, generateCode: () => 'KPT2X9' });
    const text = await envFile();
    expect(line(text, 'KEPT_PUBLIC_URL')).toBe('http://kept.home.arpa:8080');
    expect(line(text, 'KEPT_HTTP_PORT')).toBe('8080');
    expect(line(text, 'KEPT_SETUP_CODE')).toBe('KPT-2X9');
    expect(line(text, 'KEPT_IMAGE')).toBe('ghcr.io/keptinventory/kept:1.13.0');
    expect(text).not.toMatch(/PASSWORD/);
    expect((await stat(path.join(dir, '.env'))).mode & 0o777).toBe(0o600);
    // Every line is a comment, blank or NAME=value: Compose reads it as written.
    for (const l of text.split('\n')) expect(l).toMatch(/^(#.*|[A-Z_]+=\S*|)$/);
  });

  it('prints the setup code and what to do next, and nothing else from .env', async () => {
    const t = terminal(['http://kept.home.arpa:8080']);
    await runInit({ dir, version: '1.13.0', io: t.io, generateCode: () => 'KPT2X9' });
    expect(t.shown).toContain('KEPT SETUP CODE: KPT-2X9');
    const out = t.all();
    expect(out).toContain('docker compose up -d');
    expect(out).toContain('http://kept.home.arpa:8080');
    expect(out).not.toMatch(/KEPT_IMAGE|ghcr\.io/);
  });

  it('leaves the image out for a build that is not a release', async () => {
    const t = terminal(['http://kept.lan']);
    await runInit({ dir, version: '0.0.0-dev', io: t.io, generateCode: () => 'KPT2X9' });
    const text = await envFile();
    expect(line(text, 'KEPT_IMAGE')).toBeUndefined();
    expect(line(text, 'KEPT_HTTP_PORT')).toBe('80');
  });

  it('says it assumed http:// when the scheme was left out', async () => {
    const t = terminal(['kept.home.arpa:8080']);
    await runInit({ dir, version: '1.13.0', io: t.io });
    expect(t.shown.join('\n')).toContain('http://kept.home.arpa:8080');
    expect(line(await envFile(), 'KEPT_PUBLIC_URL')).toBe('http://kept.home.arpa:8080');
  });

  it('asks again after an address it refuses, saying why', async () => {
    const t = terminal(['http://kept.lan:8080/kept', 'http://kept.lan:8080']);
    await runInit({ dir, version: '1.13.0', io: t.io });
    expect(t.asked).toHaveLength(2);
    expect(t.shown.join('\n')).toMatch(/no path/);
  });

  it('asks to confirm an IP address, and asks for another on no', async () => {
    const t = terminal(['http://192.168.1.20:8080', '', 'http://kept.lan:8080']);
    await runInit({ dir, version: '1.13.0', io: t.io });
    expect(t.asked).toHaveLength(3);
    expect(t.asked[1]).toMatch(/\[y\/N\]/);
    expect(line(await envFile(), 'KEPT_PUBLIC_URL')).toBe('http://kept.lan:8080');
  });

  it('keeps an IP address on yes', async () => {
    const t = terminal(['http://192.168.1.20:8080', 'y']);
    await runInit({ dir, version: '1.13.0', io: t.io });
    expect(line(await envFile(), 'KEPT_PUBLIC_URL')).toBe('http://192.168.1.20:8080');
  });

  it('takes --url without asking, warning about an IP address', async () => {
    const t = terminal([], false);
    await runInit({ dir, url: 'http://192.168.1.20:8080', version: '1.13.0', io: t.io });
    expect(t.asked).toHaveLength(0);
    expect(t.shown.join('\n')).toMatch(/IP address/);
    expect(line(await envFile(), 'KEPT_PUBLIC_URL')).toBe('http://192.168.1.20:8080');
  });

  it('refuses a bad --url instead of asking', async () => {
    const t = terminal([], false);
    await expect(
      runInit({ dir, url: 'ftp://kept.lan', version: '1.13.0', io: t.io }),
    ).rejects.toThrow(/http:\/\/ or https:\/\//);
  });

  it('without a terminal and without --url, says which flag to use', async () => {
    const t = terminal([], false);
    await expect(runInit({ dir, version: '1.13.0', io: t.io })).rejects.toThrow(/--url/);
  });

  it('for an https address leaves the port out and says a proxy serves it', async () => {
    const t = terminal(['https://kept.example.org']);
    await runInit({ dir, version: '1.13.0', io: t.io });
    const text = await envFile();
    expect(line(text, 'KEPT_HTTP_PORT')).toBeUndefined();
    expect(t.shown.join('\n')).toMatch(/proxy/i);
  });

  it('updates an existing .env in place, keeping every other line, after asking', async () => {
    const before = [
      '# my notes',
      'KEPT_DB_SUPERUSER_PASSWORD=aa11',
      'KEPT_DB_OWNER_PASSWORD=bb22',
      'KEPT_PUBLIC_URL=http://old.lan:8080',
      'KEPT_SECRET_KEY=keep-this-key',
      'KEPT_AUTH_SECRET=keep-this-too',
      'KEPT_HTTP_PORT=8080',
      'KEPT_IMAGE=ghcr.io/keptinventory/kept:1.12.5',
      '',
    ].join('\n');
    await writeFile(path.join(dir, '.env'), before, { mode: 0o600 });
    const t = terminal(['y', 'http://kept.lan:8090']);
    const result = await runInit({
      dir,
      version: '1.13.0',
      io: t.io,
      generateCode: () => 'KPT2X9',
    });
    expect(result.merged).toBe(true);
    expect(t.asked[0]).toMatch(/\.env/);
    const after = await envFile();
    expect(line(after, 'KEPT_PUBLIC_URL')).toBe('http://kept.lan:8090');
    expect(line(after, 'KEPT_HTTP_PORT')).toBe('8090');
    expect(line(after, 'KEPT_SETUP_CODE')).toBe('KPT-2X9');
    // The image pin is the operator's to move; untouched.
    expect(line(after, 'KEPT_IMAGE')).toBe('ghcr.io/keptinventory/kept:1.12.5');
    for (const kept of before.split('\n').filter((l) => !/^KEPT_(PUBLIC_URL|HTTP_PORT)=/.test(l))) {
      expect(after.split('\n')).toContain(kept);
    }
    // Nothing from the old file is shown.
    expect(t.all()).not.toMatch(/aa11|bb22|keep-this/);
  });

  it('keeps the setup code an existing .env already has', async () => {
    await writeFile(path.join(dir, '.env'), 'KEPT_SETUP_CODE=ABC-123\n', { mode: 0o600 });
    const t = terminal(['', 'http://kept.lan:8080']);
    const result = await runInit({
      dir,
      version: '1.13.0',
      io: t.io,
      generateCode: () => 'KPT2X9',
    });
    expect(result.code).toBe('ABC-123');
    expect(t.shown).toContain('KEPT SETUP CODE: ABC-123');
  });

  it('leaves an existing .env untouched on no', async () => {
    await writeFile(path.join(dir, '.env'), 'KEPT_PUBLIC_URL=http://old.lan\n', { mode: 0o600 });
    const t = terminal(['n']);
    const result = await runInit({ dir, version: '1.13.0', io: t.io });
    expect(result.merged).toBe(false);
    expect(result.written).toBe(false);
    expect(await envFile()).toBe('KEPT_PUBLIC_URL=http://old.lan\n');
  });

  it('hands the new file to the folder owner when told how', async () => {
    const handed: string[] = [];
    const t = terminal(['http://kept.lan:8080']);
    await runInit({ dir, version: '1.13.0', io: t.io, chownTo: (file) => handed.push(file) });
    expect(handed).toHaveLength(1);
    expect(path.dirname(handed[0] as string)).toBe(dir);
  });
});
