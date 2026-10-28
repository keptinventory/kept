import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('./ci-changes.sh', import.meta.url));

/** ci-changes.sh's outputs for these changed paths, as an object. */
function decide(paths) {
  const out = execFileSync('bash', [script], { input: paths.join('\n'), encoding: 'utf8' });
  return Object.fromEntries(
    out
      .trim()
      .split('\n')
      .map((line) => line.split('=')),
  );
}

describe('ci-changes.sh', () => {
  it('prose only needs no tests at all', () => {
    expect(decide(['docs/runbooks/release.md', 'CHANGELOG.md'])).toEqual({
      unit: 'false',
      heavy: 'false',
      docs: 'false',
    });
  });

  it('the docs site needs only its own tests', () => {
    expect(decide(['apps/docs/src/content/docs/users/glossary.md', 'README.md'])).toEqual({
      unit: 'true',
      heavy: 'false',
      docs: 'true',
    });
  });

  it('anything outside the docs site needs every test', () => {
    expect(decide(['apps/docs/astro.config.mjs', 'apps/web/src/main.tsx'])).toEqual({
      unit: 'true',
      heavy: 'true',
      docs: 'false',
    });
  });

  it('an empty list needs everything', () => {
    expect(decide([])).toEqual({ unit: 'true', heavy: 'true', docs: 'false' });
  });
});
