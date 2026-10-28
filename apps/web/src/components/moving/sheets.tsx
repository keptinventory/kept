/**
 * Sheets of the board (1.x, D251): adding a numbered box, and the contents sheets PDF.
 *
 * - **Add a box** makes the next numbered box ("Box 7") in the location being packed (in its
 *   Unplaced area until it is moved), with the room it goes to when you know it. Its number comes from the server, so it
 *   needs a connection. A label for it prints from Labels (Print labels on the board).
 * - **Contents sheets** is a PDF made on the server (`POST /reports/move`, the `move` run kind): a
 *   page per box, with its number, the room it goes to, what is inside and its QR code, to tape to
 *   the box. Its form (./contents-sheets.tsx, with "Printed OK?" after it, #307) loads on demand:
 *   it needs the server anyway, and offline before its first use the sheet says so.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { movingApi } from '@/api/moving/queries';
import type { Move } from '@/api/moving/types';
import { Notice, useErrorText } from '@/components/page';
import { type PickedPlace, PlacePicker } from '@/components/places/move-picker';
import { Sheet } from '@/components/things/sheet';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { useOnline } from '@/lib/online';
import type { SheetsFormProps } from './contents-sheets';
import { useRefreshBoard } from './offline';

function Unavailable(_: SheetsFormProps) {
  const { t } = useLingui();
  return <Notice title={t`Needs a connection`} />;
}

const SheetsForm = lazy(() => import('./contents-sheets').catch(() => ({ default: Unavailable })));

export function AddBoxSheet({
  isOpen,
  onClose,
  move,
  onAdded,
}: {
  isOpen: boolean;
  onClose: () => void;
  move: Move;
  onAdded?: (containerId: string, number: number) => void;
}) {
  const { t } = useLingui();
  return (
    <Sheet isOpen={isOpen} onOpenChange={(o) => !o && onClose()} title={t`Add a box`}>
      {isOpen ? <AddBoxForm move={move} onClose={onClose} onAdded={onAdded} /> : null}
    </Sheet>
  );
}

function AddBoxForm({
  move,
  onClose,
  onAdded,
}: {
  move: Move;
  onClose: () => void;
  onAdded?: ((containerId: string, number: number) => void) | undefined;
}) {
  const { t } = useLingui();
  const online = useOnline();
  const errorText = useErrorText();
  const refresh = useRefreshBoard();
  const [room, setRoom] = useState<PickedPlace | null>(null);
  const add = useMutation({
    mutationFn: () =>
      movingApi.addBox(move.id, {
        new: { prefix: t`Box` },
        ...(room ? { destinationPlaceId: room.placeId } : {}),
      }),
    onSuccess: async (box) => {
      await refresh(move.id);
      onAdded?.(box.containerId, box.number);
      onClose();
    },
  });
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate();
      }}
    >
      <p className="m-0 text-small text-ink-2">
        <Trans>It gets the next number. Put things in it from its page, or with the scanner.</Trans>
      </p>
      <PlacePicker
        label={t`Room it goes to (optional)`}
        locationIds={[move.toLocationId ?? move.locationId]}
        includeUnplaced={false}
        value={room}
        onChange={setRoom}
      />
      {add.error ? <Notice tone="danger">{errorText(add.error)}</Notice> : null}
      {online ? null : (
        <p className="m-0 text-small text-ink-2">
          <Trans>Needs a connection</Trans>
        </p>
      )}
      <DialogFooter>
        <Button variant="secondary" onPress={onClose}>
          <Trans>Cancel</Trans>
        </Button>
        <Button type="submit" isPending={add.isPending} isDisabled={!online}>
          <Trans>Add the box</Trans>
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ContentsSheetsSheet({
  isOpen,
  onClose,
  move,
  containerIds,
}: {
  isOpen: boolean;
  onClose: () => void;
  move: Move;
  /** Only these boxes; omitted: every box. */
  containerIds?: string[] | undefined;
}) {
  const { t } = useLingui();
  return (
    <Sheet isOpen={isOpen} onOpenChange={(o) => !o && onClose()} title={t`Contents sheets`}>
      {isOpen ? (
        <Suspense fallback={null}>
          <SheetsForm onClose={onClose} move={move} containerIds={containerIds} />
        </Suspense>
      ) : null}
    </Sheet>
  );
}
