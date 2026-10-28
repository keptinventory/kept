---
title: Authentication
description: How people sign in, how sessions and second factors work, the same-site check, personal tokens, OAuth for MCP clients, and roles per location.
---

Kept uses Better Auth for sign-in, on its own database login
(`kept_auth`) with its tables in schema `auth`, and adds its own rules around it. The code is in
[`apps/server/src/auth`](https://github.com/keptinventory/kept/tree/main/apps/server/src/auth),
mounted at `/api/v1/auth/*`.

## Signing in

| Method | How | Notes |
|---|---|---|
| Email and password | Better Auth's `emailAndPassword` | A reset link carries its token in the URL `#fragment`; the web page posts it. Reset revokes every session |
| Magic link | `magicLink` plugin, 15 minutes | Signs in existing accounts only. Consumed by Kept's `POST /api/v1/auth/magic-link/verify`, never by a GET a mail scanner could follow; only a hash of the token is stored, as `magic-link:<hash>`, apart from a social sign-in's `auth-state:` records, so an OAuth `state` is never accepted as a magic link (better-auth 1.7.7 and later, GHSA-965c-763c-88jm; `auth/magic-link-oauth-state.test.ts`) |
| Passkey | `@better-auth/passkey`, relying party = the public URL's host | A passkey with user verification counts as two factors |
| Managed account | `username` plugin | A username and password, no real email (below) |
| OIDC | `genericOAuth`, when `KEPT_OIDC_ISSUER` is set and boot-time discovery worked | The account key is `sub`, never the email; linking is explicit only |
| Google | Better Auth's `socialProviders.google`, when `KEPT_GOOGLE_CLIENT_ID` and `_SECRET` are set | OIDC's rules (`auth/oidc.ts` `externalIdentityPolicy`, `keptOidc`), never autoprovision; `prompt=select_account`; Google's tokens are dropped (`auth/google.ts`) |

Sign-up isn't open by default. People join through Kept's own `POST /api/v1/auth/sign-up`, which
accepts only while sign-up is open (`KEPT_SIGNUP_OPEN`, or the admin setting) or with a live
invite, and answers a taken address the same as a free one. Better Auth's own sign-up endpoint,
its admin endpoints, email OTP, session listing and several others are switched off
(`DISABLED_AUTH_PATHS` in
[`auth/auth.ts`](https://github.com/keptinventory/kept/blob/main/apps/server/src/auth/auth.ts)).

Creating an account spans two logins: Better Auth creates the user as `kept_auth`, then
`ensureAccount()` creates the owner account, the Personal location, its Unplaced area and the
owner membership in one `kept_app` transaction. It runs from Better Auth's user-created hook,
again on every signed-in request (cached), and from the hourly `repair-orphans` job.

## Sessions and cookies

- **Lifetime.** Over HTTPS, 30 days, sliding (refreshed once a day of use). Over plain HTTP, 12
  hours, never renewed.
- **Cookies** are Better Auth's, HttpOnly, with `Secure` and the `__Secure-` prefix exactly when
  `KEPT_PUBLIC_URL` is `https`. Kept strips any `token` field from Better Auth's JSON bodies, so a
  page script never sees a session token.
- **Your devices** are listed with `GET /api/v1/me/sessions` and signed out with
  `DELETE /api/v1/me/sessions/:id`.
- **Client address.** Kept decides it from the socket, walking `X-Forwarded-For` only through
  `KEPT_TRUSTED_PROXIES` (`auth/client-ip.ts`), and hands Better Auth that one value. Every per-IP
  limit uses it. See [reverse proxies](/install/reverse-proxy/).

## Second factors

TOTP with backup codes (`twoFactor`), or a passkey with user verification. An emailed code is
**not** a second factor: email is the channel a magic link already used.

A TOTP code is accepted once (RFC 6238 §5.2): the last accepted 30-second step is kept per
account (`auth/totp.ts`, an `auth.verification` row written under the lock of the account's
`auth.two_factor` row), and a code of that step or an earlier one is refused, at sign-in, inside a
pending session and when an app is set up again.

Better Auth gates only some sign-in paths on two-factor, so Kept keeps its own flag per session
(`auth.session_mfa`) and fails closed (`auth/security.ts`): a session whose user has two-factor on
but hasn't proven it is **pending**, and every route refuses it with 403 `mfa_required` except
the ones that finish or abandon sign-in. Whether the session proved a factor becomes `app.mfa` in
the database scope, which hides locations with "require two-factor" until it is true
([row-level security](/developers/rls/)).

Changing the sign-in email, downloading the recovery kit, deleting the account and every change in
Settings → Sign-in and security need **re-authentication** (`auth/reauth.ts`): the password
again, or a sign-in in the last ten minutes for an account without one. The answer is 403
`reauth_required` with `reauth: 'password' | 'sign_in'`.

## Passkeys and the authenticator app

Settings → Sign-in and security goes through Kept's routes (`auth/sign-in-security.ts`), each
behind re-authentication:

| Route | Does |
|---|---|
| `GET /api/v1/me/sign-in` | Password or not, passkeys (name, date, synced), two-factor on and backup codes left, linked sign-ins, whether an email link signs in. Never a secret, a public key or a code |
| `POST /api/v1/me/passkeys/confirm` | Lets this session add one passkey in the next five minutes (an account with a password must, before Better Auth's registration) |
| `PATCH /api/v1/me/passkeys/:id` | Rename (1 to 64 characters) |
| `DELETE /api/v1/me/linked/:id` | Unlink an outside sign-in; 409 `last_sign_in_method` for the last way in |
| `DELETE /api/v1/me/passkeys/:id` | Remove; 409 `last_sign_in_method` when nothing else signs the account in, 409 `two_factor_required` for the last passkey while a location requires two-factor and the app is off |
| `POST /api/v1/me/two-factor/enable` | Start the authenticator app; on once Better Auth's `/two-factor/verify-totp` proves a first code |
| `POST /api/v1/me/two-factor/backup-codes` | Ten new codes; the old ones stop working |
| `POST /api/v1/me/two-factor/set-up-again` | Stage a new secret (encrypted, for this session, 15 minutes) |
| `POST /api/v1/me/two-factor/set-up-again/verify` | A code from the new app swaps the secret and the backup codes |
| `POST /api/v1/me/two-factor/disable` | Off; 409 `two_factor_required` while a location requires it and the account has no passkey |

Another person's passkey id answers 404, as a missing one. Adding a passkey is Better Auth's own
ceremony (`/passkey/generate-register-options`, `/passkey/verify-registration`), which needs a
sign-in in the last ten minutes, on an account with a password Kept's confirmation (403
`PASSKEY_CONFIRM_REQUIRED` without it), user verification and a discoverable credential, and
refuses `createSession` and names over 64 characters. Its answer to the browser carries no public
key or credential id, and it is audited (`passkey.add`).

Unlinking an outside sign-in is Kept's `DELETE /api/v1/me/linked/:id` (Better Auth's
`/unlink-account` answers 404 over HTTP): confirm-it's-you, 409 `last_sign_in_method` for the last
way in, then the other sessions are signed out, the owner is mailed and it is audited. Ways in are
counted in one transaction holding the account's row lock (`FOR NO KEY UPDATE` on `auth.user`),
which removing a passkey and unlinking both take, so neither can remove the last one at the same
moment as the other. The wait for the lock is short (2 s); past it the answer is 409 `conflict`.
A linked account counts only while its provider is configured. When Better Auth swaps the session
(turning two-factor on or off), the new one keeps the old one's sign-in time, so it never counts
as a fresh sign-in.

Better Auth's own two-factor, passkey and unlink management
(`/two-factor/enable`, `/disable`, `/generate-backup-codes`, `/get-totp-uri`,
`/passkey/list-user-passkeys`, `/update-passkey`, `/delete-passkey`, `/unlink-account`) answers
404 over HTTP (`SIGN_IN_MANAGEMENT_PATHS`): with `allowPasswordless` on, it would let any session
of a passwordless account turn two-factor off. Kept calls the two-factor ones through `auth.api`.

Set up again never uses Better Auth's `/two-factor/enable`, which refuses an account that has
two-factor on. The old secret signs in until the new one's first code is proven. Every change
except a rename signs out the other sessions and mails the owner.

## Limits

| What | Limit | Where |
|---|---|---|
| Sign-in attempts | 5 a minute per IP | Better Auth's limiter, database-backed (`auth.rate_limit`), shared by replicas |
| Sign-in failures | Per account **and** IP, 20 an hour, with growing delays instead of a lockout | `auth/sign-in-limiter.ts`, `auth.sign_in_failures` |
| Mailed-token redemptions | 30 an hour per IP | `auth/http.ts` |
| Anonymous request bodies | 16 KiB | `ANONYMOUS_BODY_LIMIT` |

## The same-site check

A request that carries a cookie and isn't a safe method must come from Kept's own pages
(`csrfHook` in [`auth/http.ts`](https://github.com/keptinventory/kept/blob/main/apps/server/src/auth/http.ts)):
its `Origin` is the origin of `KEPT_PUBLIC_URL`, or, when the browser sent no usable `Origin`,
`Sec-Fetch-Site: same-origin`. Anything else is 403 `forbidden` before the session is looked up
or the body read. This is why `KEPT_PUBLIC_URL` must be exactly the address the browser shows. A
request with a bearer token carries no cookie authority and skips it.

## How a route declares who may call it

Each route sets `config.auth`: `required` (the default), `optional` or `none` (health, the web
bundle, the OpenAPI document, the Better Auth mount, sign-up, setup, token-holding links). A
handler reads `req.scope` (`{userId, mfa, tokenId?}`) and runs its queries in
`withScope(app.pools.app, req.scope, …)`.

## Personal tokens

For scripts and Shortcuts: `Authorization: Bearer kpt_<lookup>_<secret>`
([`apps/server/src/tokens`](https://github.com/keptinventory/kept/tree/main/apps/server/src/tokens)).

- Made and revoked from a signed-in session at `/api/v1/tokens`, never by another token. Each
  has a scope (`read` or `write`), a list of locations and an optional expiry. The secret is shown
  once; the database stores an HMAC of it keyed from `KEPT_AUTH_SECRET`, which `kept_app` can't
  even select.
- A token acts as its creator, but row-level security intersects the creator's memberships with
  the token's locations on every statement, and a read token has nothing writable. Losing a
  membership takes that location from the token in the same transaction, as does dropping to
  viewer for a write token; a token whose last location goes is revoked.
- A token reaches only the routes listed in `TOKEN_ROUTES` (`tokens/access.ts`); sign-in, `/me`,
  tokens, the assistant, AI settings, secrets, exports, admin, members, invites and webhooks are
  never open to one.
- 120 reads and 30 writes a minute per token, counted in Postgres (`kept.token_rate_hit()`); a
  429 says when to retry.
- Its writes are audited as actor `token`, and it can undo only its own changes.

## OAuth for MCP clients

With an `https` public URL, Kept is also an OAuth 2.1 authorization server for MCP connectors
([`apps/server/src/oauth`](https://github.com/keptinventory/kept/tree/main/apps/server/src/oauth)):
authorization code with PKCE, clients identified by a Client ID Metadata Document URL (fetched
through the SSRF guard), no dynamic client registration. Access tokens are JWTs for
`<public URL>/mcp`, an hour long, and are accepted at `/mcp` only; the grant row holds the scopes
(`kept:read`, `kept:write`) and locations the person chose on the consent page, and is checked on
every call. The discovery documents are at `/.well-known/oauth-authorization-server` and
`/.well-known/oauth-protected-resource`.
The tools themselves are on [MCP](/developers/mcp/).

## Roles in a location

A membership's role is `owner`, `admin`, `member` or `viewer`. The full matrix is `MATRIX` in
[`packages/shared/src/roles.ts`](https://github.com/keptinventory/kept/blob/main/packages/shared/src/roles.ts),
and `can(role, action, ctx)` answers it: members add, edit and move things; admins manage
members, registries, webhooks and settings; only the owner sets secret-field policies, requires
two-factor, or transfers and deletes the location. Viewers see money only if the location allows
it. The services check `can()`; the database policies independently keep viewers from writing.
Instance administration is separate: the `instance_admins` table, checked by
`kept.is_instance_admin()`.

## Managed accounts

For someone who signs in with a username instead of an email address. An owner or admin creates one in a location
with a username and a display name (`POST /api/v1/locations/:id/managed-accounts`). Better Auth
needs an email, so the account gets a synthetic `…@managed.invalid` address that is never shown or
mailed. Nobody but the person knows the password: creation and later resets hand the admin a
one-time code, which the person redeems at `POST /api/v1/auth/reset-code` to set their own. A
location holds at most 20. See
[`managed/routes.ts`](https://github.com/keptinventory/kept/blob/main/apps/server/src/managed/routes.ts)
and [`auth/managed.ts`](https://github.com/keptinventory/kept/blob/main/apps/server/src/auth/managed.ts).
