# Kept NFC iOS Client MVP1 — Hardening Handoff

## Commits

- **Starting point (audit base):** `45761cb6425a739b3fef9660bae7dae9d9fdac35` on `main`.
- **Pre-existing partial fix on `main`:** `b45ddce9` (boolean `sessionActive` guard in Find + preview-presentation guard) — superseded by explicit session identity.
- **Earlier hardening & backend integration base (`integration/mvp1`):** `c27eeb99`, `841258b9`, integrated through `6da5d2c5` (`docs/mvp1/integration-contract.md`, contract **v1**).
- **Hardening increment (`fix/ios-mvp1-hardening`):**
  - Implementation: `aab2fa98`
  - Regression tests: `3d6e58a3` (**final tested code + tests commit**)
  - Handoff docs: committed immediately after `3d6e58a3` on `fix/ios-mvp1-hardening`.

## Findings: reproduced, already fixed, newly corrected

| # | Finding | State |
| --- | --- | --- |
| P1 | Stale Find response after timeout/restart finishes a newer session | **Corrected & hardened.** Every Find run mints a session id (`newId()`) and increments a React generation counter invalidated on termination, cancel, unmount, and backgrounding (`appState`). `NFCFindSessionGate` and `KeptBridge` enforce a single active session and reject `continueFind`/`finishFind` without a matching non-empty `sessionId` (and `cancelTag` when a mismatched `sessionId` is supplied). `KeptNFC` echoes `sessionId` on every `nfcFind` event and terminal result, dispatches CoreNFC tag callbacks (`connect`, `queryNDEFStatus`, `readNDEF`, `writeNDEF`) onto `DispatchQueue.main.async` before touching state, and React drops `nfcFind` events without a matching `sessionId`. Cancellation immediately updates accessible status (`Scan cancelled.`). Ambiguous results stay explicitly unresolved without non-match feedback. |
| P2 | Discarded offline entry counted as "Synced" | **Corrected & hardened.** Swift `Outbox` maintains a durable `completions` table (`synced` only from `complete`, `discarded` only from `discard`). `Outbox.repair()` uses `cleanupCompleted` so crash recovery after a `discard` cleans up folders/rows without overwriting `.discarded` to `.synced`. `CaptureForm` partitions batch entries into strictly mutually exclusive buckets (`Synced`, `Saved on device`/`Syncing`, `Needs attention`, `Discarded`), counting an entry as `Synced` only after server confirmation and attachment verification record a `synced` completion. |
| P3 | Held pre-restore captures stranded with no review/export | **Corrected (bounded review/export).** `Outbox.heldEntries(current:)` and `Outbox.isHeldContext(_:current:)` require non-empty matching origin and canonical account with a differing non-empty epoch — cross-account and cross-server rows are rejected in Swift and `KeptBridge`. The UI displays held entries with destination box, user notes, file byte sizes, and full SHA-256 hashes, explains why automatic replay is paused (and that saved-on-device does not mean backed up), supports QuickLook preview (`openHeldMedia`), and exports a JSON manifest (preserving user `note` alongside `recoveryNotice` and SHA-256 hashes) plus copies of all protected originals via the native iOS Share Sheet (`exportHeldCapture` / `UIActivityViewController`) until explicit discard. No relabeling to the new epoch; ordinary context guards unchanged. |
| P4 | Older/rolled-back server compatibility | **Corrected (contract v1).** `replayCapture` negotiates `GET /api/v1/native/capture-capabilities` before any upload or capture mutation, verifies contract v1 + payload v2 support + matching `account`/`epoch`, sends `payloadVersion: 2`, and confirms sync identity and attachment hashes. When capabilities returns `401` (pre-negotiation server context hook before `404`), `ensureCaptureCompatible` probes `GET /api/v1/me` with the same session/context: `200` becomes a recoverable `compatibility_hold`, while `401`/`403` propagates as session expiry. Rate limits (`429`), `5xx`, and offline (`0`) stay retryable; `409` `restore_epoch_mismatch` and `mfa_required`/`two_factor_required` trigger restore/auth handling; missing/HTML/strict-schema responses become `compatibility_hold` without stripping `reviewSuggestions` or looping. |

