/**
 * Counts (1.14, #172): a location's finished counts and box checks, newest first, under the list
 * standard (surface `counts`: search by what was counted; filters kind, place, who, had missing
 * and date; grouped by place, person or month; paged; all in the URL). One location at a time:
 * the location filter picks it (the first one by default). Each row opens the count's page.
 */
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { useCounts } from '@/api/counts/queries';
import type { CountSummary, CountsParams } from '@/api/counts/types';
import { useLocations } from '@/api/queries';
import { dateBounds } from '@/components/filters/params';
import { useFilterRegistry } from '@/components/filters/registry';
import type { FilterDef } from '@/components/filters/types';
import { ActivityIcon, AlertIcon, BoxIcon, QrIcon } from '@/components/icons';
import { ListSurface } from '@/components/list-surface';
import { EmptyState, IconTile, Pill, Row } from '@/components/page';
import { oneValue } from '@/components/schedules/list-query';
import { useFormat } from '@/lib/format';
import { useLocationName } from '@/lib/labels';
import { formatLocale, usePrefs } from '@/lib/prefs';
import { firstOf, useListState } from '@/lib/url-state';

export function CountsList() {
  const { t } = useLingui();
  const [list] = useListState();
  const f = useFilterRegistry();
  const locations = useLocations();
  const locationName = useLocationName();
  const all = locations.data ?? [];
  const locationId = oneValue(list, 'location') ?? all[0]?.id ?? null;

  const kind = oneValue(list, 'kind');
  const params: CountsParams = {
    ...(list.q ? { q: list.q } : {}),
    ...(kind === 'count' || kind === 'box_check' ? { kind } : {}),
    ...(oneValue(list, 'place') ? { placeId: oneValue(list, 'place') as string } : {}),
    ...(oneValue(list, 'by') ? { by: oneValue(list, 'by') as string } : {}),
    ...(oneValue(list, 'had') === 'missing' ? { had: 'missing' as const } : {}),
    ...dateBounds(firstOf(list, 'when')),
  };
  const query = useCounts(locationId, params);

  const filters: FilterDef[] = [
    ...(all.length > 1
      ? [
          {
            ...f.location(),
            kind: 'single' as const,
            negatable: false,
            values: {
              from: 'static' as const,
              options: all.map((l) => ({ value: l.id, label: locationName(l) })),
            },
          },
        ]
      : []),
    {
      key: 'kind',
      label: t`Kind`,
      icon: <QrIcon />,
      kind: 'single',
      negatable: false,
      values: {
        from: 'static',
        options: [
          { value: 'count', label: t`Counts` },
          { value: 'box_check', label: t`Box checks` },
        ],
      },
    },
    { ...f.place(locationId ? [locationId] : []), kind: 'single', negatable: false },
    { ...f.actor(locationId ? [locationId] : []), key: 'by', kind: 'single', negatable: false },
    {
      key: 'had',
      label: t`Had missing`,
      icon: <AlertIcon />,
      kind: 'boolean',
      on: 'missing',
    },
    f.date('when', t`Counted`),
  ];

  return (
    <ListSurface<CountSummary>
      label={t`Counts`}
      search={{ label: t`Search counts`, placeholder: t`Search by what was counted` }}
      filters={filters}
      surface="counts"
      groups={[
        { value: 'none', label: t`None` },
        { value: 'place', label: t`Place`, short: t`by place` },
        { value: 'person', label: t`Person`, short: t`by person` },
        { value: 'month', label: t`Month`, short: t`by month` },
      ]}
      query={query}
      getKey={(c) => c.id}
      groupOf={(c, by) =>
        by === 'place'
          ? { key: c.target.id, label: <bdi>{c.target.name}</bdi> }
          : by === 'person'
            ? { key: c.by.id ?? '', label: <bdi>{c.by.displayName}</bdi> }
            : by === 'month'
              ? { key: c.at.slice(0, 7), label: <MonthLabel iso={c.at} /> }
              : null
      }
      renderRow={(c) => <CountRow count={c} />}
      empty={
        <EmptyState icon={<ActivityIcon />} title={<Trans>No counts yet</Trans>}>
          <Trans>
            Count a place or a box from Scan: every count and box check is kept here, with what was
            found and what was missing.
          </Trans>
        </EmptyState>
      }
    />
  );
}

function MonthLabel({ iso }: { iso: string }) {
  const { locale, digits } = usePrefs();
  const month = new Intl.DateTimeFormat(formatLocale(locale, digits), {
    month: 'long',
    year: 'numeric',
  });
  return <>{month.format(new Date(iso))}</>;
}

export function CountRow({ count: c }: { count: CountSummary }) {
  const { t } = useLingui();
  const fmt = useFormat();
  const found = fmt.num(c.found);
  const of = fmt.num(c.expected ?? c.found);
  const missing = c.missing ?? 0;
  const link =
    c.kind === 'count'
      ? ({ to: '/counts/$id', params: { id: c.id } } as const)
      : ({ to: '/counts/box/$id', params: { id: c.id } } as const);
  return (
    <Link {...link} className="block outline-none hover:bg-sunken focus-visible:bg-sunken">
      <Row
        leading={<IconTile>{c.kind === 'count' ? <QrIcon /> : <BoxIcon />}</IconTile>}
        title={<bdi>{c.target.name || t`Unnamed`}</bdi>}
        subtitle={
          <>
            {c.kind === 'count' ? t`Count` : t`Box check`}
            {fmt.sep}
            <bdi>{c.by.displayName}</bdi>
            {fmt.sep}
            {fmt.dateTime(c.at)}
          </>
        }
        trailing={
          <span className="grid justify-items-end gap-1">
            <span className="font-semibold tabular-nums">{t`${found} of ${of}`}</span>
            {missing > 0 ? (
              <Pill tone="warn">{plural(missing, { one: '# missing', other: '# missing' })}</Pill>
            ) : c.undone ? (
              <Pill>{t`Undone`}</Pill>
            ) : null}
          </span>
        }
      />
    </Link>
  );
}
