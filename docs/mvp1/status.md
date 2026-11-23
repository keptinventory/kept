# NFC MVP1 gate record

Evidence recorded November 22, 2026. The integrated code tested for G0, G1, G2, G4 and G5 is `efa7b1ec`. G3 cites the earlier feasibility report included at the audit revision `45761cb6`. G6 is untested as a pilot. See the [handoff](backend-handoff.md) for exact commands, test results and environment boundaries.

| Gate | Status | Evidence and remaining acceptance |
| --- | --- | --- |
| G0 · Baseline and hosting | **Passed** | The pinned workspace builds with Node 24 and pnpm 11. The development baseline uses the existing Fastify app, PostgreSQL 18 with pgvector, and local original storage. Builds and the disposable backup fixture are repeatable. |
| G1 · Native feasibility on a physical iPhone | **Pending** | Bundled UI, Swift tests and iOS Simulator compilation are recorded in the handoff. Use a signed iPhone build on a trusted development HTTPS origin to verify browser auth and MFA, camera, PDF access, Keychain and outbox across force-quit and reboot. |
| G2 · NFC correctness | **Pending** | Native regressions cover stale Find events and offline resolution in simulation. Verify NDEF read, write and readback, collision and failure paths, Find feedback, and QR fallback on the intended iPhone and tags. |
| G3 · Visual retrieval qualification | **Pending** | The four-image OpenCLIP run is feasibility evidence. R10 and R11 need the production implementation and held-out household qualification. [Visual retrieval plan](visual-retrieval-plan.md). |
| G4 · Isolation and synchronization | **Pending** | PostgreSQL/server checks cover authenticated v2 replay, v1 rollback, native account/epoch rejection, viewer/outsider access and media privacy. Swift and web regressions cover held scope and durable completion. The iOS client still needs the legacy capability 401 distinction described in the handoff. Complete physical re-login/account/server switching, restart and reconnect with pending originals, and the permission-race cases in the design. |
| G5 · Recovery | **Pending** | The real Restic/PostgreSQL local-storage drill recovered containment, originals, hashes and the old label URL and rejected stale-epoch work after a fresh native exchange. Complete old physical tag and same-owner held recovery on the iPhone, the applicable portable-code collision drill, and independent blob recovery for any external object-store configuration adopted. |
| G6 · Complete P0 pilot | **Pending** | R10 and R11 are unimplemented. Complete G1–G5 and the P0 household pilot before closing G6. |

Use the [physical-device checklist](../runbooks/nfc-mvp.md#physical-device-acceptance) and record the device model, iOS version, tag type, tested commit and observed results.
