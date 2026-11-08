/**
 * A rack on its page (#373): its elevation top to bottom in rack units, gear placed at a unit,
 * and the refusals: two pieces in the same unit, a piece past the top of the rack. The thing page
 * says where a piece sits. Against the mock server, which runs the same rules (packages/shared
 * racks.ts).
 */
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StoredPlace, StoredThing } from '@/api/inventory/mock/db';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { inventoryPaths as p } from '@/api/inventory/paths';
import type { FromTemplateBody } from '@/api/inventory/types';
import { IDS, ownerScenario } from '@/api/mock/fixtures';
import { plainText } from '@/lib/bidi';
import { findHeading, renderApp } from '@/test/app';

const RACK = '01970000-0000-7000-8000-00000000a001';
const SWITCH = '01970000-0000-7000-8000-00000000a101';
const MINI_PC = '01970000-0000-7000-8000-00000000a102';

const region = () => screen.getByRole('region', { name: 'Notifications' });
const said = (sentence: string) => (content: string) => plainText(content) === sentence;

/** A 12U wall rack in the office: a switch at U11, a mini PC in it but not placed yet. */
function withRack() {
  const state = ownerScenario();
  const office = state.inventory.places.find((x) => x.id === INV_IDS.place.office) as StoredPlace;
  state.inventory.places.push({
    id: RACK,
    locationId: office.locationId,
    parentId: office.id,
    name: 'Wall rack',
    kindKey: 'furniture',
    icon: null,
    isUnplaced: false,
    shortCode: null,
    fields: [],
    custom: {},
    secrets: [],
    rowVersion: 1,
    sort: 0,
    deletedAt: null,
    trashBatchId: null,
    deletedBy: null,
    rackLayout: { kind: 'rack', units: 12, width: 19, numbering: 'bottom', mount: 'wall' },
  });
  const base = state.inventory.things.find((x) => x.id === INV_IDS.thing.tv) as StoredThing;
  const gear = (over: Partial<StoredThing>): StoredThing => ({
    ...base,
    shortCode: null,
    placeId: RACK,
    containerId: null,
    rowVersion: 1,
    ...over,
  });
  state.inventory.things.push(
    gear({
      id: SWITCH,
      name: 'Switch',
      rackUnits: 1,
      rackAt: { rackId: RACK, u: 11, face: 'front', full: true },
    }),
    gear({ id: MINI_PC, name: 'Mini PC', rackUnits: 2 }),
  );
  return state;
}

const rows = () =>
  within(screen.getByRole('list', { name: 'Rack' }))
    .getAllByRole('listitem')
    .map((li) => plainText(li.textContent ?? ''));

