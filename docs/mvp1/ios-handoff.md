# Kept NFC iOS Client MVP1 Handoff

## Branch and Working State

- **Branch:** `feat/ios-nfc-mvp`
- **Latest relevant commit:** `d301139d` (`feat(ios): seed iOS client baseline on isolated branch`) — next checkpoint commit immediately follows Step 2/3 Swift hardening.
- **Uncommitted changes:** Hardened `apps/ios/NativeStore` (`Outbox.swift`, `NFCLogic.swift`, `OutboxTests.swift`, `NFCLogicTests.swift`) and upgraded `apps/ios/ios/App/App` (`KeptNFC.swift`, `KeptBridge.swift`).

## Status Summary

### Implemented

- **`KeptNativeStore` (`apps/ios/NativeStore`):**
  - `Outbox.swift`: `OutboxError.storageFull` mapping (`CocoaError.fileWriteOutOfSpace`, `ENOSPC`, `SQLITE_FULL`), `PRAGMA busy_timeout = 5000`, scoped `kv` table (`readValue`/`saveValue`/`deleteValue`), `clearFailure`, atomic `retarget` preserving staged/committed originals and SHA-256 hashes, and `StorageStats` (`pendingCount`, `pendingBytes`, `cacheBytes`).
  - `NFCLogic.swift`: `NFCLabelValidation` (HTTPS + configured server origin match + Crockford `/l/<code>` short-code folding), `NFCRepeatDebouncer` (2.5s same-tag debounce), `NDEFRecordSnapshot` deterministic SHA-256 fingerprint, `FindOutcome`.
- **Swift Capacitor Bridge & Core NFC (`apps/ios/ios/App/App`):**
  - `KeptNFC.swift`: continuous foreground `.find` mode with repeat debounce, multi-tag `restartPolling`, `continuePolling`, `finishFind`, `interruptForBackground()`, and upgraded `KeptMatchFeedback` (`playMatch` with `.success` haptic + `.ambient` chime + VoiceOver announcement; `playNonMatch` with light impact haptic + announcement).
  - `KeptBridge.swift`: `willResignActive` / `didBecomeActive` lifecycle observers (`interruptForBackground` + `appState` event), `startFind`, `continueFind`, `finishFind`, `nonMatchFeedback`, `openPendingMedia`, `"nfcFind"` event, extended `outbox` actions (`retarget`, `clearFailure`, `stats`, `getValue`, `setValue`, `deleteValue`), `HTTPCookie` cookie extraction, optional `thing` in `openMedia` with `presentedViewController` guard, and `"storage_full"` error code rejection.

### Verified

- `cd apps/ios/NativeStore && swift test` → 12/12 tests passed (`NFCLogicTests`: 4, `OutboxTests`: 8).
- `pnpm --filter @kept/web build:ios && pnpm --filter @kept/ios sync` → exit 0.
- `xcodebuild -project apps/ios/ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'platform=iOS Simulator,name=Kept NFC MVP' CODE_SIGNING_ALLOWED=NO build` → `** BUILD SUCCEEDED **`.

### Untested

- TypeScript platform adapters, mobile workflow UX updates, i18n translations across all 8 catalogues, and Vitest native test suite — next step (Step 4 & Step 5).
- End-to-end iOS Simulator boot launch + real development backend verification on `feat/ios-nfc-mvp` — pending Step 6.
- Physical iPhone Core NFC hardware tests, camera capture, and device reboot persistence — requires physical iPhone and tags.

## Exact Build and Test Commands Used

- `cd apps/ios/NativeStore && swift test` → exit 0 (12 tests passed, 0 failures in 0.301s).
- `pnpm --filter @kept/web build:ios && pnpm --filter @kept/ios sync` → exit 0.
- `xcodebuild -project apps/ios/ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'platform=iOS Simulator,name=Kept NFC MVP' CODE_SIGNING_ALLOWED=NO build` → exit 0 (`** BUILD SUCCEEDED **`).

## Current API and Shared-Contract Assumptions

- Same as prior checkpoint (`/native/connect`, `/api/v1/native/exchange`, `X-Kept-Native-Account`, `X-Kept-Native-Epoch`, `PUT /api/v1/files/:fileId`, `POST /api/v1/files/:id/url` with optional `?thingId=`, `POST /api/v1/sync/ops`, `POST /api/v1/scan/resolve`).

## Requests and Dependencies Outstanding with Backend/Integration Agent

- Merge backend/shared native auth, capture `reviewSuggestions` / `document` role support, and `resetNativeSyncEpoch` from the integration checkout into `main`.
- Reconcile root `pnpm-lock.yaml` after integrating `@kept/ios` and `@kept/web` Capacitor dependencies.
- Provide `/.well-known/apple-app-site-association` on controlled HTTPS hosts if Associated Domains / Universal Links are enabled.

## Known Failures

- Baseline `check-i18n.mjs` still has missing translations for the seeded `src/native` strings until Step 5 runs `i18n:extract` and updates all 8 `.po` files.

## Physical-Device Checks Completed and Still Required

- **Completed:** None.
- **Required:** Full physical-device Core NFC, camera, Quick Look, VoiceOver, silent switch, and reboot acceptance suite.

## Next Smallest Concrete Implementation Task

- Step 4: Implement `apps/web/src/native/adapters.ts`, update `bridge.ts`, fix `outbox.ts` (`deduplicatedFrom` file ID handling, `reviewSuggestions` schema extension, attachment verification) and `labels.ts` (strict origin checks on QR `/l/<code>` URLs, ambiguous candidates), and upgrade mobile screens (`capture-form.tsx`, `record.tsx`, `label-panel.tsx`, `main.tsx`, `native.css`).
