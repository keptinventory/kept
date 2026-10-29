import { draftRooms, type PlanExtraction } from '@kept/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FloorPlanView, MapView } from '@/api/map/types';
import { setLocale } from '@/lib/prefs';
import { expectLogicalOnly, renderUI } from '@/test/render';
import { NO_FLOOR, planOf } from '../layout';
import { BlockedLine, EmptyMap, type PlanAi, PlanState } from './notices';
import { PlanPanel } from './panel';
import { type Review, startReview } from './review';
import { planUpload, StartPlanSheet } from './start-sheet';

// The floor plan's screens on the map (D266, spec §16.3): the empty state, an open plan's state,
// the upload sheet and the review's panel, in English and Arabic. Invented plans only.

afterEach(() => setLocale('en'));

const c = <T,>(value: T, confidence = 0.9) => ({ value, confidence });
const ANSWER: PlanExtraction = {
  is_plan: true,
  floors: [{ label: c('Ground floor') }],
  rooms: [
    { name: c('Living room'), box: [0.1, 0.1, 0.4, 0.4], size_text: c('4.00 x 4.00 m') },
    { name: c('Kitchen'), box: [0.5, 0.1, 0.3, 0.4], size_text: c('9.00 x 9.00 m') },
    { name: c('Cupboard'), box: [0.1, 0.5, 0.05, 0.05] },
    { name: c('Ktchn', 0.3), box: [0.2, 0.5, 0.5, 0.3] },
  ],
};
const IMAGE = { w: 1000, h: 1000 };

const plan = (over: Partial<FloorPlanView> = {}): FloorPlanView => ({
  id: 'plan-1',
  locationId: 'loc-1',
  status: 'ready',
  turn: 0,
  keepPlan: false,
  createdAt: '2026-10-28T10:00:00.000Z',
  read: { status: 'succeeded', reason: null, pausedUntil: null, attempt: 1 },
  file: { id: 'file-1', attachmentId: 'att-1', mime: 'image/png' },
  image: IMAGE,
  answer: ANSWER,
  drafts: draftRooms(ANSWER, IMAGE),
  ...over,
});

const data: MapView = {
  locationId: 'loc-1',
  canArrange: true,
  version: null,
  openPlans: [],
  levels: [{ id: null, name: null }],
  rooms: [],
  nodes: [],
  things: [],
  more: 0,
  attention: [],
};
const WORDS = { room: (n: number) => `Room ${n}`, floor: (n: number) => `Floor ${n}` };

function review(): Review {
  const p = planOf(data, { noFloor: 'Not on a floor', location: 'Home' });
  const r = startReview(plan(), p, data, NO_FLOOR, WORDS);
  if (!r) throw new Error('no review');
  return r;
}

const withQuery = (ui: ReactElement) => (
  <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
);

