/**
 * The Where picker in a sheet (bulk move, return, an inbox card) with a hidden Personal (#392): a
 * thing already in it may stay there, so Personal is offered; choosing another location doesn't
 * take that choice away (#459).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDS, ownerScenario } from '@/api/mock/fixtures';
import { createMockApi } from '@/api/mock/server';
import { renderUI } from '@/test/render';
import { WherePicker, type WhereValue } from './pickers';

afterEach(() => {
  vi.unstubAllGlobals();
});

function Sheet() {
  const [value, setValue] = useState<WhereValue>({
    locationId: IDS.personal,
    target: { placeId: '' },
  });
  return <WherePicker value={value} onChange={setValue} />;
}

describe('the Where picker with Personal hidden', () => {
  it('keeps Personal for a thing in it, after another location is chosen', async () => {
    const state = ownerScenario();
    state.me.profile = { ...state.me.profile, hidePersonal: true };
    state.me.personalHidden = true;
    state.locations = state.locations.map((l) =>
      l.kind === 'personal' ? { ...l, hidden: true } : l,
    );
    vi.stubGlobal('fetch', createMockApi(state).fetch);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { user } = await renderUI(
      <QueryClientProvider client={qc}>
        <Sheet />
      </QueryClientProvider>,
    );
    const location = await screen.findByRole('combobox', { name: 'Location' });
    await user.clear(location);
    await user.type(location, 'Ho');
    await user.click(await screen.findByRole('option', { name: 'Home' }));
    expect(location).toHaveValue('Home');
    await user.clear(location);
    await user.type(location, 'Pers');
    expect(await screen.findByRole('option', { name: 'Personal' })).toBeInTheDocument();
  });
});
