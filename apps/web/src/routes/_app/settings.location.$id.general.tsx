/**
 * Location settings → General (D41, D204). Its name first (an owner or admin renames
 * it; the server checks). Its languages: the ones AI writes search aliases in when it fills in a
 * thing here, chosen in a multi-select with flags. Its timezone: dates here read in it. Its
 * currency: new amounts default to it (existing amounts keep theirs; converted totals need
 * Account → Exchange rates). Room photos: whether the full photos of a room stay on its place
 * after review (#194; deleted by default). Then the location's own codes: numbering and
 * the format rule (D208). Last, for the owner, Delete with "Export first" (D149).
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useCurrencies } from '@/api/inventory/queries';
import { updateLocation } from '@/api/locations';
import { keys } from '@/api/queries';
import type { LocationDetail } from '@/api/types';
import { OwnCodeSettingsSection } from '@/components/codes/code-settings';
import { DeleteLocationSection } from '@/components/export/delete-location-sheet';
import { LanguagesMultiSelect } from '@/components/languages';
import { LocationSettingsPage } from '@/components/location-settings';
import { SettingsRouteError } from '@/components/on-demand-route-error';
import { Section, useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Select, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';

export const Route = createFileRoute('/_app/settings/location/$id/general')({
  component: GeneralPage,
  errorComponent: SettingsRouteError,
});

function GeneralPage() {
  const { id } = Route.useParams();
  const { t } = useLingui();
  return (
    <LocationSettingsPage id={id} section="general" title={() => t`General`}>
      {(loc) => (
        <div className="grid gap-8">
          <NameForm key={`${loc.id}:${loc.name}`} location={loc} />
          <LanguagesForm key={`${loc.id}:${(loc.languages ?? []).join()}`} location={loc} />
          <RoomPhotosForm location={loc} />
          <TimezoneForm key={`${loc.id}:${loc.timezone}`} location={loc} />
          <CurrencyForm key={`${loc.id}:${loc.currency}`} location={loc} />
          <OwnCodeSettingsSection locationId={loc.id} />
          <DeleteLocationSection location={loc} />
        </div>
      )}
    </LocationSettingsPage>
  );
}

/** The location's name: the sidebar, the breadcrumbs and every share link show it. */
function NameForm({ location }: { location: LocationDetail }) {
  const { t } = useLingui();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const [name, setName] = useState(location.name);
  const trimmed = name.trim();
  const dirty = trimmed !== location.name;

  const save = useMutation({
    mutationFn: () => updateLocation(location.id, { name: trimmed }, location.rowVersion),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.location(location.id) });
      await qc.invalidateQueries({ queryKey: keys.locations });
      toast({ title: t`Renamed to ${trimmed}`, tone: 'ok' });
    },
    onError: (e) => toast({ title: errorText(e), tone: 'danger' }),
  });

  return (
    <div className="grid gap-5">
      <Section title={<Trans>Name</Trans>}>
        <div className="grid gap-3 rounded-[10px] border border-line bg-surface p-3.5">
          <TextField
            label={t`Location name`}
            value={name}
            onChange={setName}
            isInvalid={trimmed === ''}
            errorMessage={trimmed === '' ? t`Give it a name.` : undefined}
            maxLength={100}
          />
        </div>
      </Section>
      <Button
        className="w-full md:w-auto md:justify-self-start"
        isDisabled={!dirty || trimmed === ''}
        isPending={save.isPending}
        onPress={() => save.mutate()}
      >
        <Trans>Rename</Trans>
      </Button>
    </div>
  );
}

const same = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

function LanguagesForm({ location }: { location: LocationDetail }) {
  const { t } = useLingui();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const saved = location.languages ?? [];
  const [languages, setLanguages] = useState<string[]>(saved);
  const dirty = !same(languages, saved);

  const save = useMutation({
    mutationFn: () => updateLocation(location.id, { languages }, location.rowVersion),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.location(location.id) });
      await qc.invalidateQueries({ queryKey: keys.locations });
      toast({ title: t`Saved`, tone: 'ok' });
    },
    onError: (e) => toast({ title: errorText(e), tone: 'danger' }),
  });

  return (
    <div className="grid gap-5">
      <Section title={<Trans>Languages</Trans>}>
        <div className="grid gap-3 rounded-[10px] border border-line bg-surface p-3.5">
          <LanguagesMultiSelect
            label={t`Languages spoken here`}
            description={t`When AI fills in a thing here, it adds search words in each of these languages, so anyone can find it in their own.`}
            value={languages}
            onChange={setLanguages}
          />
        </div>
      </Section>
      <Button
        className="w-full md:w-auto md:justify-self-start"
        isDisabled={!dirty}
        isPending={save.isPending}
        onPress={() => save.mutate()}
      >
        <Trans>Save</Trans>
      </Button>
    </div>
  );
}

