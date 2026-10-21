import { addThingItem, TOOL_DEFS } from '@kept/mcp';
import { describe, expect, it } from 'vitest';
import { CreateBody, UpdateFields } from '../things/validate.js';

// Every field a person can set on a thing in the app (the create sheet and the edit form send
// POST /things' CreateBody and PATCH /things/:id's UpdateFields) can be set by add_thing and
// update_thing too, for the assistant and MCP alike. A new field on either body fails this test
// until the tools take it, or the exclusions below say why they don't.

/** The tool field each body field is set through. */
const AS_TOOL: Record<string, string> = {
  name: 'name',
  quantity: 'quantity',
  placeId: 'place_id',
  containerId: 'place_id',
  typeId: 'type',
  brandId: 'brand',
  model: 'model',
  serial: 'serial',
  barcode: 'barcode',
  colour: 'colour',
  condition: 'condition',
  notes: 'notes',
  aliases: 'aliases',
  tagIds: 'tags',
  belongsToPersonId: 'belongs_to',
  manualUrl: 'manual_url',
  expiresOn: 'expires_on',
  expiryLeadDays: 'expiry_lead_days',
  acquiredFrom: 'acquired_from',
  provenanceNotes: 'provenance_notes',
  custom: 'custom',
  purchase: 'purchase',
};

/** Body fields no tool sets, and why. */
const NOT_A_TOOL_FIELD: Record<string, string> = {
  // The client-chosen id of an offline create; a tool's create picks its own.
  id: 'client id',
  // A tool names the location once, at the top (`location_id`), not per item.
  locationId: 'location_id at the top',
  // Quick add from a template is a shortcut of the create sheet: the template's fields are
  // fields the tool takes one by one.
  templateId: 'template shortcut',
};

const keysOf = (shape: object) => Object.keys(shape);
const addKeys = keysOf(addThingItem.shape);
const updateKeys = keysOf(TOOL_DEFS.update_thing.input.shape.fields.shape);

describe('add_thing and update_thing take every field the app’s forms set', () => {
  it.each(keysOf(CreateBody.shape))('create: %s', (key) => {
    if (key in NOT_A_TOOL_FIELD) return;
    expect(AS_TOOL[key], `${key} has no tool field`).toBeDefined();
    expect(addKeys).toContain(AS_TOOL[key]);
  });

  it.each(keysOf(UpdateFields.shape))('edit: %s', (key) => {
    expect(AS_TOOL[key], `${key} has no tool field`).toBeDefined();
    expect(updateKeys).toContain(AS_TOOL[key]);
  });

  it('a consumable’s minimum (its own route) is a tool field on both', () => {
    expect(addKeys).toContain('keep_at_least');
    expect(updateKeys).toContain('keep_at_least');
  });
});
