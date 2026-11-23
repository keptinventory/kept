# Kept NFC iOS Client (MVP 1)

Bundled Capacitor iOS client with native Swift storage, Keychain credentials, Core NFC tag reading/writing/Find mode, camera and document capture, Quick Look media viewing, and durable offline synchronization against an existing Kept backend.


See the [NFC runbook](../../docs/runbooks/nfc-mvp.md) for the integrated setup and the [gate record](../../docs/mvp1/status.md) for device results.

## Inventory on iPhone

- Use **Capture inventory** to pick a room or box, enter the item, and add original photos and PDFs. Capture works offline with a cached destination. Open **Rooms** to browse rooms or create a room while connected.
- Open a bin or item and choose **Add photos** to record its appearance without changing the inventory. The **Photos** section shows available previews and opens the authorized file. **Edit** changes the record, **Move** changes its location, and **More actions** includes **Seen here**, **Not here**, and **Move to Trash**. Restore an item from **Trash** on the home screen.
- Use **Scan QR or NFC** to open an existing label. To print a bin label, open **QR and NFC label**, then **Share QR label PDF**. The 3 × 2 inch PDF uses the bin’s existing HTTPS label and opens in the iOS share sheet. Use **Print label sheets** for writable 8-, 12- or 24-label US Letter sheets. Scan a blank label to assign it to a new or existing box.
- **History** shows who performed a recorded action and when the server logged it. Capture records existing contents by default. Change **Action** to **Add contents** when you put something in. **Add photos** logs an observation. Use **Contents checked, unchanged** after checking every direct entry. **More actions** includes recording a location correction or removing an item to **Unplaced**. Bin history includes direct contents changes with recorded bin IDs. A record marked **Not here** keeps its last known location visible.

---

## Architecture

- **`apps/ios/NativeStore` (`KeptNativeStore` Swift Package):**
  - `Outbox.swift`: Actor-backed SQLite (`PRAGMA journal_mode = WAL`, `PRAGMA busy_timeout = 5000`) queue and protected pending-original storage (`excludedFromBackup`), staged file commits + startup manifest repair, `OutboxError.storageFull` mapping (`CocoaError.fileWriteOutOfSpace`, `ENOSPC`, `SQLITE_FULL`), scoped inventory cache, scoped `kv` storage (e.g. Find target state), atomic `retarget`, `clearFailure`, and `StorageStats`.
  - `NFCLogic.swift`: Strict NDEF label URL validator (`NFCLabelValidation`: HTTPS scheme + exact configured server origin match + `/l/<code>` Crockford folding), `NFCRepeatDebouncer` (2.5 s cooldown), `NDEFRecordSnapshot` SHA-256 fingerprint, and `FindOutcome`.
- **`apps/ios/ios/App/App` (Capacitor iOS Host & Swift Bridge):**
  - `KeptBridge.swift`: Privileged native Capacitor plugin registered only when the WKWebView loads the bundled `capacitor://localhost` / `app://` assets. Handles PKCE browser auth (`ASWebAuthenticationSession`), Keychain credentials (`KeptKeychain`), scoped native HTTP requests (`X-Kept-Native-Account`, `X-Kept-Native-Epoch`), raw file uploads (`X-Kept-Sha256`), `Outbox` actions, Quick Look preview (`QLPreviewController`), and `UIApplication` active/resign lifecycle observers.
  - `KeptNFC.swift`: Foreground `NFCNDEFReaderSession` coordinator for `.read`, `.inspect`, `.write(url, expected:)`, and continuous `.find` mode with repeat debounce, multi-tag polling restart (`restartPolling`), background interruption cleanup, and `KeptMatchFeedback` (`UINotificationFeedbackGenerator`, `AudioServicesPlaySystemSound`, `AVAudioSession` `.ambient`, and `UIAccessibility` VoiceOver announcements).
