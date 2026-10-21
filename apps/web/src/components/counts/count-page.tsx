/**
 * A count's page (1.14, #172): what was counted, who (everyone who read in a shared count), when
 * and how long, found X of Y, the comparison with the previous count of the same target, then
 * its lists, each row linking to the thing with where it is now: Found, Missing, Found
 * elsewhere, Moved here, Marked not here, lent out, in repair, in the Trash, and Not counted
 * (by area). A count saved before 1.13 kept only what it applied: its lists say so. Export CSV
 * makes the file on the page.
 */
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useCountResult } from '@/api/counts/queries';
import type { CountResult, ResultLine } from '@/api/counts/types';
import { ErrorState, List, LoadingRows, Notice, Page, Pill, Row, Section } from '@/components/page';
import { Button } from '@/components/ui/button';
import { canShareFiles, saveFile, shareFiles } from '@/lib/files';
import { useFormat } from '@/lib/format';
import { countCsv, csvName } from './csv';

type Group = { key: string; title: string; lines: ResultLine[] };

export function CountPage({ id }: { id: string }) {
  const { t } = useLingui();
  const q = useCountResult(id);
  if (q.isPending)
    return (
      <Page title={t`Count`} back="/counts">
        <LoadingRows />
      </Page>
    );
  if (q.isError)
    return (
      <Page title={t`Count`} back="/counts">
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Page>
    );
  return <CountView r={q.data} />;
}

function CountView({ r }: { r: CountResult }) {
  const { t } = useLingui();
  const fmt = useFormat();
  const s = r.session;
  const name = s.target.name || t`Unnamed`;
  const found = fmt.num(s.seen + s.moved);
  const of = fmt.num(s.expected ?? s.seen + s.moved);
  const minutes = s.finishedAt
    ? Math.max(1, Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 60_000))
    : null;
  const readers = s.readers.length > 1 ? s.readers.map((x) => x.displayName).join(', ') : null;

  const by = (result: ResultLine['result']) => r.lines.filter((l) => l.result === result);
  const areas = new Map<string, { name: string; lines: ResultLine[] }>();
  for (const l of by('not_counted')) {
    const key = l.area?.id ?? '';
    const g = areas.get(key) ?? { name: l.area?.name ?? t`Unplaced`, lines: [] };
    g.lines.push(l);
    areas.set(key, g);
  }
  const groups: Group[] = [
    { key: 'seen', title: t`Found`, lines: by('seen') },
    { key: 'missing', title: t`Missing`, lines: by('missing') },
    { key: 'elsewhere', title: t`Found elsewhere`, lines: by('elsewhere') },
    { key: 'move', title: t`Moved here`, lines: by('move') },
    { key: 'not_here', title: t`Marked not here`, lines: by('not_here') },
    { key: 'on_loan', title: t`Lent out`, lines: by('on_loan') },
    { key: 'in_repair', title: t`In repair`, lines: by('in_repair') },
    { key: 'trashed', title: t`In the Trash`, lines: by('trashed') },
    ...[...areas].map(([key, g]) => ({
      key: `area:${key}`,
      title: t`Not counted: ${g.name}`,
      lines: g.lines,
    })),
  ];
  const cmp = r.compare;

  const exportCsv = async () => {
    const file = new File([countCsv(r)], csvName(r), { type: 'text/csv' });
    if (canShareFiles([file]) && (await shareFiles([file], name)) !== 'refused') return;
    saveFile(file);
  };

  return (
    <Page
      title={t`Count of ${name}`}
      back="/counts"
      actions={
        <Button variant="secondary" size="small" onPress={() => void exportCsv()}>
          <Trans>Export CSV</Trans>
        </Button>
      }
    >
      <div className="grid gap-5">
        <div className="grid gap-1">
          <p className="m-0 font-semibold text-[28px] tabular-nums">{t`${found} of ${of}`}</p>
          <p className="m-0 text-ink-2 text-small">
            {s.finishedAt ? fmt.dateTime(s.finishedAt) : <Trans>Still open</Trans>}
            {minutes !== null ? (
              <>
                {fmt.sep}
                {plural(minutes, { one: '# minute', other: '# minutes' })}
              </>
            ) : null}
            {fmt.sep}
            <Trans>
              by <bdi>{s.by.displayName}</bdi>
            </Trans>
            {s.finishedBy && s.finishedBy.id !== s.by.id ? (
              <>
                {fmt.sep}
                <Trans>
                  finished by <bdi>{s.finishedBy.displayName}</bdi>
                </Trans>
              </>
            ) : null}
          </p>
          {readers ? (
            <p className="m-0 text-ink-2 text-small">
              <Trans>
                Counted by <bdi>{readers}</bdi>
              </Trans>
            </p>
          ) : null}
          {s.schedule ? (
            <p className="m-0 text-small">
              <Trans>
                Done for the planned count <bdi>{s.schedule.name}</bdi>
              </Trans>
            </p>
          ) : null}
          {s.undone ? (
            <Pill className="mt-1">
              <Trans>Undone</Trans>
            </Pill>
          ) : null}
        </div>

        {cmp && r.previous ? (
          <Section title={t`Since the previous count`}>
            <p className="m-0 text-[15px]">
              {plural(cmp.newlyMissing.length, {
                one: '# newly missing',
                other: '# newly missing',
              })}
              {fmt.sep}
              {plural(cmp.foundAgain.length, { one: '# found again', other: '# found again' })}
              {fmt.sep}
              {plural(cmp.newThings.length, { one: '# new thing', other: '# new things' })}
            </p>
            <Link
              to="/counts/$id"
              params={{ id: r.previous.id }}
              className="text-info text-small underline"
            >
              <Trans>Open the previous count ({fmt.day(r.previous.finishedAt)})</Trans>
            </Link>
          </Section>
        ) : null}

        {!s.recorded ? (
          <Notice>
            <Trans>
              Counts saved before Kept 1.14 didn't record what was missing or elsewhere.
            </Trans>
          </Notice>
        ) : null}

        {groups.map((g) =>
          g.lines.length === 0 ? null : (
            <Section key={g.key} title={`${g.title} (${fmt.num(g.lines.length)})`}>
              <List>
                {g.lines.map((l) => (
                  <li key={l.thing.id}>
                    <LineRow line={l} />
                  </li>
                ))}
              </List>
            </Section>
          ),
        )}
      </div>
    </Page>
  );
}

