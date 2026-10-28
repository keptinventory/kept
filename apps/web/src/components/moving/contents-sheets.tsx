/**
 * The contents sheets' form (1.x, D251), loaded on demand (vite.config.ts ON_DEMAND_ENTRIES;
 * ./sheets.tsx opens it): a PDF made on the server (`POST /reports/move`, the `move` run kind), a
 * page per box with its number, the room it goes to, what is inside and its QR code, to tape to
 * the box. Followed to Open PDF, Share and Download (components/reports/progress.tsx), then
 * "Printed OK?" for the boxes on it (./sheets-printed.tsx, #307). It needs the server anyway.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { isApiError } from '@/api/client';
import { movingApi } from '@/api/moving/queries';
import type { ContentsSheetsBody, Move } from '@/api/moving/types';
import { Notice, useErrorText } from '@/components/page';
import { ReportProgress, reportFilenameOf } from '@/components/reports/progress';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Segmented } from '@/components/ui/segmented';
import { useOnline } from '@/lib/online';
import { usePrefs } from '@/lib/prefs';
import { SheetsPrinted } from './sheets-printed';

const filename = reportFilenameOf('contents-sheets');

export type SheetsFormProps = {
  onClose: () => void;
  move: Move;
  /** Only these boxes; omitted: every box. */
  containerIds?: string[] | undefined;
};

export default function SheetsForm({ onClose, move, containerIds }: SheetsFormProps) {
  const { t } = useLingui();
  const prefs = usePrefs();
  const online = useOnline();
  const errorText = useErrorText();
  const [locale, setLocale] = useState<'en' | 'ar'>(prefs.locale === 'ar' ? 'ar' : 'en');
  const [runId, setRunId] = useState<string | null>(null);
  const body = (): ContentsSheetsBody => ({
    moveId: move.id,
    ...(containerIds?.length ? { containerIds } : {}),
    locale,
    digits: locale === 'ar' ? prefs.digits : 'western',
  });
  const start = useMutation({
    mutationFn: (b: ContentsSheetsBody) => movingApi.sheets(b),
    onSuccess: ({ id }) => setRunId(id),
  });
  const startError = (e: unknown) =>
    isApiError(e) && e.code === 'rate_limited'
      ? t`Kept makes at most five reports an hour. Try again later.`
      : errorText(e);

  if (runId)
    return (
      <div className="grid gap-4">
        <ReportProgress
          key={runId}
          runId={runId}
          filename={filename}
          onRetry={() => {
            setRunId(null);
            start.mutate(body());
          }}
        />
        {start.error ? <Notice tone="danger">{startError(start.error)}</Notice> : null}
        <SheetsPrinted key={runId} runId={runId} move={move} containerIds={containerIds} />
        <DialogFooter>
          <Button variant="secondary" onPress={onClose}>
            <Trans>Close</Trans>
          </Button>
        </DialogFooter>
      </div>
    );

  const n = containerIds?.length ?? move.boxes.length;
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start.mutate(body());
      }}
    >
      <p className="m-0 text-small text-ink-2">
        <Trans>
          A page per box: its number, the room it goes to, what's inside and its code. Tape it to
          the box; scanning the code opens the box in Kept.
        </Trans>
      </p>
      {n === 0 ? (
        <Notice tone="warn">
          <Trans>Add a box first.</Trans>
        </Notice>
      ) : null}
      <Segmented<'en' | 'ar'>
        label={t`Language`}
        value={locale}
        onChange={setLocale}
        options={[
          { id: 'en', label: 'English' },
          { id: 'ar', label: <span lang="ar">العربية</span> },
        ]}
      />
      {start.error ? <Notice tone="danger">{startError(start.error)}</Notice> : null}
      {online ? null : (
        <p className="m-0 text-small text-ink-2">
          <Trans>Needs a connection</Trans>
        </p>
      )}
      <DialogFooter>
        <Button variant="secondary" onPress={onClose}>
          <Trans>Cancel</Trans>
        </Button>
        <Button type="submit" isPending={start.isPending} isDisabled={!online || n === 0}>
          <Trans>Make the PDF</Trans>
        </Button>
      </DialogFooter>
    </form>
  );
}
