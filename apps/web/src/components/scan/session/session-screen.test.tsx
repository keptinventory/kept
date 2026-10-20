/**
 * The scan session screen: choose what to do and where, read many labels (several in one frame),
 * count each once, undo the last, pause, finish, choose what the summary does, and save it as
 * queued ops. A viewer checks without saving. A session survives a remount. A USB scanner's keys
 * are reads too. No read for a minute pauses it.
 *
 * The camera is a fake stream and the decode loop is replaced: the test feeds what "the scanner
 * read". The phone's store is the real `MemoryStore`; the server's batch resolve is a stub.
 */
import type { Role, SnapLocation, SnapPlace, SnapshotPage, SnapThing } from '@kept/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Detected } from '@/camera/label-recogniser';
import type { CameraEnv } from '@/camera/session';
import { MemoryStore } from '@/offline/store';
import { renderUI } from '@/test/render';
import { memoryPersist, type SessionPersist } from './persist';
import { SessionScreen, type SessionScreenProps } from './session-screen';

const feed = vi.hoisted(() => ({ current: null as ((found: Detected[]) => void) | null }));
vi.mock('@/camera/scanner', async (actual) => ({
  ...(await actual<typeof import('@/camera/scanner')>()),
  appDetect: () => async () => [],
  startScanLoop: (_video: unknown, _detect: unknown, onRead: (found: Detected[]) => void) => {
    feed.current = onRead;
    return () => {
      if (feed.current === onRead) feed.current = null;
    };
  },
}));

const HOME = '01926f00-0000-7000-8000-00000000e001';
const UNPLACED = '01926f00-0000-7000-8000-00000000e0ff';
const STUDY = '01926f00-0000-7000-8000-00000000e011';
const KITCHEN = '01926f00-0000-7000-8000-00000000e012';
const WEBCAM = '01926f00-0000-7000-8000-00000000e021';
const LAMP = '01926f00-0000-7000-8000-00000000e022';
const MOUSE = '01926f00-0000-7000-8000-00000000e023';
const KETTLE = '01926f00-0000-7000-8000-00000000e024';
const BOX = '01926f00-0000-7000-8000-00000000e025';
const BOX15 = '01926f00-0000-7000-8000-00000000e026';

const place = (id: string, name: string, isUnplaced = false): SnapPlace => ({
  id,
  locationId: HOME,
  parentId: null,
  name,
  kindKey: isUnplaced ? 'unplaced' : 'room',
  icon: null,
  isUnplaced,
  sort: 1,
  deleted: false,
});
const thing = (id: string, name: string, over: Partial<SnapThing> = {}): SnapThing => ({
  id,
  locationId: HOME,
  shortCode: null,
  name,
  typeId: null,
  placeId: STUDY,
  containerId: null,
  quantity: '1',
  aliases: {},
  lifecycle: 'in_use',
  reviewState: 'confirmed',
  locationUncertain: false,
  lastSeenAt: null,
  coverFileId: null,
  isContainer: false,
  deleted: false,
  ...over,
});
const code = (c: string, thingId: string) => ({
  code: c,
  locationId: HOME,
  thingId,
  placeId: null,
  state: 'assigned' as const,
  isPrimary: true,
});

async function phone(role: Role = 'member') {
  const store = new MemoryStore();
  const location: SnapLocation = {
    id: HOME,
    name: 'Home',
    kind: 'house',
    timezone: 'Africa/Cairo',
    languages: ['en'],
    role,
    effectiveModules: ['labels'],
    unplacedPlaceId: UNPLACED,
    suggestRadiusM: 150,
  };
  const page: SnapshotPage = {
    asOf: '2026-10-20T10:00:00.000Z',
    payloadVersion: 1,
    minPayloadVersion: 1,
    locations: [location],
    types: { hash: 'h', items: [] },
    changes: {
      places: [place(UNPLACED, '', true), place(STUDY, 'Study'), place(KITCHEN, 'Kitchen')],
      things: [
        thing(WEBCAM, 'HD webcam', { shortCode: 'WEBC4M' }),
        thing(LAMP, 'Desk lamp', { shortCode: 'DESK42' }),
        thing(MOUSE, 'Mouse', { shortCode: 'M0SE77' }),
        thing(KETTLE, 'Kettle', { shortCode: 'KETT1E', placeId: KITCHEN }),
        thing(BOX, 'Box 14', { shortCode: 'B0X14Q', placeId: KITCHEN, isContainer: true }),
        thing(BOX15, 'Box 15', { shortCode: 'B0X15Z', placeId: KITCHEN, isContainer: true }),
      ],
      codes: [
        code('WEBC4M', WEBCAM),
        code('DESK42', LAMP),
        code('M0SE77', MOUSE),
        code('KETT1E', KETTLE),
        code('B0X14Q', BOX),
        code('B0X15Z', BOX15),
      ],
      legacyCodes: [],
    },
    removed: [],
    revokedLocationIds: [],
    nextCursor: 'c1',
    complete: true,
  };
  await store.applySnapshot(page);
  return store;
}

