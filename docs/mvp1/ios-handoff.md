# Kept NFC iOS Client MVP1 — Hardening Handoff

## Commits

- **Starting point (audit base):** `45761cb6425a739b3fef9660bae7dae9d9fdac35` on `main`.
- **Pre-existing partial fix on this branch:** `b45ddce9` (boolean `sessionActive` guard in Find + preview-presentation guard) — kept and superseded by explicit session identity below.
- **Backend contract consumed:** `e93bfe2c` (`docs/mvp1/integration-contract.md`, contract **v1**) plus the backend agent's in-tree `capturePaths.nativeCaptureCapabilities`.
- **This increment:** branch `fix/ios-mvp1-hardening` — implementation, regression tests, and this handoff (see final commit list in git log).
- **Final commit:** recorded in git history for this branch (this file is committed with the test/docs commit).

## Findings: reproduced, already fixed, newly corrected

| # | Finding | State |
| --- | --- | --- |
| P1 | Stale Find response after timeout/restart finishes a newer session | **Newly corrected.** The boolean guard in `b45ddce9` covered one React closure but carried no identity across the native boundary: native `continueFind`/`finishFind`/`cancelTag` acted on whatever reader was current, native events carried no session, and `handleFindResult` did not re-check after async work. Now every Find run mints a session id (`newId()`), React invalidates its generation on termination/cancel/unmount/backgrounding, native echoes the id in every `nfcFind` event and terminal result, and `KeptBridge` ignores continue/finish/cancel whose id does not match the live `KeptNFC.sessionId`. |
| P2 | Discarded offline entry counted as "Synced" | **Newly corrected.** `CaptureForm` computed synced as `batch − pending`. The Swift outbox now records durable completions (`completions` table: `synced` only from `complete`, `discarded` only from the new `discard`), `discardCapture` uses the distinct native path, and the form counts only explicit `synced` completions, showing `Discarded:` separately. |
| P3 | Held pre-restore captures stranded with no review/export | **Newly corrected (bounded review/export).** `Outbox.heldEntries(current:)` discovers entries only when origin **and** canonical account match the authenticated session and the epoch differs — cross-account/cross-server contexts are rejected in Swift and re-checked in `KeptBridge` (`heldList`, `heldDiscard`, `openHeldMedia`). UI lists held entries with destination, notes, file names and SHA-256 hashes, offers authorized preview and JSON export (metadata + hashes), preserves originals until explicit discard, and explains that automatic replay is paused. No relabeling to the new epoch; ordinary guards unchanged. |
| P4 | Older/rolled-back server compatibility | **Newly corrected (client side, contract v1).** `replayCapture` negotiates `GET capturePaths.nativeCaptureCapabilities` before any upload/mutation, verifies contract v1 + payload v2 support + account/epoch match, sends `payloadVersion: 2` (stored v1 drafts keep the same body/identifiers), and verifies the sync result's `clientId`, `idempotencyKey`, `entity.type/id` before attachment confirmation. Missing endpoint/non-contract/mismatch and strict-schema or `server_outdated`/`client_outdated` responses become a recoverable `compatibility_hold` (action-required, so passive sync never loops) — payload kept intact, `reviewSuggestions` never stripped. |

Ambiguous Find results are now explicitly unresolved ("cannot confirm whether it is this box", no definitive non-match feedback), matching the existing unknown/inaccessible handling. Canonical box matching, repeated-read debounce, and match/non-match feedback are preserved. The server typecheck failure in `apps/server/src/extraction/extraction.test.ts` and the 51 obsolete i18n messages come from the backend agent's in-flight changes in this shared tree and are outside this increment.

## Files and behavior changed

