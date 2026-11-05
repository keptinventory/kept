/**
 * Settings → Me → Hide Personal (#392): for someone who has no use for a second location. It takes
 * Personal out of the menu, Home, lists and search for this person; nothing in it changes, a direct
 * link still opens it and its reminders still arrive. While it is the only location it can't be
 * hidden; if someone hid it and later has nothing else, it shows until they do
 * (kept.hidden_location_ids, on the server).
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setHidePersonal } from '@/api/account';
import { useAllLocations, useMe } from '@/api/queries';
import { useErrorText } from '@/components/page';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { useOnline } from '@/lib/online';
import { usePersonalName } from '@/lib/personal-name';

export function HidePersonal() {
  const { t } = useLingui();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const online = useOnline();
  const personal = usePersonalName();
  const me = useMe();
  const locations = useAllLocations();
  const asked = me.data?.profile.hidePersonal === true;
  const another = (locations.data ?? []).some((l) => l.kind !== 'personal');
  // While they load, or if they failed, nothing is known about what else there is.
  const known = locations.data !== undefined;
  const save = useMutation({
    mutationFn: setHidePersonal,
    // Every list, Home and the menu read it: nothing cached still holds.
    onSuccess: () => qc.invalidateQueries(),
    onError: (e) =>
      toast({ title: t`Couldn't save it`, description: errorText(e), tone: 'danger' }),
  });
  if (!me.data?.personalLocationId) return null;
  return (
    <div className="grid gap-1 rounded-[10px] border border-line bg-surface p-3.5">
      <Switch
        isSelected={asked}
        isDisabled={!online || save.isPending || (!asked && !another)}
        onChange={(on) => save.mutate(on)}
      >
        <span>
          <Trans>
            Hide <bdi>{personal}</bdi>
          </Trans>
        </span>
      </Switch>
      {known ? (
        <p className="m-0 text-small text-ink-2">
          {another ? (
            <Trans>
              It leaves the menu, Home, lists and search, for you only. Nothing in it changes, a
              link to it still opens it, and its reminders still reach you. Show it again here any
              time.
            </Trans>
          ) : asked ? (
            <Trans>
              <bdi>{personal}</bdi> is showing because it's your only location. It hides again when
              you have another.
            </Trans>
          ) : (
            <Trans>
              <bdi>{personal}</bdi> is your only location, so it stays. Add or join another first.
            </Trans>
          )}
        </p>
      ) : null}
    </div>
  );
}
