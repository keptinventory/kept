/**
 * Admin → Status's sign-in length tile (#404, D274): the length in force and where it comes from,
 * for every state KEPT_HTTP_SIGN_IN_DAYS and the public URL can leave it in.
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ownerScenario } from '@/api/mock/fixtures';
import type { AdminStatus } from '@/api/types';
import { renderApp } from '@/test/app';

async function tile(signIn: NonNullable<AdminStatus['signIn']>, locale?: 'ar') {
  const state = ownerScenario();
  state.admin.status.signIn = signIn;
  await renderApp('/admin/status', { state, ...(locale ? { locale } : {}) });
  const label = await screen.findByText(locale === 'ar' ? 'مدة تسجيل الدخول' : 'Sign-in length');
  return label.parentElement as HTMLElement;
}

describe('Admin → Status: sign-in length', () => {
  it('over http, unset: 12 hours, not renewed, and the setting named', async () => {
    const t = await tile({ hours: 12, renewed: false, https: false, setting: null });
    expect(within(t).getByText('12 hours')).toBeInTheDocument();
    expect(t).toHaveTextContent(
      'Over plain HTTP, not renewed. KEPT_HTTP_SIGN_IN_DAYS makes it longer.',
    );
  });

  it.each([
    [24, 1, '1 day'],
    [168, 7, '7 days'],
    [720, 30, '30 days'],
  ])('over http, set: %i hours reads as the days set', async (hours, setting, text) => {
    const t = await tile({ hours, renewed: true, https: false, setting });
    expect(within(t).getByText(text)).toBeInTheDocument();
    expect(t).toHaveTextContent(
      'Over plain HTTP, set by KEPT_HTTP_SIGN_IN_DAYS. Renewed as it is used.',
    );
  });

  it('over https, unset: 30 days, and no word of the setting', async () => {
    const t = await tile({ hours: 720, renewed: true, https: true, setting: null });
    expect(within(t).getByText('30 days')).toBeInTheDocument();
    expect(t).toHaveTextContent('Renewed as it is used.');
    expect(t).not.toHaveTextContent('KEPT_HTTP_SIGN_IN_DAYS');
  });

  it('over https, set: 30 days all the same, and it says the setting does nothing', async () => {
    const t = await tile({ hours: 720, renewed: true, https: true, setting: 7 });
    expect(within(t).getByText('30 days')).toBeInTheDocument();
    expect(t).toHaveTextContent('KEPT_HTTP_SIGN_IN_DAYS has no effect over HTTPS.');
  });

  it('in Arabic, the name of the setting stays left to right', async () => {
    const t = await tile({ hours: 12, renewed: false, https: false, setting: null }, 'ar');
    expect(t).toHaveTextContent('عبر HTTP العادي، بلا تجديد.');
    expect(within(t).getByText('KEPT_HTTP_SIGN_IN_DAYS')).toHaveClass('ltr');
  });
});
