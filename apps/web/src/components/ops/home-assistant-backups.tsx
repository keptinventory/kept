/**
 * The Home Assistant app's backups (D272): Kept's own can't run there, Home Assistant's hold Kept.
 * Where to take or schedule one, "Settings → System → Backups", is a link to Home Assistant's own
 * /config/backup in the top window under ingress (lib/base-path.ts homeAssistantHref); on Kept's
 * own address the words alone, since Home Assistant's address isn't known there. Admin → Backups
 * and Admin → Status's tile use it.
 */
import { Trans } from '@lingui/react/macro';
import { homeAssistantHref } from '@/lib/base-path';

export function HomeAssistantBackupsPlace() {
  const href = homeAssistantHref('/config/backup');
  const where = <Trans>Settings → System → Backups</Trans>;
  return href ? (
    <a href={href} target="_top" className="underline underline-offset-2">
      {where}
    </a>
  ) : (
    where
  );
}
