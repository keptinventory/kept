/**
 * Help: the tour, in chapters (Basics and one per section; Take the tour, Continue the tour at
 * the first chapter not done, or any chapter's row; never started on launch), What's new in Kept
 * again (this version's highlights), bringing back the Get-started checklist, installing Kept on a phone, sharing into Kept from other apps per
 * platform (iPhone has no share target), logging the odometer from an iPhone Shortcut with a
 * token, and the diagnostics page. It uses the list pages' width (Page `wide`): rows and lists
 * fill under Full width, running text keeps its readable measure (styles/index.css).
 */
import { type TourId, tourKey } from '@kept/shared';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { createFileRoute } from '@tanstack/react-router';
import { type ReactNode, useId, useRef, useState } from 'react';
import { Button as AriaButton, Disclosure, DisclosurePanel, Heading } from 'react-aria-components';
import { useHome } from '@/api/inventory/queries';
import { useLocations } from '@/api/queries';
import { ShortcutRecipeSheet } from '@/components/connections/shortcut-recipe';
import { useTourTitles } from '@/components/hints/hint-copy';
import { tourRequests, useRunningTour } from '@/components/hints/tour-request';
import { type AvailableTour, availableTours, resumeAt } from '@/components/hints/tours';
import { useHints } from '@/components/hints/use-hint';
import { useChecklistDismissed } from '@/components/home/checklist';
import { InstallSheet } from '@/components/home/install-sheet';
import {
  CarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronEndIcon,
  GalleryIcon,
  PhoneIcon,
  ShareIcon,
  StarIcon,
  WrenchIcon,
} from '@/components/icons';
import { IconTile, LinkButton, List, LoadingRows, Page, Row, Section } from '@/components/page';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { WHATS_NEW, whatsNew } from '@/components/whats-new';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/help')({ component: HelpPage });

function HelpPage() {
  const { t } = useLingui();
  const [install, setInstall] = useState(false);
  const [recipe, setRecipe] = useState(false);
  return (
    <Page title={t`Help`} wide>
      <ToursSection />

      <Section title={<Trans>Get started</Trans>}>
        <List>
          <ChecklistRow />
          {WHATS_NEW ? <WhatsNewRow version={WHATS_NEW.version} /> : null}
        </List>
      </Section>

      <Section title={<Trans>On your phone</Trans>}>
        <List>
          <li>
            <Row
              leading={
                <IconTile>
                  <PhoneIcon />
                </IconTile>
              }
              title={<Trans>Install on your phone</Trans>}
              subtitle={
                <Trans>Kept opens from its own icon, full screen, and works offline.</Trans>
              }
              trailing={
                <Button size="small" variant="secondary" onPress={() => setInstall(true)}>
                  <Trans>Show steps</Trans>
                </Button>
              }
            />
          </li>
        </List>
        <InstallSheet isOpen={install} onClose={() => setInstall(false)} />
      </Section>

      <Section title={<Trans>Share into Kept</Trans>}>
        <List>
          <ShareNote icon={<ShareIcon />} title={<Trans>Android</Trans>}>
            <Trans>
              Once Kept is installed it's in the Share sheet. Share photos or PDFs to it from any
              app, and they open in Capture.
            </Trans>
          </ShareNote>
          <ShareNote icon={<GalleryIcon />} title={<Trans>iPhone, iPad</Trans>}>
            <Trans>
              iPhone doesn't let web apps appear in the Share sheet. Save the photo first, then add
              it in Capture with Gallery.
            </Trans>
          </ShareNote>
          <ShareNote icon={<GalleryIcon />} title={<Trans>Computer</Trans>}>
            <Trans>Add photos from your files with Gallery in Capture.</Trans>
          </ShareNote>
        </List>
      </Section>

      <Section title={<Trans>Connect other apps</Trans>}>
        <List>
          <li>
            <Row
              leading={
                <IconTile>
                  <CarIcon />
                </IconTile>
              }
              title={<Trans>Log your odometer from an iPhone Shortcut</Trans>}
              subtitle={
                <Trans>
                  A Shortcut that asks for the reading and sends it to Kept with a token.
                </Trans>
              }
              trailing={
                <Button size="small" variant="secondary" onPress={() => setRecipe(true)}>
                  <Trans>Show the recipe</Trans>
                </Button>
              }
            />
          </li>
        </List>
        <ShortcutRecipeSheet isOpen={recipe} onOpenChange={setRecipe} />
      </Section>

      <Section title={<Trans>Something not working?</Trans>}>
        <List>
          <li>
            <Row
              leading={
                <IconTile>
                  <WrenchIcon />
                </IconTile>
              }
              title={<Trans>Diagnostics</Trans>}
              subtitle={
                <Trans>Check the camera, offline support and storage, and copy a report.</Trans>
              }
              trailing={
                <LinkButton to="/settings/diagnostics" size="small">
                  <Trans>Open</Trans>
                </LinkButton>
              }
            />
          </li>
        </List>
      </Section>
    </Page>
  );
}

