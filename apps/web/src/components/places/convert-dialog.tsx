/**
 * Turn a place into a container (D160, Q14): a drawer that turns out to be a box you carry
 * around. It keeps its id, ID and label, so links and printed labels still work, and what's in
 * it stays in it. Only a place with no places inside can become a box: a box holds things.
 * The way back is on the box's own page (task 26's "Turn into a place").
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PlaceView } from '@/api/inventory/types';
import { Notice, useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { invalidateBrowse, placeApi } from './api';
import { Sheet } from './sheet';

export function ConvertToContainerDialog({
  place,
  isOpen,
  onOpenChange,
  onConverted,
}: {
  place: PlaceView;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted: (thingId: string) => void;
}) {
  const { t } = useLingui();
  const errorText = useErrorText();
  const qc = useQueryClient();
  const name = place.name;
  const convert = useMutation({
    mutationFn: () => placeApi.convertToContainer(place.id, place.rowVersion),
    onSuccess: ({ thingId }) => {
      // The place is gone (its id is the box's now): its own queries are not asked again, and
      // the box opens at once while the lists refresh behind it (#336).
      void invalidateBrowse(qc, { gone: place.id });
      toast({ title: t`${name} is a box now`, tone: 'ok' });
      onConverted(thingId);
    },
  });
  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title={t`Turn ${name} into a box?`}>
      {({ close }) => (
        <div className="grid gap-4">
          <p className="m-0 text-ink-2">
            <Trans>
              A box is a thing: it can be moved, with everything in it, in one step.{' '}
              <bdi>{name}</bdi> keeps its ID and label, and what's in it stays in it.
            </Trans>
          </p>
          {convert.error ? <Notice tone="danger">{errorText(convert.error)}</Notice> : null}
          <DialogFooter>
            <Button variant="secondary" onPress={close}>
              <Trans>Cancel</Trans>
            </Button>
            <Button isPending={convert.isPending} onPress={() => convert.mutate()}>
              <Trans>Turn into a box</Trans>
            </Button>
          </DialogFooter>
        </div>
      )}
    </Sheet>
  );
}