## Files and behavior changed

- `apps/web/src/native/outbox.ts` — contract v1 `/api/v1/me` probe on capability `401`, `429` retryability, `isRestoreEpochMismatch` / `isAuthRefusal` helpers, fixed `heldCaptureExport` (`recoveryNotice` key instead of clobbering `note`, optional destination names).
- `apps/web/src/native/bridge.ts`, `adapters.ts` — added `exportHeldCapture` / `media.exportHeld`; session id on Find commands/events; durable outbox `discard`, `completions`, `heldList`, `discardHeld`, `openHeld`.
- `apps/web/src/native/label-panel.tsx` — strict `event.sessionId === sessionId` check, generation invalidation on cancel/timeout/unmount/background, immediate `Scan cancelled.` status, `isAuthRefusal`/`isRestoreEpochMismatch` handling, ambiguous-as-unresolved.
- `apps/web/src/native/capture-form.tsx` — mutually exclusive batch status counts (`Synced`, `Saved on device`/`Syncing`, `Needs attention`, `Discarded`).
- `apps/web/src/native/main.tsx`, `record.tsx` — native `exportHeld` Share Sheet export, held card size/destination display, unified `isAuthRefusal`/`isRestoreEpochMismatch` checks.
- `apps/ios/NativeStore/Sources/KeptNativeStore/NFCLogic.swift` — added `NFCFindSessionGate` enforcing single active session and rejecting stale/empty session commands.
- `apps/ios/NativeStore/Sources/KeptNativeStore/Outbox.swift` — `cleanupCompleted` helper preserving `.discarded` state across crash repair; empty-segment guard in `isHeldContext`; `completions`, `discard`, `heldEntries`.
- `apps/ios/ios/App/App/KeptNFC.swift` — echoed `sessionId` on Find events/results; wrapped CoreNFC tag callbacks (`connect`, `queryNDEFStatus`, `readNDEF`, `writeNDEF`) in `DispatchQueue.main.async`.
- `apps/ios/ios/App/App/KeptBridge.swift` — `NFCFindSessionGate` + strict `isCurrentFindCommand`/`canCancelTag`; `exportHeldCapture` presenting `UIActivityViewController` with metadata JSON + sanitized original copies and temp cleanup.
- Tests: `apps/web/src/native/outbox.test.ts`, `apps/web/src/native/native-app.test.tsx`, `apps/ios/NativeStore/Tests/KeptNativeStoreTests/NFCLogicTests.swift`, `apps/ios/NativeStore/Tests/KeptNativeStoreTests/OutboxTests.swift`.

## Shared contract and backend dependencies

- Consumes Integration Contract **v1** (`docs/mvp1/integration-contract.md`) and `capturePaths.nativeCaptureCapabilities` (`/api/v1/native/capture-capabilities`), already landed on `integration/mvp1` (`6da5d2c5`).
- Held-work reconciliation/adoption into a restored server remains out of scope until destination-permission, operation-identity, duplicate, and attachment-integrity rules are agreed.
- Native CI commands (for `.github/workflows/mvp1-ios.yml`):
  - `pnpm exec vitest run --project @kept/web apps/web/src/native`
  - `pnpm --filter @kept/web build:ios`
  - `pnpm --filter @kept/ios sync`
  - `swift test --package-path apps/ios/NativeStore`
  - `xcodebuild -project apps/ios/ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`
  - Signed device CI requires a development team and NFC provisioning profile for `info.keptinventory.nfc`.

## Checks run

Environment: macOS arm64, Node `v24.22.3`, pnpm `11.23.0`, Xcode `27.2` (`27B52`), Swift `6.4.2`.
Verified on tested code + tests commit `3d6e58a3`:

