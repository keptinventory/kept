/**
 * A language chosen in the app reaches the account, which mail goes by, and neither a failed save
 * nor a catalogue that can't load leaves the person stuck.
 */
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signedOutScenario } from '@/api/mock/fixtures';
import { MockReply } from '@/api/mock/server';
import { paths } from '@/api/paths';
import { findHeading, renderApp } from '@/test/app';

vi.setConfig({ testTimeout: 20_000 });

const catalogues = vi.hoisted(() => ({ missing: null as string | null }));
vi.mock('@/i18n/i18n', async (original) => {
  const real = await original<typeof import('@/i18n/i18n')>();
  return {
    ...real,
    activateLocale: (locale: Parameters<typeof real.activateLocale>[0], digits?: 'western') =>
      locale === catalogues.missing
        ? Promise.reject(new TypeError('Failed to fetch dynamically imported module'))
        : real.activateLocale(locale, digits),
  };
});

beforeEach(() => {
  catalogues.missing = null;
});

const pick = async (user: Awaited<ReturnType<typeof renderApp>>['user'], name: string) => {
  await user.click(screen.getByRole('combobox', { name: 'Language' }));
  await user.click(await screen.findByRole('option', { name }));
};

describe('Settings → Me → Display: the language', () => {
  it('is kept on the account as well as on this device', async () => {
    const { user, mock } = await renderApp('/settings');
    await findHeading('Settings');
    await pick(user, 'Español');
    await findHeading('Configuración');
    expect(localStorage.getItem('kept.locale')).toBe('es');
    await waitFor(() => expect(mock.state.me.profile.locale).toBe('es'));
    expect(
      mock.calls.filter((c) => c.method === 'PATCH' && c.path === paths.me).map((c) => c.body),
    ).toEqual([{ locale: 'es' }]);
  });

  it('still changes when the server refuses it', async () => {
    const { user, mock } = await renderApp('/settings', {
      setup: (m) =>
        m.on('PATCH', paths.me, () => {
          throw new MockReply(500, { error: 'No', code: 'internal' });
        }),
    });
    await findHeading('Settings');
    await pick(user, 'Español');
    await findHeading('Configuración');
    await waitFor(() => expect(mock.calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(localStorage.getItem('kept.locale')).toBe('es');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('still changes offline, when the save never leaves', async () => {
    const { user, mock } = await renderApp('/settings');
    await findHeading('Settings');
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'PATCH'
        ? Promise.reject(new TypeError('Failed to fetch'))
        : mock.fetch(input, init),
    );
    await pick(user, 'Español');
    await findHeading('Configuración');
    expect(localStorage.getItem('kept.locale')).toBe('es');
    expect(mock.state.me.profile.locale).toBe('en');
  });

  it("stays as it was when the language can't load, and says so", async () => {
    catalogues.missing = 'es';
    const { user, mock } = await renderApp('/settings');
    await findHeading('Settings');
    await pick(user, 'Español');
    expect(await screen.findByText('Needs a connection')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('English');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(localStorage.getItem('kept.locale')).toBeNull();
    expect(mock.calls.some((c) => c.method === 'PATCH')).toBe(false);
  });
});

describe('the sign-in pages', () => {
  it('send nothing: there is no session to keep it on', async () => {
    const { user, mock } = await renderApp('/signin', { state: signedOutScenario() });
    await findHeading('Sign in to Kept');
    await pick(user, 'Deutsch');
    await waitFor(() => expect(document.documentElement.lang).toBe('de'));
    expect(mock.calls.some((c) => c.method === 'PATCH')).toBe(false);
  });
});

describe('a language picked on this device before it reached the account (#474)', () => {
  const patches = (mock: Awaited<ReturnType<typeof renderApp>>['mock']) =>
    mock.calls.filter((c) => c.method === 'PATCH' && c.path === paths.me).map((c) => c.body);

  it('goes to the account once, quietly, when signed in', async () => {
    localStorage.setItem('kept.locale', 'de');
    const { mock } = await renderApp('/', { locale: 'de' });
    await waitFor(() => expect(mock.state.me.profile.locale).toBe('de'));
    expect(patches(mock)).toEqual([{ locale: 'de' }]);
    expect(localStorage.getItem('kept.localeSent')).toBe('de');
  });

  it('is not sent again, so another device’s later choice stays the account’s', async () => {
    localStorage.setItem('kept.locale', 'de');
    localStorage.setItem('kept.localeSent', 'de');
    const { mock } = await renderApp('/', { locale: 'de' });
    await findHeading(/./);
    expect(patches(mock)).toEqual([]);
  });

  it('is not a default: a device that follows its browser sends nothing', async () => {
    const { mock } = await renderApp('/', { locale: 'de' });
    await findHeading(/./);
    expect(patches(mock)).toEqual([]);
    expect(mock.state.me.profile.locale).toBe('en');
  });

  it('never gets in the way when the account refuses it, and tries again next time', async () => {
    localStorage.setItem('kept.locale', 'fr');
    const { mock } = await renderApp('/', {
      locale: 'fr',
      setup: (m) =>
        m.on('PATCH', paths.me, () => {
          throw new MockReply(500, { error: 'No', code: 'internal' });
        }),
    });
    await findHeading(/./);
    await waitFor(() => expect(patches(mock)).toEqual([{ locale: 'fr' }]));
    expect(localStorage.getItem('kept.localeSent')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
