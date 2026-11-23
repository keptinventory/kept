# Kept NFC iOS Client MVP1 Handoff

## Branch and Working State

- **Branch:** `feat/ios-nfc-mvp` (in isolated worktree `.tmp/worktrees/ios-mvp`, branched from `8d890f96`)
- **Latest relevant commits prior to docs commit:**
  - `2c35d3a0` (`i18n(web): translate native iOS workflow strings`)
  - `27295fea` (`feat(ios): implement platform adapters, mobile workflow, and tests`)
  - `ba63d05c` (`feat(ios): harden native outbox store and continuous NFC find bridge`)
  - `d301139d` (`feat(ios): seed iOS client baseline on isolated branch`)
- **Current commit adds:** `apps/ios/README.md`, `apps/ios/STATUS.md`, and this updated `docs/mvp1/ios-handoff.md`.
- **Integration checkout state:** Untouched by this branch (backend/shared changes stay owned by the integration agent).

## Status Summary

### Implemented

- **`KeptNativeStore` (`apps/ios/NativeStore`):**
  - `Outbox.swift`: Actor-backed WAL SQLite outbox (`PRAGMA busy_timeout = 5000`), staged original writes + startup repair, `OutboxError.storageFull` error mapping (`CocoaError.fileWriteOutOfSpace`, `ENOSPC`, `SQLITE_FULL`), scoped `kv` storage (`readValue`/`saveValue`/`deleteValue`), `clearFailure`, atomic `retarget`, and `StorageStats` (`pendingCount`, `pendingBytes`, `cacheBytes`).
  - `NFCLogic.swift`: `NFCLabelValidation` (HTTPS + configured server origin match + Crockford `/l/<code>` short-code folding), `NFCRepeatDebouncer` (2.5 s cooldown), `NDEFRecordSnapshot` SHA-256 fingerprint, `FindOutcome`.
- **Swift Capacitor Bridge & Core NFC (`apps/ios/ios/App/App`):**
  - `KeptNFC.swift`: foreground `.read`, `.inspect`, `.write(url, expected:)`, continuous `.find` mode with repeat debounce, multi-tag polling restart, background interruption, and `KeptMatchFeedback` (`.success` haptic + `.ambient` chime + VoiceOver announcement; distinct nonmatch haptic + announcement).
  - `KeptBridge.swift`: `willResignActive`/`didBecomeActive` lifecycle observers, `startFind`/`continueFind`/`finishFind`/`nonMatchFeedback`/`openPendingMedia`, `"nfcFind"`/`"appState"` events, extended `outbox` actions (`retarget`, `clearFailure`, `stats`, `getValue`, `setValue`, `deleteValue`), `HTTPCookie` cookie extraction, `X-Kept-Native-Account` / `X-Kept-Native-Epoch` / `X-Kept-Sha256` request & upload headers, optional `thing` in `openMedia` with `presentedViewController` guard, and `"storage_full"` rejection.
- **TypeScript Platform Adapters, Sync Client & Mobile UI (`apps/web/src/native/`):**
  - `adapters.ts`: `PlatformAdapters` + `NativePlatformProvider` + `capacitorAdapters` keeping UI decoupled from Capacitor plugins.
  - `bridge.ts`, `outbox.ts`, `inventory.ts`, `labels.ts`: `deduplicatedFrom` file ID reconciliation, post-upload attachment confirmation, `reviewSuggestions: true` local payload extension, offline search with attachment filename tokenization + pending drafts, strict server-origin label validation, Find target KV persistence, and unresolved-when-offline Find semantics.
  - `capture-form.tsx`, `record.tsx`, `label-panel.tsx`, `main.tsx`, `native.css`: Destination-locked **Add to this box**, camera + PDF attachments, non-blocking AI suggestions, Find mode feedback/multi-tag/timeout/resume, retarget/discard/retry UI, safe sign-out confirm dialog (`useConfirm`), RTL logical CSS, and all 8 Lingui catalogues updated.
- **Documentation (`apps/ios/README.md`, `apps/ios/STATUS.md`):**
  - Full developer build/test guide, Xcode signing/Team ID, `KeptNFC.entitlements` vs `KeptNFC-AssociatedDomains.entitlements` + AASA config, NTAG213/215/216 guidance, local HTTPS setup, ownership/contract status record, and Physical-Device Acceptance Checklist.

### Verified

