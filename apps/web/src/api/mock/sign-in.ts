/**
 * Settings → Sign-in and security in the mock: the person's passkeys and authenticator app, with
 * the server's refusals (apps/server/src/auth/sign-in-security.ts): confirm it's you before every
 * change, the last way in, and two-factor a location asks for.
 */
import { paths } from '../paths';
import type { PasskeyView } from '../types';
import type { MockState } from './fixtures';
import { type AreaRoutes, err, type MockReply, notFound, reply, route, sessionGate } from './kit';

export type SignInMockState = {
  /** The account has a password; without one, a sign-in in the last ten minutes confirms. */
  hasPassword: boolean;
  passkeys: PasskeyView[];
  backupCodesLeft: number;
  linked: { providerId: string }[];
  emailLink: boolean;
  /** A location the person belongs to asks for two-factor. */
  locationRequiresTwoFactor: boolean;
  /** "Set up again" was started and not finished. */
  settingUpAgain: boolean;
  /** The password was confirmed for adding one passkey. */
  passkeyConfirmed: boolean;
};

export function signInFixtures(): SignInMockState {
  return {
    hasPassword: true,
    passkeys: [
      {
        id: '0195f2a0-0000-7000-8000-00000000a001',
        name: 'Laptop',
        createdAt: '2026-09-02T09:15:00.000Z',
        backedUp: true,
        deviceType: 'multiDevice',
      },
    ],
    backupCodesLeft: 8,
    linked: [],
    emailLink: false,
    locationRequiresTwoFactor: false,
    settingUpAgain: false,
    passkeyConfirmed: false,
  };
}

/** What a new secret looks like in the mock's otpauth URIs. */
export const MOCK_NEW_SECRET = 'KRUGS4ZANFZSAYJAONSWG4TFOQ';

const newCodes = () => [
  'h2k4m-n6p8q',
  'r3s5t-v7w9x',
  'y2z4a-b6c8d',
  'e3f5g-h7j9k',
  'm2n4p-q6r8s',
  't3v5w-x7y9z',
  'a4b6c-d8e2f',
  'g4h6j-k8m2n',
  'p4q6r-s8t2v',
  'w5x7y-z9a3b',
];

/** The server's confirm-it's-you: the password, or a recent sign-in on an account without one. */
export function confirmItsYou(state: MockState, body: unknown): MockReply | null {
  const password = (body as { password?: string } | undefined)?.password;
  if (state.signIn.hasPassword) {
    if (password === undefined)
      return err(403, 'reauth_required', 'Confirm it is you to continue.', 'Enter your password.', {
        reauth: 'password',
      });
    if (password !== state.password)
      return err(
        403,
        'reauth_required',
        'Confirm it is you to continue.',
        'That password is not right.',
        { reauth: 'password' },
      );
    return null;
  }
  if (!state.freshSignIn)
    return err(
      403,
      'reauth_required',
      'Confirm it is you to continue.',
      'Sign in again, then try again.',
      { reauth: 'sign_in' },
    );
  return null;
}