/**
 * The tour: Basics, and one short chapter per section the person has (tours.ts), walked one after
 * another. One compact panel: the chapters and how many are done (a thin bar), with Take the tour,
 * or Continue the tour at the first chapter not done; then a tight row per chapter, its number and
 * steps, the whole row starting it. A finished chapter (its `help.tours.<chapter>` hint, so every
 * device agrees) folds away under Done (N), from where it still starts.
 */
function ToursSection() {
  const { t } = useLingui();
  const f = useFormat();
  const hints = useHints(false);
  const locations = useLocations();
  const running = useRunningTour();
  const ref = useRef<HTMLButtonElement>(null);
  // Not before the list has loaded: the chapters of no location at all are 7, where the tour,
  // started a moment later from the loaded list, counts the person's 12 (#314). Offline with
  // nothing cached the query pauses or fails, and these are the tour's offline chapters.
  // Nor before the hints say which chapters are done: listed first, a done chapter would then jump
  // into Done (N) under the person's finger. Offline or refused, the list shows without them.
  const loading = (q: { data: unknown; fetchStatus: string }) =>
    q.data === undefined && q.fetchStatus === 'fetching';
  if (loading(locations) || loading(hints))
    return (
      <Section title={<Trans>The tour</Trans>}>
        <LoadingRows rows={2} />
      </Section>
    );
  const chapters = availableTours(locations.data ?? []);
  const isDone = (id: TourId) =>
    !!hints.data?.hints.find((h) => h.key === tourKey(id) && h.dismissedAt);
  const count = chapters.length;
  const numbered = chapters.map((chapter, k) => ({ chapter, number: k + 1 }));
  const open = numbered.filter((c) => !isDone(c.chapter.tour.id));
  const finished = numbered.filter((c) => isDone(c.chapter.tour.id));
  const from = resumeAt(chapters, isDone);
  const midway = finished.length > 0 && finished.length < count;
  const disabled = running !== null;
  const done = f.num(finished.length);
  const total = f.num(count);
  return (
    <Section title={<Trans>The tour</Trans>}>
      <List data-tour="help-tours">
        <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-3">
          <div className="grid min-w-0 flex-1 gap-1.5">
            <div className="font-semibold text-[15px] text-ink">
              <Plural value={count} one="# chapter" other="# chapters" />
            </div>
            {finished.length === 0 ? (
              <div className="text-small text-ink-2">
                <Trans>One after another, on the real screens. Stop any time.</Trans>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <span
                  role="progressbar"
                  aria-label={t`Chapters done`}
                  aria-valuemin={0}
                  aria-valuemax={count}
                  aria-valuenow={finished.length}
                  className="relative h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-sunken"
                >
                  <span
                    className="absolute inset-y-0 start-0 rounded-full bg-amber"
                    style={{ inlineSize: `${(finished.length / Math.max(1, count)) * 100}%` }}
                  />
                </span>
                <span className="shrink-0 text-small text-ink-2 tabular-nums">
                  {t`${done} of ${total} done`}
                </span>
              </div>
            )}
          </div>
          {from ? (
            <Button
              ref={ref}
              variant="primary"
              isDisabled={disabled}
              onPress={() => tourRequests.request({ id: from, returnFocus: ref.current })}
            >
              {midway ? <Trans>Continue the tour</Trans> : <Trans>Take the tour</Trans>}
            </Button>
          ) : null}
        </li>
        {open.length > 0 ? (
          <li>
            <ChapterRows chapters={open} done={false} disabled={disabled} />
          </li>
        ) : null}
        {finished.length > 0 ? (
          <li>
            <Disclosure>
              <Heading className="m-0">
                <AriaButton
                  slot="trigger"
                  className="group flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2 text-start font-semibold text-[14px] text-ink-2 outline-none data-hovered:bg-sunken data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-info"
                >
                  {t`Done (${done})`}
                  <ChevronDownIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 transition-transform group-aria-expanded:rotate-180"
                  />
                </AriaButton>
              </Heading>
              <DisclosurePanel>
                <ChapterRows chapters={finished} done disabled={disabled} />
              </DisclosurePanel>
            </Disclosure>
          </li>
        ) : null}
      </List>
    </Section>
  );
}

