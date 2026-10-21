/**
 * The Kept instances the e2e run starts (e2e/serve.mjs), one per purpose so no test sees
 * another's data: each project gets a fresh, never-set-up instance of its own for the flow
 * (first-run setup happens once per instance) and a seeded one for the sign-in tests.
 *
 * Ports sit away from 8080, the port `node dist/main.js` and the dev server use, so a running dev
 * server doesn't collide with an e2e run.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type Instance = { name: string; port: number; seed: boolean };

export const INSTANCES = {
  phone: { name: 'flow-phone', port: 8181, seed: false },
  desktop: { name: 'flow-desktop', port: 8182, seed: false },
  seedPhone: { name: 'seed-phone', port: 8183, seed: true },
  seedDesktop: { name: 'seed-desktop', port: 8184, seed: true },
  // Step 2's flows (e2e/step2.spec.ts) write to the inventory: a seeded instance of their own.
  step2Phone: { name: 'inventory-phone', port: 8185, seed: true },
  step2Desktop: { name: 'inventory-desktop', port: 8186, seed: true },
  // The UI audit's axe pass and keyboard walk (e2e/audit.spec.ts): a capture and a label print.
  auditPhone: { name: 'audit-phone', port: 8193, seed: true },
  auditDesktop: { name: 'audit-desktop', port: 8194, seed: true },
  // Step 4's household journeys (e2e/step4.spec.ts): lending, schedules, documents, incidents
  // and the notification centre, on a seeded instance of their own.
  household: { name: 'household', port: 8188, seed: true },
  // The guided tour (e2e/tour.spec.ts): where it stopped is per person on the server, so a
  // seeded instance of its own, one person per project.
  tour: { name: 'tour', port: 8190, seed: true },
  // The spreadsheet view (e2e/sheet.spec.ts) edits and moves things: a seeded instance of
  // its own, so no other spec sees its changes.
  sheet: { name: 'sheet', port: 8198, seed: true },
  // Moving mode (e2e/moving.spec.ts) moves boxes between the seed's Garage and Home: a
  // seeded instance of its own, so no other spec sees its changes.
  moving: { name: 'moving', port: 8199, seed: true },
  // Labels printed from long names (e2e/labels-print.spec.ts): the print PDF read back, the
  // preview against the print, "Printed OK?" and the duplicate-sheet offer, on a seeded instance
  // of its own.
  labels: { name: 'labels', port: 8202, seed: true },
} as const satisfies Record<string, Instance>;

/**
 * Step 5's vehicle journeys (e2e/step5.spec.ts): seeded with `households`, every AI call answered
 * by the mock (the service invoice's lines, e2e/fixtures/mock-answers.json), as the capture
 * instance is. Its key for KEPT_E2E_INSTANCES is `vehicles`.
 */
export const VEHICLES_INSTANCE: Instance & { aiMock: true } = {
  name: 'vehicles',
  port: 8189,
  seed: true,
  aiMock: true,
};

/**
 * Steps 6–8's journeys run behind HTTPS (serve.mjs `--https`: a TLS proxy with a self-signed
 * certificate made for the run), because token creation, an export with secrets, revealing a
 * secret and the backup settings are refused over plain http. Their contexts take
 * `ignoreHTTPSErrors`. Keys for KEPT_E2E_INSTANCES: `assistant`, `portability`, `operations`.
 */
export type TlsInstance = Instance & { https: true; aiMock?: boolean; owner?: boolean };

/** Step 6 (e2e/step6.spec.ts): the assistant on the mock's scripted cases, tokens and /mcp. */
export const ASSISTANT_INSTANCE: TlsInstance = {
  name: 'assistant',
  port: 8195,
  seed: true,
  aiMock: true,
  https: true,
};

/** Step 7 (e2e/step7.spec.ts): the Homebox and Kept imports, the export, consumables. */
export const PORTABILITY_INSTANCE: TlsInstance = {
  name: 'portability',
  port: 8196,
  seed: true,
  https: true,
};

/** Step 8 (e2e/step8.spec.ts): Admin → Backups (with the owner login a run needs), the app lock. */
export const OPERATIONS_INSTANCE: TlsInstance = {
  name: 'operations',
  port: 8197,
  seed: true,
  https: true,
  owner: true,
};

/**
 * Settings → Sign-in and security (e2e/sign-in-security.spec.ts): passkeys through Chromium's
 * virtual authenticator and the authenticator app, on the `households` seed. Its server believes
 * `X-Forwarded-For` from this machine (serve.mjs `--trust-proxy`), so each journey's sign-ins
 * come from an address of their own and Better Auth's per-address sign-in limit (5 a minute)
 * doesn't run out between journeys. Key for KEPT_E2E_INSTANCES: `signIn`.
 */
export const SIGN_IN_INSTANCE: Instance & { trustProxy: true } = {
  name: 'sign-in',
  port: 8200,
  seed: true,
  trustProxy: true,
};

/**
 * Sign-in changes seen from outside (e2e/sign-in-changes.spec.ts): other devices signed out, the
 * security notices in the mail, unlinking an outside sign-in, a location that asks for
 * two-factor. Its server mails through the dev Mailpit (compose.dev.yaml, SMTP 1025, API 8025;
 * serve.mjs `--mail`), and offers Google sign-in with made-up client credentials (`--google`): no
 * Google request is ever made, unlinking needs none. Key for KEPT_E2E_INSTANCES: `signInMail`.
 */
export const SIGN_IN_MAIL_INSTANCE: Instance & {
  trustProxy: true;
  mail: true;
  google: true;
} = {
  name: 'sign-in-mail',
  port: 8201,
  seed: true,
  trustProxy: true,
  mail: true,
  google: true,
};

export const urlOf = (i: Instance & { https?: boolean }) =>
  `${i.https ? 'https' : 'http'}://localhost:${i.port}`;

/** Where serve.mjs keeps an instance's config, data and log: the repo's gitignored .tmp/. */
export const stateDirOf = (i: Instance) =>
  fileURLToPath(new URL(`../../../.tmp/e2e/${i.name}/`, import.meta.url));

/** The setup code the instance printed on first boot (`KEPT SETUP CODE: XXX-XXX`). */
export function printedSetupCode(i: Instance): string {
  const log = readFileSync(`${stateDirOf(i)}server.log`, 'utf8');
  const codes = [...log.matchAll(/^KEPT SETUP CODE: (\S+)$/gm)].map((m) => m[1]);
  if (codes.length !== 1 || !codes[0]) {
    throw new Error(`${i.name}: expected one setup code line in its log, found ${codes.length}`);
  }
  return codes[0];
}
