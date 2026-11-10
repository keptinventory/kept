import { describe, expect, it } from 'vitest';
import type { ImportChoices } from '../types';
import { mockDryRun } from './imports';

const choices: ImportChoices = {
  placeSeparator: '>',
  createPlaces: true,
  dateFormat: 'YYYY-MM-DD',
  currency: 'USD',
  defaultTarget: { unplaced: true },
  typeByName: false,
};
const columns = ['Name', 'Bought', 'Price'];
const mapping = { Name: 'name', Bought: 'purchased_on', Price: 'price' };

describe('the mock dry run, as the server plans a purchase', () => {
  it('makes a purchase from a date with no price', () => {
    const report = mockDryRun(columns, [['Lamp', '2024-05-01', '']], mapping, choices);
    expect(report.summary.purchases).toBe(1);
    expect(report.rows[0]).toEqual({ row: 1, status: 'ok', issues: [] });
  });

  it('keeps a price with no date as text: a purchase needs a date', () => {
    const report = mockDryRun(columns, [['Lamp', '', '40']], mapping, choices);
    expect(report.summary.purchases).toBe(0);
    expect(report.rows[0]?.status).toBe('text');
    expect(report.rows[0]?.issues).toEqual([
      { column: 'Price', code: 'needs_date', message: 'A purchase needs a date.' },
    ]);
  });

  it('still makes a priced purchase', () => {
    const report = mockDryRun(columns, [['Lamp', '2024-05-01', '40']], mapping, choices);
    expect(report.summary.purchases).toBe(1);
  });
});
