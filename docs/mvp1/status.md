# NFC MVP1 gate record

Evidence updated November 23, 2026. The backend integration was tested at `efa7b1ec`, with focused checks and a repeat of the local-storage restore drill on consolidated `main` at `87121094`. The R2 recovery follow-up ran on `19427e2b` with the test extension. G1 has physical-device evidence from `d128abff`. G3 cites the feasibility report included at the audit revision `45761cb6`. G6 is untested as a pilot. [Commands, results and hosted runs](backend-handoff.md).

| Gate | Status | Evidence and remaining acceptance |
| --- | --- | --- |
| G0 · Baseline and hosting | **Passed** | The pinned workspace builds with Node 24 and pnpm 11. The development baseline uses the existing Fastify app, PostgreSQL 18 with pgvector, and local original storage. Builds and the disposable backup fixture are repeatable. |
| G1 · Native feasibility on a physical iPhone | **Pending** | Signed Kept NFC 1.0 build 2 from `d128abff` installed and launched on an iPhone 17 Pro with iOS 27.2.1. The development HTTPS server confirmed password, TOTP and consent from the phone. The signed app session exchange, camera and PDF access, Keychain persistence and durable outbox across force-quit and reboot remain to be verified. |
| G2 · NFC correctness | **Pending** | Native regressions cover stale Find events and offline resolution in simulation. Verify NDEF read, write and readback, collision and failure paths, Find feedback, and QR fallback on the intended iPhone and tags. |
| G3 · Visual retrieval qualification | **Pending** | The four-image OpenCLIP run is feasibility evidence. R10 and R11 need the production implementation and held-out household qualification. [Visual retrieval plan](visual-retrieval-plan.md). |
| G4 · Isolation and synchronization | **Pending** | PostgreSQL/server checks cover authenticated v2 replay, v1 rollback, native account/epoch rejection, viewer/outsider access and media privacy. Swift and web regressions cover held scope and durable completion. The later native candidate covers the legacy capability 401 distinction in adapter tests. Complete physical re-login/account/server switching, restart and reconnect with pending originals, and the permission-race cases in the design. |
| G5 · Recovery | **Pending** | Real Restic/PostgreSQL drills verified local-storage restore and independent Cloudflare R2 object recovery after source loss. Both checked originals and hashes, containment, the old label URL and stale-epoch rejection. A portable export/import drill exercised code collisions, legacy labels and review-only policy. The physical old-tag and same-owner held-work restore checks on iPhone remain pending. [R2 evidence](backend-handoff.md#cloudflare-r2-recovery-on-november-23-2026). |
| G6 · Complete P0 pilot | **Pending** | R10 and R11 are unimplemented. Complete G1–G5 and the P0 household pilot before closing G6. |

Use the [physical-device checklist](../runbooks/nfc-mvp.md#physical-device-acceptance) and record the device model, iOS version, tag type, tested commit and observed results.

## G1 device evidence

Xcode 27.2 built an arm64 Release app with an Apple development profile for `info.keptinventory.nfc` carrying the NDEF entitlement. Signature validation, CoreDevice installation readback and foreground launch passed. The detached build used the same team and bundle ID for both device builds.

The disposable fixture used PostgreSQL, local blob storage and a private HTTPS origin. Browser password and TOTP verification returned 200 on the phone. The consent form returned the expected 303. At this checkpoint the server had received no native exchange request and issued no native session. Local diagnostic and installation logs are under the ignored `.tmp/mvp1-g1/` directory.
