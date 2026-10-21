import { readFileSync } from 'node:fs';
import { TOOL_DEFS, type ToolName } from '@kept/mcp';
import { ASSISTANT_OUTPUT, MODULE_IDS, REASONING_ALLOWANCE } from '@kept/shared';
import { describe, expect, it } from 'vitest';
import { requestTokens } from '../ai/call.js';
import type { KeptMessage } from '../ai/convert.js';
import { MOCK_SCRIPTS_PATH } from '../ai/mock-script.js';
import { toolsIn } from '../tools/context.js';
import { fitToCeiling } from './fit.js';
import { instructionsFor, toolSpecOf } from './prompt.js';
import { askOf, CORE_TOOLS, offeredTools } from './select.js';

const owner = { userId: 'u', mfa: true, scope: 'write' as const };
/** Every tool the assistant may call with every module on, as an owner. */
const ALL = toolsIn(owner, 'assistant', 'owner', new Set(MODULE_IDS));
const offered = (question: string, used: string[] = []) =>
  offeredTools(ALL, { questions: [question], used })[0] as ToolName[];

describe('choosing the tools a step offers', () => {
  it('a question naming no topic gets the core: finding things and the everyday changes', () => {
    expect(offered('Are you working?')).toEqual(ALL.filter((t) => CORE_TOOLS.includes(t)));
    expect(offered('Are you working?')).toEqual([
      'capabilities',
      'list_locations',
      'search_things',
      'where_is',
      'get_thing',
      'list_contents',
      'add_thing',
      'update_thing',
      'move_thing',
      'mark_seen',
    ]);
  });

  it.each([
    ['Who borrowed the ladder?', 'lend_thing'],
    ['I lent the drill to Louis', 'lend_thing'],
    ['Louis gave the ladder back', 'return_thing'],
    ['The drill came back', 'return_thing'],
    ['Il trapano è tornato', 'return_thing'],
    ['أعرت المثقاب لبروس', 'lend_thing'],
    ['J’ai prêté la perceuse à Louis', 'lend_thing'],
    ['Ich habe die Leiter verliehen', 'lend_thing'],
    ['Ho prestato il trapano a Louis', 'lend_thing'],
    ['I handed the camera kit to Talia', 'lend_thing'],
    ['Ich habe Peter die Kamera übergeben', 'lend_thing'],
    ['What is due this week?', 'upcoming'],
    ['ما الصيانة القادمة؟', 'upcoming'],
    ['Was ist diese Woche fällig?', 'upcoming'],
    ['Quali sono le scadenze?', 'upcoming'],
    ['I cleaned the filter, mark the task done', 'complete_schedule'],
    ['Postpone the boiler service to May', 'snooze_schedule'],
    ['Where is the receipt for the TV?', 'find_documents'],
    ['أين فاتورة التلفزيون؟', 'find_documents'],
    ['Où est la facture de la télé ?', 'find_documents'],
    ['The TV has a two-year warranty', 'add_warranty'],
    ['Open a claim for the broken kettle', 'open_claim'],
    ['الغلاية عليها ضمان سنتين', 'add_warranty'],
    ['I filled up the car: 40 litres', 'log_fuel'],
    ['Die Inspektion am Auto ist gemacht', 'log_service'],
    ['The odometer reads 52,300 km', 'log_reading'],
    ['فولت العربية بنزين', 'log_fuel'],
    ['Abbiamo fatto il pieno di benzina', 'log_fuel'],
    ['We ran out of AA batteries', 'adjust_stock'],
    ['خلص الصابون', 'adjust_stock'],
    ['What happened to the kettle?', 'thing_history'],
    ['Who moved the HD webcam?', 'thing_history'],
    ['Add a shelf in the study', 'create_place'],
    ['I want to add a photo of the receipt', 'attach_link'],
    ['Tag the tent and the cool box camping', 'tag_things'],
    ['Which tags do we have?', 'list_tags'],
    ['ضع وسم التخييم على الخيمة', 'tag_things'],
    ['Quels tags avons-nous ?', 'list_tags'],
  ] as const)('“%s” offers %s', (question, tool) => {
    expect(offered(question)).toContain(tool);
    // The core is always there.
    for (const t of CORE_TOOLS) expect(offered(question)).toContain(t);
  });

  it('matches a word’s start in Latin scripts: “scarves” is not a car', () => {
    expect(offered('Where are the winter scarves?')).not.toContain('log_fuel');
    expect(offered('Where are the winter scarves?')).not.toContain('log_service');
  });

  it('keeps a tool the thread already used, and one the model asked for and was not offered', () => {
    expect(offered('and the drill?', ['lend_thing'])).toContain('lend_thing');
    expect(offered('and the drill?', ['start_move'])).not.toContain('start_move');
  });

  it('never offers a tool the person may not call, in the order the registry lists them', () => {
    const viewer = toolsIn(owner, 'assistant', 'viewer', new Set(MODULE_IDS));
    const picked = offeredTools(viewer, { questions: ['I lent the drill to Louis'], used: [] })[0];
    expect(picked?.every((t) => TOOL_DEFS[t].scope === 'read')).toBe(true);
    expect(picked).toEqual(viewer.filter((t) => picked?.includes(t)));
  });

  it('moving tools are MCP’s only: a moving question still finds things, with no moving tool', () => {
    const picked = offered('Which boxes are still packed for the move?');
    expect(picked).toContain('search_things');
    expect(picked).toContain('list_contents');
    expect(picked.some((t) => TOOL_DEFS[t].module === 'moving')).toBe(false);
  });

  it('answers smaller fallbacks: the latest question alone, then the core', () => {
    const tiers = offeredTools(ALL, {
      questions: ['Who borrowed the ladder?', 'and is the TV warranty still good?'],
      used: [],
    });
    expect(tiers[0]).toContain('lend_thing');
    expect(tiers[0]).toContain('add_warranty');
    expect(tiers[1]).not.toContain('lend_thing');
    expect(tiers[1]).toContain('add_warranty');
    expect(tiers.at(-1)).toEqual(offered('Are you working?'));
  });

  it('the thread’s last questions and the tools it called', () => {
    const user = (text: string): KeptMessage => ({ role: 'user', parts: [{ type: 'text', text }] });
    const messages: KeptMessage[] = [
      user('one'),
      user('two'),
      {
        role: 'assistant',
        parts: [{ type: 'tool_call', callId: 'c1', tool: 'lend_thing', input: {} }],
      },
      user('three'),
      user('four'),
    ];
    expect(askOf(messages)).toEqual({ questions: ['two', 'three', 'four'], used: ['lend_thing'] });
  });
});

