import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { renderUI } from '@/test/render';
import { KeptExtras } from './kept-extras';

vi.mock('./app-lock', () => ({
  useAppLock: () => ({ record: {}, dataKey: {}, db: {} }),
}));

vi.mock('@/offline/extras', () => ({
  extraOf: async () => ({
    extra: {},
    documents: [
      {
        attachmentId: 'fixture-pdf',
        title: 'Offline invoice',
        kind: 'document',
        bytes: 327,
      },
    ],
  }),
}));

it('reads the kept paperwork from the device while network queries are paused', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wasOnline = onlineManager.isOnline();
  onlineManager.setOnline(false);
  try {
    await renderUI(
      <QueryClientProvider client={qc}>
        <KeptExtras thingId="fixture-thing" />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('button', { name: 'Open Offline invoice' })).toBeVisible();
  } finally {
    qc.clear();
    onlineManager.setOnline(wasOnline);
  }
});