- `apps/web/src/native/label-panel.tsx` — Find session id + generation invalidation (cancel/timeout/restart/unmount/background), stale-event and stale-resolution drops, ambiguous-as-unresolved.
- `apps/web/src/native/bridge.ts`, `adapters.ts` — session id on Find commands/events; outbox `discard`/`completions`/`listHeld`/`discardHeld`; media `openHeld`.
- `apps/ios/ios/App/App/KeptNFC.swift` — `sessionId` echoed in all Find events/results.
- `apps/ios/ios/App/App/KeptBridge.swift` — session-id guard on continue/finish/cancel; outbox actions `discard`, `completions`, `heldList`, `heldDiscard`; `openHeldMedia` with held-context verification.
- `apps/ios/NativeStore/Sources/KeptNativeStore/Outbox.swift` — durable `completions` table, `discard`, `completions(context:)`, `isHeldContext`/`heldContexts`/`heldEntries`.
- `apps/web/src/native/outbox.ts` — contract-v1 negotiation (`ensureCaptureCompatible`), payload v2, strengthened completion verification, `compatibility_hold` classification, distinct discard, held export builder.
- `apps/web/src/native/capture-form.tsx`, `main.tsx` — truthful batch counts (`Synced`/`Discarded`), held-captures review/export/preview/discard section, compatibility-hold message. "Saved on device" wording does not claim backup.
- `apps/web/src/locales/*/messages.po` — 11 new native strings in all 8 catalogues (hand-added to avoid a whole-catalogue extraction rewrite while the backend agent's source changes are in flight).
- Tests: `apps/web/src/native/outbox.test.ts`, `native-app.test.tsx` (fake harness now models sessions/completions/held), `apps/ios/NativeStore/Tests/KeptNativeStoreTests/OutboxTests.swift`.

## Shared contract and backend dependencies

- Integration contract **v1** (`docs/mvp1/integration-contract.md`): `GET /api/v1/native/capture-capabilities`, payload v2, `server_outdated`/`client_outdated` 409s, restore-epoch 409. The client consumes `capturePaths.nativeCaptureCapabilities` (backend-owned paths file).
- Depends on the backend agent landing its in-tree server/shared changes (capabilities route, v2 handling, migrations 0180/0181) and reconciling the shared lockfile. Held-work **reconciliation/adoption** remains out of scope until destination-permission, operation-identity, duplicate and attachment-integrity rules are agreed.
- Native CI needs: `pnpm --filter @kept/web build:ios`, `pnpm --filter @kept/ios sync`, `swift test --package-path apps/ios/NativeStore`, and an unsigned simulator `xcodebuild` (commands below). Signed device CI needs a development team + NFC provisioning profile for `info.keptinventory.nfc`.

## Checks run (macOS, Node 24 / pnpm 11.23.0, Xcode simulator iOS 27)

| Check | Result |
| --- | --- |
| `pnpm exec vitest run --project @kept/web apps/web/src/native/` | **20/20 passed** (4 files) — includes delayed-resolution-after-timeout, restart session-B-stays-active, discard-never-synced, held review/preview/discard, rolled-back-server hold→upgrade→retry |
| `swift test --package-path apps/ios/NativeStore` | **14/14 passed** — includes synced-vs-discarded durability and held discovery (permitted vs cross-account/cross-server rejection) |
| `pnpm exec biome check apps/web/src/native apps/ios/NativeStore` | Pass (no errors/warnings after cleanup) |
| `pnpm --filter @kept/web exec tsc --noEmit` | Pass. Root `pnpm typecheck` fails only in the backend agent's in-flight `apps/server` test file |
| `pnpm --filter @kept/web build:ios` + `pnpm --filter @kept/ios sync` | Pass |
| `xcodebuild … -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` | **BUILD SUCCEEDED**; `simctl install` + `launch info.keptinventory.nfc` on booted simulator succeeded (simulator/fake-bridge evidence only, not device evidence) |
| `node scripts/check-i18n.mjs` | All current messages present (51 obsolete entries are from the backend agent's in-flight sources) |
| `check-logical-css`, `check-web-api-paths`, `check-no-local-paths` | Pass |

## Physical-device gate (not executed — do not treat MVP1 as fully qualified)

A signed device build could not be produced: an iPhone 17 Pro (iOS 27.2.1, UDID `00008150-001104C902C1401C`) is connected and an Apple Development identity exists, but Xcode reports **no account for the development team and no provisioning profile for `info.keptinventory.nfc`** (Near Field Communication Tag Reading). No physical NFC, camera, haptic, or reboot-persistence result is claimed.

To execute the remaining gate: sign into the development team in Xcode, select it for the `App` target with an NFC-capable profile, build to the device over a trusted HTTPS origin, then run `docs/runbooks/nfc-mvp.md` physical acceptance: (1) sign-in + MFA, (2) notes + two photos + PDF, reopen originals, (3) AI-unavailable save then editable suggestion, (4) enroll tag, verify same box via NFC + QR, (5) Find Box A scanning B then A, repeated reads, delayed responses, cancellation, timeout/restart, (6) offline save, terminate app, reboot, recover pending, reconnect, (7) one server record + intact hashes, (8) session renewal + account/server isolation, (9) restored-server label check + held-work review/export, (10) record device model, iOS version and tag type (NTAG213/215/216) for each result.

## Remaining limitations

- Physical-device qualification above; simulator tests and fake bridge events are labeled simulator/fake evidence.
- Held-work reconciliation/adoption into a restored server is intentionally not implemented (review/export only).
- Compatibility negotiation is implemented to contract v1 and fake-server tests; end-to-end proof against the backend agent's finished rolled-back/upgrade servers lands with their integration run.
- Existing-record editing and production visual retrieval remain follow-on work, unchanged.
