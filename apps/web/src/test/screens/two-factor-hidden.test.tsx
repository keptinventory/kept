/**
 * A location of yours that asks for two-factor while this session has none: the location page
 * says why and links to Sign-in and security, and Home, Settings → Locations and the sidebar list
 * it with a lock. Anything else is still the plain "not here".
 */
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ownerScenario } from '@/api/mock/fixtures';
import { expectLogicalOnly } from '@/test/render';
import { findHeading, renderApp } from '../app';

const WORKSHOP = '01a16190-0168-72e3-873b-c1822c35ca41';
const NOBODYS = '01a16190-0168-72e3-873b-c1822c35ca99';

function hiddenScenario() {
  const state = ownerScenario();
  state.me.mfa = false;
  state.me.twoFactorHidden = [{ locationId: WORKSHOP, name: 'Workshop', kind: 'home' }];
  return state;
}

describe('a location hidden until this session has a second factor', () => {
  it('its page says why and what to do, with the way to Sign-in and security', async () => {
    await renderApp(`/loc/${WORKSHOP}`, { state: hiddenScenario() });
    expect(await findHeading('Workshop')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Workshop asks for two-factor');
    expect(
      screen.getByText(
        'Turn on an authenticator app to open it, or add a passkey and sign in with it.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set up two-factor' })).toHaveAttribute(
      'href',
      '/settings#sign-in-security',
    );
    expect(screen.queryByText("This isn't here any more, or you can't see it.")).toBeNull();
  });

  it('a location that is not yours is still the plain "not here"', async () => {
    await renderApp(`/loc/${NOBODYS}`, { state: hiddenScenario() });
    expect(
      await screen.findByText("This isn't here any more, or you can't see it."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/asks for two-factor/)).toBeNull();
  });

  it('Home, Settings → Locations and the sidebar list it with a lock, linking to its page', async () => {
    await renderApp('/', { state: hiddenScenario() });
    // Home's card and the sidebar's entry.
    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: 'Workshop, asks for two-factor' })).toHaveLength(
        2,
      ),
    );
    const links = screen.getAllByRole('link', { name: 'Workshop, asks for two-factor' });
    for (const link of links) expect(link).toHaveAttribute('href', `/loc/${WORKSHOP}`);
    expect(screen.getByText('Asks for two-factor: set it up to open it')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Locations' });
    expect(within(nav).getByRole('link', { name: 'Workshop, asks for two-factor' })).toBeVisible();
  });

  it('Settings → Locations lists it too', async () => {
    await renderApp('/settings/locations', { state: hiddenScenario() });
    const row = await screen.findByRole('link', { name: 'Workshop, asks for two-factor' });
    expect(row).toHaveAttribute('href', `/loc/${WORKSHOP}`);
  });

  it('with a second factor in the session nothing is listed as hidden', async () => {
    await renderApp('/', { state: ownerScenario() });
    await screen.findAllByRole('heading', { name: 'Locations' });
    expect(screen.queryByRole('link', { name: /asks for two-factor/ })).toBeNull();
  });

  it('reads right to left in Arabic', async () => {
    await renderApp(`/loc/${WORKSHOP}`, { state: hiddenScenario(), locale: 'ar' });
    const link = await screen.findByRole('link', { name: 'أعدّ التحقق بخطوتين' });
    expect(document.documentElement.dir).toBe('rtl');
    expectLogicalOnly(link.closest('main') as HTMLElement);
  });
});
