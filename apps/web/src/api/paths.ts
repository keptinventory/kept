/**
 * Every server path the web app calls, in one place, so a path that the server names differently
 * is fixed here and nowhere else.
 *
 * Where each one comes from:
 * - AUTH: Better Auth 1.7.13 endpoints (checked in node_modules/better-auth and
 *   @better-auth/passkey), mounted at /api/v1/auth by apps/server/src/auth/auth.ts.
 * - KEPT: Kept's own routes, checked against the routes the server registers
 *   (apps/server/src: each area's routes.ts, accounts/me.ts, auth/me.ts, auth/email-change.ts).
 */

const AUTH = '/api/v1/auth';
const V1 = '/api/v1';
const seg = (value: string) => encodeURIComponent(value);

export const paths = {
  auth: {
    signInEmail: `${AUTH}/sign-in/email`,
    signInUsername: `${AUTH}/sign-in/username`,
    signInMagicLink: `${AUTH}/sign-in/magic-link`,
    /**
     * Kept's `POST {token}` → `{mfaRequired}` (auth/http.ts). Better Auth's own GET with
     * `?token=` answers 404: a GET never consumes the token (D176).
     */
    magicLinkVerify: `${AUTH}/magic-link/verify`,
    signOut: `${AUTH}/sign-out`,
    getSession: `${AUTH}/get-session`,
    /** Proves a code: at sign-in, and the first one that turns the authenticator app on. */
    twoFactorVerifyTotp: `${AUTH}/two-factor/verify-totp`,
    twoFactorVerifyBackupCode: `${AUTH}/two-factor/verify-backup-code`,
    passkeyAuthenticateOptions: `${AUTH}/passkey/generate-authenticate-options`,
    passkeyVerifyAuthentication: `${AUTH}/passkey/verify-authentication`,
    /** Adding a passkey: both need a sign-in in the last ten minutes (`SESSION_NOT_FRESH`). */
    passkeyRegisterOptions: `${AUTH}/passkey/generate-register-options`,
    /** `{response, name}` → the passkey. */
    passkeyVerifyRegistration: `${AUTH}/passkey/verify-registration`,
    changePassword: `${AUTH}/change-password`,
    /** Better Auth: `{email}` → 200 either way; mails a `/auth/reset#token=…` link (3 an hour). */
    requestPasswordReset: `${AUTH}/request-password-reset`,
    /** Better Auth: `{token, newPassword}` from `/auth/reset#token=…`; signs out every session. */
    resetPassword: `${AUTH}/reset-password`,
    /** Kept's second step of an email change: `{token}` → `{stage}` (auth/email-change.ts). */
    emailChangeConfirm: `${AUTH}/email-change/confirm`,
    /** Kept's own sign-up (Better Auth's /sign-up/email is off): 202 `{next: 'sign-in'}`. */
    signUp: `${AUTH}/sign-up`,
    /** A managed account's one-time code (D164): `{username, code, newPassword}` → 204. */
    resetCode: `${AUTH}/reset-code`,
    /**
     * Better Auth's social and generic-OAuth start (`api/routes/sign-in.mjs`): `{provider: 'oidc',
     * callbackURL, errorCallbackURL, disableRedirect, additionalData?}` → `{url, redirect}` at the
     * IdP; the callback then returns to `callbackURL`, or to `errorCallbackURL?error=<code>`
     * (step 6 T16).
     */
    signInSocial: `${AUTH}/sign-in/social`,
    /** D176, D226: link an outside sign-in to the signed-in account, from a fresh session. */
    linkSocial: `${AUTH}/link-social`,
    /** The account's sign-in methods (password, OIDC, Google), never their tokens. */
    listAccounts: `${AUTH}/list-accounts`,
  },
  /** D147: `{version, revision, source}` (apps/server/src/http/health.ts). */
  version: '/version',
  setup: `${V1}/setup`,
  me: `${V1}/me`,
  mySessions: `${V1}/me/sessions`,
  mySession: (id: string) => `${V1}/me/sessions/${seg(id)}`,
  /** Starts an email change (Better Auth's /change-email is off): 202 `{stage: 'confirm_old'}`. */
  myEmailChange: `${V1}/me/email-change`,
  /** D225: GET what stops it, POST to ask (202 `{purgeAfter}`), DELETE to keep the account. */
  myDeletion: `${V1}/me/deletion`,
  /**
   * Settings → Sign-in and security (apps/server/src/auth/sign-in-security.ts). Every change takes
   * `{password?}`: 403 `reauth_required` with `reauth: 'password' | 'sign_in'` until it's you.
   * Better Auth's own two-factor and passkey management answers 404 over HTTP.
   */
  mySignIn: `${V1}/me/sign-in`,
  /** PATCH `{name, password?}` → the passkey; DELETE `{password?}` → 204, or 409
   * `last_sign_in_method`. */
  myPasskey: (id: string) => `${V1}/me/passkeys/${seg(id)}`,
  /** DELETE `{password?}` → 204: unlinks an outside sign-in (Better Auth's own row id, as
   * /list-accounts gives it); 409 `last_sign_in_method` for the last way in. Better Auth's
   * /unlink-account answers 404. */
  myLinked: (id: string) => `${V1}/me/linked/${seg(id)}`,
  /** `{password?}` → 204: this session may add one passkey in the next five minutes. */
  myPasskeyConfirm: `${V1}/me/passkeys/confirm`,
  myTwoFactor: {
    /** `{password?}` → `{totpURI, backupCodes}`; on once the first code is proven. */
    enable: `${V1}/me/two-factor/enable`,
    /** `{password?}` → 204, or 409 `two_factor_required`. */
    disable: `${V1}/me/two-factor/disable`,
    /** `{password?}` → `{backupCodes}`; the old ones stop working. */
    backupCodes: `${V1}/me/two-factor/backup-codes`,
    /** `{password?}` → `{totpURI}`; the current app keeps working until `setUpAgainVerify`. */
    setUpAgain: `${V1}/me/two-factor/set-up-again`,
    /** `{code}` → `{backupCodes}`. */
    setUpAgainVerify: `${V1}/me/two-factor/set-up-again/verify`,
  },
  locations: `${V1}/locations`,
  /** The owner's deleted locations still in their grace period. */
  locationsDeleted: `${V1}/locations/deleted`,
  location: (id: string) => `${V1}/locations/${seg(id)}`,
  locationRestore: (id: string) => `${V1}/locations/${seg(id)}/restore`,
  locationMembers: (id: string) => `${V1}/locations/${seg(id)}/members`,
  locationMember: (id: string, membershipId: string) =>
    `${V1}/locations/${seg(id)}/members/${seg(membershipId)}`,
  locationModules: (id: string) => `${V1}/locations/${seg(id)}/modules`,
  locationInvites: (id: string) => `${V1}/locations/${seg(id)}/invites`,
  /** Revoke a pending invite ("pending invites … Revoke"). */
  locationInvite: (id: string, inviteId: string) =>
    `${V1}/locations/${seg(id)}/invites/${seg(inviteId)}`,
  locationManagedAccounts: (id: string) => `${V1}/locations/${seg(id)}/managed-accounts`,
  managedResetCode: (userId: string) => `${V1}/managed-accounts/${seg(userId)}/reset-code`,
  invite: (token: string) => `${V1}/invites/${seg(token)}`,
  inviteAccept: (token: string) => `${V1}/invites/${seg(token)}/accept`,
  admin: {
    users: `${V1}/admin/users`,
    userAction: (id: string, action: AdminUserAction) => `${V1}/admin/users/${seg(id)}/${action}`,
    settings: `${V1}/admin/settings`,
    instanceAdmins: `${V1}/admin/instance-admins`,
    instanceAdmin: (userId: string) => `${V1}/admin/instance-admins/${seg(userId)}`,
    recoveryKit: `${V1}/admin/recovery-kit`,
    recoveryKitAcknowledge: `${V1}/admin/recovery-kit/acknowledge`,
    failedJobs: `${V1}/admin/jobs/failed`,
    failedJobAction: (id: string, action: 'retry' | 'discard') =>
      `${V1}/admin/jobs/failed/${seg(id)}/${action}`,
    alerts: `${V1}/admin/alerts`,
    status: `${V1}/admin/status`,
    /**
     * The embeddings source switch (step 6 T14, D207): `PUT {source}` → EmbeddingsStatus. Proposed by
     * T24 (the plan names no path); T14 confirms or renames it here.
     */
    embeddings: `${V1}/admin/embeddings`,
    /** The instance cap's per-account override picker: names only (D33). */
    accounts: `${V1}/admin/accounts`,
  },
} as const;

export type AdminUserAction = 'disable' | 'enable' | 'reset-2fa' | 'sign-out-everywhere';
