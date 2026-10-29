/**
 * Kept under Home Assistant's ingress, end to end (D273): the kept-ha image behind a proxy that does
 * what Home Assistant's Core and Supervisor do (e2e-ha/Caddyfile). scripts/ha-ingress-e2e.sh builds
 * nothing: it starts the image given to it, the proxy at the Supervisor's address, and then this
 * config, with KEPT_HA_E2E_URL (Home Assistant's address) and the two apps' ingress tokens.
 *
 *   bash scripts/ha-ingress-e2e.sh kept-ha:dev
 */
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.KEPT_HA_E2E_URL;
if (!baseURL) throw new Error('KEPT_HA_E2E_URL is unset: run scripts/ha-ingress-e2e.sh');

export default defineConfig({
  testDir: 'e2e-ha',
  // One Kept per app, set up once: the tests run in order.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  // Setup hashes a password and signs in, on a CI runner's shared CPU.
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL,
    // Playwright's bundled Chromium: never the person's own browser profile.
    ...devices['Desktop Chrome'],
    channel: 'chromium',
    trace: 'retain-on-failure',
  },
});
