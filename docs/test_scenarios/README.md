# Kept NFC MVP1 playtests

Use the trusted checkout with Node 24 and the pnpm version in `package.json`.
Start the development PostgreSQL service with `docker compose -f compose.dev.yaml up -d db`.
Build with `corepack pnpm --filter '@kept/server...' build` and
`corepack pnpm --filter @kept/web build`. From `apps/web`, run
`node --conditions=kept-dist e2e/serve.mjs <unique-run-name> <unused-port>`
for each fixture. Use lowercase letters and hyphens in the fixture name and
start a fresh process after rebuilding the web bundle. Omit flags for
first-run setup, use `--seed` for household
inventory, and add `--https` for the portability card. Use the seeded owner's
fixture credentials from `apps/web/e2e/step2.spec.ts`. The fixture starts a
scratch database and local file store and drops its database on SIGTERM.
Follow the [iOS runbook](../runbooks/nfc-mvp.md#development-and-installation)
for the local iPhone Simulator bundle. Use a separate Simulator app data
container and server for the native cards. For visual search, start the
[local encoder](../mvp1/visual-retrieval-plan.md#run-the-first-slice) and prefix
the disposable launcher command with
`KEPT_VISUAL_ENCODER_URL=http://127.0.0.1:8798` when using its default port.

Use synthetic names and files and add a run marker to records created by the
test. Record the server, account and record identifier at creation. Reversals
apply only to the marked records or stated seed fixtures. Stop only the
processes started for the run. Use a fresh browser profile and no production
service, live data, external inference, or physical NFC programming.

| Order | Cards | Surface |
| --- | --- | --- |
| 1 | [WEB-01–04](01-inventory.md) | Setup, inventory, record lifecycle and preferences |
| 2 | [FILE-01–02](02-files.md) | PDF handling and portability |
| 3 | [VIS-01–02](03-visual-search.md) | Words, photos, evidence and interrupted searches |
| 4 | [IOS-01–03](04-iphone.md) | Sign-in, native capture, offline recovery and label resolution |

Run every card in order for a full pass. Record observations, results and
screenshots or reproducible evidence in a separate report under `docs/audits/`.
A smoke pass runs WEB-01, WEB-02 and IOS-01. Initial state is covered by WEB-01,
navigation and keyboard use by WEB-02 and WEB-04, invalid and boundary values
by WEB-02 and IOS-02, deletion and recovery by WEB-03, preferences by WEB-04,
file import and export by FILE-01 and FILE-02, interruption by VIS-02 and
IOS-02, and save/reopen and relaunch by WEB-02, WEB-04 and IOS-01–02. Typed-code
resolution is runnable in Simulator. Physical tags and restore-gate acceptance
are covered by the [MVP1 runbook](../runbooks/nfc-mvp.md).
