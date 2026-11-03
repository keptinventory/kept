/**
 * Re-type (D92): values whose field the new type also has carry over; the rest are archived,
 * never deleted, and the sheet names them before you confirm. A thing with no type just takes
 * one: there is nothing to archive. The type chip at the top of a thing's page opens it (#366),
 * and the Edit form says the same before it saves a new type (`RetypeNotice`).
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { thingApi, useTypeDetail } from '@/api/inventory/thing-api';
import { useOfferUndo } from '@/components/history/undo';
import { Notice, useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useThingCtx } from './context';
import { useFieldLabel } from './names';
import { TypePicker, useLocationAccountId } from './pickers';
import { Sheet } from './sheet';

/**
 * What a new type does to the thing's values: which are archived, or that every one carries
 * over. Nothing for a thing with no type yet (there is nothing to archive), nor while the new
 * type is read.
 */
export function RetypeNotice({ typeId }: { typeId: string | null }) {
  const { thing } = useThingCtx();
  const fieldLabel = useFieldLabel();
  const detail = useTypeDetail(typeId);
  if (!thing.type || typeId === thing.type.id) return null;
  if (typeId && !detail.data) return null;
  const keep = new Set((detail.data?.fields ?? []).map((f) => f.key));
  const archived = thing.fields.filter((f) => thing.custom[f.key] != null && !keep.has(f.key));
  return archived.length ? (
    <Notice tone="warn" title={<Trans>These values will be archived</Trans>}>
      <span className="block">{archived.map((f) => fieldLabel(f)).join(', ')}</span>
      <Trans>
        They stay on the thing under Archived fields, and come back if you re-type again.
      </Trans>
    </Notice>
  ) : (
    <Notice tone="ok">
      <Trans>Every value carries over.</Trans>
    </Notice>
  );
}

export function RetypeSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { thing, location, refresh } = useThingCtx();
  const { t } = useLingui();
  const errorText = useErrorText();
  const offerUndo = useOfferUndo();
  const accountId = useLocationAccountId(location);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!typeId) return;
    setBusy(true);
    try {
      const { auditEvents } = await thingApi.retype(thing.id, { typeId }, thing.rowVersion);
      offerUndo({ title: t`Type changed` }, auditEvents, { thingId: thing.id });
      await refresh();
      setTypeId(null);
      onClose();
    } catch (e) {
      toast({ title: t`Couldn't change the type`, description: errorText(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={thing.type ? t`Change the type` : t`Choose a type`}
    >
      <div className="grid gap-3.5">
        <TypePicker
          accountId={accountId}
          label={thing.type ? t`New type` : t`Type`}
          value={typeId}
          onChange={(id) => setTypeId(id)}
          {...(thing.type ? { exclude: thing.type.id } : {})}
        />
        {typeId ? <RetypeNotice typeId={typeId} /> : null}
        <DialogFooter>
          <Button variant="secondary" onPress={onClose}>
            <Trans>Cancel</Trans>
          </Button>
          <Button isDisabled={!typeId} isPending={busy} onPress={() => void save()}>
            {thing.type ? <Trans>Change type</Trans> : <Trans>Save</Trans>}
          </Button>
        </DialogFooter>
      </div>
    </Sheet>
  );
}