/** Chapters as tight rows, two or three to a line on a wide screen. */
function ChapterRows({
  chapters,
  done,
  disabled,
}: {
  chapters: { chapter: AvailableTour; number: number }[];
  done: boolean;
  disabled: boolean;
}) {
  return (
    <ul className="mx-0 -mt-px mb-0 grid list-none p-0 md:grid-cols-2 xl:grid-cols-3">
      {chapters.map(({ chapter, number }) => (
        <ChapterRow
          key={chapter.tour.id}
          chapter={chapter}
          number={number}
          done={done}
          disabled={disabled}
        />
      ))}
    </ul>
  );
}

function ChapterRow({
  chapter,
  number,
  done,
  disabled,
}: {
  chapter: AvailableTour;
  number: number;
  done: boolean;
  disabled: boolean;
}) {
  const titles = useTourTitles();
  const f = useFormat();
  const ref = useRef<HTMLButtonElement>(null);
  const described = useId();
  const id = chapter.tour.id;
  const steps = chapter.steps.length;
  return (
    <li data-tour-row={id} className="border-t border-line">
      <AriaButton
        ref={ref}
        aria-label={titles[id]}
        aria-describedby={described}
        isDisabled={disabled}
        onPress={() => tourRequests.request({ id, returnFocus: ref.current })}
        className="flex min-h-11 w-full cursor-pointer items-center gap-3 px-3.5 py-2 text-start outline-none data-hovered:bg-sunken data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-info data-disabled:cursor-not-allowed data-disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-full font-semibold text-[13px] tabular-nums',
            done ? 'text-ok [&_svg]:size-5' : 'bg-sunken text-ink-2',
          )}
        >
          {done ? <CheckCircleIcon /> : f.num(number)}
        </span>
        <span className="min-w-0 flex-1 font-medium text-[15px] text-ink [overflow-wrap:anywhere]">
          {titles[id]}
        </span>
        <span id={described} className="shrink-0 text-small text-ink-2">
          {done ? <Trans>Done</Trans> : <Plural value={steps} one="# step" other="# steps" />}
        </span>
        <ChevronEndIcon aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
      </AriaButton>
    </li>
  );
}

/** What's new in Kept: this version's highlights again, the card shown after an update. */
function WhatsNewRow({ version }: { version: string }) {
  return (
    <li>
      <Row
        leading={
          <IconTile>
            <StarIcon />
          </IconTile>
        }
        title={<Trans>What's new in Kept</Trans>}
        subtitle={
          <Trans>
            Version <span className="ltr tabular-nums">{version}</span>: its highlights.
          </Trans>
        }
        trailing={
          <Button size="small" variant="secondary" onPress={() => whatsNew.open()}>
            <Trans>What's new</Trans>
          </Button>
        }
      />
    </li>
  );
}

/**
 * The Get-started checklist: bring it back to Home when it was hidden (the `checklist` hint, so
 * every device agrees, D138). While it shows, or once every step is done, there is nothing to do.
 */
function ChecklistRow() {
  const { t } = useLingui();
  const home = useHome();
  const setDismissed = useChecklistDismissed();
  const checklist = home.data?.checklist;
  const finished = !!checklist && checklist.items.every((i) => i.done);
  return (
    <li>
      <Row
        leading={
          <IconTile>
            <CheckCircleIcon />
          </IconTile>
        }
        title={<Trans>Get-started checklist</Trans>}
        subtitle={
          !checklist ? null : finished ? (
            <Trans>Every step is done.</Trans>
          ) : checklist.dismissed ? (
            <Trans>Hidden from Home.</Trans>
          ) : (
            <Trans>On Home until every step is done.</Trans>
          )
        }
        trailing={
          checklist?.dismissed && !finished ? (
            <Button
              size="small"
              variant="secondary"
              onPress={() => {
                setDismissed(false);
                toast({ title: t`The checklist is back on Home`, tone: 'ok' });
              }}
            >
              <Trans>Bring it back</Trans>
            </Button>
          ) : null
        }
      />
    </li>
  );
}

function ShareNote({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <li>
      <Row leading={<IconTile>{icon}</IconTile>} title={title} subtitle={children} />
    </li>
  );
}
