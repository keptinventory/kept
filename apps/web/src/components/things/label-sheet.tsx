/**
 * Label (D120, D134, D137). The thing's short ID is permanent: its label reprints with the same
 * code (D45). The label shows as it prints (#366: QR, code and name, label-preview.tsx), with
 * Print, which opens the batch builder for this one thing, and Download, a PNG; the code can be
 * copied too. With the Labels module off it says so.
 *
 * From md it is a card in the Details tab's side column (`LabelCard`); on a phone, Details has a
 * Label row that opens the same preview in a sheet (`LabelSheet`), as the action menu's Label
 * does.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { lazy, Suspense } from 'react';
import { LoadingRows, Notice, Section } from '@/components/page';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { DialogFooter } from '@/components/ui/dialog';
import { ModuleOff, useThingCtx } from './context';
import { Sheet } from './sheet';

function Unavailable() {
  const { t } = useLingui();
  return <Notice title={t`Needs a connection`} />;
}

// The preview reads the builder's dry run and draws the print cell: on demand.
const Preview = lazy(() => import('./label-preview').catch(() => ({ default: Unavailable })));

/** The label as it prints, Print and Download, and the code to copy. */
function LabelBody() {
  const { thing, moduleOn, can } = useThingCtx();
  const { t } = useLingui();
  if (!moduleOn('labels')) return <ModuleOff what={t`Labels & QR`} />;
  if (!thing.shortCode)
    return (
      <p className="m-0 text-ink-2">
        <Trans>Its ID is still being made. Try again in a moment.</Trans>
      </p>
    );
  return (
    <div className="grid justify-items-start gap-3">
      {can('labels.use') ? (
        <Suspense fallback={<LoadingRows rows={2} />}>
          <Preview />
        </Suspense>
      ) : null}
      <p className="m-0 text-small text-ink-2">
        <Trans>
          This code stays with {thing.name ?? ''} for good, so a reprinted label still finds it.
        </Trans>
      </p>
      <CopyButton text={thing.shortCode} label={t`Copy the code`} size="small" />
    </div>
  );
}

export function LabelSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useLingui();
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={t({ message: 'Label', context: 'printed label' })}
    >
      {isOpen ? <LabelBody /> : null}
      <DialogFooter>
        <Button variant="secondary" onPress={onClose}>
          <Trans>Done</Trans>
        </Button>
      </DialogFooter>
    </Sheet>
  );
}

/** From md: the Label card in the Details tab's side column. */
export function LabelCard() {
  return (
    <Section title={<Trans context="printed label">Label</Trans>}>
      <div className="rounded-[10px] border border-line bg-surface p-3.5">
        <LabelBody />
      </div>
    </Section>
  );
}
