import { TOOL_DEFS, type ToolName } from '@kept/mcp';
import { describe, expect, it } from 'vitest';
import { TOOL_FIELDS, toolHint } from './hints.js';

describe('toolHint (#425)', () => {
  it('names the tool’s field, not the route’s', () => {
    expect(toolHint('lend_thing', 'Check body.dueOn: a loan is due on or after the day.')).toBe(
      'Check due_on: a loan is due on or after the day.',
    );
    expect(toolHint('return_thing', 'Check body.quantityBack: more than 0.')).toBe(
      'Check quantity: more than 0.',
    );
    expect(toolHint('create_place', 'Check body.kindKey: there is no place kind "x".')).toBe(
      'Check kind: there is no place kind "x".',
    );
    expect(toolHint('update_thing', 'body.purchase.purchasedOn is in the future.')).toBe(
      'purchase.purchased_on is in the future.',
    );
    expect(toolHint('add_thing', 'Check body.lines[0].unitPrice: a decimal amount.')).toBe(
      'Check purchase.price: a decimal amount.',
    );
    expect(toolHint('log_fuel', 'Check body.currency: use a currency that is turned on.')).toBe(
      'Check cost.currency: use a currency that is turned on.',
    );
  });

  it('leaves a custom field’s key as the person wrote it', () => {
    expect(toolHint('update_place', 'Check body.custom.serialNo: it is required.')).toBe(
      'Check custom.serialNo: it is required.',
    );
  });

  it('leaves a hint with no route field alone', () => {
    const plain = 'Give thing_id or meter_id. The body.';
    expect(toolHint('log_reading', plain)).toBe(plain);
  });

  it('only names fields the tool has', () => {
    const inputKeys = (schema: unknown): Set<string> => {
      const def = (schema as { shape?: Record<string, unknown>; def?: { in?: unknown } }) ?? {};
      if (def.shape) return new Set(Object.keys(def.shape));
      return def.def?.in ? inputKeys(def.def.in) : new Set();
    };
    const nested = (name: ToolName) => {
      const keys = inputKeys(TOOL_DEFS[name].input);
      const out = new Set(keys);
      // A thing's fields sit under `fields` or `items`, a place's under `fields`.
      if (name === 'update_thing' || name === 'update_place' || name === 'add_thing') {
        for (const k of ['purchase', 'kind']) out.add(k);
      }
      return out;
    };
    for (const [name, fields] of Object.entries(TOOL_FIELDS)) {
      const known = nested(name as ToolName);
      for (const field of Object.values(fields)) {
        for (const one of field.split(' and ')) {
          expect(known, `${name}: ${one}`).toContain(one.split('.')[0]);
        }
      }
    }
  });
});
