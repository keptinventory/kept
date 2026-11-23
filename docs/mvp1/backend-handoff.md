# Kept NFC MVP1 backend handoff

November 22, 2026 · [Gate record](status.md) · [Integration contract v1](integration-contract.md) · [iOS handoff](ios-handoff.md)

## Revisions and scope

| Reference | Commit |
| --- | --- |
| Design baseline | `52a19f0c9060f6db3f6250a6b46d7cd9032aae66` |
| Independent audit baseline | `45761cb6425a739b3fef9660bae7dae9d9fdac35` |
| Starting checkout and fork main | `b45ddce90137f1dfc4ae537487ade77370c7515a` |
| Integration branch | `integration/mvp1` |
| Tested code before this evidence-only commit | `efa7b1ecebb559f2811c8acb577d3a15e92c0c6b` |

The working branch began clean. The newer starting commit guarded native presentation and Find lifecycle and the two backend defects were still present. The iOS owner contributed implementation and regression commits directly on the shared task branch. The earlier `feat/ios-nfc-mvp` worktree contains historical alternate versions. The integrated series builds on the native implementation already in the fork's main branch. The workspace lockfile required no regeneration.

## Defect disposition

- **Rollback compatibility** · Closed by the versioned capability check and native v2 payload guard. A v1-only server refuses v2 before a ledger outcome. An already authenticated phone also negotiates before uploading. The ordinary web queue stays on v1. Current Kept recognizes exact legacy v1 review captures under their existing ledger keys. Terminal legacy outcomes retain their meaning. [Regression](../../apps/server/src/sync/native-compat.test.ts).
- **Browser re-analysis** · Closed by storing the capture policy on the thing and carrying it to every re-analysis attempt, including another photograph on the same record. Migration 0181 backfills records with surviving review-only extraction history and pending re-analyses. Older records that left no review-only history retain the legacy default. The baseline regression demonstrated changes to brand, model, colour, type and aliases and two additional draft items under the box. The manually entered name stayed intact. The corrected revision left the recorded fields, aliases, containment and count intact and put a suggestion in the review inbox. [Regression](../../apps/server/src/extraction/extraction.test.ts).
- **AI history** · The full extraction file reproduced a missing AI ledger line on the starting and integration revisions. PostgreSQL's clock was about 95 ms ahead of Node locally. The history and inbox share a ledger join that tolerates this skew while keeping its timestamp bound. The regression places the recorded ledger time 250 ms before the extraction row and verifies that the owner can still see the call and its cost.
- **Offline documents** · The existing IndexedDB staging tests cover a failed PDF replacement keeping the previous published bytes, cleanup when an offline copy is cleared, and revocation while fetching. Browser sync and search use their existing paths. [Browser regression](../../apps/web/src/offline/extras.test.ts).

These changes follow the capture/review and preserve-originals requirements in the [design](../plans/kept_nfc_software_design.md) and [implementation plan](../plans/kept_nfc_implementation_plan.md). The companion [backup runbook](../runbooks/backup-restore.md) governs local and external storage, and the [NFC runbook](../runbooks/nfc-mvp.md) links the physical-device evidence still required.

The backend changes cover `apps/server/src/auth/native.ts`, `sync/`, `capture/service.ts`, `things/service.ts`, `extraction/`, `inbox/view.ts`, `db/schema/things.ts`, migrations 0180/0181 and their metadata, and `backup/backup.test.ts`. The shared changes are in `packages/shared/src/sync.ts` and the web capture paths module. CI and runbook changes are in `.github/workflows/mvp1-ios.yml`, this evidence directory and `docs/runbooks/nfc-mvp.md`. The native changes are listed in the iOS handoff.

## Executed checks

| Check | Result |
| --- | --- |
| Focused server | **124 passed** across native auth, capture, extraction, sync, scan and route audit coverage. The rollback scenario used the compiled `8d890f96` server. |
| Additional rollback runs | The default fixture and the compiled `b45ddce9` server each passed. The latter returned 401 on the missing capability route while the same session returned 200 on `/me`. |
| Real recovery | The selected Restic scenario passed. PostgreSQL and Restic used scratch infrastructure and the file store was local. |
| Browser and shared | 76 focused web tests and 28 shared sync tests passed. Offline tests use fake IndexedDB. The five phone-sized Playwright tests used Chromium and the built Fastify server. |
| Workspace | `pnpm typecheck`, `pnpm lint`, changed-file Biome, workflow actionlint, migration drift and licence checks passed. The ordinary production web and server builds and the bundled iOS UI build passed. |
| Native | 14 Swift package tests passed. The local iOS Simulator app compiled unsigned and with an ad hoc signature verified by `codesign`. The local generic iOS build compiled with signing disabled. |

Local tools were Node 24.22.3, pnpm 11.23.0 and Xcode 27.2 on macOS arm64. The development database image supplied PostgreSQL 18.6 and pgvector 0.8.6. The native and web test fixtures used dummy accounts and originals. Playwright and HTTP injection exercise real routing and permissions. The native web tests use platform doubles and Swift tests exercise the on-disk store. The physical held-preview and NFC workflows still require device evidence.

