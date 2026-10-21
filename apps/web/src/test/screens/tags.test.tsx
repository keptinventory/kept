/**
 * Tags (#209) against the mock server: a thing's Tags on its page (add one, make one inline, take
 * one off, each with Undo), the tag's own page with how many things have it, and Account settings
 * linking to it with each tag's count. The pickers and editors load on demand; the tests wait
 * for them as a person would.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { findHeading, renderApp } from '@/test/app';

const T = INV_IDS.thing;
const G = INV_IDS.tag;

const tagsSection = async () => {
  const heading = await findHeading('Tags');
  return heading.closest('section') as HTMLElement;
};

describe("a thing's tags", () => {
  it('shows its chips, adds an existing tag and makes a new one, in one change', async () => {
    const { user, mock } = await renderApp(`/t/${T.drill}`);
    const section = await tagsSection();
    expect(within(section).getByRole('link', { name: 'tools' })).toBeTruthy();
    await user.click(await within(section).findByRole('button', { name: 'Add tag' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tags' });
    await user.click(await within(dialog).findByRole('row', { name: /winter/ }));
    await user.type(within(dialog).getByRole('searchbox', { name: 'Find a tag' }), 'Picnic');
    await user.click(await within(dialog).findByRole('button', { name: /Create .Picnic./ }));
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      const thing = mock.state.inventory.things.find((x) => x.id === T.drill);
      expect(thing?.tags.map((g) => g.name).sort()).toEqual(['Picnic', 'tools', 'winter']);
    });
    expect(await screen.findByText('Tags changed')).toBeTruthy();
  });

  it('takes a tag off from its chip', async () => {
    const { user, mock } = await renderApp(`/t/${T.drill}`);
    const section = await tagsSection();
    await user.click(await within(section).findByRole('button', { name: /Take .*tools.* off/ }));
    await waitFor(() =>
      expect(mock.state.inventory.things.find((x) => x.id === T.drill)?.tags).toEqual([]),
    );
  });
});

describe("a tag's page", () => {
  it('lists the things with the tag and says how many', async () => {
    await renderApp(`/tags/${G.tools}`);
    expect(await findHeading('tools')).toBeTruthy();
    expect(await screen.findByText(/Bosch drill/)).toBeTruthy();
    expect(screen.getByText(/2 things/)).toBeTruthy();
  });

  it('is reached from Account settings, where each tag says how many things have it', async () => {
    const { user } = await renderApp('/settings/account/tags');
    const list = await screen.findByRole('list', { name: 'Tags' }, { timeout: 3000 });
    const link = await within(list).findByRole('link', { name: /winter/ });
    expect(within(link).getByText('1 thing')).toBeTruthy();
    await user.click(link);
    expect(await findHeading('winter')).toBeTruthy();
  });
});
