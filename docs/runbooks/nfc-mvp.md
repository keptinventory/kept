# Kept NFC on iPhone

The first iPhone increment uses a bundled React interface, Capacitor, Core NFC and
Kept's existing PostgreSQL server. A box is a Kept thing with the Box / Bin type.
Captures, photographs, PDFs, label codes and AI suggestions use Kept's original
records and permissions.

## Development and installation

1. Follow [local setup](../../CONTRIBUTING.md#set-up) with Node 24, the pinned pnpm,
   and the development Compose services. Start with a disposable database and file
   store. Run `pnpm --filter @kept/server kept migrate` to apply the native
   capture migrations through 0181.
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
     -configuration Debug -destination 'generic/platform=iOS Simulator' \
     CODE_SIGN_IDENTITY=- build
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
already saved. Browser re-analysis of a review-only record creates another
suggestion for review. It preserves the manual record, aliases and containment
and keeps automatic multi-item expansion disabled for that record. A PDF is
attached as a document and stays out of image extraction. Ordinary browser
capture and text-semantic search keep their existing options.

## NFC and QR labels

Use formatted writable NDEF tags. NTAG213, NTAG215 and NTAG216 are candidates
for physical qualification. A short, trusted HTTPS hostname leaves more space
on a small tag. The payload is one NDEF URI record containing
`https://<configured-host>/l/<existing-code>`.

- Open the box and use **QR and NFC label**. **Inspect NFC tag** checks the
  current label assignment, writability and NDEF capacity. An occupied tag
  requires an explicit overwrite. Hold the same tag near the phone again
  to write it. The app compares the NDEF contents observed in the two scan
  sessions, then reads the written payload back to verify it. Different tags
  can present the same NDEF contents, including two blank tags.
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
work after a session expires. Every replay checks the server's capture
capabilities before uploading files. An incompatible server leaves pending
entries and originals available for retry after an upgrade.

After Kept restores a database, older pending work stays on the phone. Sign
back in as the same user on the same server to review held entries, preview
originals, or share them with the held-entry metadata and hashes. Held entries require
manual handling. Kept sync has a 90-day window for first submission of UUIDv7
operation IDs. See the [integration contract](../mvp1/integration-contract.md)
for the wire behavior.

The [backup and restore runbook](backup-restore.md) applies. Use the supported
Kept restore command for a local-storage installation so the server rotates
the restore epoch. The focused drill used real Restic and PostgreSQL 18 in a
disposable database with Kept's local blob store and a local Restic repository.
It used a native PKCE session to upload two original photos and a PDF, then
verified restored containment, notes, attachment roles, original lengths and
SHA-256 hashes, and the existing label URL. A fresh native exchange on the
restored app confirmed epoch rotation. The restored app refused stale-epoch
capability checks, uploads and queued writes.

```sh
KEPT_TEST_RESTIC=1 KEPT_RESTIC_BIN="$(command -v restic)" \
  pnpm exec vitest run --project @kept/server apps/server/src/backup/backup.test.ts \
  -t 'restores the NFC inventory capture'
```

On macOS, keep the Docker configuration that supplies your Compose plugin
available to the test. If your development services use a separate Compose
project name, pass it in `COMPOSE_PROJECT_NAME`.

For the Cloudflare R2 variant, create two empty private scratch buckets named
`kept-mvp1-drill-<12 lowercase hex digits>-source` and
`kept-mvp1-drill-<same digits>-recovered`. Make the following variables available
in the process environment, then run the same focused real-Restic command.

| Variable | Value |
| --- | --- |
| `KEPT_TEST_R2_SOURCE_BUCKET` | Scratch source bucket |
| `KEPT_TEST_R2_DESTINATION_BUCKET` | Paired scratch recovery bucket |
| `KEPT_TEST_R2_ENDPOINT` | The account's R2 S3 endpoint |
| `KEPT_TEST_R2_ACCESS_KEY_ID` and `KEPT_TEST_R2_SECRET_ACCESS_KEY` | Temporary R2 credentials scoped to both scratch buckets |

The fixture deletes its source objects after backing them up. It restores the
independent object backup before verifying the database and files together.
Empty and remove both scratch buckets when the run ends, then revoke the token.

Run the portable export drill separately. It imports a seeded location into a
populated server with conflicting codes and into a fresh server. It checks old
label URLs, newly issued codes and legacy aliases, and preservation of the
capture's AI review-only policy.

```sh
pnpm exec vitest run --project @kept/server apps/server/test/portability/round-trip.test.ts
```

## Automated verification

The [gate record](../mvp1/status.md) tracks G0–G6. The
[backend handoff](../mvp1/backend-handoff.md) records the tested revision,
GitHub job outcomes, rollback builds, test environment and device evidence.

```sh
pnpm typecheck
pnpm lint
bash scripts/ci-local.sh --only drift,licences
pnpm --filter '@kept/server...' build
pnpm --filter @kept/web build
pnpm --filter @kept/web build:ios
swift test --package-path apps/ios/NativeStore
KEPT_E2E_INSTANCES=signIn pnpm --filter @kept/web e2e e2e/native-auth.spec.ts --project=phone
pnpm exec vitest run --project @kept/web apps/web/src/native \
  apps/web/src/components/scan/iphone-labels.test.ts apps/web/src/offline/sync-engine.test.ts \
  apps/web/src/offline/extras.test.ts apps/web/src/pwa/pwa.test.tsx
pnpm exec vitest run --project @kept/server apps/server/src/auth/native.test.ts \
  apps/server/src/capture/capture.test.ts apps/server/src/sync/ops.test.ts \
  apps/server/src/sync/native-compat.test.ts apps/server/src/sync/ordering.test.ts \
  apps/server/src/extraction/extraction.test.ts apps/server/src/scan/scan.test.ts
```

For the shared sign-in fixture regression, run both
`e2e/native-auth.spec.ts` and `e2e/sign-in-security.spec.ts` against the
`signIn` instance. Each consent attempt creates its own password account
in the disposable database before enabling MFA. The passkey scenario
uses its own seeded account.

## Physical-device acceptance

Use only disposable boxes and fixtures. Record iPhone model, iOS version, tag
type, and observed behavior for each test.

| Scenario | Physical test |
| --- | --- |
| Sign-in and session | On the signed phone build, complete browser sign-in, MFA and consent. Verify the app returns to the signed-in view and a native session appears in Kept's active sessions. Reopen the app after a force-quit and verify session access. |
| Manual capture | Add “Holiday decorations” with notes, two photos and a PDF. Reopen and view the originals. |
| AI independence | Save while AI is disabled or unavailable, then enable a mock provider and edit a suggestion before accepting it. |
| NFC and QR | Scan both identifiers for the same box. Test an inaccessible, retired, malformed, and foreign-origin identifier. |
| Find | Select Box A. Scan Box B, Box A twice, then an uncached tag while offline. Check visual, haptic and sound feedback, including silent mode. Cancel, wait for timeout, and restart with Box A still selected. |
| Enrollment | Program a writable tag, confirm readback, replace it without changing QR, then try an occupied tag, a read-only tag, a too-small tag, multiple tags, and interruption during a write. |
| Offline and reconnect | Cache the box, disconnect, save a photo and PDF. Terminate the app and restart the device. Reopen and check the queue, reconnect, and verify one record with matching file hashes. |
| Isolation | Expire and renew the session, then switch accounts and servers. Verify that only the original context can view or sync its pending capture. |
| Restore | Sync one capture and leave another pending, then restore the server. Read the original physical tag, re-login as the same owner, and verify held review, original preview and export without replay. Sign in as a different account and check that the held originals are inaccessible. |

Record physical observations in the gate record. Continue with the
[production visual retrieval milestone](../mvp1/visual-retrieval-plan.md)
for R10 and R11.
