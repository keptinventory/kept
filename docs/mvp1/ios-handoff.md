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

## Physical-device checkpoint

The initial signing check above preceded provisioning. The later signed Kept NFC 1.0 build 2 from `d128abff` installed and launched on an iPhone 17 Pro running iOS 27.2.1. The phone completed browser password and TOTP verification and received the expected consent redirect. The server received no final PKCE exchange at that checkpoint and issued no native session. [G1 device evidence](status.md#g1-device-evidence).

G1 remains pending. Complete the native session exchange, camera and PDF access, Keychain persistence and outbox durability across force-quit and reboot. Record the tested build and outcomes in the [gate record](status.md) while following the [physical-device checklist](../runbooks/nfc-mvp.md#physical-device-acceptance).

## November 23 authentication follow-up

The integration at `c70ca90a`, based on `9755d52a`, adds stage and status diagnostics in Kept NFC 1.0 build 3. Use subsystem `info.keptinventory.nfc` and category `NativeAuth` in Console. Browser start, completion, callback validation, the native exchange, Keychain and the first successful API response each produce a separate event. A custom-scheme delivery to the scene produces a separate observation. Authentication inputs and request details stay out of these events. The exchange and callback rules are the existing contract.

| Evidence | Result |
| --- | --- |
| iOS 27.0 Simulator, iPhone 17 Pro, diagnostic build 3 | The actual system browser session completed password, TOTP and consent against the disposable HTTPS Fastify server. The completion handler received the callback, state validation accepted it, the exchange returned HTTP 200, Keychain saved the session and an authorized API request returned 200. The disposable database reported one unexpired native session with MFA. Terminating and relaunching the app loaded the session from Keychain and produced another authorized response. Dismissing the browser delivered cancellation code 1, after which a fresh retry completed. |
| Simulator online capture | Selected two JPEGs in Photos and one PDF in Files, then saved **Holiday decorations** with notes under **Cable box**. The UI reported **Synced: 1**. The disposable database contained one matching record with roles `photo`, `photo`, `document` and review-only policy, with zero active AI providers. The stored originals matched all three input files and their database SHA-256 values at 956, 611 and 327 bytes. Reopening each attachment through Kept downloaded the original into Quick Look with identical bytes. |
| Physical iPhone 17 Pro, iOS 27.2.1 | The prior build 2 attempt reached consent and the server received no exchange. Build 3 compiled as an Apple Development-signed arm64 Release app with NDEF entitlement, passed signature verification, installed and read back as build 3. CoreDevice rejected foreground launch while the device was locked. The cause of the earlier physical handoff failure remains undetermined. |
| Focused automation | The bundled iOS web build and Capacitor sync passed. The 16 Swift package and 25 native web tests passed. Xcode 27.2 built and launched the ad hoc signed Debug simulator app and built the development-signed Release device app. |

Physical G1 and G2 still require an unlocked phone and operator interaction. On build 3, follow the sign-in and camera/PDF acceptance steps on the disposable server, then exercise force-quit, reboot, reconnect, original-file verification and context changes. The offline outbox reopen and scope checks were exercised in Swift tests. The complete disconnected capture, preview, reboot and replay sequence still needs device evidence. Repeat NFC tag programming, readback, NFC/QR Identify, Find and failure cases with the listed tags. The programmer compares NDEF contents across scans. Identical contents can be presented by different tags. [Physical-device checklist](../runbooks/nfc-mvp.md#physical-device-acceptance).

## Remaining limitations

- Held-work reconciliation/adoption into a restored server is intentionally unimplemented (bounded review, preview, metadata+originals Share Sheet export, and explicit discard only).
- End-to-end tests against a real rolled-back/upgraded HTTP server live in the server suite (`apps/server/src/sync/native-compat.test.ts`); phone UI rolled-back/401-probe flows were verified with fake transport doubles.
- Existing-record editing remains follow-on work. Browser visual search and the remaining held-out qualification are tracked in the [visual retrieval plan](visual-retrieval-plan.md).
