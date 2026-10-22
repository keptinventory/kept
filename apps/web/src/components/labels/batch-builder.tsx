/**
 * The batch builder (D43, D137, D175): what is printing,
 * the stock, the start cell on a partly used sheet, then Print.
 *
 * What prints comes from where the person started: a selection of things, a place's own label,
 * "Label everything unprinted" in a place or location (its things, or its places), or a blank
 * sheet. The list is the server's
 * answer to a dry run (`dryRun`: no batch saved, no blank allocated; a place with no code gets
 * its own, the code it prints with), so it shows exactly what the batch
 * will hold, and says how many things were left out because their ID is still pending (they were
 * captured offline and haven't synced). Print makes the batch, then opens the print view, which
 * opens the print dialog.
 *
 * The preview is the printed label itself (start-cell.tsx, `LabelCell`), and names or places too
 * long for the chosen label even at the smallest type are listed before anything prints, each
 * with a link to rename it. When a batch still waiting for "Printed OK?" holds exactly these
 * labels, the builder offers to open it rather than make a duplicate.
 *
 * One press, one request: the create. The preview's dry run isn't asked again when the create
 * lands (the labels queries are refreshed, the preview left out), so a print is one dry run when
 * the builder opens and one create.
 */
import { isSheet, labelStock } from '@kept/shared';
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { captureApi, captureKeys, useLabelSummary } from '@/api/capture/queries';
import type {
  CreateLabelBatchBody,
  LabelBatchKind,
  LabelBatchNothingDetails,
  LabelBatchPreview,
  LabelCellContent,
  LabelExclusions,
} from '@/api/capture/types';
import { isApiError } from '@/api/client';
import type { LocationDetail } from '@/api/types';
import { PrinterIcon } from '@/components/icons';
import { IdChip } from '@/components/id-chip';
import { EmptyState, LoadingRows, Notice, useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { isolate } from '@/lib/bidi';
import { useFormat } from '@/lib/format';
import { labelsTooLong, useLabelMeasure } from './fit';
import { LabelCell } from './label-cell';
import { perPage } from './layout';
import { useQrEncoder } from './qr';
import { blankSample, StartCellPicker } from './start-cell';
import { rememberedStock, StockPicker, useStockText } from './stock-picker';

/** Where the builder was opened from (the `/labels` search). */
export type BatchSource = {
  locationId: string;
  kind: LabelBatchKind;
  thingIds?: string[];
  placeIds?: string[];
  /** "Label everything unprinted", in a place's subtree or the whole location. */
  unprinted?: { placeId?: string };
  blankCount?: number;
};

/**
 * The server's 400 for a real batch with nothing left to label: what it left out, or null
 * when the error is something else.
 */
export function nothingToLabel(e: unknown): LabelExclusions | null {
  if (!isApiError(e) || e.code !== 'validation') return null;
  const x = (e.details as Partial<LabelBatchNothingDetails>).excluded;
  return x && typeof x.pending === 'number' && typeof x.other === 'number' ? x : null;
}

/** "Nothing here can be labelled now", and why, in counts. */
function NothingToLabel({ excluded }: { excluded: LabelExclusions }) {
  const { t } = useLingui();
  const { pending, other } = excluded;
  const lines = [
    ...(pending > 0
      ? [
          plural(pending, {
            one: '# is waiting to sync: its ID is still pending.',
            other: '# are waiting to sync: their IDs are still pending.',
          }),
        ]
      : []),
    ...(other > 0
      ? [
          plural(other, {
            one: "# can't be labelled here: it is in the trash or in another location.",
            other: "# can't be labelled here: they are in the trash or in another location.",
          }),
        ]
      : []),
  ];
  return (
    <Notice tone="warn" title={t`Nothing here can be labelled now`}>
      {lines.length ? (
        lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))
      ) : (
        <Trans>Everything listed has been printed since.</Trans>
      )}
    </Notice>
  );
}

/** A blank sheet at most (D172 caps unclaimed labels at 1,000 per location; a batch at 500). */
export const MAX_BLANK = 500;