describe('the empty map', () => {
  it('offers a floor plan and Arrange with AI on', async () => {
    const onStart = vi.fn();
    const { user } = await renderUI(
      <EmptyMap ai={{ kind: 'on' }} onStart={onStart} onArrange={vi.fn()} />,
    );
    expect(screen.getByRole('heading', { name: 'No rooms on the map yet' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Start from a floor plan' }));
    expect(onStart).toHaveBeenCalled();
    expectLogicalOnly();
  });

  it.each<[PlanAi, string]>([
    [
      { kind: 'off', location: 'Home' },
      'AI capture is off in Home. An owner or admin can turn it on.',
    ],
    [
      { kind: 'no_provider' },
      'No AI provider that reads photos is set up. Ask your instance admin.',
    ],
    [{ kind: 'paused', until: null }, 'Paused: the AI budget is used up.'],
  ])('with AI blocked, Arrange alone and the reason (%o)', async (ai, line) => {
    await renderUI(<EmptyMap ai={ai} onStart={vi.fn()} onArrange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Start from a floor plan' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Arrange' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(line);
  });

  it('says nothing when AI is on', async () => {
    const { container } = await renderUI(<BlockedLine ai={{ kind: 'on' }} />);
    expect(container.textContent).toBe('');
  });
});

describe('an open plan’s state', () => {
  const props = {
    onCheck: vi.fn(),
    onRetry: vi.fn(),
    onDiscard: vi.fn(),
    onChoose: vi.fn(),
    onDraw: vi.fn(),
  };
  it('reading: you can leave', async () => {
    await renderUI(
      <PlanState
        {...props}
        plan={plan({
          status: 'reading',
          drafts: null,
          read: { status: 'running', reason: null, pausedUntil: null, attempt: 1 },
        })}
      />,
    );
    expect(screen.getByText('Reading the plan…')).toBeTruthy();
    expect(screen.getByText('You can leave; the plan waits on the map.')).toBeTruthy();
  });
  it('waiting for a provider, in the existing words', async () => {
    await renderUI(
      <PlanState
        {...props}
        plan={plan({
          status: 'reading',
          read: {
            status: 'waiting_provider',
            reason: 'no_provider',
            pausedUntil: null,
            attempt: 1,
          },
        })}
      />,
    );
    expect(
      screen.getByText('Waiting for an AI provider · ask an admin to connect one'),
    ).toBeTruthy();
  });
  it('failed, a PDF: try again, a screenshot, or discard', async () => {
    const { user } = await renderUI(
      <PlanState
        {...props}
        plan={plan({
          status: 'failed',
          file: { id: 'f', attachmentId: 'a', mime: 'application/pdf' },
        })}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('Couldn’t read this plan.');
    expect(screen.getByRole('status').textContent).toContain(
      'For a PDF, try a screenshot of the plan.',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(props.onRetry).toHaveBeenCalled();
  });
  it('not a plan, and no rooms', async () => {
    const not = { ...ANSWER, is_plan: false };
    await renderUI(
      <PlanState {...props} plan={plan({ answer: not, drafts: draftRooms(not, IMAGE) })} />,
    );
    expect(screen.getByText('This doesn’t look like a floor plan.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose another file' })).toBeTruthy();
  });
  it('ready: Check it', async () => {
    const { user } = await renderUI(<PlanState {...props} plan={plan()} />);
    await user.click(screen.getByRole('button', { name: 'Check it' }));
    expect(props.onCheck).toHaveBeenCalled();
  });
});

describe('the review’s panel', () => {
  const panel = (r: Review, over: Partial<Parameters<typeof PlanPanel>[0]> = {}) => (
    <PlanPanel
      review={r}
      location="Home"
      levels={[{ key: NO_FLOOR, id: null, name: 'Home', short: '1' }]}
      newFloorName={(i) => `Floor ${i + 1}`}
      selected={null}
      onSelect={vi.fn()}
      onEdit={vi.fn()}
      onFloor={vi.fn()}
      onRescale={vi.fn()}
      keepPlan={false}
      onKeepPlan={vi.fn()}
      {...over}
    />
  );

  it('lists every room with its switch, name, size, kind and one note', async () => {
    await renderUI(panel(review()));
    expect(screen.getByRole('heading', { name: 'Rooms from the plan' })).toBeTruthy();
    // One printed size disagrees with the other (9 m): the scale is the living room's.
    expect(screen.getByText('Sizes from the plan: 1 of 2 rooms agree')).toBeTruthy();
    const living = screen.getByRole('switch', { name: 'Add Living room' }) as HTMLInputElement;
    expect(living.checked).toBe(true);
    // The cupboard: switched off, said so, never cut short.
    const cupboard = screen.getByRole('switch', { name: 'Add Cupboard' }) as HTMLInputElement;
    expect(cupboard.checked).toBe(false);
    expect(screen.getByText('Under 1 m: too small for the map.')).toBeTruthy();
    expect(screen.getByText('Name unclear on the plan.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /The plan says 9\.00 x 9\.00 m/ })).toBeTruthy();
    expect(screen.getAllByRole('radiogroup', { name: 'Kind' })).toHaveLength(4);
    expect(screen.getByRole('checkbox', { name: 'Keep the plan with Home' })).toBeTruthy();
    for (const el of document.querySelectorAll('.kplan *')) {
      expect(getComputedStyle(el).textOverflow).not.toBe('ellipsis');
    }
    expectLogicalOnly();
  });

  it('a switch, a rename and the printed size are edits of that room', async () => {
    const onEdit = vi.fn();
    const r = review();
    const { user } = await renderUI(panel(r, { onEdit }));
    await user.click(screen.getByRole('switch', { name: 'Add Kitchen' }));
    expect(onEdit).toHaveBeenCalledWith('plan:1', { on: false });
    await user.click(screen.getByRole('button', { name: /The plan says/ }));
    expect(onEdit).toHaveBeenCalledWith('plan:1', { w: 9, d: 9 });
    const names = screen.getAllByRole('textbox', { name: 'Name' });
    await user.type(names[0] as HTMLElement, 'X');
    expect(onEdit).toHaveBeenLastCalledWith('plan:0', { name: 'Living roomX' });
  });

  it('Set a room’s size rescales from the room typed', async () => {
    const onRescale = vi.fn();
    const r = review();
    const { user } = await renderUI(panel(r, { onRescale, selected: 'plan:0' }));
    await user.click(screen.getByRole('button', { name: 'Set a room’s size' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading').textContent).toBe('Living room is…');
    const width = within(dialog).getByRole('textbox', { name: 'Width (m)' });
    await user.clear(width);
    await user.type(width, '5.2{Enter}');
    await user.click(within(dialog).getByRole('button', { name: 'Rescale' }));
    expect(onRescale).toHaveBeenCalledWith('plan:0', 5.2, r.proposals[0]?.d);
  });

  it('reads right to left in Arabic, the names isolated', async () => {
    setLocale('ar');
    await renderUI(panel(review()), { locale: 'ar' });
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByRole('heading', { name: 'غرف من المخطط' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'أضف Living room' })).toBeTruthy();
    expectLogicalOnly();
  });
});

describe('the upload sheet', () => {
  it('waits for a file, then shows the cost, where it goes, and Turn', async () => {
    const { user } = await renderUI(
      withQuery(
        <StartPlanSheet
          isOpen
          onOpenChange={vi.fn()}
          locationId="loc-1"
          provider="groq"
          onStarted={vi.fn()}
        />,
      ),
    );
    const read = screen.getByRole('button', { name: 'Read the plan' });
    expect(read.hasAttribute('disabled') || read.getAttribute('data-disabled') !== null).toBe(true);
    expect(screen.getByText(/Up to ~11,000 tokens|Up to ~10,996 tokens/)).toBeTruthy();
    const privacy = screen.getByText(
      (_, el) => el?.tagName === 'P' && /^Kept sends the plan/.test(el.textContent ?? ''),
    );
    expect(privacy.textContent).toBe(
      'Kept sends the plan, without its location data, to Groq. It is deleted when you finish, unless you keep it.',
    );
    const pdf = new File(['%PDF-1.4'], 'plan.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, pdf);
    expect(await screen.findByText('Only the first page is read.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Turn the plan a quarter turn' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Read the plan' }).getAttribute('data-disabled'),
    ).toBeNull();
  });

  it('sends a PDF as it is (the server renders it)', async () => {
    const pdf = new File(['%PDF-1.4'], 'plan.pdf', { type: 'application/pdf' });
    expect((await planUpload(pdf)).file).toBe(pdf);
  });
});
