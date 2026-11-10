/** First run, the signed-in person, their devices, and the build info (D147). */
import { noteMainAddress } from '@/lib/base-path';
import { api } from './client';
import { paths } from './paths';
import type {
  AccountDeletionState,
  DeviceSession,
  EmailChangeBody,
  EmailChangeStage,
  Me,
  SetupBody,
  SetupResult,
  SetupStatus,
  VersionInfo,
} from './types';

export const getVersion = () => api.get<VersionInfo>(paths.version);

export const getSetupStatus = () =>
  api.get<SetupStatus>(paths.setup).then((status) => {
    noteMainAddress(status.mainAddress);
    return status;
  });
export const completeSetup = (body: SetupBody) => api.post<SetupResult>(paths.setup, body);

export const getMe = () => api.get<Me>(paths.me);
/** PATCH /api/v1/me: "Suggest where I am" (D153, T19), audited `me.preferences`. */
type MePreferences = {
  suggestLocation: boolean;
  hidePersonal: boolean;
  locale: string;
  units: 'metric' | 'imperial';
};
export const setSuggestLocation = (suggestLocation: boolean) =>
  api.patch<MePreferences>(paths.me, { suggestLocation });
export const setHidePersonal = (hidePersonal: boolean) =>
  api.patch<MePreferences>(paths.me, { hidePersonal });
/** The language chosen in the app, kept on the account: mail follows it. */
export const setAccountLocale = (locale: string) => api.patch<MePreferences>(paths.me, { locale });
/** Metric or imperial (#385), kept on the account: map sizes, label sizes and fuel use follow it. */
export const setUnits = (units: 'metric' | 'imperial') =>
  api.patch<MePreferences>(paths.me, { units });

export const listMySessions = () =>
  api.get<{ sessions: DeviceSession[] }>(paths.mySessions).then((r) => r.sessions);
export const revokeMySession = (id: string) => api.del(paths.mySession(id));
/** Every other device and every connector's sign-in, in one step on the server. */
export const signOutOtherSessions = () => api.post(paths.myOtherSessions, {});

/**
 * Starts an email change: a link to the current address first (202 `{stage: 'confirm_old'}`).
 * Without `password`, 403 `reauth_required` when the last sign-in is over 10 minutes old.
 */
export const startEmailChange = (body: EmailChangeBody) =>
  api.post<EmailChangeStage>(paths.myEmailChange, body);

/** What stops the account from being deleted, and when it goes if it was asked (D225). */
export const getAccountDeletion = () => api.get<AccountDeletionState>(paths.myDeletion);
/**
 * Asks for the account to be deleted in 30 days (D225). 409 `account_deletion_blocked` with
 * `blockers`; without `password`, 403 `reauth_required` as for an email change.
 */
export const requestAccountDeletion = (password: string | undefined) =>
  api.post<{ purgeAfter: string }>(paths.myDeletion, password === undefined ? {} : { password });
/** Keeps the account: the deletion is called off. */
export const keepAccount = () => api.del<{ purgeAfter: null }>(paths.myDeletion);
