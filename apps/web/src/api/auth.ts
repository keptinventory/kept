/** Better Auth calls (sign-in, second factor, passkeys), and Kept's Sign-in and security
 * routes. Paths in ./paths.ts. */
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { assistantStore } from '@/assistant/store';
import { TRY } from '@/try/flag';
import { api } from './client';
import { paths } from './paths';
import type {
  EmailChangeStage,
  PasskeyView,
  SignInMethod,
  SignInResult,
  SignInSecurity,
  SignUpBody,
  TwoFactorEnableResult,
} from './types';

/** "Email or username" is one field: an @ means an email (managed accounts have none, D47). */
export function signInWithPassword(identifier: string, password: string) {
  const id = identifier.trim();
  return id.includes('@')
    ? api.post<SignInResult>(paths.auth.signInEmail, { email: id, password })
    : api.post<SignInResult>(paths.auth.signInUsername, { username: id, password });
}

/** The generic OIDC provider's fixed id on the server (the callback is `/callback/oidc`). */
export const OIDC_PROVIDER_ID = 'oidc';
/** Google's (1.2, D226): the callback is `/callback/google`. */
export const GOOGLE_PROVIDER_ID = 'google';
/** An outside sign-in: the instance's OIDC provider, or Google. */
export type OutsideProvider = typeof OIDC_PROVIDER_ID | typeof GOOGLE_PROVIDER_ID;

/**
 * Starts "Sign in with <name>" (step 6 T16, D127): the server answers the IdP's URL, which the page
 * then opens. Back from the IdP, Kept lands on `callbackURL`, or on `errorCallbackURL` with
 * `?error=<code>`. An invite's token travels in `additionalData` (the invite path a trial run settled on), so a
 * new person invited here can join with the IdP; Kept never links on email alone (D176).
 */
export function startOidcSignIn(opts: {
  /** Default: the instance's OIDC provider. */
  provider?: OutsideProvider;
  callbackURL: string;
  errorCallbackURL: string;
  inviteToken?: string;
}) {
  return api.post<{ url: string; redirect: boolean }>(paths.auth.signInSocial, {
    provider: opts.provider ?? OIDC_PROVIDER_ID,
    callbackURL: opts.callbackURL,
    errorCallbackURL: opts.errorCallbackURL,
    disableRedirect: true,
    ...(opts.inviteToken ? { additionalData: { inviteToken: opts.inviteToken } } : {}),
  });
}

/**
 * Links an outside sign-in to the signed-in account (D176, D226): the server answers the provider's
 * URL, which the page opens; back from it, Kept lands on `callbackURL`, or on `errorCallbackURL`
 * with `?error=<code>`. A session older than ten minutes is refused (`SESSION_NOT_FRESH`).
 */
export function startLinkSignIn(
  provider: OutsideProvider,
  opts: { callbackURL: string; errorCallbackURL: string },
) {
  return api.post<{ url: string; redirect: boolean }>(paths.auth.linkSocial, {
    provider,
    callbackURL: opts.callbackURL,
    errorCallbackURL: opts.errorCallbackURL,
    disableRedirect: true,
  });
}

/** The account's sign-in methods: `credential` (a password), `oidc`, `google`. */
export const listSignInMethods = () => api.get<SignInMethod[]>(paths.auth.listAccounts);

/** Unlinks one (by Better Auth's row id), after confirm-it's-you: the password, or a sign-in in
 * the last ten minutes on an account without one. Never the last way in (409
 * `last_sign_in_method`). */
export const unlinkSignInMethod = (id: string, password?: string) =>
  api.del(paths.myLinked(id), password ? { password } : {});

/** The server mails a link to /auth/confirm#token=…; the fragment never reaches it. */
export function requestMagicLink(email: string) {
  return api.post<{ status: boolean }>(paths.auth.signInMagicLink, { email: email.trim() });
}

/** POSTs the token from the fragment (D176, D181). Never called on page load. */
export function confirmMagicLink(token: string) {
  return api.post<{ mfaRequired: boolean }>(paths.auth.magicLinkVerify, { token });
}

/** Every way out (the menu, the app lock, the orphaned queue, a cancelled second factor) comes
 * here, so the assistant's draft and thread go too: the next person on this device mustn't see
 * them (its store lives outside React and survives the sign-in page). */
export function signOut() {
  assistantStore.reset();
  return api.post<unknown>(paths.auth.signOut);
}

export function verifyTotp(code: string) {
  return api.post<unknown>(paths.auth.twoFactorVerifyTotp, { code: code.replace(/\s+/g, '') });
}

export function verifyBackupCode(code: string) {
  return api.post<unknown>(paths.auth.twoFactorVerifyBackupCode, { code: code.trim() });
}

const reauthBody = (password: string | undefined) => (password ? { password } : {});

/**
 * Starts the authenticator app: the secret and backup codes exist, but it is on only after
 * verifyTotp. `password` on an account with one; without, a sign-in in the last ten minutes.
 */
export function enableTwoFactor(password?: string) {
  return api.post<TwoFactorEnableResult>(paths.myTwoFactor.enable, reauthBody(password));
}

/** What signs this account in: passkeys, the authenticator app, a password, outside sign-ins. */
export const getSignInSecurity = () => api.get<SignInSecurity>(paths.mySignIn);

