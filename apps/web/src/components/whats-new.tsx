/**
 * What's new in Kept: after the app updates to a new version, a small card with that release's
 * Highlights, once per version per person, and from Help any time.
 *
 * - **The release** is this build's: its version (KEPT_VERSION) and its Highlights from
 *   CHANGELOG.md, read at build time (`virtual:kept-whats-new`, whats-new-plugin.ts), so it works
 *   offline. A version without Highlights, or a development build, has no card.
 * - **Seen, per person:** the person's `whats_new.<version>` hint on the server (D138, the store
 *   the tour and the HTTP strip use), so a card dismissed on the phone doesn't come back on the
 *   laptop. The server takes only its own version's key (home/service.ts).
 * - **Never on a new account:** a person with no hint rows at all (no earlier version's card, no
 *   tour chapter, checklist or HTTP-strip record) gets this version recorded and nothing shown.
 *   Anyone with a row used Kept before, so they get this version's card once, including people
 *   from before What's new existed. Their hints are already in the cache: no extra request.
 * - **Never in the way:** not over Capture or Scan (it waits until the person leaves), not while
 *   the tour or a hint holds the screen (use-hint.ts's slot), and not until the hints are known.
 * - **Got it** (or Escape, or ×) records it. The highlights are English, as released; the card's
 *   own words are translated, and in another language it says the notes are in English.
 */

import release from 'virtual:kept-whats-new';
import { whatsNewKey } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRouterState } from '@tanstack/react-router';
import { useEffect, useSyncExternalStore } from 'react';
import { hintSlot, useHints, useMarkHint } from '@/components/hints/use-hint';
import { Sheet } from '@/components/places/sheet';
import { Button } from '@/components/ui/button';
import { boldParts, isReleaseVersion, releaseNotesUrl } from '@/whats-new/highlights';

/** This build's release, when it has a card to show. */
export const WHATS_NEW =
  isReleaseVersion(release.version) && release.highlights.length > 0 ? release : null;

const SLOT = 'whats_new';
/** The version this build is (KEPT_VERSION). */
const version = release.version;

/** Capture and Scan (a scan session too) are full screens with a camera: no card over them. */
const busyRoute = (path: string) => /^\/(capture|scan)(?:[/-]|$)/.test(path);

// ----- open from anywhere (Help) --------------------------------------------------------------

let isOpen = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => {
  if (isOpen === v) return;
  isOpen = v;
  for (const l of listeners) l();
};

export const whatsNew = {
  open: () => set(true),
  close: () => set(false),
  isOpen: () => isOpen,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Tests: closed, as on a fresh start. */
  reset: () => set(false),
};

/**
 * In the app shell: records the version on a first run, opens the card once after an update,
 * and shows it whenever Help asks.
 */
export function WhatsNewHost() {
  const hints = useHints(false);
  const mark = useMarkHint();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const holder = useSyncExternalStore(hintSlot.subscribe, hintSlot.get, hintSlot.get);
  const open = useSyncExternalStore(whatsNew.subscribe, whatsNew.isOpen, whatsNew.isOpen);
  const list = hints.isSuccess ? hints.data.hints : null;

  useEffect(() => {
    if (!list || !isReleaseVersion(version)) return;
    const key = whatsNewKey(version);
    if (list.some((h) => h.key === key)) return;
    // Used Kept before: any hint row at all (an earlier version's card, a tour chapter, the
    // checklist, the HTTP strip…). A brand-new account has none when the app first reads them.
    const before = list.length > 0;
    // A first run, or a release with nothing to tell: record it, show nothing.
    if (!before || !WHATS_NEW) {
      void mark(key, { dismissed: true });
      return;
    }
    if (open || busyRoute(path) || holder !== null) return;
    if (!hintSlot.claim(SLOT)) return;
    whatsNew.open();
  }, [list, mark, open, path, holder]);

  // Closed: recorded (again, from Help: the server keeps it once), and the screen is free.
  const close = () => {
    whatsNew.close();
    hintSlot.release(SLOT);
    if (isReleaseVersion(version)) void mark(whatsNewKey(version), { dismissed: true });
  };

  if (!WHATS_NEW) return null;
  return <WhatsNewCard isOpen={open} onClose={close} />;
}

function WhatsNewCard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t, i18n } = useLingui();
  if (!WHATS_NEW) return null;
  const version = WHATS_NEW.version;
  const english = i18n.locale === 'en';
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={t`What's new in Kept`}
    >
      {({ close }) => (
        <div className="grid gap-4">
          <p className="m-0 -mt-2 text-small text-ink-2">
            <Trans>
              Version <span className="ltr tabular-nums">{version}</span>
            </Trans>
          </p>
          {/* A long release scrolls here, so Got it stays in view on a phone. */}
          <section
            aria-label={t`Highlights`}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region takes focus so a keyboard can scroll it
            tabIndex={0}
            className="max-h-[min(50dvh,26rem)] overflow-y-auto rounded-[10px] border border-line bg-paper px-3 py-2.5 outline-none focus-visible:outline-2 focus-visible:outline-info"
          >
            <ul
              lang="en"
              dir="ltr"
              className="m-0 grid list-disc gap-2 ps-5 text-[14px] leading-snug text-ink"
            >
              {WHATS_NEW.highlights.map((line) => (
                <li key={line} className="[overflow-wrap:anywhere]">
                  {boldParts(line).map((part, i) =>
                    part.bold ? (
                      // biome-ignore lint/suspicious/noArrayIndexKey: a line's runs never move
                      <strong key={i} className="font-semibold">
                        {part.text}
                      </strong>
                    ) : (
                      // biome-ignore lint/suspicious/noArrayIndexKey: a line's runs never move
                      <span key={i}>{part.text}</span>
                    ),
                  )}
                </li>
              ))}
            </ul>
          </section>
          {english ? null : (
            <p className="m-0 text-small text-ink-2">
              <Trans>The release notes are in English.</Trans>
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a
              href={releaseNotesUrl(version)}
              target="_blank"
              rel="noreferrer"
              className="text-small text-ink underline underline-offset-2 outline-none hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-info"
            >
              <Trans>Full release notes</Trans>
            </a>
            <Button onPress={close}>
              <Trans>Got it</Trans>
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
