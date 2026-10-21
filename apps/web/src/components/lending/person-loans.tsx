/**
 * Loans on the person page (D57):
 * "Has from us" (open loans out to them) and "Lent to us" (open loans in from
 * them), then the returned ones, before the page's "Belongs to" list. Only locations with Lending
 * on count (the server's rule); with nothing either way, the sections stay away.
 *
 * 1.14 (#170): what they have is grouped by hand-over ("3 things with Camera bag, 3 Oct"), each
 * group with "Mark returned" for its checklist.
 */
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { usePersonLoans } from '@/api/household/queries';
import type { LoanRow } from '@/api/household/types';
import { List, LoadingRows, Section } from '@/components/page';
import { useLocationAccess } from '@/components/schedules/access';
import { Button } from '@/components/ui/button';
import { sep, useFormat } from '@/lib/format';
import { HandoverReturnSheet } from './handover-return';
import { LoanRowView } from './loan-row';

export function PersonLoans({ personId, name }: { personId: string; name: string }) {
  const { t } = useLingui();
  const q = usePersonLoans(personId);
  if (q.isPending) return <LoadingRows rows={1} label={t`Loading loans`} />;
  if (q.isError) return null;
  const first = q.data.pages[0];
  const has = first?.has ?? [];
  const lentUs = first?.lentUs ?? [];
  const history = q.data.pages.flatMap((p) => p.history);
  return (
    <>
      {has.length ? (
        <Section title={<Trans>Has from us</Trans>}>
          <Grouped label={t`What ${name} has from us`} rows={has} />
        </Section>
      ) : null}
      {lentUs.length ? (
        <Section title={<Trans>Lent to us</Trans>}>
          <Loans label={t`What ${name} lent us`} rows={lentUs} />
        </Section>
      ) : null}
      {history.length ? (
        <Section title={<Trans>Returned</Trans>}>
          <Loans label={t`Loans with ${name} that ended`} rows={history} />
          {q.hasNextPage ? (
            <Button
              variant="secondary"
              className="justify-self-center"
              isPending={q.isFetchingNextPage}
              onPress={() => void q.fetchNextPage()}
            >
              <Trans>Load more</Trans>
            </Button>
          ) : null}
        </Section>
      ) : null}
    </>
  );
}

function Loans({ label, rows }: { label: string; rows: LoanRow[] }) {
  return (
    <List aria-label={label}>
      {rows.map((l) => (
        <li key={l.id}>
          <LoanRowView loan={l} hidePerson />
        </li>
      ))}
    </List>
  );
}

/** Open loans out, by hand-over: one with several things gets a heading and its checklist. */
function Grouped({ label, rows }: { label: string; rows: LoanRow[] }) {
  const fmt = useFormat();
  const access = useLocationAccess();
  const [checklist, setChecklist] = useState<string | null>(null);
  const groups = new Map<string, LoanRow[]>();
  for (const l of rows) {
    const key = l.handoverId ?? l.id;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  return (
    <>
      {[...groups].map(([key, lines]) => {
        const first = lines[0] as LoanRow;
        const root = lines.find((l) => !l.with) ?? first;
        const many = lines.length > 1;
        const canReturn = access(first.thing.locationId).can('things.edit');
        return (
          <div key={key} className="grid gap-1.5">
            {many ? (
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="m-0 flex-1 font-semibold text-[15px]">
                  {plural(lines.length, { one: '# thing', other: '# things' })}{' '}
                  <Trans>
                    with <bdi>{root.thing.name ?? first.with?.name ?? ''}</bdi>
                  </Trans>
                  {sep()}
                  {fmt.day(first.startedAt)}
                </h3>
                {canReturn && first.handoverId ? (
                  <Button
                    size="small"
                    variant="secondary"
                    onPress={() => setChecklist(first.handoverId ?? null)}
                  >
                    <Trans>Mark returned</Trans>
                  </Button>
                ) : null}
              </div>
            ) : null}
            <Loans label={label} rows={lines} />
          </div>
        );
      })}
      <HandoverReturnSheet
        handoverId={checklist}
        isOpen={!!checklist}
        onClose={() => setChecklist(null)}
      />
    </>
  );
}
