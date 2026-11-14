/**
 * A customised built-in type keeps its name (#546). "Customise" makes the account's copy of a
 * built-in with no name of its own; the server names it by the built-in's key (`builtinKey`) on
 * the thing page and in the type list, so it reads in each person's language. The copy stands
 * in for the built-in in every picker (#357).
 */
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { inventoryPaths as p } from '@/api/inventory/paths';
import { type MockState, ownerScenario } from '@/api/mock/fixtures';
import { findHeading, renderApp } from '@/test/app';

vi.setConfig({ testTimeout: 15_000 });

const T = INV_IDS.thing;
const copyId = '0190a000-0000-7000-8000-00000000c546';

/** Ibrahim's account has customised TV / display: its TV is on the copy, as the server leaves it. */
function customised(): MockState {
  const s = ownerScenario();
  const original = s.inventory.types.find((x) => x.id === INV_IDS.type.tvDisplay);
  if (!original) throw new Error('fixture');
  s.inventory.types.push({
    ...structuredClone(original),
    id: copyId,
    name: null,
    builtinKey: 'tv_display',
    copiedFromId: original.id,
  });
  const tv = s.inventory.things.find((x) => x.id === T.tv);
  if (!tv?.type) throw new Error('fixture');
  tv.type = { ...tv.type, id: copyId, name: null, builtinKey: 'tv_display' };
  return s;
}

describe('a customised built-in type (#546)', () => {
  for (const { locale, name, actions, retype, title, confirm, newType, typed } of [
    {
      locale: 'en',
      name: 'TV / display',
      actions: 'Actions',
      retype: 'Re-type',
      title: 'Change the type',
      confirm: 'Change type',
      newType: 'New type',
      typed: 'disp',
    },
    {
      locale: 'de',
      name: 'TV / Bildschirm',
      actions: 'Aktionen',
      retype: 'Typ ändern',
      title: 'Typ ändern',
      confirm: 'Typ ändern',
      newType: 'Neuer Typ',
      typed: 'Bildsch',
    },
  ] as const) {
    it(`the thing page names it, never "No type" (${locale})`, async () => {
      await renderApp(`/t/${T.tv}`, { state: customised(), locale });
      await findHeading('Samsung TV, 55″');
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    });

    it(`Change type offers it once, by its name, and picks the copy (${locale})`, async () => {
      const { user, mock } = await renderApp(`/t/${T.drill}`, { state: customised(), locale });
      await findHeading('Bosch drill, 18 V');
      await user.click(screen.getByRole('button', { name: actions }));
      await user.click(await screen.findByRole('menuitem', { name: retype }));
      const dialog = await screen.findByRole('dialog', { name: title });
      await user.type(within(dialog).getByRole('combobox', { name: newType }), typed);
      const options = await screen.findAllByRole('option', { name: new RegExp(`^${name}`) });
      expect(options).toHaveLength(1);
      await user.click(options[0] as HTMLElement);
      await user.click(within(dialog).getByRole('button', { name: confirm }));
      await waitFor(() =>
        expect(mock.lastCall('POST', p.thingRetype(T.drill))?.body).toEqual({ typeId: copyId }),
      );
    });
  }
});
