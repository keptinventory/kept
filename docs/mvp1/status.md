# NFC MVP1 gate record

Evidence updated November 23, 2026 for the integration code at `c70ca90a`, based on `9755d52a`. Prior recovery evidence includes local-storage restore on `87121094` and the R2 recovery follow-up on `19427e2b` with the test extension. The earlier physical-device checkpoint used `d128abff`. [Commands, results and hosted runs](backend-handoff.md).

| Gate | Status | Evidence and remaining acceptance |
| --- | --- | --- |
| G0 · Baseline and hosting | **Passed** | The pinned workspace builds with Node 24 and pnpm 11. The development baseline uses the existing Fastify app, PostgreSQL 18 with pgvector, and local original storage. Builds and the disposable backup fixture are repeatable. |
| G1 · Native feasibility on a physical iPhone | **Pending** | Signed build 3 installed and was read back on the iPhone 17 Pro with iOS 27.2.1. The device was locked during that follow-up. In the earlier Simulator run, MFA, native exchange, Keychain-backed relaunch and authorized API access passed. An online capture saved two photos and a PDF with AI disabled. Physical session exchange, camera, PDF and outbox durability remain to be verified. [iOS handoff](ios-handoff.md). |
| G2 · NFC correctness | **Pending** | Native regressions cover stale Find events and offline resolution in simulation. Verify NDEF read, write and readback, collision and failure paths, Find feedback, and QR fallback on the intended iPhone and tags. |
| G3 · Visual retrieval qualification | **Pending** | The opt-in whole-image R10 and R11 paths work in the built browser and real PostgreSQL/encoder checks. The separate-exposure smoke found the expected records and returned one false match for an absent query photo. Held-out household quality, abstention, coverage and performance remain to be qualified. [Visual retrieval results](visual-retrieval-plan.md#first-slice-evidence). |
| G4 · Isolation and synchronization | **Pending** | PostgreSQL/server checks cover authenticated v2 replay, v1 rollback, native account and epoch rejection, viewer and outsider access, and media privacy. Visual search tests cover session-bound input, revocation and stale-index rejection. Swift and web regressions cover held scope and durable completion. Physical re-login, account and server switching, offline restart and reconnect with pending originals, and the permission-race cases in the design remain pending. |
| G5 · Recovery | **Pending** | Real Restic/PostgreSQL drills verified local-storage restore and independent Cloudflare R2 object recovery after source loss. Both checked originals and hashes, containment, the old label URL and stale-epoch rejection. A portable export/import drill exercised code collisions, legacy labels and review-only policy. The physical old-tag and same-owner held-work restore checks on iPhone remain pending. [R2 evidence](backend-handoff.md#cloudflare-r2-recovery-on-november-23-2026). |
| G6 · Complete P0 pilot | **Pending** | Complete G1–G5, including held-out qualification for R10 and R11, and the P0 household pilot. |

The Apple-only sign-in increment after `a3f05d64` passed local Apple-token verification against a fixture key, the Kept MFA and PKCE handoff, and the real local-storage restore drill. Simulator and device compilation were unsigned. G1 stays pending until a provisioned iPhone completes the Apple flow and the capture and durability cases. [iOS handoff](ios-handoff.md#apple-only-iphone-sign-in).

Use the [physical-device checklist](../runbooks/nfc-mvp.md#physical-device-acceptance) and record the device model, iOS version, tag type, tested commit and observed results.

## G1 device evidence

Xcode 27.2 built an arm64 Release app with an Apple development profile for `info.keptinventory.nfc` carrying the NDEF entitlement. Signature validation, CoreDevice installation readback and foreground launch passed. The detached build used the same team and bundle ID for both device builds.

The disposable fixture used PostgreSQL, local blob storage and a private HTTPS origin. Browser password and TOTP verification returned 200 on the phone. The consent form returned the expected 303. At this checkpoint the server had received no native exchange request and issued no native session. Local diagnostic and installation logs are under the ignored `.tmp/mvp1-g1/` directory.