const liveCamera: CameraEnv = {
  secure: true,
  media: { getUserMedia: vi.fn(async () => ({ getTracks: () => [] }) as unknown as MediaStream) },
};
const qr = (c: string): Detected => ({
  rawValue: `https://kept.example/l/${c}`,
  format: 'qr_code',
});

beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn(async () => {});
});
afterEach(() => {
  feed.current = null;
  vi.useRealTimers();
});

async function render(props: Partial<SessionScreenProps> & { store: MemoryStore }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const all: SessionScreenProps = {
    persist: memoryPersist(),
    online: false,
    camera: liveCamera,
    detect: async () => [],
    onExit: vi.fn(),
    onQueued: vi.fn(),
    ...props,
  };
  const r = await renderUI(
    <QueryClientProvider client={qc}>
      <SessionScreen {...all} />
    </QueryClientProvider>,
  );
  return { ...r, props: all, store: props.store };
}

/** The big counter says `text`. */
const counterIs = (text: string) =>
  waitFor(() => expect(screen.getByTestId('session-counter')).toHaveTextContent(text));

async function read(...found: Detected[]) {
  await waitFor(() => expect(feed.current).not.toBeNull());
  await act(async () => {
    feed.current?.(found);
  });
}

async function startCounting(
  store: MemoryStore,
  extra: Partial<Omit<SessionScreenProps, 'store'>> = {},
) {
  const r = await render({
    store,
    start: { mode: 'count', target: { kind: 'place', id: STUDY } },
    ...extra,
  });
  await screen.findByRole('heading', { name: 'Start a session' });
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  await counterIs('0 of 3');
  return r;
}

