/**
 * Archive and Unarchive (the `archived` lifecycle: still yours, put away). One tap each, from the
 * thing's actions or its Archived badge, through the lifecycle route (things.edit), with the
 * same Undo every lifecycle change offers.
 */
import { useLingui } from '@lingui/react/macro';
import { inventoryApi } from '@/api/inventory/queries';
import { useOfferUndo } from '@/components/history/undo';
import { useErrorText } from '@/components/page';
import { toast } from '@/components/ui/toast';
import { useThingCtx } from './context';

export function useSetArchived() {
  const { thing, refresh } = useThingCtx();
  const { t } = useLingui();
  const offerUndo = useOfferUndo();
  const errorText = useErrorText();
  return async (archived: boolean) => {
    try {
      const { auditEvents } = await inventoryApi.lifecycle(
        thing.id,
        { lifecycle: archived ? 'archived' : 'in_use' },
        thing.rowVersion,
      );
      offerUndo({ title: archived ? t`Archived` : t`Back in use` }, auditEvents, {
        thingId: thing.id,
      });
      await refresh();
    } catch (e) {
      toast({ title: t`Couldn't change it`, description: errorText(e), tone: 'danger' });
    }
  };
}
