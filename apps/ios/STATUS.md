# Kept NFC iOS Client MVP 1 — Status & Interface Record

## Ownership Map

| Component / Area | Owner | Paths (branch `feat/ios-nfc-mvp`) |
| --- | --- | --- |
| iOS Xcode project, Swift bridge, Core NFC, SQLite Outbox | iOS client | `apps/ios/**` |
| Platform adapter boundary, native sync/search/label logic, phone UI | iOS client | `apps/web/src/native/**`, `apps/web/vite.ios.ts` |
| iOS bundle Capacitor config & scripts | iOS client | `apps/web/native/**`, `apps/web/package.json`, `apps/ios/package.json` |
| Web/native i18n message catalogues (8 locales) | iOS client (locale entries for `src/native`) | `apps/web/src/locales/{ar,de,es,fr,it,uk,vi,en}/messages.po` |
| Backend routes, migrations, RLS, shared contracts, root `pnpm-lock.yaml` reconciliation | Integration / Backend agent | `apps/server/**`, `packages/shared/**`, root `pnpm-lock.yaml` |

Note: No files under `apps/server/**` or `packages/shared/**` were modified on this iOS branch (`apps/web/src/native/outbox.ts` temporarily extends `CreateThingPayload` locally for `reviewSuggestions: true` so the branch typechecks against baseline HEAD until integration merge).

---

## Milestones & Checkpoints

1. **Milestone 1 — Bundled App & Adapter Foundation (`d301139d`):**
   Seeded Capacitor iOS host, `KeptNativeStore`, Swift bridge baseline, `vite.ios.ts`, and isolated worktree dependency installation (`pnpm install --frozen-lockfile`).
2. **Milestone 2 & 3 — Durable Local Store & Bridge Hardening (`ba63d05c`):**
   Added `OutboxError.storageFull`, `PRAGMA busy_timeout = 5000`, scoped `kv` storage, `clearFailure`, atomic `retarget`, `StorageStats`, `NFCLabelValidation`, `NFCRepeatDebouncer`, `NDEFRecordSnapshot`, continuous `.find` Core NFC session, `KeptMatchFeedback`, and foreground/background lifecycle listeners.
3. **Milestone 4, 5 & 6 — Platform Adapters, Mobile Capture/NFC/Find UI & Tests (`27295fea`):**
   Delivered `PlatformAdapters`/`NativePlatformProvider`, `deduplicatedFrom` file ID reconciliation, post-upload attachment confirmation, offline filename-tokenized search, strict origin URL validation, unresolved-when-offline Find semantics, Find target persistence, AI review without blocking manual capture, failure retargeting, safe sign-out confirmation, RTL logical CSS, and Vitest + Swift tests.
4. **i18n Completeness (`2c35d3a0`):**
   Extracted and translated all 143 native workflow strings across all 8 Lingui catalogues (`en`, `ar`, `de`, `es`, `fr`, `it`, `uk`, `vi`).
5. **Live Backend Joint Check, Setup Documentation & Final Handoff (current commit):**
   Verified TS client modules end-to-end against live `@kept/server` routes in a disposable `households`-seeded PostgreSQL DB, verified Simulator build/launch, and documented setup/checklist/handoff.

---

## Consumed Backend & Shared Contracts

- **Auth & Isolation:**
  - `GET /native/connect?challenge=&state=`, `POST /native/connect`, `POST /api/v1/native/exchange` (`{ code, verifier }`) -> `{ account, epoch }` + first-party `Kept for iPhone` session cookie.
  - Native request headers: `X-Kept-Native-Account`, `X-Kept-Native-Epoch`, `Origin`, `User-Agent: Kept for iPhone`.
  - Expects `401` on revoked/logged-out/mismatched-account requests and `409` on stale sync epoch after backup restore (`kept-native-sync-epoch`).
- **Files & Sync:**
  - `PUT /api/v1/files/:fileId?locationId=&class=evidence|document` with `Content-Type`, `Content-Length`, `X-Kept-Sha256` -> returns `FileView` (using canonical `uploaded.id` on per-location `deduplicatedFrom` hits).
  - `POST /api/v1/sync/ops` (`create_thing` with `idempotencyKey`, `reviewSuggestions: true`, `files: [{ fileId, role: 'photo' | 'document', sha256 }]`).
  - `POST /api/v1/files/:id/url?thingId=` (`{ variant: 'original' }`) -> `{ url, expiresAt }` -> `GET /f/<token>`.
