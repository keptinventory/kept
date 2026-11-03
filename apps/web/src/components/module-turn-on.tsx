/**
 * A module that is off in a location, turned on where it's missing: "Turn on Lending here" for an
 * owner or admin, one tap, the same route the "What to track" screen saves through, one module
 * at a time (`{module, enabled}`, D61). Anyone else is told who can: the location's owners and
 * admins by name (the members list every member may read), or "an admin" while it loads.
 */
import type { ModuleId, Role } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setModule } from '@/api/locations';
import { keys, useMembers } from '@/api/queries';
import { useErrorText } from '@/components/page';
import { useInvalidateHousehold } from '@/components/schedules/access';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { isolate } from '@/lib/bidi';
import { useLocationName, useModuleLabels } from '@/lib/labels';
import { useOnline } from '@/lib/online';

type Where = { id: string; name: string; kind?: string; role: Role };

const runs = (role: Role) => role === 'owner' || role === 'admin';

/** The button, for an owner or admin; `onDone` after the location has it on. */
export function TurnOnHere({
  location,
  module,
  onDone,
}: {
  location: Where;
  module: ModuleId;
  onDone?: () => void | Promise<void>;
}) {
  const { t } = useLingui();
  const label = useModuleLabels()[module];
  const name = useLocationName()(location);
  const errorText = useErrorText();
  const online = useOnline();
  const qc = useQueryClient();
  const invalidateHousehold = useInvalidateHousehold();
  const turnOn = useMutation({
    mutationFn: () => setModule(location.id, { module, enabled: true }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.location(location.id) }),
        qc.invalidateQueries({ queryKey: keys.locations }),
        // What the module shows (loans, schedules, Home's rows) is answered per module.
        invalidateHousehold(),
      ]);
      await onDone?.();
      toast({ title: t`${label} is on in ${isolate(name)}`, tone: 'ok' });
    },
    onError: (e) => toast({ title: errorText(e), tone: 'danger' }),
  });
  return (
    <Button
      size="small"
      isDisabled={!online}
      isPending={turnOn.isPending}
      onPress={() => turnOn.mutate()}
    >
      <Trans>Turn on {label} here</Trans>
    </Button>
  );
}

/** For someone who can't turn it on: who can, by name. */
export function WhoTurnsOn({ locationId }: { locationId: string }) {
  const { i18n } = useLingui();
  const members = useMembers(locationId);
  const names = (members.data?.members ?? [])
    .filter((m) => runs(m.role) && m.displayName)
    .map((m) => isolate(m.displayName));
  if (names.length === 0) return <Trans>Ask an admin of this location to turn it on.</Trans>;
  const who = new Intl.ListFormat(i18n.locale, { type: 'disjunction' }).format(names);
  return <Trans>Ask {who} to turn it on.</Trans>;
}
