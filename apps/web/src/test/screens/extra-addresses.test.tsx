/**
 * Kept on one of KEPT_EXTRA_ADDRESSES (#405, D275): `GET /setup` names the main address. Sign-in
 * offers a password or an email link and says why not a passkey; the links people copy stay on the
 * main address; what can only happen there says so. With no main address named, nothing changes.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ownerScenario, signedOutScenario } from '@/api/mock/fixtures';
import type { MockApi } from '@/api/mock/server';
import { paths } from '@/api/paths';
import type { AdminStatus } from '@/api/types';
import { mainAddressElsewhere, noteMainAddress, publicOrigin } from '@/lib/base-path';
import { findHeading, renderApp } from '@/test/app';

const MAIN = 'http://kept.lan:8080';
const HERE = () => location.origin;

function stubPasskeysSupported() {
  Object.defineProperty(window, 'PublicKeyCredential', {
    configurable: true,
    value: function PublicKeyCredential() {},
  });
}

afterEach(() => {
  noteMainAddress(undefined);
  Reflect.deleteProperty(window, 'PublicKeyCredential');
});

describe('lib/base-path: the main address', () => {
  it('with none named, the page’s own origin, as ever', () => {
    noteMainAddress(undefined);
    expect(mainAddressElsewhere()).toBeNull();
    expect(publicOrigin()).toBe(HERE());
  });

  it('on another address, links go to the main one', () => {
    noteMainAddress(MAIN);
    expect(mainAddressElsewhere()).toBe(MAIN);
    expect(publicOrigin()).toBe(MAIN);
  });

  it('on the main address itself, nothing is elsewhere', () => {
    noteMainAddress(HERE());
    expect(mainAddressElsewhere()).toBeNull();
    expect(publicOrigin()).toBe(HERE());
  });

  it('ignores anything that isn’t a bare origin', () => {
    for (const bad of ['http://kept.lan/app', 'javascript:alert(1)', 'not a url', 7, null]) {
      noteMainAddress(bad);
      expect(mainAddressElsewhere(), String(bad)).toBeNull();
    }
  });

  it('is remembered for a cold start offline, and forgotten when the server stops naming it', () => {
    noteMainAddress(MAIN);
    expect(localStorage.getItem('kept.main-address')).toBe(MAIN);
    noteMainAddress(undefined);
    expect(localStorage.getItem('kept.main-address')).toBeNull();
  });
});

/** `GET /setup` as a server with KEPT_EXTRA_ADDRESSES answers it. */
const naming = (mainAddress: string) => (mock: MockApi) =>
  mock.on('GET', paths.setup, () => ({ needed: false, mainAddress }));

async function signInPage(mainAddress?: string) {
  await renderApp('/signin', {
    state: signedOutScenario(),
    ...(mainAddress ? { setup: naming(mainAddress) } : {}),
  });
  await findHeading('Sign in to Kept');
}

describe('sign-in', () => {
  it('on an extra address: no passkey, and it says why', async () => {
    stubPasskeysSupported();
    await signInPage(MAIN);
    expect(screen.queryByRole('button', { name: 'Sign in with a passkey' })).toBeNull();
    expect(screen.getByText(/Passkeys work only at/, { selector: 'p' })).toHaveTextContent(
      `Passkeys work only at ${MAIN}, because browsers tie a passkey to one address. Here, use your password or an email link.`,
    );
    const link = screen.getByRole('link', { name: MAIN });
    expect(link.getAttribute('href')?.startsWith(`${MAIN}/`)).toBe(true);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Email me a sign-in link' })).toBeInTheDocument();
  });

  it('on the main address, or with none named: as ever', async () => {
    stubPasskeysSupported();
    await signInPage(HERE());
    expect(screen.getByRole('button', { name: 'Sign in with a passkey' })).toBeInTheDocument();
    expect(screen.queryByText(/Passkeys work only at/)).toBeNull();
  });

  it('with none named: as ever', async () => {
    stubPasskeysSupported();
    await signInPage();
    expect(screen.getByRole('button', { name: 'Sign in with a passkey' })).toBeInTheDocument();
    expect(screen.queryByText(/Passkeys work only at/)).toBeNull();
  });

  it('an email link says where it lands', async () => {
    const user = userEvent.setup();
    await signInPage(MAIN);
    await user.type(screen.getByLabelText('Email or username'), 'louis@example.com');
    await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    await findHeading('Check your email');
    expect(screen.getByText(/signs you in there/)).toHaveTextContent(
      `The link opens at ${MAIN} and signs you in there, not on this address. Can't reach it from here? Use your password.`,
    );
  });

  it('a password reset says where to set it and to come back', async () => {
    const user = userEvent.setup();
    await signInPage(MAIN);
    await user.type(screen.getByLabelText('Email or username'), 'louis@example.com');
    await user.click(screen.getByRole('button', { name: 'Forgot your password?' }));
    await findHeading('Check your email');
    expect(screen.getByText(/Set the new password there/)).toHaveTextContent(
      `The link opens at ${MAIN}. Set the new password there, then sign in here with it.`,
    );
  });

  it('on the main address, the mail screens say nothing of the sort', async () => {
    const user = userEvent.setup();
    await signInPage(HERE());
    await user.type(screen.getByLabelText('Email or username'), 'louis@example.com');
    await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    await findHeading('Check your email');
    expect(screen.queryByText(/signs you in there/)).toBeNull();
  });
});