- **Swift Package unit tests (`apps/ios/NativeStore`):** `12/12` passed (`OutboxTests`: 8, `NFCLogicTests`: 4).
- **Vitest native suite (`apps/web/src/native`):** `4/4` files, `16/16` tests passed (including Arabic RTL logical CSS test; uses fake `PlatformAdapters` in jsdom).
- **Repo build & lint gates:** `biome check`, `pnpm typecheck`, `check-i18n.mjs` (`7129 messages`), `check-logical-css.mjs`, `check-web-api-paths.mjs`, `check-no-local-paths.mjs`, `check-licences.mjs`, `pnpm --filter @kept/web build:ios`, `pnpm --filter @kept/ios sync` — all exited `0`.
- **iOS Simulator build & launch:** `xcodebuild` (`Debug` iphonesimulator, `CODE_SIGNING_ALLOWED=NO`) -> `** BUILD SUCCEEDED **`; `xcrun simctl install` + `xcrun simctl launch` launched `info.keptinventory.nfc` on booted simulator without crash.
- **Live development backend integration suite:** Executed `outbox.ts`, `inventory.ts`, `labels.ts`, and `adapters.ts` against a live `@kept/server` process backed by a disposable `households`-seeded PostgreSQL DB using a Node `fetch` + CookieJar transport replicating `KeptBridge` headers (`X-Kept-Native-Account`, `X-Kept-Native-Epoch`, `X-Kept-Sha256`, `Origin`, `User-Agent`). Passed `7/7` checks:
  1. PKCE login (`ibrahim@kept.test` -> `/native/connect` -> `/api/v1/native/exchange`, `Kept for iPhone` session).
  2. MFA login (`alfred@kept.test` TOTP enable + `twoFactorRedirect: true` + `verify-totp` + PKCE exchange, `secondFactor: true`).
  3. Authorized box lookup (`loadInventory` + `loadDetail` + `inventoryPath`).
  4. Offline JPEG + PDF capture -> `syncOutbox` -> original retrieval via `POST /api/v1/files/:id/url` + `GET /f/<token>` -> exact byte-length and SHA-256 verification.
  5. Idempotent replay (`replayCapture` with original `takenAt`/`idempotencyKey`, verified single record in box) and per-location duplicate-byte `deduplicatedFrom` handling.
  6. Label resolution (`resolveLabel` for assigned code, unknown code -> `not_in_your_kept`, foreign origin -> `foreign`).
  7. Native account isolation (`401`), native `sign-out` session revocation (`401`), and stale restore-epoch header rejection (`409`).

### Untested

- **Physical iPhone hardware & signed device build (blocked on hardware/Team signing):**
  - Core NFC physical tag `read`, `inspect`, `write` (NTAG213/215/216), `find`, occupied/locked/too-small tags, multi-tag polling, and mid-write pull recovery.
  - Physical camera capture, Quick Look media sheet UX, silent-switch haptics/ambient chime, VoiceOver on-device announcements, and force-quit + physical-device reboot outbox persistence.
  - Signed device build with Team ID & provisioning profile + optional `apple-app-site-association` Universal Links.

## Exact Build and Test Commands Used

- `cd apps/ios/NativeStore && swift test` -> exit `0` (`12 tests passed, 0 failures`).
- `pnpm exec vitest run --project @kept/web apps/web/src/native` -> exit `0` (`4 test files, 16 tests passed`).
- `pnpm exec biome check apps/web/src/native apps/web/vite.ios.ts && pnpm typecheck` -> exit `0`.
- `node scripts/check-i18n.mjs && node scripts/check-logical-css.mjs && node scripts/check-web-api-paths.mjs && node scripts/check-no-local-paths.mjs && node scripts/check-licences.mjs` -> exit `0`.
- `pnpm --filter @kept/web build:ios && pnpm --filter @kept/ios sync` -> exit `0`.
- `xcodebuild -project apps/ios/ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'platform=iOS Simulator,id=1B22FC17-F736-4834-9FFE-35B338860596' -derivedDataPath .tmp/ios-derived CODE_SIGNING_ALLOWED=NO build` -> exit `0` (`** BUILD SUCCEEDED **`).
- `xcrun simctl install 1B22FC17-F736-4834-9FFE-35B338860596 .tmp/ios-derived/Build/Products/Debug-iphonesimulator/App.app && xcrun simctl launch 1B22FC17-F736-4834-9FFE-35B338860596 info.keptinventory.nfc` -> exit `0`.
- Live dev server verification script against disposable `kept_ios_verify` database (dropped after test) -> exit `0` (`7/7` integration assertions passed).

## Current API and Shared-Contract Assumptions

- Same as `apps/ios/STATUS.md` (`/native/connect`, `/api/v1/native/exchange`, `X-Kept-Native-Account`, `X-Kept-Native-Epoch`, `PUT /api/v1/files/:fileId`, `POST /api/v1/files/:id/url`, `POST /api/v1/sync/ops`, `POST /api/v1/scan/resolve`).

## Requests and Dependencies Outstanding with Backend/Integration Agent

- Merge backend/shared native auth, `0179_native_capture_review.sql`, `reviewSuggestions` + `document` role support, and `resetNativeSyncEpoch` from the integration checkout into `main`.
- Reconcile root `pnpm-lock.yaml` after integrating `@kept/ios` and `@kept/web` Capacitor dependencies, then align `outbox.ts` directly to `@kept/shared`'s `CreateThingPayload`.
- Deploy `/.well-known/apple-app-site-association` on controlled HTTPS origins when enabling Associated Domains / Universal Links.

## Known Failures

- None in automated Swift, Vitest, lint, Simulator build/launch, or live-backend API checks.

## Physical-Device Checks Completed and Still Required

- **Completed:** None (physical iPhone and NTAG tags were not attached).
- **Required:** Complete all sections (A–E) of the Physical-Device Acceptance Checklist in `apps/ios/README.md`.

## Next Smallest Concrete Implementation Task

- After integration merge of backend/shared changes and Team signing configuration in Xcode (`<TEAM_ID>`), install on a physical iPhone over HTTPS (`https://<machine>.<tailnet>.ts.net`) and execute the Physical-Device Acceptance Checklist in `apps/ios/README.md`.