- **Labels & Inventory:**
  - `GET /api/v1/sync/snapshot` paginated snapshot sync (`locations`, `types`, `places`, `things`, `codes`, `legacyCodes`, `removed`).
  - `POST /api/v1/scan/resolve`, `GET /api/v1/things/:id`, `GET /api/v1/things/:id/attachments`, `GET /api/v1/places/:id`, `POST /api/v1/things`.

### Outstanding Dependencies on Integration Agent

1. Merge backend native auth/capture/epoch routes (`0179_native_capture_review.sql`, `apps/server/src/auth/native.ts`, `capture/service.ts`, `extraction/apply.ts`) and shared schema updates (`CreateThingPayload.reviewSuggestions`, `document` role, audit actions) into `main`.
2. Reconcile root `pnpm-lock.yaml` after integrating `@kept/ios` and `@kept/web` Capacitor dependencies, then drop the temporary local `NativeCreateThingPayload` schema extension once `@kept/shared` exports `reviewSuggestions` directly.
3. Publish `/.well-known/apple-app-site-association` on controlled HTTPS hosts if Optional Universal Links (`KeptNFC-AssociatedDomains.entitlements`) are enabled.

---

## Verification Matrix

| Category | Status | Scope & Notes |
| --- | --- | --- |
| **Swift Unit Tests (`KeptNativeStore`)** | **Verified (12/12)** | `OutboxTests` (8): WAL durability, staged commit & startup repair, `storageFull` mapping, scoped KV, atomic retarget, clearFailure, stats, isolation. `NFCLogicTests` (4): HTTPS/origin `/l/<code>` Crockford validation, 2.5 s repeat debounce, deterministic SHA-256 NDEF snapshot fingerprint. |
| **Web Adapter & UI Tests (Vitest)** | **Verified (16/16)** | 4 test files (`inventory.test.ts`, `labels.test.ts`, `outbox.test.ts`, `native-app.test.tsx`): PKCE, offline photo+PDF outbox replay, `deduplicatedFrom`, attachment verification failure handling, strict label origin checks, Find mode match/nonmatch/repeat/offline-unresolved/timeout/restart, storage exhaustion, retargeting, safe sign-out confirm, and Arabic RTL logical-CSS check (uses jsdom + fake `PlatformAdapters`). |
| **Workspace Static & Lint Gates** | **Verified (0 errors)** | `pnpm typecheck`, `biome check`, `check-i18n.mjs` (7,129 messages / 8 locales), `check-logical-css.mjs`, `check-web-api-paths.mjs`, `check-no-local-paths.mjs`, `check-licences.mjs`, `pnpm --filter @kept/web build:ios`, `pnpm --filter @kept/ios sync`. |
| **iOS Simulator Build & Launch** | **Verified (Booted Launch)** | `xcodebuild` (`Debug` iphonesimulator, `CODE_SIGNING_ALLOWED=NO`) succeeded; installed & launched `info.keptinventory.nfc` on booted `Kept NFC MVP` simulator cleanly with WebKit local bundle load and Keychain query initialization. |
| **Real Dev Backend Joint Check** | **Verified (7/7 checks)** | Executed `outbox.ts`, `inventory.ts`, `labels.ts`, `adapters.ts` via Node `fetch` + CookieJar replicating `KeptBridge` headers against live `@kept/server` (`households`-seeded isolated DB): PKCE login, MFA TOTP (`twoFactorRedirect` + `secondFactor: true`), box access, offline photo+PDF capture -> sync -> `/files/:id/url` + `/f/<token>` byte & SHA-256 verification, idempotent replay + `deduplicatedFrom`, label resolution, account isolation (`401`), sign-out revocation (`401`), and epoch reset (`409`). |
| **Physical iPhone Hardware & Signing** | **Untested (Blocked: hardware & signing)** | Core NFC `NFCNDEFReaderSession` (`read`, `inspect`, `write`, continuous `find`, NTAG213/215/216, multi-tag, interrupted write recovery), hardware camera/photo library, Quick Look UI, VoiceOver + mute-switch haptics, and physical reboot persistence. Complete acceptance checklist is in `apps/ios/README.md`. |