describe('in Arabic', () => {
  it('sign-in says why, with the address left to right', async () => {
    await renderApp('/signin', {
      state: signedOutScenario(),
      setup: naming(MAIN),
      locale: 'ar',
    });
    const link = await screen.findByRole('link', { name: MAIN });
    expect(link).toHaveClass('ltr');
    expect(link.closest('p')).toHaveTextContent('مفاتيح المرور تعمل فقط على');
  });

  it('Status’s tile is translated, and its addresses stay left to right', async () => {
    const state = ownerScenario();
    state.admin.status.addresses = { main: MAIN, extra: ['http://100.64.0.7'] };
    await renderApp('/admin/status', { state, locale: 'ar' });
    const label = await screen.findByText('العناوين');
    const t = label.parentElement as HTMLElement;
    expect(t).toHaveTextContent('العنوان الرئيسي، وعليه تبقى الروابط والبريد ومفاتيح المرور.');
    expect(within(t).getByText('KEPT_EXTRA_ADDRESSES')).toHaveClass('ltr');
    expect(within(t).getByText(MAIN)).toHaveClass('ltr');
  });
});

describe('Settings → Sign-in and security', () => {
  it('on an extra address: no adding a passkey, and where to', async () => {
    stubPasskeysSupported();
    await renderApp('/settings', { state: ownerScenario(), setup: naming(MAIN) });
    await screen.findByRole('heading', { name: 'Passkeys' });
    expect(screen.queryByRole('button', { name: 'Add a passkey' })).toBeNull();
    expect(screen.getByText(/Add one there/)).toHaveTextContent(
      `Passkeys work only at ${MAIN}, because browsers tie a passkey to one address. Add one there.`,
    );
  });

  it('on the main address, adding one is there', async () => {
    stubPasskeysSupported();
    await renderApp('/settings', { state: ownerScenario(), setup: naming(HERE()) });
    expect(await screen.findByRole('button', { name: 'Add a passkey' })).toBeInTheDocument();
    expect(screen.queryByText(/Add one there/)).toBeNull();
  });
});

describe('Admin → Status: addresses', () => {
  async function tile(addresses: NonNullable<AdminStatus['addresses']>) {
    const state = ownerScenario();
    state.admin.status.addresses = addresses;
    await renderApp('/admin/status', { state });
    const label = await screen.findByText('Addresses');
    return label.parentElement as HTMLElement;
  }

  it('one address: the main one, and the setting named', async () => {
    const t = await tile({ main: MAIN, extra: [] });
    expect(within(t).getByText(MAIN)).toBeInTheDocument();
    expect(t).toHaveTextContent('The main address. KEPT_EXTRA_ADDRESSES adds more.');
  });

  it('several: every one in force, and which is which', async () => {
    const t = await tile({ main: MAIN, extra: ['http://kept-ts.lan:8080', 'http://100.64.0.7'] });
    expect(within(t).getByText(MAIN)).toBeInTheDocument();
    expect(t).toHaveTextContent(
      'The main address, where links, mail and passkeys stay. Also, set by KEPT_EXTRA_ADDRESSES:',
    );
    expect(within(t).getByText('http://kept-ts.lan:8080')).toBeInTheDocument();
    expect(within(t).getByText('http://100.64.0.7')).toBeInTheDocument();
  });
});
