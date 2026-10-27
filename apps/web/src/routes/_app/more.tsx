/**
 * More (phone): the navigation list, in the sidebar's groups and order: the locations, Tracking,
 * Tools, then Activity, Trash, Notifications, Settings and Help. The desktop has the same entries
 * in the sidebar.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useLocations } from '@/api/queries';
import {
  byGroup,
  type NavEntry,
  useNavEntries,
  useNavGroupTitles,
  VersionFooter,
} from '@/components/app-shell';
import { SoonBadge } from '@/components/coming-later';
import { ChevronEndIcon, PlusIcon } from '@/components/icons';
import { KindIcon } from '@/components/kind-icon';
import { IconTile, List, Page, Row, Section } from '@/components/page';
import { SignOutButton } from '@/components/sign-out';
import { locationAddress } from '@/lib/address';
import { useLocationName } from '@/lib/labels';

export const Route = createFileRoute('/_app/more')({ component: MorePage });

function MorePage() {
  const { t } = useLingui();
  const locations = useLocations();
  const nameOf = useLocationName();
  const groups = byGroup(useNavEntries());
  const titles = useNavGroupTitles();
  return (
    <Page title={t`More`}>
      <Section title={<Trans>Locations</Trans>}>
        <List>
          {(locations.data ?? []).map((l) => (
            <li key={l.id}>
              <Link
                to="/loc/$id"
                params={{ id: locationAddress(l) }}
                className="block outline-none hover:bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info"
              >
                <Row
                  leading={
                    <IconTile>
                      <KindIcon kind={l.kind} />
                    </IconTile>
                  }
                  title={nameOf(l)}
                  trailing={<ChevronEndIcon className="size-5 text-ink-3" />}
                />
              </Link>
            </li>
          ))}
          <li>
            <Link
              to="/locations/new"
              className="block outline-none hover:bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info"
            >
              <Row
                leading={
                  <IconTile>
                    <PlusIcon />
                  </IconTile>
                }
                title={<Trans>New location</Trans>}
              />
            </Link>
          </li>
        </List>
      </Section>
      {/* The guided tour's "everything else" stop on a phone (components/hints/tour.ts). */}
      <div className="grid gap-6" data-tour="more-entries">
        {groups.tracking.length ? (
          <Section title={titles.tracking}>
            <Entries entries={groups.tracking} label={titles.tracking} />
          </Section>
        ) : null}
        {groups.tools.length ? (
          <Section title={titles.tools}>
            <Entries entries={groups.tools} label={titles.tools} />
          </Section>
        ) : null}
        <Entries entries={groups.bottom} label={t`Everything else`} />
      </div>
      <SignOutButton />
      <VersionFooter className="justify-center" />
    </Page>
  );
}

function Entries({ entries, label }: { entries: NavEntry[]; label: string }) {
  return (
    <List aria-label={label}>
      {entries.map((e) =>
        e.to ? (
          <li key={e.key}>
            <Link
              to={e.to}
              className="block outline-none hover:bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info"
            >
              <Row
                leading={<IconTile>{e.icon}</IconTile>}
                title={e.label}
                trailing={<ChevronEndIcon className="size-5 text-ink-3" />}
              />
            </Link>
          </li>
        ) : (
          <li key={e.key} aria-disabled="true" className="cursor-not-allowed">
            <Row
              leading={<IconTile className="opacity-60">{e.icon}</IconTile>}
              title={<span className="opacity-60">{e.label}</span>}
              trailing={<SoonBadge />}
            />
          </li>
        ),
      )}
    </List>
  );
}
