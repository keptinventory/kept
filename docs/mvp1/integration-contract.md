# Kept native capture integration contract

Contract version **1** · 2026-11-22

This contract applies to the bundled iPhone app using the existing Kept server, session, uploads and sync ledger. The ordinary browser queue continues to send payload version 1.

## Session and capability

- Open `GET /native/connect?challenge=<PKCE-S256>&state=<state>` in system browser authentication. Kept's existing sign-in and MFA return to consent. Consent `POST /native/connect` redirects with HTTP 303 to `kept-nfc://auth/callback?code=<code>&state=<state>`. Verify state and exchange the single-use code with `POST /api/v1/native/exchange` and JSON `{"code":"…","verifier":"…"}`. HTTP 200 sets a first-party session cookie and returns `{"account":"<user UUID>","epoch":"<restore UUID>"}`.
- Fix the server origin to the selected connection. Use its session cookie and send `X-Kept-Native-Account: <account>` and `X-Kept-Native-Epoch: <epoch>` on native API requests. The account value identifies the signed-in user. The epoch identifies the current database generation.
- Before **each** replay attempt, including manual retry after being offline, send `GET /api/v1/native/capture-capabilities` with that session and both headers. HTTP 200, `Cache-Control: no-store` body:

  ```json
  {"contractVersion":1,"capturePayloadVersions":[2],"account":"<user UUID>","epoch":"<restore UUID>"}
  ```

  Verify the version, that the supported list contains 2, and that both context fields match. Check on the configured origin before the first upload or capture mutation. Keep the result for that attempt only. Treat missing route (404), non-contract response (including an HTML fallback), or missing supported version as recoverable server incompatibility. Retain the queued record, its request key and original files and retry negotiation when service returns or the server is upgraded. An already authenticated phone still negotiates.

## Replay and confirmation

- Upload with `PUT /api/v1/files/:fileId` using the existing upload query and headers, including native context and `X-Kept-Sha256`. On HTTP 200/201 use the returned canonical `id` and verify `sha256` and `bytes`; on deduplication the returned ID can differ from the requested ID. Keep upload identities stable across retries.
- Send `POST /api/v1/sync/ops` with the existing `{clientVersion, ops:[…]}` envelope. A native capture is `op: "create_thing"`, `payloadVersion: 2`, with the existing named box-capture fields, `reviewSuggestions: true`, and file roles `photo` or `document`. Keep the thing ID, client ID, operation key, timestamp and payload stable across retries. A v1 draft made by the earlier native client can send the same body and identifiers as v2. The server recognizes exact legacy-v1 ledger replays under the original key. Existing terminal outcomes retain their meaning.
- Version 2 is scoped to native review capture. Kept continues serving ordinary v1 operations and v1 snapshots. A v1-only server rejects v2 at the batch boundary with HTTP 409 `server_outdated` before writing an operation result. This also protects the ledger if the server changes after negotiation.
- Completion requires the matching sync result (`results[]` entry with the original `clientId` and `idempotencyKey`, `outcome: "applied"`, and `entity: {type: "thing", id: "<record UUID>", shortCode?: string | null}`). Also confirm every original against the `items` from `GET /api/v1/things/:id/attachments?limit=100` by attachment role, file `sha256` and `bytes`. A replayed result counts once when the phone durably completes its local entry. Until then retain the local queue entry and originals. Authorized original access uses `POST /api/v1/files/:id/url` and the returned short-lived download URL.

## Failure and recovery

Errors use Kept's `{error, code, hint?, …}` body. Network failure, HTTP 429, 5xx, a missing sync result, or unavailable attachment confirmation are retryable with the same identity. HTTP 401 or MFA-related refusal requires authentication for the same origin and user. HTTP 409 `server_outdated` or `client_outdated` blocks replay pending a compatible server or client respectively. Per-operation `target_missing` or `target_trashed` requires an authorized new destination. An explicit retarget retains the record and local files and uses a new operation key. Permission refusal, invalid payload, checksum mismatch or idempotency mismatch requires review of that capture.

Restore mismatch is HTTP 409 `{"code":"conflict","error":"…","reason":"restore_epoch_mismatch","hint":"…"}`. An authenticated exchange returning a different epoch for the same origin/account also identifies a restore or replacement. Hold pre-restore entries and originals under their original scope. Ordinary pending replay requires the same origin, account and epoch. Same-origin, same-owner held entries can be reviewed or exported after re-login. Keep held entries inaccessible to other accounts and origins. Automatic replay or reconciliation of held work is outside this contract.
