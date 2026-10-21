/**
 * A box check's page (1.14, #172): the box, who checked it and when, and each line: what the box
 * should hold, how many were found, and what was found in it from elsewhere.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { useBoxCheckDetail } from '@/api/counts/queries';
import { ErrorState, List, LoadingRows, Page, Pill, Row, Section } from '@/components/page';
import { useFormat } from '@/lib/format';

export function BoxCheckPage({ id }: { id: string }) {
  const { t } = useLingui();
  const fmt = useFormat();
  const q = useBoxCheckDetail(id);
  if (q.isPending)
    return (
      <Page title={t`Box check`} back="/counts">
        <LoadingRows />
      </Page>
    );
  if (q.isError)
    return (
      <Page title={t`Box check`} back="/counts">
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Page>
    );
  const b = q.data;
  const name = b.container.name || t`Unnamed`;
  const listed = b.lines.filter((l) => Number(l.expectedQty) > 0);
  const extra = b.lines.filter((l) => Number(l.expectedQty) === 0);
  const found = fmt.num(listed.filter((l) => Number(l.foundQty) > 0).length);
  const of = fmt.num(listed.length);
  const row = (l: (typeof b.lines)[number]) => {
    const a = fmt.num(Number(l.foundQty));
    const b = fmt.num(Number(l.expectedQty));
    return (
      <li key={l.thing.id}>
        <Link to="/t/$id" params={{ id: l.thing.id }} className="block hover:bg-sunken">
          <Row
            title={<bdi>{l.thing.name ?? t`Unnamed`}</bdi>}
            subtitle={Number(l.expectedQty) > 0 ? t`${a} of ${b} found` : undefined}
            trailing={
              l.thing.trashed ? (
                <Pill tone="warn">
                  <Trans>Trashed</Trans>
                </Pill>
              ) : Number(l.expectedQty) > 0 && Number(l.foundQty) === 0 ? (
                <Pill tone="warn">
                  <Trans>Not here</Trans>
                </Pill>
              ) : undefined
            }
          />
        </Link>
      </li>
    );
  };
  return (
    <Page title={t`Box check of ${name}`} back="/counts">
      <div className="grid gap-5">
        <div className="grid gap-1">
          <p className="m-0 font-semibold text-[28px] tabular-nums">{t`${found} of ${of}`}</p>
          <p className="m-0 text-ink-2 text-small">
            {fmt.dateTime(b.at)}
            {fmt.sep}
            <Trans>
              by <bdi>{b.by.displayName}</bdi>
            </Trans>
          </p>
          <Link
            to="/t/$id"
            params={{ id: b.container.id }}
            className="text-info text-small underline"
          >
            <Trans>Open the box</Trans>
          </Link>
        </div>
        {listed.length ? (
          <Section title={t`What it should hold (${fmt.num(listed.length)})`}>
            <List>{listed.map(row)}</List>
          </Section>
        ) : null}
        {extra.length ? (
          <Section title={t`Found in it from elsewhere (${fmt.num(extra.length)})`}>
            <List>{extra.map(row)}</List>
          </Section>
        ) : null}
      </div>
    </Page>
  );
}