/** Room photos (#194): the full photos of a room are deleted once it is reviewed, unless kept. */
function RoomPhotosForm({ location }: { location: LocationDetail }) {
  const { t } = useLingui();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const save = useMutation({
    mutationFn: (keep: boolean) =>
      updateLocation(location.id, { keepRoomPhotos: keep }, location.rowVersion),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.location(location.id) });
      await qc.invalidateQueries({ queryKey: keys.locations });
      toast({ title: t`Saved`, tone: 'ok' });
    },
    onError: (e) => toast({ title: errorText(e), tone: 'danger' }),
  });
  return (
    <Section title={<Trans>Room photos</Trans>}>
      <div className="grid gap-2 rounded-[10px] border border-line bg-surface p-3.5">
        <Switch
          isSelected={location.keepRoomPhotos ?? false}
          isDisabled={save.isPending}
          onChange={(on) => save.mutate(on)}
        >
          <Trans>Keep room photos after review</Trans>
        </Switch>
        <p className="m-0 text-small text-ink-2">
          <Trans>
            When you photograph a room, Kept cuts a picture for each thing it finds. Once you close
            the room in the inbox, the full photos are deleted, unless this is on: then they stay on
            the room's page.
          </Trans>
        </p>
      </div>
    </Section>
  );
}

/** The zone dates here read in. Type to filter the IANA list; the server canonicalises. */
function TimezoneForm({ location }: { location: LocationDetail }) {
  const { t } = useLingui();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      return [];
    }
  }, []);
  const [zone, setZone] = useState(location.timezone);
  const dirty = zone !== location.timezone;

  const save = useMutation({
    mutationFn: () => updateLocation(location.id, { timezone: zone }, location.rowVersion),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.location(location.id) });
      await qc.invalidateQueries({ queryKey: keys.locations });
      toast({ title: t`Saved`, tone: 'ok' });
    },
    onError: (e) => toast({ title: errorText(e), tone: 'danger' }),
  });

  return (
    <div className="grid gap-5">
      <Section title={<Trans>Timezone</Trans>}>
        <div className="grid gap-3 rounded-[10px] border border-line bg-surface p-3.5">
          <Combobox
            label={t`Timezone`}
            description={t`Dates in this location read in this zone.`}
            items={
              zones.includes(zone)
                ? zones.map((z) => ({ id: z, label: z }))
                : [{ id: zone, label: zone }, ...zones.map((z) => ({ id: z, label: z }))]
            }
            selectedKey={zone}
            onSelectionChange={(k) => {
              if (typeof k === 'string') setZone(k);
            }}
          />
        </div>
      </Section>
      <Button
        className="w-full md:w-auto md:justify-self-start"
        isDisabled={!dirty || zone === ''}
        isPending={save.isPending}
        onPress={() => save.mutate()}
      >
        <Trans>Save</Trans>
      </Button>
    </div>
  );
}

/** What new amounts default to. Existing amounts keep their currency. */
function CurrencyForm({ location }: { location: LocationDetail }) {
  const { t } = useLingui();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const currencies = useCurrencies();
  const enabled = (currencies.data?.currencies ?? []).filter((c) => c.enabled);
  const [code, setCode] = useState(location.currency);
  const dirty = code.toUpperCase() !== location.currency.toUpperCase();

  const save = useMutation({
    mutationFn: () =>
      updateLocation(location.id, { currency: code.toUpperCase() }, location.rowVersion),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.location(location.id) });
      await qc.invalidateQueries({ queryKey: keys.locations });
      toast({ title: t`Saved`, tone: 'ok' });
    },
    onError: (e) => toast({ title: errorText(e), tone: 'danger' }),
  });

  return (
    <div className="grid gap-5">
      <Section title={<Trans>Currency</Trans>}>
        <div className="grid gap-3 rounded-[10px] border border-line bg-surface p-3.5">
          <Select<{ id: string; label: string }>
            label={t`Currency`}
            description={t`New amounts default to this. Existing amounts keep theirs; converted totals need Account → Exchange rates.`}
            items={enabled.map((c) => ({ id: c.code, label: c.name }))}
            value={code.toUpperCase()}
            onChange={(k) => {
              if (k) setCode(String(k));
            }}
            renderValue={([item]) =>
              item ? (
                <span dir="ltr">
                  {item.id} · {item.label}
                </span>
              ) : null
            }
          >
            {(item) => (
              <SelectItem id={item.id} textValue={item.label}>
                <span dir="ltr">
                  {item.id} · {item.label}
                </span>
              </SelectItem>
            )}
          </Select>
        </div>
      </Section>
      <Button
        className="w-full md:w-auto md:justify-self-start"
        isDisabled={!dirty}
        isPending={save.isPending}
        onPress={() => save.mutate()}
      >
        <Trans>Save</Trans>
      </Button>
    </div>
  );
}