export function BatchBuilder({
  source,
  location,
  onUnprintedKind,
}: {
  source: BatchSource;
  location: LocationDetail;
  /** "Label everything unprinted": switch between its things and its places. */
  onUnprintedKind?: (kind: 'things' | 'places') => void;
}) {
  const { t } = useLingui();
  const fmt = useFormat();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const errorText = useErrorText();
  const stockText = useStockText();
  const encode = useQrEncoder();
  const { measure } = useLabelMeasure();
  const [stockKey, setStockKey] = useState(rememberedStock);
  const stock = labelStock(stockKey);
  const sheet = isSheet(stock);
  const [start, setStart] = useState(1);
  const startCell = sheet ? Math.min(start, perPage(stock)) : 1;
  const [blankCount, setBlankCount] = useState(() => {
    const first = labelStock(rememberedStock());
    return Math.min(MAX_BLANK, source.blankCount ?? (isSheet(first) ? perPage(first) : 10));
  });
  const blank = source.kind === 'blank';
  const summary = useLabelSummary(location.id);
  const unclaimed = summary.data?.blankUnclaimed ?? 0;

  const body: CreateLabelBatchBody = {
    locationId: location.id,
    kind: source.kind,
    ...(source.thingIds ? { thingIds: source.thingIds } : {}),
    ...(source.placeIds ? { placeIds: source.placeIds } : {}),
    ...(source.unprinted ? { unprinted: source.unprinted } : {}),
    ...(blank ? { blankCount } : {}),
    stock: stockKey,
    startCell,
  };
  const preview = useQuery({
    // The stock and start cell don't change what prints.
    queryKey: [...captureKeys.labels.all, 'preview', { ...body, stock: null, startCell: null }],
    queryFn: () => captureApi.previewLabelBatch(body),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const labels = preview.data?.labels ?? [];
  const count = blank ? blankCount : labels.length;
  const pending = preview.data?.excluded.pending ?? 0;

  const create = useMutation({
    mutationFn: () => captureApi.createLabelBatch(body),
    // The list changed under the preview (printed, trashed or pending since): show it as it is.
    onError: (e) => {
      if (nothingToLabel(e)) void preview.refetch();
    },
    onSuccess: async ({ batch }) => {
      qc.setQueryData(captureKeys.labels.batch(batch.id), batch);
      // Not the preview: it would post its dry run again for a builder that is closing.
      void qc.invalidateQueries({
        queryKey: captureKeys.labels.all,
        predicate: (q) => q.queryKey[1] !== 'preview',
      });
      await navigate({
        to: '/labels/$batchId',
        params: { batchId: batch.id },
        search: { print: 1 },
      });
    },
  });

  const nothingLeft = nothingToLabel(create.error);
  const tooLong = useMemo(() => labelsTooLong(stock, labels, measure), [stock, labels, measure]);
  const already = preview.data?.unconfirmed ?? null;
  const first = labels[0];
  const { title: stockTitle } = stockText(stock);
  const countText = fmt.num(count);
  const pendingText = plural(pending, {
    one: '# thing was left out: its ID is still pending.',
    other: '# things were left out: their IDs are still pending.',
  });

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,380px)] md:items-start md:gap-7">
      <div className="grid min-w-0 content-start gap-5">
        {source.unprinted && onUnprintedKind && source.kind !== 'blank' ? (
          <Segmented<'things' | 'places'>
            label={t`What to label`}
            value={source.kind}
            onChange={onUnprintedKind}
            options={[
              { id: 'things', label: t`Things` },
              { id: 'places', label: t`Places` },
            ]}
            description={
              source.kind === 'places'
                ? t`Every place in here with no printed label, the ones never labelled too: each gets its ID now.`
                : t`Every thing in here with no printed label.`
            }
          />
        ) : null}
        {blank ? (
          <BlankCount
            value={blankCount}
            onChange={setBlankCount}
            max={Math.max(1, Math.min(MAX_BLANK, 1000 - unclaimed))}
            unclaimed={unclaimed}
          />
        ) : (
          <section className="grid gap-2">
            <h2 className="eyebrow m-0">
              <Trans>Printing {countText}</Trans>
            </h2>
            {preview.isPending ? (
              <LoadingRows rows={2} />
            ) : labels.length === 0 && !preview.isError ? (
              <EmptyState icon={<PrinterIcon />} title={t`Nothing to print`}>
                {source.unprinted ? (
                  <Trans>Everything here already has a printed label.</Trans>
                ) : (
                  <Trans>None of these has an ID yet.</Trans>
                )}
              </EmptyState>
            ) : (
              <ul className="m-0 grid list-none gap-0 overflow-hidden rounded-[10px] border border-line bg-surface p-0 sm:grid-cols-2">
                {labels.map((l) => (
                  <li
                    key={l.code}
                    className="flex min-w-0 items-center gap-2.5 border-line px-3 py-2 not-first:border-t sm:nth-2:border-t-0 sm:even:border-s"
                  >
                    <IdChip code={l.code} />
                    <bdi className="min-w-0 text-small text-ink-2 [overflow-wrap:anywhere]">
                      {l.name ?? ''}
                    </bdi>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {pending > 0 ? (
          <Notice title={pendingText}>
            <Trans>
              They get their IDs when the phone that captured them syncs. Print them then, from
              "Print pending labels" on that phone.
            </Trans>
          </Notice>
        ) : null}
        {preview.isError ? <Notice tone="danger">{errorText(preview.error)}</Notice> : null}
        {already ? <AlreadyOnASheet batch={already} /> : null}

        <StockPicker
          value={stockKey}
          onChange={(key) => {
            setStockKey(key);
            setStart(1);
          }}
        />

        {tooLong.length > 0 ? <TooLong labels={tooLong} /> : null}
        {create.isError ? (
          nothingLeft ? (
            <NothingToLabel excluded={nothingLeft} />
          ) : (
            <Notice tone="danger">{errorText(create.error)}</Notice>
          )
        ) : null}
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              onPress={() => create.mutate()}
              isPending={create.isPending}
              isDisabled={count === 0 || preview.isError || preview.isPending}
            >
              <PrinterIcon className="size-5" />
              {plural(count, { one: 'Print # label', other: 'Print # labels' })}
            </Button>
            <Link
              to="/labels"
              className="inline-flex min-h-11 items-center rounded-[10px] px-3 font-semibold text-ink underline-offset-2 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-info"
            >
              <Trans>Back</Trans>
            </Link>
          </div>
          <p className="m-0 text-small text-ink-2">
            {sheet ? (
              <Trans>
                Opens the print dialog at {stockTitle}, scale 100%. Afterwards Kept asks "Printed
                OK?" and records the print date.
              </Trans>
            ) : (
              <Trans>
                Opens the print dialog: choose your label printer and this label size. Afterwards
                Kept asks "Printed OK?" and records the print date.
              </Trans>
            )}
          </p>
        </div>
      </div>

      <div className="grid min-w-0 content-start gap-2">
        {sheet ? (
          <StartCellPicker
            stock={stock}
            value={startCell}
            onChange={setStart}
            labels={labels}
            count={count}
            encode={encode}
            measure={measure}
          />
        ) : (
          <>
            <span className="eyebrow">
              <Trans>Label preview</Trans>
            </span>
            <div className="justify-self-center overflow-hidden rounded-md border border-line shadow-[0_8px_24px_rgba(0,0,0,.1)]">
              <div
                // Printed size, zoomed to about 260 px wide.
                style={{ zoom: 260 / ((stock.cell.w * 96) / 25.4) }}
              >
                <div style={{ inlineSize: `${stock.cell.w}mm`, blockSize: `${stock.cell.h}mm` }}>
                  <LabelCell
                    label={first ?? blankSample()}
                    stock={stock}
                    encode={encode}
                    measure={measure}
                  />
                </div>
              </div>
            </div>
            {blank ? (
              <p className="m-0 text-small text-ink-2">
                <Trans>Each blank label gets its own code when you print.</Trans>
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/** A batch still waiting for "Printed OK?" holds exactly these labels: open it instead. */
function AlreadyOnASheet({ batch }: { batch: NonNullable<LabelBatchPreview['unconfirmed']> }) {
  const { t } = useLingui();
  const fmt = useFormat();
  const stockText = useStockText();
  const when = fmt.dateTime(batch.createdAt);
  let stock = batch.stock;
  try {
    stock = stockText(labelStock(batch.stock)).title;
  } catch {
    // A stock this build doesn't know: its key.
  }
  const title = t`These labels are already on a sheet that isn’t confirmed printed`;
  return (
    <section aria-label={title}>
      <Notice
        tone="warn"
        title={title}
        action={
          <Link to="/labels/$batchId" params={{ batchId: batch.id }} className={inlineLink}>
            <Trans>Open that sheet</Trans>
          </Link>
        }
      >
        <Trans>
          Made {when} on {stock}. Open it to print it or confirm it printed, or print a new sheet
          below.
        </Trans>
      </Notice>
    </section>
  );
}

const inlineLink =
  'shrink-0 font-semibold text-ink underline underline-offset-2 outline-none focus-visible:outline-2 focus-visible:outline-info';

/** Names or places too long for this label even at the smallest type: say so before printing. */
function TooLong({ labels }: { labels: readonly LabelCellContent[] }) {
  const { t } = useLingui();
  const title = plural(labels.length, {
    one: '# name is too long for this label',
    other: '# names are too long for this label',
  });
  return (
    <section aria-label={title}>
      <Notice tone="warn" title={title}>
        <span className="block">
          <Trans>Shorten them, or pick a bigger label. Printed as they are, they won't fit.</Trans>
        </span>
        <ul className="m-0 mt-1.5 grid list-none gap-1 p-0">
          {labels.map((l) => {
            const name = l.name ?? l.code;
            const rename = t`Rename ${isolate(name)}`;
            return (
              <li key={l.code} className="flex flex-wrap items-baseline gap-x-2">
                <bdi className="min-w-0 [overflow-wrap:anywhere]">{name}</bdi>
                {l.targetId && l.kind === 'thing' ? (
                  <Link
                    to="/t/$id"
                    params={{ id: l.targetId }}
                    aria-label={rename}
                    className={inlineLink}
                  >
                    <Trans>Rename</Trans>
                  </Link>
                ) : l.targetId && l.kind === 'place' ? (
                  <Link
                    to="/p/$id"
                    params={{ id: l.targetId }}
                    aria-label={rename}
                    className={inlineLink}
                  >
                    <Trans>Rename</Trans>
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Notice>
    </section>
  );
}

/** "How many blank labels": a stepper, never an OS number picker. */
function BlankCount({
  value,
  onChange,
  max,
  unclaimed,
}: {
  value: number;
  onChange: (n: number) => void;
  max: number;
  unclaimed: number;
}) {
  const { t } = useLingui();
  const fmt = useFormat();
  const n = fmt.num(value);
  const left = fmt.num(unclaimed);
  const cap = fmt.num(1000);
  const set = (next: number) => onChange(Math.max(1, Math.min(max, next)));
  return (
    <section className="grid gap-2">
      <h2 className="eyebrow m-0">
        <Trans>Blank labels</Trans>
      </h2>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          aria-label={t`Fewer`}
          isDisabled={value <= 1}
          onPress={() => set(value - (value > 10 ? 10 : 1))}
        >
          −
        </Button>
        <output
          aria-live="polite"
          className="min-w-16 text-center font-semibold text-title tabular-nums"
        >
          {n}
        </output>
        <Button
          variant="secondary"
          size="icon"
          aria-label={t`More`}
          isDisabled={value >= max}
          onPress={() => set(value + (value >= 10 ? 10 : 1))}
        >
          +
        </Button>
      </div>
      <p className="m-0 text-small text-ink-2">
        <Trans>
          Stick them on boxes now and name them later: the first scan asks what each one is. This
          location has {left} unclaimed of at most {cap}.
        </Trans>
      </p>
    </section>
  );
}
