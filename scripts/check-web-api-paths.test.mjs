import { describe, expect, it } from 'vitest';
import { rawApiPaths } from './check-web-api-paths.mjs';

// D273: under Home Assistant ingress every server path goes under a prefix. The web app names its
// server paths in its paths modules; a raw '/api/…' literal anywhere else is one more place to keep
// right, so it fails here.

describe('rawApiPaths()', () => {
  it('allows the paths modules and the demo, mocks and tests', () => {
    const src = "const V1 = '/api/v1';";
    for (const file of [
      'apps/web/src/api/paths.ts',
      'apps/web/src/api/household/paths.ts',
      'apps/web/src/api/inventory/codes.ts',
      'apps/web/src/api/portability/queries.ts',
      'apps/web/src/demo.ts',
      'apps/web/src/api/mock/server.ts',
      'apps/web/src/api/connections/mock/instance.ts',
      'apps/web/src/things/x.test.tsx',
      'apps/web/src/test/app.tsx',
    ]) {
      expect(rawApiPaths(file, src), file).toEqual([]);
    }
  });

  it('finds a raw /api/ literal in any other module, in any quotes', () => {
    expect(rawApiPaths('apps/web/src/components/x.tsx', "fetch('/api/v1/me')")).toEqual([1]);
    expect(rawApiPaths('apps/web/src/components/x.tsx', 'a\nfetch("/api/v1/me")')).toEqual([2]);
    expect(rawApiPaths('apps/web/src/components/x.tsx', 'fetch(`/api/v1/` + id)')).toEqual([1]);
  });

  it('ignores comments', () => {
    expect(
      rawApiPaths(
        'apps/web/src/components/x.tsx',
        "// GET '/api/v1/me'\n * `/api/v1/accounts` lists",
      ),
    ).toEqual([]);
  });
});
