/**
 * #474: a language picked on this device before it reached the account (picked signed out, or
 * before 1.14.6 kept it on the account) goes to the account once, quietly, so mail follows it.
 * Only a picked language: a device that follows its browser sends nothing.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { setAccountLocale } from '@/api/account';
import { keys } from '@/api/queries';
import { localeToSend, markLocaleSent } from './prefs';

/** Call where the signed-in account is known; `accountLocale` is its `profile.locale`. */
export function useSendChosenLocale(accountLocale: string | undefined): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (accountLocale === undefined) return;
    const locale = localeToSend(accountLocale);
    if (!locale) return;
    // Never in the way: a failure leaves mail as it was, and the next start tries again.
    void setAccountLocale(locale)
      .then(() => {
        markLocaleSent(locale);
        return qc.invalidateQueries({ queryKey: keys.me });
      })
      .catch(() => undefined);
  }, [accountLocale, qc]);
}
