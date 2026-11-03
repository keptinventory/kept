import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { problems, settingsIn } from './check-setting-parity.mjs';

const env = (...names) =>
  `const schema = z.object({\n${names.map((n) => `  ${n}: z.string(),`).join('\n')}\n});`;
const base = {
  envTs: env('KEPT_PUBLIC_URL', 'KEPT_AI_MOCK'),
  envExample: 'KEPT_PUBLIC_URL=',
  composeYaml: 'KEPT_PUBLIC_URL: ${KEPT_PUBLIC_URL}',
  haFiles: ['env.KEPT_PUBLIC_URL = given;'],
  notInEnvExample: { KEPT_AI_MOCK: 'tests only' },
  notInHaApp: { KEPT_AI_MOCK: 'tests only' },
};

describe('settings in step', () => {
  it('reads the settings env.ts declares', () => {
    expect([...settingsIn(env('KEPT_A', 'KEPT_B'))]).toEqual(['KEPT_A', 'KEPT_B']);
  });

  it('passes when every setting is everywhere it must be, or excused', () => {
    expect(problems(base)).toEqual([]);
  });

  it('a new setting added to env.ts alone is caught twice: the example and the app', () => {
    const found = problems({ ...base, envTs: env('KEPT_PUBLIC_URL', 'KEPT_AI_MOCK', 'KEPT_NEW') });
    expect(found).toEqual([
      'KEPT_NEW: not in compose.env.example (add it, or to NOT_IN_ENV_EXAMPLE with why)',
      'KEPT_NEW: not in the Home Assistant app (map it in docker/ha/options.mjs, or add it to NOT_IN_HA_APP with why)',
    ]);
  });

  it('a setting in .env that compose.yaml never hands to the container (the KEPT_HSTS case)', () => {
    const found = problems({
      ...base,
      envTs: env('KEPT_PUBLIC_URL', 'KEPT_AI_MOCK', 'KEPT_HSTS'),
      envExample: 'KEPT_PUBLIC_URL=\nKEPT_HSTS=',
      haFiles: ['env.KEPT_PUBLIC_URL; env.KEPT_HSTS'],
    });
    expect(found).toEqual([
      "KEPT_HSTS: in compose.env.example but compose.yaml doesn't pass it to the container",
    ]);
  });

  it('a name env.ts doesn’t know (a typo) in any of the files', () => {
    const found = problems({ ...base, envExample: 'KEPT_PUBLIC_URL=\nKEPT_PUBLC_URL=' });
    expect(found).toContain(
      'KEPT_PUBLC_URL: named in compose.env.example, but env.ts reads no such setting',
    );
  });

  it('an excuse that no longer holds: the setting is there after all, or is gone', () => {
    expect(
      problems({
        ...base,
        envExample: 'KEPT_PUBLIC_URL=\nKEPT_AI_MOCK=',
        composeYaml: 'KEPT_PUBLIC_URL KEPT_AI_MOCK',
      }),
    ).toContain('KEPT_AI_MOCK: in compose.env.example, so take it off NOT_IN_ENV_EXAMPLE');
    expect(problems({ ...base, envTs: env('KEPT_PUBLIC_URL') })).toContain(
      'KEPT_AI_MOCK: on an exception list, but env.ts reads no such setting',
    );
  });

  it('passes on the repository itself', () => {
    const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const out = execFileSync('node', [path.join(repo, 'scripts/check-setting-parity.mjs')], {
      cwd: repo,
      encoding: 'utf8',
    });
    expect(out).toBe('');
    expect(readFileSync(path.join(repo, 'compose.env.example'), 'utf8')).toContain('KEPT_HSTS');
  });
});
