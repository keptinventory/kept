import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { captureApi } from '@/api/capture/queries';
import { ApiError } from '@/api/client';
import { currentOffline, type Offline } from '@/offline/open';
import { OfflineContext } from '@/offline/provider';
import { useAddress } from './address';

vi.mock('@/offline/open', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/offline/open')>()),
  currentOffline: vi.fn(),
}));

it('resolves a cold offline short address when the device inventory finishes opening', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const id = '01926f00-0000-7000-8000-00000020001a';
  const code = 'K7Q3FM';
  const device = {
    store: { byCode: vi.fn(async () => ({ kind: 'thing', id })) },
  } as unknown as Offline;
  vi.mocked(currentOffline).mockResolvedValue(null);
  const resolveScan = vi
    .spyOn(captureApi, 'resolveScan')
    .mockRejectedValue(new ApiError(0, 'offline', 'Needs a connection'));

  function Address() {
    const address = useAddress('thing', code);
    return <output>{address.status === 'ready' ? address.id : address.status}</output>;
  }
  function page(offline: Offline | null) {
    return (
      <QueryClientProvider client={qc}>
        <OfflineContext.Provider value={offline}>
          <Address />
        </OfflineContext.Provider>
      </QueryClientProvider>
    );
  }

  try {
    const { rerender } = render(page(null));
    await screen.findByText('error');
    vi.mocked(currentOffline).mockResolvedValue(device);
    rerender(page(device));
    expect(await screen.findByText(id)).toBeVisible();
    expect(resolveScan).toHaveBeenCalledOnce();
  } finally {
    resolveScan.mockRestore();
    qc.clear();
  }
});
