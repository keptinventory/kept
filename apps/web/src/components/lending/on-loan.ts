/**
 * "Locked" is a status, not a wall (1.14, #170): a move, a trash or a pack into a box of
 * something that is with someone is answered 409 `on_loan`, naming who has it. This asks first
 * ("This is with Sam: mark it returned first, or go ahead?") and, confirmed, sends it again with
 * `onLoan: "confirm"`. Nothing changes silently.
 */
import { useLingui } from '@lingui/react/macro';
import { useCallback } from 'react';
import { isApiError } from '@/api/client';
import { useConfirm } from '@/components/ui/confirm';
import { isolate } from '@/lib/bidi';

/** Runs `write(false)`; on `on_loan`, asks, and runs `write(true)` when confirmed (else null). */
export function useOnLoanConfirm() {
  const { t } = useLingui();
  const confirm = useConfirm();
  return useCallback(
    async <T>(write: (confirmed: boolean) => Promise<T>, go: string): Promise<T | null> => {
      try {
        return await write(false);
      } catch (e) {
        if (!isApiError(e) || (e.code !== 'on_loan' && e.serverCode !== 'on_loan')) throw e;
        const w = e.details.with as { person?: string; name?: string | null } | undefined;
        const ok = await confirm({
          title: t`This is with ${isolate(w?.person ?? '')}`,
          body: w?.name
            ? t`${isolate(w.name)} is lent out. Mark it returned first, or go ahead anyway?`
            : t`Mark it returned first, or go ahead anyway?`,
          confirmLabel: go,
        });
        return ok ? write(true) : null;
      }
    },
    [confirm, t],
  );
}