describe('making a rack', () => {
  it('makes a rack from Furniture with compartments, in units, with no compartments', async () => {
    const { user, mock } = await renderApp(`/loc/${IDS.home}`);
    await findHeading('Home');
    await user.click(await screen.findByRole('button', { name: 'Room or spot' }));
    const place = await screen.findByRole('dialog', { name: /^Add a room or spot to/ });
    await user.click(within(place).getByRole('button', { name: 'Furniture with compartments…' }));
    const dialog = await screen.findByRole('dialog', { name: /^Add furniture to/ });
    await within(dialog).findByLabelText('Name');
    await user.click(within(dialog).getByRole('button', { name: /Template$/ }));
    await user.click(await screen.findByRole('option', { name: '19-inch rack, 42U' }));
    expect(within(dialog).getByLabelText('Name')).toHaveValue('19-inch rack, 42U');
    // A rack has no compartment names or codes to give.
    expect(within(dialog).queryByLabelText('Compartment names')).toBeNull();
    const units = within(dialog).getByLabelText('Units');
    await user.clear(units);
    await user.type(units, '24');
    await user.click(within(dialog).getByRole('radio', { name: 'The top' }));
    expect(within(dialog).getByText('24 units, U1 at the top')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(await within(region()).findByText(said('Added 19-inch rack, 42U'))).toBeVisible();
    const sent = mock.lastCall('POST', p.placesFromTemplate(IDS.home))?.body as FromTemplateBody;
    expect(sent).toMatchObject({
      template: { builtin: 'rack_19_42' },
      units: 24,
      numbering: 'top',
    });
    expect(sent.compartmentName).toBeUndefined();
    const made = mock.state.inventory.places.find((x) => x.name === '19-inch rack, 42U');
    expect(made?.rackLayout).toMatchObject({ units: 24, numbering: 'top' });
  });
});

describe('a rack', () => {
  it('shows its units top to bottom, gear at its units and the free units in runs', async () => {
    await renderApp(`/p/${RACK}`, { state: withRack(), digits: 'western' });
    await findHeading('Wall rack');
    expect(await screen.findByText('12 units, U1 at the bottom')).toBeVisible();
    expect(rows()).toEqual(['U12Empty', 'U11SwitchChange', 'U1–U10Empty']);
    expect(screen.getByText('Not placed yet')).toBeVisible();
  });

  it('places gear at a unit, and refuses a unit that is taken or past the top', async () => {
    const { user, mock } = await renderApp(`/p/${RACK}`, { state: withRack(), digits: 'western' });
    await findHeading('Wall rack');
    await user.click(await screen.findByRole('button', { name: 'Place it' }));
    const sheet = await screen.findByRole('dialog', { name: /Mini PC.*in.*Wall rack/ });
    const start = within(sheet).getByRole('textbox', { name: 'Starts at' });
    const save = within(sheet).getByRole('button', { name: 'Save' });
    // It suggests the lowest free units for its height.
    expect(start).toHaveValue('1');

    // U10 and U11: the switch is at U11.
    await user.clear(start);
    await user.type(start, '10');
    expect(
      within(sheet).getByText((t) => plainText(t) === 'U11 is taken by Switch at the front.'),
    ).toBeVisible();
    expect(save).toBeDisabled();

    // U12 and past it.
    await user.clear(start);
    await user.type(start, '12');
    expect(within(sheet).getByText("It doesn't fit: the rack is 12 units high.")).toBeVisible();
    expect(save).toBeDisabled();

    await user.clear(start);
    await user.type(start, '5');
    await user.click(within(sheet).getByRole('radio', { name: 'Half depth' }));
    await user.click(save);
    expect(await within(region()).findByText(said('Placed Mini PC'))).toBeVisible();
    expect(mock.lastCall('PATCH', p.thing(MINI_PC))?.body).toEqual({
      rackUnits: 2,
      rackAt: { u: 5, face: 'front', full: false },
    });
    await waitFor(() =>
      expect(rows()).toEqual([
        'U12Empty',
        'U11SwitchChange',
        'U7–U10Empty',
        'U5–U6Mini PCHalf depthChange',
        'U1–U4Empty',
      ]),
    );
  });

  it('shows the server’s refusal when the unit was taken meanwhile', async () => {
    const state = withRack();
    const { user, mock } = await renderApp(`/p/${RACK}`, { state, digits: 'western' });
    await findHeading('Wall rack');
    await user.click(await screen.findByRole('button', { name: 'Place it' }));
    const sheet = await screen.findByRole('dialog', { name: /Mini PC.*in.*Wall rack/ });
    // Someone else puts the switch at U1 before this sheet saves.
    const sw = mock.state.inventory.things.find((x) => x.id === SWITCH) as StoredThing;
    sw.rackAt = { rackId: RACK, u: 1, face: 'front', full: true };
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(
      await within(sheet).findByText((t) => plainText(t) === 'U1 is taken by Switch at the front.'),
    ).toBeVisible();
  });

  it('says on the thing page where a piece sits', async () => {
    await renderApp(`/t/${SWITCH}`, { state: withRack(), digits: 'western' });
    await findHeading('Switch');
    expect(await screen.findByText('In the rack')).toBeVisible();
    expect(screen.getByText('U11')).toBeVisible();
    expect(screen.getByText('Full depth')).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Wall rack' }).length).toBeGreaterThan(0);
  });
});