describe('a count', () => {
  it('reads several labels in one frame, counts each once, undoes the last', async () => {
    const store = await phone();
    await startCounting(store);
    await read(qr('WEBC4M'), qr('DESK42'));
    await counterIs('2 of 3');
    const last = screen.getByRole('list', { name: 'Last reads' });
    expect(within(last).getByText('HD webcam')).toBeInTheDocument();
    expect(within(last).getByText('Desk lamp')).toBeInTheDocument();

    await read(qr('DESK42'));
    await counterIs('2 of 3');

    fireEvent.click(screen.getByRole('button', { name: 'Undo last read' }));
    await counterIs('1 of 3');
  });

  it('shows a thing found elsewhere in amber, with where it is', async () => {
    const store = await phone();
    await startCounting(store);
    await read(qr('KETT1E'));
    const last = screen.getByRole('list', { name: 'Last reads' });
    expect(await within(last).findByText('Kettle')).toBeInTheDocument();
    expect(within(last).getByRole('listitem')).toHaveTextContent(/in Kitchen/);
    await counterIs('0 of 3');
  });

  it('pauses, and resumes', async () => {
    const store = await phone();
    await startCounting(store);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(feed.current).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(feed.current).not.toBeNull());
  });

  it('finishes into a summary that leaves the missing alone, and saves it as queued ops', async () => {
    const store = await phone();
    const { props } = await startCounting(store);
    await read(qr('WEBC4M'), qr('KETT1E'));
    await counterIs('1 of 3');
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    const found = await screen.findByRole('region', { name: 'Found (1)' });
    expect(within(found).getByText('HD webcam')).toBeInTheDocument();
    const missing = screen.getByRole('region', { name: 'Missing (2)' });
    expect(within(missing).getAllByRole('radio', { name: 'Leave', checked: true })).toHaveLength(2);
    // One deliberate choice: the mouse isn't here.
    const mouse = within(missing).getByRole('radiogroup', { name: 'Mouse' });
    fireEvent.click(within(mouse).getByRole('radio', { name: 'Mark not here' }));
    const elsewhere = screen.getByRole('region', { name: 'Found elsewhere (1)' });
    expect(within(elsewhere).getByText('Kettle')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/It will save when you're online/)).toBeInTheDocument();
    const ops = await store.pending();
    expect(ops.map((o) => o.op)).toEqual(['scan_session_lines', 'scan_session_finish']);
    const first = ops[0]?.payload as { lines: { thingId: string; action: string }[] } | undefined;
    const lines = first?.lines ?? [];
    expect(lines.map((l) => [l.thingId, l.action])).toEqual([
      [WEBCAM, 'seen'],
      [MOUSE, 'not_here'],
    ]);
    expect(props.onQueued).toHaveBeenCalled();
  });

  it('lets a viewer check: the same counter, a banner, and nothing saved', async () => {
    const store = await phone('viewer');
    await startCounting(store);
    expect(screen.getByText("You're a viewer: nothing is saved")).toBeInTheDocument();
    await read(qr('WEBC4M'));
    await counterIs('1 of 3');
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await screen.findByRole('region', { name: 'Found (1)' });
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await store.pending()).toEqual([]);
  });

  it('picks the session up again after the screen is closed and opened', async () => {
    const store = await phone();
    const persist: SessionPersist = memoryPersist();
    const first = await startCounting(store, { persist });
    await read(qr('WEBC4M'));
    await counterIs('1 of 3');
    first.unmount();
    feed.current = null;
    await render({ store, persist });
    fireEvent.click(await screen.findByRole('button', { name: 'Resume session' }));
    await counterIs('1 of 3');
  });

  it('checks a code read offline once online', async () => {
    const store = await phone();
    const persist = memoryPersist();
    const batch = vi.fn(async (body: { items: { text: string }[] }) => ({
      results: body.items.map(() => ({
        outcome: 'open' as const,
        target: { kind: 'thing' as const, id: MOUSE, locationId: HOME },
      })),
    }));
    const first = await startCounting(store, { persist, online: false, batch });
    await read(qr('ZZ9ZZ9'));
    await counterIs('0 of 3');
    expect(batch).not.toHaveBeenCalled();
    first.unmount();
    feed.current = null;
    await render({ store, persist, online: true, batch });
    fireEvent.click(await screen.findByRole('button', { name: 'Resume session' }));
    await counterIs('1 of 3');
    expect(batch).toHaveBeenCalledTimes(1);
  });

  it('takes a USB scanner’s keys as a read', async () => {
    const store = await phone();
    await startCounting(store);
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => (clock += 5));
    for (const key of [...'DESK42', 'Enter']) fireEvent.keyDown(document.body, { key });
    await counterIs('1 of 3');
  });

  it('pauses after a minute with no reads', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const store = await phone();
    await startCounting(store);
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument();
  });
});

describe('pack into', () => {
  it('packs into a box, then into the next box scanned after Target', async () => {
    const store = await phone();
    await render({
      store,
      start: { mode: 'pack', target: { kind: 'container', id: BOX } },
    });
    const startButton = await screen.findByRole('button', { name: 'Start' });
    await waitFor(() => expect(startButton).toBeEnabled());
    fireEvent.click(startButton);
    await screen.findByText('Going into Box 14');
    await read(qr('WEBC4M'));
    await counterIs('1 thing');
    fireEvent.click(screen.getByRole('button', { name: 'Target' }));
    await read(qr('B0X15Z'));
    expect(await screen.findByText('Going into Box 15')).toBeInTheDocument();
    await read(qr('M0SE77'));
    await counterIs('2 things');
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByRole('region', { name: 'Box 14 (1)' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Box 15 (1)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(/It will save when you're online/);
    const [op] = await store.pending();
    const payload = op?.payload as { lines: { thingId: string; to: unknown }[] } | undefined;
    expect((payload?.lines ?? []).map((l) => [l.thingId, l.to])).toEqual([
      [WEBCAM, { containerId: BOX }],
      [MOUSE, { containerId: BOX15 }],
    ]);
  });

  it('starts from a move without a box: the first box scanned is the target', async () => {
    const store = await phone();
    await render({ store, start: { mode: 'pack' } });
    fireEvent.click(await screen.findByRole('button', { name: "Scan the box's label" }));
    await read(qr('WEBC4M'));
    expect(await screen.findByText("Scan a box's label")).toBeInTheDocument();
    await read(qr('B0X15Z'));
    const startButton = await screen.findByRole('button', { name: 'Start' });
    await waitFor(() => expect(startButton).toBeEnabled());
    fireEvent.click(startButton);
    expect(await screen.findByText('Going into Box 15')).toBeInTheDocument();
  });
});
