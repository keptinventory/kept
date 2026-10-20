/**
 * What the thing page's step-4 sections share: after a write, refresh everything that may
 * show it (the sections, the lists, Home's rows, the thing's own header chips), and the reason
 * a write is disabled offline ("Needs a connection").
 */
import { useLingui } from '@lingui/react/macro';
import { useCallback } from 'react';
import { dayIn, useInvalidateHousehold } from '@/components/schedules/access';
import { useOnline } from '@/lib/online';
import { useThingCtx } from './context';

export function useHouseholdDone() {
  const { refresh } = useThingCtx();
  const invalidate = useInvalidateHousehold();
  return useCallback(async () => {
    await Promise.all([invalidate(), refresh()]);
  }, [invalidate, refresh]);
}

/** Null when online; otherwise the reason every write here is disabled. */
export function useBlocked(): string | null {
  const { t } = useLingui();
  return useOnline() ? null : t`Needs a connection`;
}

/** Today in the thing's location (dates are the location's calendar days). */
export const todayIn = (timeZone: string | undefined): string => dayIn(timeZone);
