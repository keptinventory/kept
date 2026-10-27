/**
 * A private-address refusal (400 `private_address`: the server's guard against requests to its
 * own network) leads an instance admin to the one switch that allows them, Admin → Settings →
 * "Allow private addresses". Anyone else gets nothing more: the error already says an instance
 * admin can allow it.
 */
import { Trans } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { isApiError } from '@/api/client';
import { useMe } from '@/api/queries';

/** Whether an error is the server's private-address refusal, as any of its callers report it. */
export function isPrivateAddressError(e: unknown): boolean {
  if (!isApiError(e)) return false;
  return (
    e.code === 'private_address' ||
    e.details?.paperlessError === 'private_address' ||
    e.details?.mailError === 'private_address'
  );
}

/** The link to the switch, for an instance admin; nothing for anyone else. */
export function PrivateAddressLink({ className }: { className?: string }) {
  const me = useMe();
  if (!me.data?.user.instanceAdmin) return null;
  return (
    <Link
      to="/admin/settings"
      hash="private-addresses"
      className={
        className ??
        'font-semibold text-ink underline underline-offset-2 outline-none focus-visible:outline-2 focus-visible:outline-info'
      }
    >
      <Trans>Allow private addresses in Admin → Settings</Trans>
    </Link>
  );
}
