/**
 * Hide Personal (#392): a record in a hidden Personal, reached by a link, is as usable as any other.
 * The role, the name and the actions come from the location the record is in, hidden or not; a list
 * narrowed to it (the location page's own links) offers it.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { seedConditionReport } from '@/api/condition/mock';
import { ensureSeeded, hh } from '@/api/household/mock/db';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { IDS, ownerScenario } from '@/api/mock/fixtures';
import { findHeading, renderApp } from '@/test/app';

vi.setConfig({ testTimeout: 20_000 });

/** Ibrahim with Personal hidden, and every module on in it. */
const hidden = () => {
  const state = ownerScenario();
  state.me.profile = { ...state.me.profile, hidePersonal: true };
  state.me.personalHidden = true;
  state.locations = state.locations.map((l) =>
    l.kind === 'personal'
      ? {
          ...l,
          hidden: true,
          modules: [...l.modules, 'consumables', 'warranties', 'money', 'moving'],
          effectiveModules: [
            ...(l.effectiveModules ?? l.modules),
            'consumables',
            'warranties',
            'money',
            'moving',
          ],
        }
      : l,
  ) as typeof state.locations;
  return state;
};

describe('a record in a hidden Personal, opened by a link', () => {
  it('a condition report: the owner can still write to it and delete it', async () => {
    const state = hidden();
    const id = '01926f00-0000-7000-8000-0000000cr009';
    seedConditionReport(state, {
      id,
      locationId: IDS.personal,
      kind: 'move_in',
      heldOn: '2026-10-01',
      notes: null,
      createdBy: { displayName: 'Ibrahim' },
      createdAt: '2026-10-01T09:00:00Z',
      finishedAt: null,
      finishedBy: null,
      rowVersion: 1,
      rooms: [],
    });
    await renderApp(`/condition-reports/${id}`, { state });
    await findHeading(/^Move-in/);
    expect(await screen.findByRole('button', { name: 'Finish' })).toBeInTheDocument();
  });

  it('an incident: its insurance report still opens', async () => {
    const state = hidden();
    ensureSeeded(state);
    const id = '01926f00-0000-7000-8000-000000299009';
    hh(state).incidents.push({
      id,
      locationId: IDS.personal,
      kind: 'burglary',
      occurredOn: '2026-09-12',
      policeReference: null,
      insurerReference: null,
      notes: null,
      documents: [],
      createdBy: { displayName: 'Ibrahim' },
      rowVersion: 1,
      thingIds: [INV_IDS.thing.tv],
    });
    await renderApp(`/reports/insurance?incident=${id}`, { state });
    await findHeading('Insurance report');
    expect(await screen.findByRole('button', { name: 'Make the PDF' })).toBeInTheDocument();
    expect(screen.queryByText('No report for this incident')).toBeNull();
  });
});

describe('a list narrowed to a hidden Personal', () => {
  it('Consumables opens on it, not on another location', async () => {
    await renderApp(`/consumables?f.location=${IDS.personal}`, {
      state: hidden(),
      digits: 'western',
    });
    await findHeading('Consumables');
    expect(await screen.findByText(/Personal/)).toBeInTheDocument();
    // The AA batteries are Home's.
    expect(screen.queryByText('AA batteries')).toBeNull();
  });

  it('Trash: a thing in it can be restored', async () => {
    const state = hidden();
    const { user } = await renderApp(`/trash?f.location=${IDS.personal}`, {
      state,
      setup: (m) => {
        const lamp = m.state.inventory.things.find((t) => t.deletedAt);
        if (!lamp) throw new Error('no trashed thing');
        lamp.locationId = IDS.personal;
        lamp.name = 'Old passport';
      },
    });
    await findHeading('Trash');
    const row = await screen.findByRole('article', { name: 'Old passport' });
    expect(within(row).getByRole('button', { name: 'Restore Old passport' })).toBeInTheDocument();
    expect(user).toBeTruthy();
  });

  it('the filter chip names it', async () => {
    await renderApp(`/counts?f.location=${IDS.personal}`, { state: hidden() });
    await findHeading('Counts');
    expect(await screen.findByText(/Personal/)).toBeInTheDocument();
  });
});

describe('the notice on a hidden Personal', () => {
  it('comes first, above what the page holds', async () => {
    await renderApp(`/loc/${IDS.personal}`, { state: hidden() });
    await findHeading('Personal');
    const notice = await screen.findByText(/is hidden from your menu, Home, lists and search/);
    const add = await screen.findByText('Add here');
    expect(notice.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('the rule, for the next lookup', () => {
  /**
   * useLocations() leaves a hidden Personal out, so finding a record's location in it answers
   * nothing on a page reached by a link: the role, the actions and the name silently go. By id,
   * useAllLocations(). Catches the plain forms: the list itself, or `const all = list.data`.
   */
  const SRC = path.resolve(__dirname, '../..');
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) return name === 'mock' || name === 'locales' ? [] : sources(p);
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
    });

  /** Each by-id find on a value that came from useLocations(), as file:line. */
  function lookups(source: string, file: string): string[] {
    const lines = source.split('\n');
    const out: string[] = [];
    lines.forEach((line, i) => {
      const hook = /const (\w+) = useLocations\(\)(\.data)?/.exec(line);
      const inline = /useLocations\(\)\.data\?\.find\(/.test(line);
      if (inline) out.push(`${file}:${i + 1}`);
      if (!hook) return;
      const names = new Set([hook[1] as string]);
      for (let j = i + 1; j < lines.length; j++) {
        const at = lines[j] as string;
        if (/^}/.test(at)) break;
        const alias = /const (\w+) = (\w+)\.data( \?\? \[\])?;/.exec(at);
        if (alias && names.has(alias[2] as string)) names.add(alias[1] as string);
        for (const n of names) {
          if (new RegExp(`\\b${n}(\\.data\\?)?\\.find\\(\\(\\w+\\) => \\w+\\.id === `).test(at))
            out.push(`${file}:${j + 1}`);
        }
      }
    });
    return out;
  }

  it('finds a planted lookup, in each form', () => {
    expect(
      lookups(
        `function A() {
  const locations = useLocations();
  const l = locations.data?.find((x) => x.id === id);
}
function B() {
  const all = useLocations().data ?? [];
  const here = useLocations().data?.find((x) => x.id === id);
}
function C() {
  const locations = useLocations();
  const all = locations.data ?? [];
  return all.find((x) => x.id === id);
}
function D() {
  const locations = useAllLocations();
  return locations.data?.find((x) => x.id === id);
}`,
        'f',
      ),
    ).toEqual(['f:3', 'f:7', 'f:12']);
  });

  it('no by-id lookup in the app reads useLocations()', () => {
    const found = sources(SRC).flatMap((f) =>
      lookups(readFileSync(f, 'utf8'), path.relative(SRC, f)),
    );
    expect(found).toEqual([]);
  });
});
