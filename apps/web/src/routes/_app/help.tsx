/**
 * Help: the tour, in chapters (Basics and one per section; Take the tour, Continue the tour at
 * the first chapter not done, or Start here on any chapter; never started on launch), bringing back
 * the Get-started checklist, installing Kept on a phone, sharing into Kept from other apps per
 * platform (iPhone has no share target), logging the odometer from an iPhone Shortcut with a
 * token, and the diagnostics page. It uses the list pages' width (Page `wide`): rows and lists
 * fill under Full width, running text keeps its readable measure (styles/index.css).
 */
import { type TourId, tourKey } from '@kept/shared';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { createFileRoute } from '@tanstack/react-router';
import { type ReactNode, useRef, useState } from 'react';
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
  GalleryIcon,
  PhoneIcon,
  QuestionIcon,
  ShareIcon,
  WrenchIcon,
} from '@/components/icons';
import { IconTile, LinkButton, List, Page, Row, Section } from '@/components/page';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useFormat } from '@/lib/format';

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
 * another. A finished chapter says Done (its `help.tours.<chapter>` hint, so every device agrees);
 * Continue the tour picks up at the first chapter not done, and any chapter starts from its row.
 */
function ToursSection() {
  const { t } = useLingui();
  const f = useFormat();
  const hints = useHints(false);
  const locations = useLocations();
  const running = useRunningTour();
  const ref = useRef<HTMLButtonElement>(null);
  const chapters = availableTours(locations.data ?? []);
  const done = (id: TourId) =>
    !!hints.data?.hints.find((h) => h.key === tourKey(id) && h.dismissedAt);
  const count = chapters.length;
  const finished = chapters.filter((c) => done(c.tour.id)).length;
  const from = resumeAt(chapters, done);
  const midway = finished > 0 && finished < chapters.length;
  const doneCount = f.num(finished);
  const total = f.num(chapters.length);
  return (
    <Section title={<Trans>The tour</Trans>}>
      <List data-tour="help-tours">
        <li>
          <Row
            leading={
              <IconTile>
                <QuestionIcon />
              </IconTile>
            }
            title={<Plural value={count} one="# chapter" other="# chapters" />}
            subtitle={
              finished === 0 ? (
                <Trans>One after another, on the real screens. Stop any time.</Trans>
              ) : (
                t`Chapters done: ${doneCount} of ${total}`
              )
            }
            trailing={
              from ? (
                <Button
                  ref={ref}
                  size="small"
                  variant="primary"
                  isDisabled={running !== null}
                  onPress={() => tourRequests.request({ id: from, returnFocus: ref.current })}
                >
                  {midway ? <Trans>Continue the tour</Trans> : <Trans>Take the tour</Trans>}
                </Button>
              ) : null
            }
          />
        </li>
        {chapters.map((chapter, k) => (
          <ChapterRow
            key={chapter.tour.id}
            chapter={chapter}
            number={k + 1}
            done={done(chapter.tour.id)}
            disabled={running !== null}
          />
        ))}
      </List>
    </Section>
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
  const id = chapter.tour.id;
  const steps = chapter.steps.length;
  return (
    <li data-tour-row={id}>
      <Row
        leading={
          <IconTile>
            {done ? (
              <CheckCircleIcon />
            ) : (
              <span className="font-semibold text-[15px]">{f.num(number)}</span>
            )}
          </IconTile>
        }
        title={titles[id]}
        subtitle={
          done ? <Trans>Done</Trans> : <Plural value={steps} one="# step" other="# steps" />
        }
        trailing={
          <Button
            ref={ref}
            size="small"
            variant="secondary"
            isDisabled={disabled}
            onPress={() => tourRequests.request({ id, returnFocus: ref.current })}
          >
            <Trans>Start here</Trans>
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