## Repeat the evidence

Use Node 24 and the pinned pnpm from `package.json` and the [development setup](../../CONTRIBUTING.md#set-up). Start the disposable development PostgreSQL and keep its Docker Compose configuration available. The tests create and drop their own databases.

```sh
pnpm typecheck
pnpm lint
bash scripts/ci-local.sh --only drift,licences
pnpm --filter '@kept/server...' build
pnpm --filter @kept/web build

KEPT_TEST_WORKERS=1 pnpm exec vitest run --project @kept/server \
  apps/server/src/auth/native.test.ts apps/server/src/capture/capture.test.ts \
  apps/server/src/extraction/extraction.test.ts apps/server/src/sync/native-compat.test.ts \
  apps/server/src/sync/ops.test.ts apps/server/src/sync/ordering.test.ts \
  apps/server/src/scan/scan.test.ts apps/server/test/route-catalogue.test.ts

pnpm exec vitest run --project @kept/shared packages/shared/src/sync.test.ts
pnpm exec vitest run --project @kept/web apps/web/src/native \
  apps/web/src/offline/extras.test.ts apps/web/src/offline/sync-engine.test.ts \
  apps/web/src/pwa/pwa.test.tsx apps/web/src/components/scan/iphone-labels.test.ts
KEPT_E2E_INSTANCES=signIn,capture pnpm --filter @kept/web e2e \
  e2e/native-auth.spec.ts e2e/step3.spec.ts --project=phone --workers=1 \
  -g 'iPhone consent|offline capture: three|offline, the Search|camera reads a seeded label|a viewer:'

pnpm --filter @kept/web build:ios
pnpm --filter @kept/ios sync
swift test --package-path apps/ios/NativeStore
xcodebuild -project apps/ios/ios/App/App.xcodeproj -scheme App \
  -configuration Debug -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .tmp/kept-mvp1-simulator CODE_SIGNING_ALLOWED=NO build
```

The default compatibility test uses a small fixture of the former server boundary. The commands below build the actual historical server and point the test at its compiled entry.

```sh
git worktree add --detach .tmp/mvp1-rollback 8d890f96
(cd .tmp/mvp1-rollback && pnpm install --frozen-lockfile && pnpm --filter '@kept/server...' build)
KEPT_TEST_ROLLBACK_SERVER="$PWD/.tmp/mvp1-rollback/apps/server/dist/http/app.js" \
  pnpm exec vitest run --project @kept/server apps/server/src/sync/native-compat.test.ts
```

Repeat with a separate worktree at `b45ddce9` to test a server that supported native sign-in before negotiation was added. The actual cross-version test uses Fastify injection against the old and new application code on the same disposable database. The native outbox regression uses fake platform adapters for the no-upload assertion and retry behavior.

```sh
KEPT_TEST_RESTIC=1 KEPT_RESTIC_BIN="$(command -v restic)" \
  pnpm exec vitest run --project @kept/server apps/server/src/backup/backup.test.ts \
  -t 'restores the NFC inventory capture'
```

The restore test uses its fast fake by default. The real run used **Restic 0.20.0**, **PostgreSQL 18.6** and its matching dump tools in development Compose, scratch local blob directories and a scratch local Restic repository. It exercised the supported restore implementation and started a real Fastify app against the empty-then-restored database. On the restored app it verified a new epoch on PKCE re-login, original photo/PDF lengths and SHA-256 over authorized downloads, correct attachment roles, notes and containment, resolution of the old label URL, and rejection of old-context capability checks, uploads and pending capture mutations before ledger insertion. The scenario also tested missing and trashed destinations, and denied outsider label/media access. External object-store originals require independent recovery evidence.

## Hosted checks and environment

The dedicated workflow builds and tests the bundled UI on Linux and runs Swift tests and an unsigned simulator compile on macOS. Both jobs passed in the fork at `29e8e286` and at the tested code revision `efa7b1ec`. The upstream general CI has no runs in this fork and uses main pushes, pull requests and explicit triggers. This task branch invokes the dedicated focused workflow. [Workflow](../../.github/workflows/mvp1-ios.yml) · [First run](https://github.com/e3742526/kept-nfc/actions/runs/45106111841) · [Run for the tested revision](https://github.com/e3742526/kept-nfc/actions/runs/45106797376).

One client-side rollback edge remains with the iOS owner. The pre-negotiation native server can mask a missing capability route as 401, so the integrated client can prompt for sign-in even when its session is valid. The queue and original files remain on the phone. Signing in to the upgraded server as the same user resumes replay. The contract specifies the authenticated `/me` probe that can distinguish this case from genuine session expiry.

The connected iPhone could not run a signed build. The iOS handoff records Xcode's missing development-team account and NFC provisioning profile. Run the [physical-device checklist](../runbooks/nfc-mvp.md#physical-device-acceptance) after provisioning. The device build above was compile-only. Production deployment and production data were outside this run.

The next implementation milestone is [production visual retrieval for R10 and R11](visual-retrieval-plan.md).