describe('the evaluation set’s scripted tools are offered for its questions', () => {
  type Case = { id: string; question: string; mock?: { calls?: { tool: string }[] }[] };
  const cases = (JSON.parse(readFileSync(MOCK_SCRIPTS_PATH, 'utf8')) as { cases: Case[] }).cases;
  it.each(cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const picked = offered(c.question);
    for (const step of c.mock ?? []) {
      for (const call of step.calls ?? []) expect(picked, call.tool).toContain(call.tool);
    }
  });
});

describe('the first request fits Groq’s free tier (8,000 tokens a minute)', () => {
  const locations = [
    {
      id: '0b6f3a52-6c1e-4f43-9c1a-2f4f8c1d9e01',
      name: 'Home',
      role: 'owner' as const,
      canWrite: true,
    },
    {
      id: '7d2e9c44-1a5b-4e7f-8b3c-5a6d7e8f9a02',
      name: 'Garage',
      role: 'owner' as const,
      canWrite: true,
    },
  ];
  const instructions = instructionsFor({ locale: 'en', locations, context: null, writes: true });
  const maxOut = ASSISTANT_OUTPUT.maxTokens + REASONING_ALLOWANCE.low;
  const size = (tools: readonly ToolName[], question: string, out: number) =>
    requestTokens('groq', {
      instructions,
      tools: tools.map((t) => toolSpecOf(t)),
      messages: [{ role: 'user', parts: [{ type: 'text', text: question }] }],
      maxOutputTokens: out,
    });

  it('every module on, two locations: under 8,000 with the whole output allowance', () => {
    const tokens = size(offered('Are you working?'), 'Are you working?', maxOut);
    expect(tokens).toBeLessThan(8000 * 0.95);
    const fitted = fitToCeiling({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Are you working?' }] }],
      maxOut,
      floor: ASSISTANT_OUTPUT.expectedToolStep + REASONING_ALLOWANCE.low,
      ceiling: 8000,
      measure: (m, out) =>
        requestTokens('groq', {
          instructions,
          tools: offered('Are you working?').map((t) => toolSpecOf(t)),
          messages: m,
          maxOutputTokens: out,
        }),
    });
    expect(fitted?.maxOut).toBe(maxOut);
  });

  it('a question on every topic still fits with the step’s output floor', () => {
    const question =
      'Who borrowed the ladder, what is due, where is the TV receipt and warranty, log the car fuel, we ran out of soap, add a shelf';
    const tiers = offeredTools(ALL, { questions: [question], used: [] });
    const floor = ASSISTANT_OUTPUT.expectedToolStep + REASONING_ALLOWANCE.low;
    expect(tiers.some((t) => size(t, question, floor) <= 8000 * 0.95)).toBe(true);
  });
});
