# Kept NFC on iPhone

The first iPhone increment uses a bundled React interface, Capacitor, Core NFC and
Kept's existing PostgreSQL server. A box is a Kept thing with the Box / Bin type.
Captures, photographs, PDFs, label codes and AI suggestions use Kept's original
records and permissions.

## Development and installation

1. Follow [local setup](../../CONTRIBUTING.md#set-up) with Node 24, the pinned pnpm,
   and the development Compose services. Start with a disposable database and file
   store. Run `pnpm --filter @kept/server kept migrate` to apply migration 0179.
   Build the ordinary web app because the iPhone's system sign-in window opens
   the server's existing web sign-in and MFA pages.

   ```sh
   pnpm --filter @kept/web build
   pnpm --filter @kept/ios sync
   pnpm --filter @kept/ios open
   ```

2. Use Xcode 26 or later. Select the `App` scheme and an iPhone simulator or
   device. The iOS deployment target is 15.0. A Debug simulator build can connect
   to a loopback Kept server such as `http://localhost:8080`. Use an ad hoc
   simulator signature if needed so the simulator can exercise Keychain.

   ```sh
   xcodebuild -project apps/ios/ios/App/App.xcodeproj -scheme App \
     -destination 'generic/platform=iOS Simulator' CODE_SIGN_IDENTITY=- build
   ```

3. For physical testing, select your development team in Xcode and use a bundle
   ID and provisioning profile with Near Field Communication Tag Reading.
   Keep the test server private and set `KEPT_PUBLIC_URL` to the exact
   trusted HTTPS origin the phone uses. Follow the
   [HTTPS setup guidance](../../CONTRIBUTING.md#on-a-phone-https)
   to make the server reachable from the phone. Leave the Capacitor endpoint
   settings empty so the app continues to load its bundled assets.

4. Enter the server origin on the iPhone. Complete Kept's browser sign-in and
   MFA and approve “Connect Kept for iPhone.” The one-time PKCE exchange creates
   a separate first-party Kept session in Keychain. It appears in Kept's active
   sessions and follows the normal account and media permissions. Sign out
   before changing servers or accounts. An offline sign-out clears local session
   access and may leave a server session that can be revoked in Kept's active
   sessions list.

## Capture and review

Open or create a Box / Bin and choose **Add to this box**. A short description
is enough to save. Notes, a quantity, photographs and PDFs are optional.
Each selected file can be up to 25 MB, with up to 20 files per entry.
Keep adding entries on the same screen to group them in a batch for that box.
When Kept is reachable, open **Recent capture batches** for its saved entries
and review items.

When the AI module and a vision provider are available, Kept can suggest a
description from the first photo. Open the entry and choose **Check AI
suggestions** to edit and accept the suggestion or keep the description
already saved. A PDF is attached as a document, and it stays out of image
extraction. Existing web capture behavior and text-semantic search continue to
use their own options.

## NFC and QR labels

Use formatted writable NDEF tags. NTAG213, NTAG215 and NTAG216 are candidates
for physical qualification. A short, trusted HTTPS hostname leaves more space
on a small tag. The payload is one NDEF URI record containing
`https://<configured-host>/l/<existing-code>`.

- Open the box and use **QR and NFC label**. **Inspect NFC tag** checks the
  current label assignment, writability and NDEF capacity. An occupied tag
  requires an explicit overwrite. Hold the same tag near the phone again
  to write it. The app checks the existing contents again immediately before
  the write, then reads the written payload back to verify it.
- To replace a missing or damaged tag, enroll a new tag using the same box
  label. This preserves existing QR labels and any tags still carrying the
  same link. Kept has no per-tag revocation when several physical copies
  intentionally share an identifier.
- Use **Identify a label** for NFC, the existing QR camera decoder, or a typed
  code. Use **Find this box** to compare each resolved tag with the box you
  selected. Hold the top of the iPhone close to a single tag. Timeouts or
  cancellations leave the selected box available for another scan. There
  is no distance measurement or continuous background searching.
- If a tag leaves the field during a write, inspect it again. A verified
  payload for the intended box is safe to keep. A different payload should
  be treated as a new enrollment decision. Unknown, retired and inaccessible
  codes share Kept's privacy-preserving unavailable response. The app
  describes an uncached offline scan as unresolved.

### Optional Universal Links

Keep foreground NFC available before adding a domain association. On a controlled
HTTPS label hostname, deploy `/.well-known/apple-app-site-association` from the
proxy or web root using the signing team and bundle ID of the installed app.
Serve it as JSON over HTTPS, with no redirect. Scope the app's paths to `/l/*`.

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

Enable Associated Domains for the signed target. Use the optional
`App/KeptNFC-AssociatedDomains.entitlements` file in the iOS project as
`CODE_SIGN_ENTITLEMENTS` and set `KEPT_NFC_ASSOCIATED_DOMAIN` to the host.
Reinstall and test a known URL both with the app running and after terminating
it. The chosen host must match the app's configured Kept origin.
[Apple Associated Domains documentation](https://developer.apple.com/documentation/xcode/supporting-associated-domains).

## Offline and recovery

Previously synced inventory and labels can open and be searched offline.
Previously opened records can show saved notes and attachment metadata. Pending
captures can preview their protected originals on the phone.
Opening a server original, running AI, creating a new box, and programming a
tag need a connection. Captures inside a cached box can be saved with original
files while offline. The iPhone uses its SQLite outbox, separate from the
web application's browser queue.

**Saved on device** means original bytes and the SQLite entry were committed.
A manifest lets startup repair recover an interrupted commit. Originals stay in
protected storage until Kept confirms both the existing sync operation and its
file attachments. **Synced** means Kept confirmed those records and hashes.
If the phone runs out of space, free some space and retry the save. Leave Kept
open when connectivity returns, or use **Retry sync**.

If Kept reports that the destination box is missing or in Trash, choose **Change
box** on the failed capture and retry. This preserves the inventory ID and the
files saved on the phone. Kept uses a new request key for the corrected destination.

Pending entries belong to the original server, user and restore epoch.
Signing in again as the same user on the same server can resume ordinary pending
work after a session expires. After Kept restores a database, older pending
work stays on the phone and is held from replay. The MVP does not include
automatic reconciliation of entries from before a restore. Kept sync also has
a 90-day window for first submission of UUIDv7 operation IDs.

The [backup and restore runbook](backup-restore.md) applies. Use the supported
Kept restore command for a local-storage installation so the server rotates
the restore epoch. The focused drill used real Restic and PostgreSQL 18 in a
disposable database. It obtained a native PKCE session, uploaded two original
photos and a PDF, verified the signed downloads, and restored the box, notes,
SHA-256 hashes, and old label URL. It also checked that stale-epoch uploads
and capture replays were refused.

```sh
KEPT_TEST_RESTIC=1 KEPT_RESTIC_BIN="$(command -v restic)" \
  pnpm exec vitest run --project @kept/server apps/server/src/backup/backup.test.ts \
  -t 'restores the NFC inventory capture'
```

On macOS, keep the Docker configuration that supplies your Compose plugin
available to the test. If your development services use a separate Compose
project name, pass it in `COMPOSE_PROJECT_NAME`.

## Automated verification

The phone-sized Playwright MFA test completed the password and authenticator-code
sign-in, consent, PKCE exchange, and revocation against the development server.
The signed iPhone simulator build launched and displayed the connection screen.
An unsigned iPhone build compiled successfully. The native tests covered cached
label resolution, Find feedback, protected outbox files, and recovery from an
interrupted commit. A separate client check used a Node HTTP adapter against
the live development server and verified MFA, capture and replay, original
downloads, label resolution, and account and restore-epoch checks. Four existing
phone-sized web tests passed for capture, cached search, QR resolution, and
viewer permissions. The local-storage restore test passed with real Restic.

```sh
pnpm typecheck
pnpm lint
bash scripts/ci-local.sh --only drift,licences
swift test --package-path apps/ios/NativeStore
KEPT_E2E_INSTANCES=signIn pnpm --filter @kept/web e2e e2e/native-auth.spec.ts --project=phone
pnpm exec vitest run --project @kept/web apps/web/src/native \
  apps/web/src/components/scan/iphone-labels.test.ts apps/web/src/offline/sync-engine.test.ts \
  apps/web/src/pwa/pwa.test.tsx
pnpm exec vitest run --project @kept/server apps/server/src/auth/native.test.ts \
  apps/server/src/capture/capture.test.ts apps/server/src/sync/ops.test.ts \
  apps/server/src/scan/scan.test.ts
pnpm exec vitest run --project @kept/server apps/server/src/extraction/extraction.test.ts \
  -t 'named box capture'
```

## Physical-device acceptance

Use only disposable boxes and fixtures. Record iPhone model, iOS version, tag
type, and observed behavior for each test.

| Scenario | Physical test |
| --- | --- |
| Manual capture | Add “Holiday decorations” with notes, two photos and a PDF. Reopen and view the originals. |
| AI independence | Save while AI is disabled or unavailable, then enable a mock provider and edit a suggestion before accepting it. |
| NFC and QR | Scan both identifiers for the same box. Test an inaccessible, retired, malformed, and foreign-origin identifier. |
| Find | Select Box A. Scan Box B, Box A twice, then an uncached tag while offline. Check visual, haptic and sound feedback, including silent mode. Cancel, wait for timeout, and restart with Box A still selected. |
| Enrollment | Program a writable tag, confirm readback, replace it without changing QR, then try an occupied tag, a read-only tag, a too-small tag, multiple tags, and interruption during a write. |
| Offline and reconnect | Cache the box, disconnect, save a photo and PDF. Terminate the app and restart the device. Reopen and check the queue, reconnect, and verify one record with matching file hashes. |
| Isolation | Expire and renew the session, then switch accounts and servers. Verify that only the original context can view or sync its pending capture. |

No physical NFC result was recorded in the automated checks described here.
The [visual feasibility experiment](../../scripts/visual-retrieval/README.md)
is a separate local measurement. It leaves larger-dataset evaluation,
confidence thresholds and production authorization integration for follow-on work.
