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
});