- **`apps/web/src/native/` (Bundled Web UI & Platform Adapters):**
  - `vite.ios.ts`: Dedicated production bundle config building `apps/web/dist-ios` (synced into `apps/ios/ios/App/App/public`).
  - `adapters.ts`: `PlatformAdapters` + `NativePlatformProvider` + `capacitorAdapters` isolating native bridge calls from shared/mobile UI modules.
  - `outbox.ts`, `inventory.ts`, `labels.ts`: Replay engine (`deduplicatedFrom` canonical ID handling, post-upload attachment verification, `reviewSuggestions: true`), offline cache + filename-tokenized local search, strict label URL checking, and unresolved-when-offline Find semantics.
  - `main.tsx`, `record.tsx`, `capture-form.tsx`, `label-panel.tsx`, `native.css`: Phone navigation, **Add to this box** destination-locked capture, multi-photo + PDF attachment pickers, non-blocking AI review, Find target persistence, failure retargeting, and RTL-ready logical CSS across all 8 locales.

---

## Development, Build, and Test Commands

Run commands from the repository root with Node 24 and the pnpm version pinned in `package.json`.

### 1. Fast Automated Checks & Tests

```sh
# Swift Package unit tests (Outbox durability, storage exhaustion, NFC validation & debounce)
swift test --package-path apps/ios/NativeStore

# Native adapter, outbox, inventory, label, UI workflow, and Arabic RTL Vitest suite
pnpm exec vitest run --project @kept/web apps/web/src/native

# Workspace typecheck, Biome, i18n catalogues, logical CSS, API path, local-path & licence gates
pnpm typecheck
pnpm exec biome check apps/web/src/native apps/web/vite.ios.ts
node scripts/check-i18n.mjs
node scripts/check-logical-css.mjs
node scripts/check-web-api-paths.mjs
node scripts/check-no-local-paths.mjs
node scripts/check-licences.mjs
```

### 2. Build Bundled Assets & Sync iOS Project

```sh
# Build the standalone iOS web bundle (apps/web/dist-ios) and copy it into ios/App/App/public
pnpm --filter @kept/ios sync

# Open Xcode project
pnpm --filter @kept/ios open
```