function LineRow({ line: l }: { line: ResultLine }) {
  const { t } = useLingui();
  const fmt = useFormat();
  const now = l.now?.name;
  const was = l.was?.name;
  const parts: ReactNode[] = [];
  if (l.foundQty && l.expectedQty) {
    const a = fmt.num(Number(l.foundQty));
    const b = fmt.num(Number(l.expectedQty));
    parts.push(t`${a} of ${b} found`);
  }
  if (now)
    parts.push(
      <Trans key="now">
        now in <bdi>{now}</bdi>
      </Trans>,
    );
  else if (was)
    parts.push(
      <Trans key="was">
        was in <bdi>{was}</bdi>
      </Trans>,
    );
  if (l.readBy)
    parts.push(
      <Trans key="by">
        read by <bdi>{l.readBy.displayName}</bdi>
      </Trans>,
    );
  return (
    <Link to="/t/$id" params={{ id: l.thing.id }} className="block hover:bg-sunken">
      <Row
        title={<bdi>{l.thing.name ?? t`Unnamed`}</bdi>}
        subtitle={
          parts.length
            ? parts.map((p, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of parts
                <span key={i}>
                  {i > 0 ? fmt.sep : null}
                  {p}
                </span>
              ))
            : undefined
        }
        trailing={
          l.thing.trashed ? (
            <Pill tone="warn">
              <Trans>Trashed</Trans>
            </Pill>
          ) : undefined
        }
      />
    </Link>
  );
}