| Check | Result | Scope / Notes |
| --- | --- | --- |
| `pnpm exec biome check apps/web/src/native` | **Pass** (14 files, 0 errors, 0 warnings) | Native TypeScript/TSX sources & tests |
| `pnpm exec vitest run --project @kept/web apps/web/src/native/` | **25/25 passed** (4 files) | Uses platform doubles / fake adapters (not physical NFC): covers delayed Find resolution after timeout/cancel/background, stale `sessionId` events, ambiguous reads, failed/async/verified batch sync counts, discard-never-synced, held review/preview/export + cross-account/cross-server rejection, and capability `401` `/me` probe → upgrade → retry |
| `swift test --package-path apps/ios/NativeStore` | **16/16 passed** (`NFCLogicTests`: 5, `OutboxTests`: 11) | On-disk SQLite + file store tests including `NFCFindSessionGate`, `repair()` preserving `.discarded`, and `isHeldContext` rejection |
| `pnpm typecheck` | **Pass** (all workspace projects) | `packages/mcp`, `packages/shared`, `apps/web`, `apps/docs`, `apps/server` |
| `pnpm lint` | **Pass** (exit 0) | Full `biome check .` (2718 files, 0 errors; 11 pre-existing warnings in unrelated non-iOS files), `check-logical-css`, `check-i18n` (7140 messages in catalogues), `check-no-local-paths`, `check-ha-app`, `check-web-api-paths`, `check-setting-parity`, `check-compose-files` |
| `pnpm --filter @kept/web build:ios && pnpm --filter @kept/ios sync` | **Pass** | Bundled React iOS build (9951 modules) synced into `apps/ios/ios/App/App/public` (gitignored) |
| `xcodebuild … -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` | **BUILD SUCCEEDED** | Simulator compile + `xcrun simctl install` + `xcrun simctl launch` (`info.keptinventory.nfc`, simulator evidence only) |
| `xcodebuild … -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build` | **BUILD SUCCEEDED** | Unsigned generic iOS device compile verification |
| `xcodebuild … -destination 'generic/platform=iOS' build` (signed) | **Failed (team/profile missing)** | Fails with `Signing for "App" requires a development team` |

## Physical-device gate (not executed — do not treat MVP1 as fully qualified)

A signed physical-device build could not be produced: an **iPhone 17 Pro** running **iOS 27.2.1** is connected and an Apple Development certificate exists, but Xcode has **no development team selected in `App.xcodeproj` and no provisioning profile for `info.keptinventory.nfc`** with the Near Field Communication Tag Reading capability. No physical NFC, camera, haptic/audio, Keychain, or device-reboot result is claimed.

To execute the remaining physical qualification gate:
1. Select a development team in Xcode for the `App` target (`info.keptinventory.nfc`) with a provisioning profile enabling Near Field Communication Tag Reading.
2. Start a private HTTPS Kept server (`KEPT_PUBLIC_URL=https://…`) and build/install the signed `App` scheme onto the iPhone.
3. Run all physical acceptance steps in `docs/runbooks/nfc-mvp.md` (sign-in + MFA; notes + 2 photos + PDF + reopen originals; AI-unavailable save + editable suggestion; tag enrollment/readback + NFC & QR verification; Find Box A scanning B then A with repeated reads, delayed responses, cancel, and timeout/restart; offline save, force-quit, device reboot, reconnect -> 1 server record + matching hashes; session renewal & account/server isolation; disposable restored server label check + held-work review/preview/Share-Sheet export/discard).
4. Record device model, iOS version, tag type (`NTAG213`/`NTAG215`/`NTAG216`), commit SHA, and observed results in `docs/mvp1/status.md`.

## Remaining limitations

- Physical-device qualification above remains open; Vitest and simulator runs exercise fake bridges / simulator runtime only.
- Held-work reconciliation/adoption into a restored server is intentionally unimplemented (bounded review, preview, metadata+originals Share Sheet export, and explicit discard only).
- End-to-end tests against a real rolled-back/upgraded HTTP server live in the server suite (`apps/server/src/sync/native-compat.test.ts`); phone UI rolled-back/401-probe flows were verified with fake transport doubles.
- Existing-record editing and production visual retrieval remain follow-on work, unchanged.
