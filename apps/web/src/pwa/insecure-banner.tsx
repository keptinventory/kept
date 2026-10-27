/**
 * Plain HTTP is explained, not refused (D31, D193): a line above every signed-in page saying what
 * doesn't work, with the HTTPS setups behind "How". Capture falls back to picking files, which
 * works without HTTPS. localhost counts as secure, so development never shows it.
 *
 * Someone who stays on their home network can dismiss it, once for every browser and phone they
 * use (#321): the dismissal is the person's `http_banner` hint on the server (D138, the store
 * the Get-started checklist uses), so another person on the same browser still sees it.
 *
 * - The hints are read when the app starts (hints-provider.tsx); until they are known the strip
 *   waits, so a person who dismissed it never sees it flash. If they can't be read (offline at
 *   start), it shows.
 * - This device remembers the dismissal too (localStorage, per person): it hides the strip while
 *   the server is out of reach, and a dismissal from before #321, kept only here, moves to the
 *   server once. Without storage (private mode, blocked storage) it is dismissed for the page.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useHints, useMarkHint } from '@/components/hints/use-hint';
import { HttpsHowButton } from '@/components/home/checklist';
import { AlertIcon, XIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';

export function isInsecure(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === false;
}

/** The person's hint (@kept/shared HINT_KEYS) that remembers the strip was dismissed. */
export const HTTP_BANNER_HINT = 'http_banner';

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
  // Read only over plain HTTP: a secure page never asks for the hints on the strip's account.
  const hints = useHints(insecure);
  const mark = useMarkHint();
  const onServer = !!hints.data?.hints.find((h) => h.key === HTTP_BANNER_HINT)?.dismissedAt;
  // A dismissal this device kept before the server held it: moved there once.
  useEffect(() => {
    if (insecure && hidden && hints.isSuccess && !onServer)
      void mark(HTTP_BANNER_HINT, { dismissed: true });
  }, [insecure, hidden, hints.isSuccess, onServer, mark]);
  if (!insecure || hidden || onServer || hints.isPending) return null;
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
          // Only onto hints that are known: marking writes the cache first, and an unread (failed)
          // one would become a one-entry list that says every other first-use hint is due. The
          // effect above uploads this dismissal once the hints can be read.
          if (hints.isSuccess) void mark(HTTP_BANNER_HINT, { dismissed: true });
        }}
        className="size-9 shrink-0 [&_svg]:size-4"
      >
        <XIcon />
      </Button>
    </div>
  );
}
