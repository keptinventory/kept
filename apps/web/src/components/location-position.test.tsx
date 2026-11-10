/**
 * A location's position on its settings page (#375): typed, or read once from the phone (a fake
 * geolocation here: never the device's), saved with If-Match, removed, and opened in maps.
 * Over plain HTTP the phone's reading is off and says why.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocationDetail } from '@/api/types';
import type { Geo } from '@/camera/geo';
import { setLocale } from '@/lib/prefs';
import { expectLogicalOnly, renderUI } from '@/test/render';
import { PositionForm } from './location-position';

const HOME = '01926f00-0000-7000-8000-00000000b002';

const home = (over: Partial<LocationDetail> = {}): LocationDetail => ({
  id: HOME,
  name: 'Home',
  kind: 'home',
  ownerAccountId: '01926f00-0000-7000-8000-00000000a001',
  role: 'admin',
  membershipExpiresAt: null,
  preset: 'household',
  timezone: 'Africa/Cairo',
  currency: 'EGP',
  memberCount: 2,
  thingCount: 0,
  pendingInviteCount: 0,
  require2fa: false,
  modules: [],
  providerResolved: false,
  rowVersion: 4,
  position: null,
  ...over,
});

const fetchSpy = vi.fn(
  async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify(home()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
);

beforeEach(() => {
  fetchSpy.mockClear();
  vi.stubGlobal('fetch', fetchSpy);
});
afterEach(() => {
  vi.unstubAllGlobals();
  setLocale('en');
});

async function renderForm(
  props: { location?: LocationDetail; geo?: Geo | null; secure?: boolean } = {},
  locale: 'en' | 'ar' | 'de' = 'en',
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderUI(
    <QueryClientProvider client={qc}>
      <PositionForm
        location={props.location ?? home()}
        geo={props.geo === undefined ? null : props.geo}
        secure={props.secure ?? true}
      />
    </QueryClientProvider>,
    { locale },
  );
}

/** The PATCHes sent: [url, body, If-Match]. */
const patches = () =>
  fetchSpy.mock.calls
    .filter(([, init]) => init?.method === 'PATCH')
    .map(([url, init]) => [
      url,
      JSON.parse(String(init?.body)),
      new Headers(init?.headers).get('if-match'),
    ]);

describe('a location’s position', () => {
  it('saves a typed latitude and longitude with If-Match', async () => {
    const { user } = await renderForm();
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText('Latitude'), '30.0444');
    await user.type(screen.getByLabelText('Longitude'), '31.2357');
    await user.click(save);
    await waitFor(() =>
      expect(patches()).toEqual([
        [`/api/v1/locations/${HOME}`, { position: { latitude: 30.0444, longitude: 31.2357 } }, '4'],
      ]),
    );
  });

  it('says what is wrong with a number off the globe, waits for both halves, and sends nothing', async () => {
    const { user } = await renderForm();
    await user.type(screen.getByLabelText('Latitude'), '95');
    expect(screen.getByText('Enter a number from -90 to 90.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Longitude'), 'east');
    expect(screen.getByText('Enter a number from -180 to 180.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Latitude'));
    await user.type(screen.getByLabelText('Latitude'), '30');
    await user.clear(screen.getByLabelText('Longitude'));
    // A latitude with no longitude: no error yet, and nothing to save.
    expect(screen.queryByText(/Enter a number/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fills both from one reading on the phone when asked, and only then', async () => {
    const geo: Geo = {
      getCurrentPosition: vi.fn((ok: PositionCallback) =>
        ok({ coords: { latitude: 30.04441234, longitude: 31.23571234 } } as GeolocationPosition),
      ),
    };
    const { user } = await renderForm({ geo });
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Use where I am now' }));
    expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Latitude')).toHaveValue('30.044412');
    expect(screen.getByLabelText('Longitude')).toHaveValue('31.235712');
    // Read, not sent: the person saves it.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('says so when the browser refuses the position', async () => {
    const geo: Geo = {
      getCurrentPosition: vi.fn((_ok: PositionCallback, err?: PositionErrorCallback | null) =>
        err?.({ code: 1 } as GeolocationPositionError),
      ),
    };
    const { user } = await renderForm({ geo });
    await user.click(screen.getByRole('button', { name: 'Use where I am now' }));
    expect(
      screen.getByText("Location access is off for Kept in this browser's settings."),
    ).toBeInTheDocument();
  });

  it('over plain HTTP, turns the phone’s reading off and says why; typing still works', async () => {
    const geo: Geo = { getCurrentPosition: vi.fn() };
    await renderForm({ geo, secure: false });
    expect(screen.getByRole('button', { name: 'Use where I am now' })).toBeDisabled();
    expect(
      screen.getByText(
        'Over plain HTTP, phones block the camera, installing Kept, push notifications and location.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Latitude')).toBeEnabled();
  });

  it('shows a saved position as numbers, opens it in maps, and removes it', async () => {
    const { user } = await renderForm({
      location: home({ position: { latitude: 30.0444, longitude: 31.2357 } }),
    });
    expect(screen.getByLabelText('Latitude')).toHaveValue('30.0444');
    expect(screen.getByLabelText('Longitude')).toHaveValue('31.2357');
    const link = screen.getByRole('link', { name: 'Open in maps' });
    expect(link).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/?mlat=30.0444&mlon=31.2357#map=17/30.0444/31.2357',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await user.click(screen.getByRole('button', { name: 'Remove position' }));
    await waitFor(() =>
      expect(patches()).toEqual([[`/api/v1/locations/${HOME}`, { position: null }, '4']]),
    );
  });

  it('reads and takes Eastern digits in Arabic, right to left', async () => {
    setLocale('ar');
    const { user } = await renderForm(
      { location: home({ position: { latitude: 30.0444, longitude: 31.2357 } }) },
      'ar',
    );
    expect(document.documentElement.dir).toBe('rtl');
    const lat = screen.getByLabelText('خط العرض');
    expect(lat).toHaveValue('٣٠٫٠٤٤٤');
    await user.clear(lat);
    await user.type(lat, '٢٩٫٩');
    await user.click(screen.getByRole('button', { name: 'حفظ' }));
    await waitFor(() =>
      expect(patches()[0]?.[1]).toEqual({ position: { latitude: 29.9, longitude: 31.2357 } }),
    );
    expectLogicalOnly();
  });

  it('reads a decimal comma in German, however many decimals follow (#481)', async () => {
    setLocale('de');
    const { user } = await renderForm({}, 'de');
    await user.type(screen.getByLabelText('Breitengrad'), '52,520008');
    await user.type(screen.getByLabelText('Längengrad'), '13,404954');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(patches()[0]?.[1]).toEqual({
        position: { latitude: 52.520008, longitude: 13.404954 },
      }),
    );
  });

  it('takes a minus, and refuses grouping or a second mark', async () => {
    const { user } = await renderForm();
    await user.type(screen.getByLabelText('Latitude'), '-33.8688');
    await user.type(screen.getByLabelText('Longitude'), '1,51.2');
    expect(screen.getByText('Enter a number from -180 to 180.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Longitude'));
    await user.type(screen.getByLabelText('Longitude'), '151,2093');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(patches()[0]?.[1]).toEqual({ position: { latitude: -33.8688, longitude: 151.2093 } }),
    );
  });
});
