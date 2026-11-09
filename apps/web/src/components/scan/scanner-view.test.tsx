/**
 * The live scanner when the decoder gives up (#486): it lets go of the camera, says the scanner
 * didn't start rather than blaming the browser, and "Try again" opens the camera and the
 * decode loop afresh. The camera is a fake stream and the loop is replaced: the test decides when
 * the decoder gives up. No real camera is opened.
 */
import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CameraEnv } from '@/camera/session';
import { renderUI } from '@/test/render';
import { ScannerView } from './scanner-view';

const loop = vi.hoisted(() => ({
  starts: 0,
  unavailable: null as (() => void) | null,
}));
vi.mock('@/camera/scanner', () => ({
  buzz: () => {},
  startScanLoop: (
    _video: unknown,
    _detect: unknown,
    _onRead: unknown,
    opts: { onUnavailable?: () => void },
  ) => {
    loop.starts += 1;
    loop.unavailable = opts.onUnavailable ?? null;
    return () => {};
  },
}));

function fakeCamera() {
  const stops: ReturnType<typeof vi.fn>[] = [];
  const getUserMedia = vi.fn(async () => {
    const stop = vi.fn();
    stops.push(stop);
    return { getTracks: () => [{ stop }] } as unknown as MediaStream;
  });
  const camera: CameraEnv = { secure: true, media: { getUserMedia } };
  return { camera, getUserMedia, stops };
}

beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn(async () => {});
  loop.starts = 0;
  loop.unavailable = null;
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('when the decoder gives up', () => {
  it('lets go of the camera, and Try again opens it and the decoder afresh', async () => {
    const { camera, getUserMedia, stops } = fakeCamera();
    const onProblem = vi.fn();
    const onRetry = vi.fn();
    const { user } = await renderUI(
      <ScannerView
        detect={async () => []}
        paused={false}
        onRead={vi.fn()}
        onProblem={onProblem}
        onRetry={onRetry}
        camera={camera}
      />,
    );
    await waitFor(() => expect(loop.starts).toBe(1));
    act(() => loop.unavailable?.());

    expect(await screen.findByText("Kept can't scan here")).toBeInTheDocument();
    expect(screen.getByText("The scanner didn't start.")).toBeInTheDocument();
    expect(screen.queryByText(/This browser can't read codes/)).not.toBeInTheDocument();
    expect(onProblem).toHaveBeenCalledWith('no_scanner');
    // The camera isn't held while nothing can be read.
    expect(stops[0]).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(loop.starts).toBe(2));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Kept can't scan here")).not.toBeInTheDocument();
    expect(screen.getByLabelText('Camera view')).toBeInTheDocument();
  });

  it('offers Try again for a busy camera, but not for one that is turned off', async () => {
    const busy = vi.fn(async () => {
      throw new DOMException('Could not start video source', 'NotReadableError');
    });
    const first = await renderUI(
      <ScannerView
        detect={async () => []}
        paused={false}
        onRead={vi.fn()}
        camera={{ secure: true, media: { getUserMedia: busy } }}
      />,
    );
    expect(await screen.findByText(/Another app is using the camera/)).toBeInTheDocument();
    await first.user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(busy).toHaveBeenCalledTimes(2));
    first.unmount();

    const denied = vi.fn(async () => {
      throw new DOMException('Permission denied', 'NotAllowedError');
    });
    await renderUI(
      <ScannerView
        detect={async () => []}
        paused={false}
        onRead={vi.fn()}
        camera={{ secure: true, media: { getUserMedia: denied } }}
      />,
    );
    expect(await screen.findByText('Camera access is off for Kept.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});
