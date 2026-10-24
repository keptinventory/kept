/**
 * Plain HTTP is explained, not refused (D31, D193): a line above every signed-in page saying what
 * doesn't work, with the HTTPS setups behind "How". Capture falls back to picking files, which
 * works without HTTPS. localhost counts as secure, so development never shows it.
 *
 * Someone who stays on their home network can dismiss it: remembered per person on this device,
 * so another person on the same browser still sees it. Without storage (private mode, blocked
 * storage) it is dismissed for the page only.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { HttpsHowButton } from '@/components/home/checklist';
import { AlertIcon, XIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';

export function isInsecure(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === false;
}

export const insecureBannerKey = (userId: string) => `kept.http-banner.hidden.${userId}`;

function dismissedFor(userId: string | undefined): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(insecureBannerKey(userId)) === '1';
  } catch {
    return false;
  }
}

function rememberDismissed(userId: string | undefined): void {
  if (!userId) return;
  try {
    localStorage.setItem(insecureBannerKey(userId), '1');
  } catch {
    // No storage: dismissed for this page only.
  }
}

export function InsecureBanner({
  insecure = isInsecure(),
  userId,
}: {
  insecure?: boolean;
  /** Whose dismissal to remember; without one it can still be dismissed for the page. */
  userId?: string;
}) {
  const { t } = useLingui();
  const [hidden, setHidden] = useState(() => dismissedFor(userId));
  if (!insecure || hidden) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 border-b border-warn bg-surface py-2 ps-3.5 pe-1.5 text-small text-ink-2 md:ps-6 md:pe-3"
    >
      <AlertIcon aria-hidden="true" className="size-[18px] shrink-0 text-warn" />
      <span className="min-w-0 flex-1">
        <Trans>Camera, offline capture and install need HTTPS.</Trans>
      </span>
      <HttpsHowButton />
      <Button
        variant="ghost"
        size="icon"
        aria-label={t`Dismiss`}
        onPress={() => {
          rememberDismissed(userId);
          setHidden(true);
        }}
        className="size-9 shrink-0 [&_svg]:size-4"
      >
        <XIcon />
      </Button>
    </div>
  );
}
