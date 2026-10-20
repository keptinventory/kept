import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectLogicalOnly, renderUI } from '@/test/render';
import { RoomTray } from './room-tray';

const shots = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, thumb: null }));

describe('the room tray', () => {
  it('asks for photos, then counts them and what reading them may cost', async () => {
    const onSend = vi.fn();
    const first = await renderUI(
      <RoomTray
        shots={[]}
        onRemove={vi.fn()}
        onSend={onSend}
        sending={false}
        block={null}
        provider="groq"
      />,
    );
    expect(screen.getByText('Take up to 5 photos of the room.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    first.unmount();
    await renderUI(
      <RoomTray
        shots={shots(3)}
        onRemove={vi.fn()}
        onSend={onSend}
        sending={false}
        block={null}
        provider="groq"
      />,
    );
    expect(screen.getByText(/^About 3 photos · up to ~[\d,]+ tokens · Groq$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send 3 photos' })).toBeEnabled();
  });

  it('says why it is off, and offers the sample photo in Try Kept', async () => {
    const onSample = vi.fn();
    const { user } = await renderUI(
      <RoomTray
        shots={shots(1)}
        onRemove={vi.fn()}
        onSend={vi.fn()}
        sending={false}
        block={{ kind: 'paused', until: null }}
        provider={null}
        onSample={onSample}
      />,
      { locale: 'ar' },
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button').at(-2) as HTMLElement);
    expect(onSample).toHaveBeenCalled();
    expectLogicalOnly(document.body);
  });

  it('says plainly that no AI runs in Try Kept, instead of a cost', async () => {
    const tray = (n: number) => (
      <RoomTray
        shots={shots(n)}
        onRemove={vi.fn()}
        onSend={vi.fn()}
        sending={false}
        block={null}
        provider={null}
        onSample={vi.fn()}
      />
    );
    const one = await renderUI(tray(1));
    expect(screen.getByText('1 photo · No AI runs in this demo')).toBeInTheDocument();
    expect(screen.queryByText(/About 1 photo/)).toBeNull();
    one.unmount();
    await renderUI(tray(2), { locale: 'ar' });
    expect(
      screen.getByText(/^صورتان.+لا يعمل الذكاء الاصطناعي في هذا العرض التجريبي$/),
    ).toBeInTheDocument();
  });

  it('counts the photos only while the cost is unknown (offline)', async () => {
    await renderUI(
      <RoomTray
        shots={shots(2)}
        onRemove={vi.fn()}
        onSend={vi.fn()}
        sending={false}
        block={null}
        provider={null}
      />,
    );
    expect(screen.getByText('About 2 photos')).toBeInTheDocument();
  });
});