export const renamePasskey = (id: string, name: string, password?: string) =>
  api.patch<PasskeyView>(paths.myPasskey(id), { name: name.trim(), ...reauthBody(password) });

/** 409 `last_sign_in_method` when nothing else would sign the account in. */
export const removePasskey = (id: string, password?: string) =>
  api.del(paths.myPasskey(id), reauthBody(password));

/** 409 `two_factor_required` while a location asks for it and no passkey can stand in. */
export const disableTwoFactor = (password?: string) =>
  api.post<void>(paths.myTwoFactor.disable, reauthBody(password));

/** Ten new backup codes, shown once; the old ones stop working. */
export const newBackupCodes = (password?: string) =>
  api.post<{ backupCodes: string[] }>(paths.myTwoFactor.backupCodes, reauthBody(password));

/** Lets this session add one passkey in the next five minutes: an account with a password must
 * give it before Better Auth's registration (403 `PASSKEY_CONFIRM_REQUIRED` otherwise). */
export const confirmPasskeyAdd = (password?: string) =>
  api.post<void>(paths.myPasskeyConfirm, reauthBody(password));

/** A new secret for a new app; the current app keeps working until finishSetUpAgain. */
export const startSetUpAgain = (password?: string) =>
  api.post<{ totpURI: string }>(paths.myTwoFactor.setUpAgain, reauthBody(password));

/** A code from the new app: the new app replaces the old one, with ten new backup codes. */
export const finishSetUpAgain = (code: string) =>
  api.post<{ backupCodes: string[] }>(paths.myTwoFactor.setUpAgainVerify, {
    code: code.replace(/\s+/g, ''),
  });

export function changePassword(currentPassword: string, newPassword: string) {
  return api.post<unknown>(paths.auth.changePassword, {
    currentPassword,
    newPassword,
    revokeOtherSessions: true,
  });
}

/** Thrown when the browser has no WebAuthn or the person cancels the passkey prompt. */
export class PasskeyCancelled extends Error {
  constructor() {
    super('Passkey sign-in was cancelled');
    this.name = 'PasskeyCancelled';
  }
}

/** The passkey ceremony, as Better Auth's own passkey client runs it. */
export async function signInWithPasskey(): Promise<unknown> {
  // biome-ignore lint/suspicious/noExplicitAny: the options JSON is passed through untouched
  const optionsJSON = await api.get<any>(paths.auth.passkeyAuthenticateOptions);
  let response: Awaited<ReturnType<typeof startAuthentication>>;
  try {
    response = await startAuthentication({ optionsJSON });
  } catch {
    throw new PasskeyCancelled();
  }
  const { clientExtensionResults: _ignored, ...body } = response;
  return api.post<unknown>(paths.auth.passkeyVerifyAuthentication, { response: body });
}

/** The browser already holds a passkey of this account for Kept. */
export class PasskeyExists extends Error {
  constructor() {
    super('This device already has a passkey for this account');
    this.name = 'PasskeyExists';
  }
}

/**
 * Adds a passkey to the signed-in account: Better Auth's registration ceremony. It needs a
 * sign-in in the last ten minutes (403 `SESSION_NOT_FRESH`) and, with mail on, a verified address
 * (403 `EMAIL_UNVERIFIED`). Throws PasskeyCancelled when the person closes the browser's dialog.
 */
export async function addPasskey(name: string): Promise<PasskeyView> {
  // biome-ignore lint/suspicious/noExplicitAny: the options JSON is passed through untouched
  const optionsJSON = await api.get<any>(paths.auth.passkeyRegisterOptions);
  let response: Awaited<ReturnType<typeof startRegistration>>;
  try {
    response = await startRegistration({ optionsJSON });
  } catch (err) {
    if ((err as { code?: unknown }).code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
      throw new PasskeyExists();
    }
    throw new PasskeyCancelled();
  }
  return api.post<PasskeyView>(paths.auth.passkeyVerifyRegistration, {
    response,
    name: name.trim(),
  });
}

export function passkeysSupported(): boolean {
  // Try Kept (D246) never asks the browser for a passkey.
  if (TRY) return false;
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function';
}

/** Open sign-up, or sign-up with an invite token. Never says whether the address was taken. */
export function signUp(body: SignUpBody) {
  return api.post<{ next: 'sign-in' }>(paths.auth.signUp, body);
}

/** Sets a managed account's password with the one-time code its admin handed over (D164). */
export function redeemResetCode(username: string, code: string, newPassword: string) {
  return api.post<void>(paths.auth.resetCode, {
    username: username.trim(),
    code: code.replace(/[\s-]/g, '').toUpperCase(),
    newPassword,
  });
}

/** Mails a reset link if the address has an account; the answer is the same either way. */
export function requestPasswordReset(email: string) {
  return api.post<unknown>(paths.auth.requestPasswordReset, { email: email.trim() });
}

/** From `/auth/reset#token=…` (a reset mail or `kept admin reset-password`). Signs out everywhere. */
export function resetPassword(token: string, newPassword: string) {
  return api.post<unknown>(paths.auth.resetPassword, { token, newPassword });
}

/**
 * The link from an email-change mail (`/auth/email-change#token=…`). The first link (to the old
 * address) answers `verify_new` and mails the new one; that one's link answers `done`.
 */
export function confirmEmailChange(token: string) {
  return api.post<EmailChangeStage>(paths.auth.emailChangeConfirm, { token });
}
