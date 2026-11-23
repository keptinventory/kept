# Kept NFC iOS Client MVP1 Handoff

## Branch and Working State

- **Branch:** `feat/ios-nfc-mvp` (branched from `main` at `8d890f96`)
- **Latest relevant commit:** Pending initial baseline seed commit on `feat/ios-nfc-mvp`
- **Uncommitted changes:** Initial iOS client seed (`apps/ios/`, `apps/web/native/`, `apps/web/vite.ios.ts`, `apps/web/src/native/`, `apps/web/package.json`, `apps/web/.gitignore`, `pnpm-lock.yaml` with Capacitor dependencies)

## Status Summary

### Implemented (Seeded Baseline)

- Capacitor 8.6.2 iOS shell (`apps/ios/`) bundling production Vite output (`apps/web/dist-ios` via `apps/web/vite.ios.ts`).
- `KeptNativeStore` Swift Package (`apps/ios/NativeStore`) with SQLite WAL outbox (`Outbox.swift`) and 3 unit tests.
- Swift Capacitor plugin (`KeptBridge.swift`, `KeptNFC.swift`) supporting PKCE `ASWebAuthenticationSession` auth, Keychain session storage, chunked original staging, and single-shot NFC read/inspect/write.
- Mobile React entry point (`apps/web/src/native/`): connect, inventory cache, box record view, capture form, label panel.

### Verified

- `pnpm install --frozen-lockfile` in the `feat/ios-nfc-mvp` worktree passed supply-chain checks (1304 entries) and installed 1108 packages.
- `cd apps/ios/NativeStore && swift test` passed 3/3 `OutboxTests` (0 failures).

### Untested

- Hardened `KeptNativeStore` features (`storage_full`, `kv` Find target persistence, `retarget`, NFC validation/debounce logic) — not yet implemented.
- Continuous foreground NFC Find mode, QR/typed Find fallback, `appState` lifecycle interruption, pending media preview, safe sign-out confirmation, and deduplicated upload `id` handling — not yet implemented.
- iOS Simulator build (`xcodebuild`) and real development backend E2E verification on this branch — pending.
- Physical iPhone hardware verification (Core NFC NDEF read/write/Find, camera capture, VoiceOver, Dynamic Type, device reboot persistence) — requires physical iPhone and tags.

## Exact Build and Test Commands Used

- `pnpm install --frozen-lockfile` (in isolated worktree) → exit 0 (1108 packages added, supply-chain policy check passed).
- `cd apps/ios/NativeStore && swift test` → exit 0 (3 tests passed, 0 failures in 0.040s).

## Current API and Shared-Contract Assumptions

- Native OAuth/PKCE bootstrap: `GET /native/connect?challenge=<s256>&state=<state>`, `POST /native/connect` → `kept-nfc://auth/callback?code=...&state=...`, `POST /api/v1/native/exchange` `{ code, verifier }` → `{ account, epoch }` + `Set-Cookie`.
- Native sync context headers on authenticated requests: `X-Kept-Native-Account: <uuid>` and `X-Kept-Native-Epoch: <uuid>` (409 on restored database epoch mismatch).
- Uploads: `PUT /api/v1/files/:fileId?locationId=<uuid>&class=evidence|document` with `X-Kept-Sha256` and `Content-Length` → `FileView` (note: `deduplicatedFrom` returns existing `id`).
- Sync operations: `POST /api/v1/sync/ops` with `create_thing` (`reviewSuggestions: true` keeps AI suggestions in inbox).
- Label resolution: `POST /api/v1/scan/resolve` `{ text, format? }` → `ScanOutcome`.

## Requests and Dependencies Outstanding with Backend/Integration Agent

- Backend/shared changes currently live uncommitted in the integration agent's checkout (`apps/server/src/auth/native.ts`, `apps/server/src/capture/service.ts`, `apps/server/src/extraction/apply.ts`, `apps/server/src/backup/restore.ts`, migration `0179_native_capture_review.sql`, `packages/shared/src/sync.ts` `reviewSuggestions`).
- Root `pnpm-lock.yaml` reconciliation remains owned by the integration agent; this branch carries the Capacitor lockfile entries locally so frozen-lockfile installs work in CI/worktrees.
- Optional Apple App Site Association (`/.well-known/apple-app-site-association`) endpoint on the controlled production/test HTTPS host if Universal Links / background NFC notification tap-to-open is enabled.

## Known Failures

- None yet on `feat/ios-nfc-mvp`; baseline `check-i18n.mjs` on the seeded prototype strings will be resolved after implementing the complete mobile UI and updating all 8 `.po` catalogues.

## Physical-Device Checks Completed and Still Required

- **Completed:** None (physical iPhone and physical NDEF tags not connected in this environment).
- **Required:** Full physical-device acceptance checklist (to be documented in `apps/ios/README.md`): photo & PDF capture, original-file SHA-256 verification, offline capture across app force-quit and device reboot, NFC Identify/Enroll/Find (NTAG213/215/216, read-only, multi-tag, removal mid-write, silent switch, VoiceOver, Dynamic Type, RTL).

## Next Smallest Concrete Implementation Task

- Step 2: Extend `apps/ios/NativeStore` (`Outbox.swift` with `storageFull`, `kv` table, `retarget`, `clearFailure`, `stats`; add `NFCLogic.swift` for label origin validation, repeat debouncer, and NDEF record fingerprinting) and add comprehensive unit tests in `OutboxTests.swift` and `NFCLogicTests.swift`.
