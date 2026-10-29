import { describe, expect, it } from 'vitest';
import { strayAppConfigs } from './check-ha-app.mjs';

// The kept repository is also a Home Assistant app repository (D272): the Supervisor lists every
// config.(json|yaml|yml) it finds as an app, except under a folder whose name starts with `.` or
// is `rootfs` (supervisor/store/data.py `_find_app_configs`). Only the app's own may exist.

describe('strayAppConfigs()', () => {
  it('allows the app’s own config.yaml and files that are not configs', () => {
    expect(
      strayAppConfigs([
        'homeassistant/kept/config.yaml',
        'repository.yaml',
        'apps/web/vite.config.ts',
        'apps/docs/astro.config.mjs',
        'charts/kept/values.yaml',
        'configs/x.yaml',
        'my-config.yaml',
      ]),
    ).toEqual([]);
  });

  it('skips dot folders and rootfs, as the Supervisor does', () => {
    expect(
      strayAppConfigs([
        '.github/ISSUE_TEMPLATE/config.yml',
        'homeassistant/.test/kept-demo/config.yaml',
        'x/rootfs/etc/config.json',
      ]),
    ).toEqual([]);
  });

  it('finds any other config.json, config.yaml or config.yml', () => {
    expect(
      strayAppConfigs([
        'config.yaml',
        'apps/server/config.json',
        'docs/examples/config.yml',
        'homeassistant/kept-beta/config.yaml',
      ]),
    ).toEqual([
      'config.yaml',
      'apps/server/config.json',
      'docs/examples/config.yml',
      'homeassistant/kept-beta/config.yaml',
    ]);
  });
});
