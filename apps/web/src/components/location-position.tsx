/**
 * Location settings → General → Position (#375): where the location is, so Capture's "Suggest
 * where I am" (D153, camera/geo.ts) can suggest it when you're there. Set from the phone ("Use
 * where I am now": one reading, asked for only on that press) or typed as latitude and
 * longitude; removed with "Remove position". Owners and admins only: the server shows the
 * position to them alone (locations/views.ts), and its history says "changed", never where.
 *
 * "Open in maps" opens OpenStreetMap at the saved position, in a new tab, only when pressed.
 * Over plain HTTP browsers refuse the position: the button is off and says so; typing still works.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { updateLocation } from '@/api/locations';
import { keys } from '@/api/queries';
import type { LocationDetail, LocationPosition } from '@/api/types';
import { currentPosition, deviceGeo, type Geo } from '@/camera/geo';
import { Section, useErrorText } from '@/components/page';
import { parseNumber } from '@/components/things/form-model';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { useFormat } from '@/lib/format';
import { useTypedNumber } from '@/lib/units';

/** Six decimals: about 10 cm, finer than any phone reads. */
const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** OpenStreetMap's marker link (wiki.openstreetmap.org/wiki/Browsing: mlat, mlon, #map). */
export function mapsLink({ latitude, longitude }: LocationPosition): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}

/** A typed coordinate: null when empty, NaN when it isn't a number within ±`limit`. */
function coordinate(typed: string, limit: number): number | null {
  const n = parseNumber(typed);
  if (n === null) return null;
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : Number.NaN;
}

type Reading = 'finding' | 'denied' | 'unavailable' | 'failed' | null;

export function PositionForm({
  location,
  geo = deviceGeo(),
  secure = typeof window === 'undefined' || window.isSecureContext !== false,
}: {
  location: LocationDetail;
  /** The device's geolocation; tests pass a fake. */
  geo?: Geo | null;
  /** Browsers give the position only on a secure address (D193). */
  secure?: boolean;
}) {
  const { t } = useLingui();
  const fmt = useFormat();
  const typed = useTypedNumber();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const saved = location.position ?? null;
  const [lat, setLat] = useState(saved ? typed(round(saved.latitude)) : '');
  const [lon, setLon] = useState(saved ? typed(round(saved.longitude)) : '');
  const [reading, setReading] = useState<Reading>(null);

  const latitude = coordinate(lat, 90);
  const longitude = coordinate(lon, 180);
  // Off the globe, or not a number. Half a position isn't an error yet: Save waits for both.
  const latBad = Number.isNaN(latitude);
  const lonBad = Number.isNaN(longitude);
  const wanted: LocationPosition | null =
    latitude !== null && longitude !== null && !latBad && !lonBad ? { latitude, longitude } : null;
  const dirty =
    wanted !== null &&
    (wanted.latitude !== saved?.latitude || wanted.longitude !== saved?.longitude);

  const save = useMutation({
    mutationFn: (position: LocationPosition | null) =>
      updateLocation(location.id, { position }, location.rowVersion),
    onSuccess: async (_r, position) => {
      await qc.invalidateQueries({ queryKey: keys.location(location.id) });
      await qc.invalidateQueries({ queryKey: keys.locations });
      toast({ title: position ? t`Saved` : t`Position removed`, tone: 'ok' });
    },
    onError: (e) => toast({ title: errorText(e), tone: 'danger' }),
  });

  const readHere = async () => {
    setReading('finding');
    const r = await currentPosition(geo);
    if (!r.ok) {
      setReading(r.reason);
      return;
    }
    setReading(null);
    setLat(typed(round(r.position.latitude)));
    setLon(typed(round(r.position.longitude)));
  };

  const between = (limit: number) => {
    const from = fmt.num(-limit);
    const to = fmt.num(limit);
    return t`Enter a number from ${from} to ${to}.`;
  };

  const note = !secure
    ? t`Over plain HTTP, phones block the camera, installing Kept, push notifications and location.`
    : reading === 'finding'
      ? t`Finding where you are…`
      : reading === 'denied'
        ? t`Location access is off for Kept in this browser's settings.`
        : reading === 'unavailable'
          ? t`Not available on this device.`
          : reading === 'failed'
            ? t`Couldn't read where you are. Try again, or type it.`
            : !geo
              ? t`Not available on this device.`
              : null;

  return (
    <div className="grid gap-5">
      <Section title={<Trans>Position</Trans>}>
        <div className="grid gap-3 rounded-[10px] border border-line bg-surface p-3.5">
          <p className="m-0 text-small text-ink-2">
            <Trans>
              With Suggest where I am on, Capture picks this location when you're here. Your phone's
              position is compared on the phone and never sent. Only owners and admins see this.
            </Trans>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label={t`Latitude`}
              value={lat}
              onChange={setLat}
              inputMode="decimal"
              isInvalid={latBad}
              errorMessage={latBad ? between(90) : undefined}
            />
            <TextField
              label={t`Longitude`}
              value={lon}
              onChange={setLon}
              inputMode="decimal"
              isInvalid={lonBad}
              errorMessage={lonBad ? between(180) : undefined}
            />
          </div>
          <div className="grid gap-1">
            <Button
              variant="secondary"
              className="w-full md:w-auto md:justify-self-start"
              isDisabled={!secure || !geo}
              isPending={reading === 'finding'}
              onPress={() => void readHere()}
            >
              <Trans>Use where I am now</Trans>
            </Button>
            {note ? (
              <p className="m-0 text-small text-ink-3" role="status">
                {note}
              </p>
            ) : null}
          </div>
          {saved ? (
            <a
              href={mapsLink(saved)}
              target="_blank"
              rel="noopener noreferrer"
              className="justify-self-start text-small font-semibold text-info underline-offset-2 hover:underline"
            >
              <Trans>Open in maps</Trans>
            </a>
          ) : null}
        </div>
      </Section>
      <div className="flex flex-wrap gap-2">
        <Button
          className="w-full md:w-auto"
          isDisabled={!dirty}
          isPending={save.isPending && save.variables !== null}
          onPress={() => save.mutate(wanted)}
        >
          <Trans>Save</Trans>
        </Button>
        {saved ? (
          <Button
            variant="secondary"
            className="w-full md:w-auto"
            isPending={save.isPending && save.variables === null}
            onPress={() => save.mutate(null)}
          >
            <Trans>Remove position</Trans>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