Build the ordinary server web bundle (`pnpm --filter @kept/web build`) for Apple linking and Kept MFA. Use a server build that supports [the Apple sign-in contract](../../docs/mvp1/integration-contract.md#session-and-capability).

### 3. Build & Launch on iOS Simulator

```sh
xcodebuild \
  -project apps/ios/ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=Kept NFC MVP' \
  -derivedDataPath .tmp/ios-derived \
  CODE_SIGNING_ALLOWED=NO \
  build
```

To test Keychain operations on Simulator cleanly, use Xcode or sign the simulator binary ad hoc (`CODE_SIGN_IDENTITY=-`). Install and launch on a booted simulator:

```sh
xcrun simctl install <SIMULATOR_UDID> .tmp/ios-derived/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch <SIMULATOR_UDID> info.keptinventory.nfc
```

*Simulator limitations:* Core NFC (`NFCNDEFReaderSession`), hardware camera capture, silent-switch haptics, and physical reboot persistence cannot execute on iOS Simulator and must be qualified on a physical iPhone.

---

## Device Setup: Signing, Entitlements, Tags, and HTTPS

### Xcode Signing & Bundle Identifier

1. Open `apps/ios/ios/App/App.xcodeproj` in Xcode (Xcode 26+ recommended, deployment target iOS 15.0+).
2. Select target **App** → **Signing & Capabilities**:
   - Choose your Apple Developer Team (`<TEAM_ID>`).
   - Use bundle identifier `info.keptinventory.nfc`. Kept verifies this exact Apple token audience.
   - Enable **Sign in with Apple** on that App ID in Apple Developer and refresh the development and distribution provisioning profiles. The server verifies the native identity token using Apple's public keys. This flow requires no Services ID, Apple callback URL or Apple private key. [Apple capability setup](https://developer.apple.com/help/account/identifiers/enable-app-capabilities/#enable-sign-in-with-apple).
   - Confirm **Near Field Communication Tag Reading** capability is enabled (maps to `com.apple.developer.nfc.readersession.formats` = `NDEF` in `App/KeptNFC.entitlements`).
   - Confirm **Keychain Sharing** / default app keychain access works for `KeptKeychain` (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`).

### Entitlements (`KeptNFC.entitlements` vs `KeptNFC-AssociatedDomains.entitlements`)

- **Default:** `CODE_SIGN_ENTITLEMENTS` points to `App/KeptNFC.entitlements` (foreground NFC tag reading without requiring domain association setup).
- **Optional Universal Links (`/l/*`):**
  1. Switch `CODE_SIGN_ENTITLEMENTS` in Xcode build settings to `App/KeptNFC-AssociatedDomains.entitlements`.
  2. Set `KEPT_NFC_ASSOCIATED_DOMAIN` to your exact Kept hostname (no scheme, no port).
  3. Serve `/.well-known/apple-app-site-association` on that HTTPS origin as `application/json` (HTTP 200, no redirect):

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "<TEAM_ID>.info.keptinventory.nfc",
        "paths": ["/l/*"]
      }
    ]
  }
}
```

Do not ship `apple-app-site-association` or switch Associated Domains unless the hosted domain matches the app's configured Kept server origin.

### Local Server & Phone-Reachable HTTPS

- **Bundled assets remain authoritative:** Leave Capacitor `server.url` unset in `capacitor.config.json` so the privileged `KeptNative` Swift bridge stays bound strictly to bundled `capacitor://localhost` assets.
- **Physical phone connectivity:** iPhones require trusted HTTPS for `ASWebAuthenticationSession` and NDEF URL labels (plain `http://` is permitted only on Simulator loopback). Expose your private dev server over Tailscale Serve or a reverse proxy with a trusted TLS certificate (for example `https://<machine>.<tailnet>.ts.net`), and set `KEPT_PUBLIC_URL` on the Kept server to that exact origin.

### NFC Tag Hardware Notes

- Use ISO 14443 Type A NDEF-formatted writable tags: **NTAG213** (~144 bytes usable NDEF), **NTAG215** (~504 bytes), or **NTAG216** (~888 bytes).
- Kept writes exactly **one NDEF URI record** containing `https://<configured-host>/l/<6-char-code>` (~38–60 bytes depending on hostname length). Short HTTPS hostnames comfortably fit NTAG213.
- **Zero secrets or inventory contents** are ever stored on a tag. Multiple tags and printed QR stickers can share the same identifier for one box.

---

## Physical-Device Acceptance Checklist

Execute against disposable boxes/tags on a physical iPhone (Core NFC requires iPhone 7+ / iOS 15+). Record **Device Model**, **iOS Version**, **Tag Type**, and **Observed Outcome** for each check.

### A. Authentication & Account Isolation
- [ ] **Standard PKCE login:** Enter `https://<configured-host>`, tap **Sign in**, approve consent in `ASWebAuthenticationSession`, verify box list loads and `/api/v1/me/sessions` shows a `Kept for iPhone` session.
- [ ] **MFA login:** Enable TOTP on test user, sign in from iPhone, complete 6-digit TOTP challenge inside system auth sheet, approve consent, confirm `secondFactor: true`.
- [ ] **Session expiry recovery:** Revoke the iPhone session from another browser's active sessions list, trigger a refresh/sync on iPhone, verify pending captures remain safe in outbox, re-sign in as the same user on the same server, and confirm pending captures sync cleanly.
- [ ] **Safe sign-out & server/account switching:** Create an offline draft, tap **Sign out**, verify warning confirmation dialog (`AlertDialog`), test canceling (**Stay signed in**), then sign in as another user/server and verify the prior account's cache, Find target, and pending captures are completely isolated.

### B. Mobile Capture, Documents, AI & Search
- [ ] **Box destination visibility:** Open a Box/Bin, confirm readable recorded-location path (e.g. `Home › Office › Shelf`), tap **Add to this box**, and verify the box name and path remain visible throughout capture.
- [ ] **Multi-photo & PDF manual capture (no AI):** Disconnect or disable AI, enter description `"Holiday decorations"`, add notes & optional quantity, take 2 photos via camera/library, attach 1 PDF document, tap **Save to box** → verify **Saved on device** appears immediately after SQLite/file commit.
- [ ] **Batch capture & sync:** Add a second entry in the same session, reconnect network, verify **Synced** only after backend confirms records and original files.
- [ ] **Original-file integrity:** Reopen the synced item, open both photos and the PDF via Quick Look, and verify exact pixel quality, PDF readability, and server SHA-256 checksums match.
- [ ] **AI suggestions review:** With an AI provider configured, capture with a photo, open the synced item via **Check AI suggestions** / **Recent capture batches**, edit or ignore suggestions, and save.
- [ ] **Search (online & offline):** Search online by name/note/code; disconnect network and verify cached search finds boxes, notes, codes, and PDF filenames inside attachments.

### C. NFC Identification, Enrollment & QR Fallback
- [ ] **NFC Identify (valid):** Scan a programmed NTAG213/215/216 tag → opens authorized box record with contents and location path.
- [ ] **Malformed / Unknown / Retired / Foreign / Inaccessible tags:**
  - Plain text or `http://` NDEF record → **Malformed** error.
  - `https://other.invalid/l/7KQ4MZ` → **Foreign server** error (no silent server switch).
  - Unowned/unknown/retired `/l/<code>` → privacy-preserving unavailable response.
  - Valid uncached tag while offline → explicit **Unresolved offline** message.
- [ ] **NFC Enroll (fresh & reuse QR):** On a box with an existing QR/short code, tap **Inspect NFC tag**, scan blank writable NTAG213/215/216, verify writable capacity check passes, write `/l/<code>`, read back & verify, confirm both old QR sticker and new NFC tag open the same box.
- [ ] **Enrollment edge cases:**
  - **Occupied tag:** Inspect a tag belonging to another box → verify owner name / deliberate overwrite confirmation prompt before writing.
  - **Locked / too-small tag:** Test a locked read-only tag and a capacity-constrained tag → clear refusal without corruption.
  - **Interrupted write recovery:** Pull tag out mid-write, tap **Inspect NFC tag** on the same tag → confirm deterministic payload inspection distinguishes verified write from unprogrammed/foreign payload.
- [ ] **QR & manual fallback:** Scan box QR code via camera and via manual 6-character Crockford entry; verify `O->0` / `I,L->1` folding works.

### D. Find Mode & Accessibility
- [ ] **Match vs nonmatch vs repeat:** Select Box A → **Find this box** → start foreground scan.
  - Tap Box B tag → distinct nonmatch UI + light tap haptic + session stays active.
  - Tap Box B tag again within 2.5 s → repeat debounce notice ("Same tag scanned again. Move to another box.").
  - Tap Box A tag → distinct match banner + `.success` haptic + chime + VoiceOver announcement.
- [ ] **Silent switch & VoiceOver:** Toggle physical silent/mute switch on iPhone → haptic and visual match still trigger distinctly; enable VoiceOver and verify accessible labels and match announcements.
- [ ] **Offline uncached tag in Find mode:** Disconnect network, scan an uncached tag → reports **unresolved**, NOT a verified nonmatch.
- [ ] **Multi-tag, cancellation, timeout & restart persistence:**
  - Bring 2+ tags into field or scan past single-shot read → polling continues cleanly.
  - Cancel session or let 60 s NFC timeout fire → box target remains selected with **Continue finding**.
  - Background/force-quit app mid-Find, reopen → resumable Find target banner restores Box A target cleanly.

### E. Crash, Force-Quit & Device Reboot Durability
- [ ] **Termination & reboot persistence:** Disconnect network, save a capture with 1 photo + 1 PDF until **Saved on device** shows, force-quit the app (`App Switcher` swipe up), reboot the physical iPhone, relaunch offline → verify draft remains visible with intact preview thumbnails/Quick Look PDF and zero data loss.
- [ ] **Reconnect replay & duplicate prevention:** Reconnect network, allow sync (or tap **Retry sync**), confirm capture uploads once with matching original hashes and outbox empties.
- [ ] **Storage exhaustion (`storage_full`) & retargeting:** Verify graceful error on low-storage save refusal (simulated/unit-verified cleanly) and retargeting a capture whose destination box was trashed via **Change box → Move and retry**.