export const signInMockRoutes: AreaRoutes = (state: MockState) => {
  const s = () => state.signIn;

  const confirm = (body: unknown) => confirmItsYou(state, body);

  const view = () => ({
    password: s().hasPassword,
    passkeys: s().passkeys,
    twoFactor: {
      enabled: state.me.user.twoFactorEnabled,
      backupCodesLeft: state.me.user.twoFactorEnabled ? s().backupCodesLeft : null,
    },
    linked: s().linked,
    emailLink: s().emailLink,
  });

  return [
    route('GET', paths.mySignIn, () => sessionGate(state) ?? view()),
    route('PATCH', paths.myPasskey(':id'), ({ params, body }) => {
      const refused = sessionGate(state) ?? confirm(body);
      if (refused) return refused;
      const key = s().passkeys.find((p) => p.id === params.id);
      if (!key) return notFound();
      const name = String((body as { name?: string }).name ?? '').trim();
      if (!name || name.length > 64) return err(400, 'validation', 'The request is not valid.');
      key.name = name;
      return key;
    }),
    route('DELETE', paths.myPasskey(':id'), ({ params, body }) => {
      const refused = sessionGate(state) ?? confirm(body);
      if (refused) return refused;
      const key = s().passkeys.find((p) => p.id === params.id);
      if (!key) return notFound();
      const others = s().passkeys.length - 1;
      if (!s().hasPassword && others === 0 && s().linked.length === 0 && !s().emailLink)
        return err(409, 'last_sign_in_method', 'That is your only way to sign in.');
      if (s().locationRequiresTwoFactor && others === 0 && !state.me.user.twoFactorEnabled)
        return err(409, 'two_factor_required', 'A location you belong to asks for two-factor.');
      s().passkeys = s().passkeys.filter((p) => p.id !== params.id);
      return reply(204);
    }),
    route('POST', paths.myTwoFactor.enable, ({ body }) => {
      const refused = sessionGate(state) ?? confirm(body);
      if (refused) return refused;
      state.enrolling = true;
      return {
        totpURI: `otpauth://totp/Kept:${state.me.user.email}?secret=JBSWY3DPEHPK3PXP&issuer=Kept`,
        backupCodes: state.backupCodes,
      };
    }),
    route('POST', paths.myTwoFactor.disable, ({ body }) => {
      const refused = sessionGate(state) ?? confirm(body);
      if (refused) return refused;
      if (s().locationRequiresTwoFactor && s().passkeys.length === 0)
        return err(409, 'two_factor_required', 'A location you belong to asks for two-factor.');
      state.me.user.twoFactorEnabled = false;
      s().settingUpAgain = false;
      return reply(204);
    }),
    route('POST', paths.myTwoFactor.backupCodes, ({ body }) => {
      const refused = sessionGate(state) ?? confirm(body);
      if (refused) return refused;
      s().backupCodesLeft = 10;
      return { backupCodes: newCodes() };
    }),
    route('POST', paths.myTwoFactor.setUpAgain, ({ body }) => {
      const refused = sessionGate(state) ?? confirm(body);
      if (refused) return refused;
      if (!state.me.user.twoFactorEnabled) return err(409, 'conflict', 'Two-factor is off.');
      s().settingUpAgain = true;
      return {
        totpURI: `otpauth://totp/Kept:${state.me.user.email}?secret=${MOCK_NEW_SECRET}&issuer=Kept`,
      };
    }),
    route('POST', paths.myTwoFactor.setUpAgainVerify, ({ body }) => {
      const refused = sessionGate(state);
      if (refused) return refused;
      if (!s().settingUpAgain) return err(400, 'validation', 'Nothing is being set up.');
      if ((body as { code?: string }).code !== state.totpCode)
        return err(400, 'validation', "That code didn't match.");
      s().settingUpAgain = false;
      s().backupCodesLeft = 10;
      return { backupCodes: newCodes() };
    }),
    route('POST', paths.myPasskeyConfirm, ({ body }) => {
      const refused = sessionGate(state) ?? confirm(body);
      if (refused) return refused;
      s().passkeyConfirmed = true;
      return reply(204);
    }),
    route('GET', paths.auth.passkeyRegisterOptions, () => {
      const refused = sessionGate(state);
      if (refused) return refused;
      if (s().hasPassword && !s().passkeyConfirmed)
        return reply(403, {
          code: 'PASSKEY_CONFIRM_REQUIRED',
          message: 'Confirm with your password first.',
        });
      if (!state.freshSignIn)
        return reply(403, { code: 'SESSION_NOT_FRESH', message: 'Session is not fresh' });
      return {
        challenge: 'bW9jay1jaGFsbGVuZ2U',
        rp: { name: 'Kept', id: 'localhost' },
        user: { id: 'bW9jay11c2Vy', name: state.me.user.email, displayName: 'Ibrahim' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        attestation: 'none',
        excludeCredentials: [],
      };
    }),
    route('POST', paths.auth.passkeyVerifyRegistration, ({ body }) => {
      const refused = sessionGate(state);
      if (refused) return refused;
      s().passkeyConfirmed = false;
      const added: PasskeyView = {
        id: `0195f2a0-0000-7000-8000-${String(s().passkeys.length + 2).padStart(12, '0')}`,
        name: String((body as { name?: string }).name ?? '') || null,
        createdAt: new Date().toISOString(),
        backedUp: false,
        deviceType: 'singleDevice',
      };
      s().passkeys.push(added);
      return added;
    }),
  ];
};
