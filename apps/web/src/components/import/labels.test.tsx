/**
 * Every dry-run reason has a sentence of its own: a test walks IMPORT_ISSUE_CODES,
 * the CSV, archive and Homebox codes alike, and fails on one that falls back to the server's
 * English message. Every ARCHIVE_REFUSALS reason has its words too.
 */
import { ARCHIVE_REFUSALS, IMPORT_ISSUE_CODES } from '@kept/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderUI } from '@/test/render';
import { useIssueText, useRefusalText } from './labels';

const FALLBACK = 'UNTRANSLATED';

function All() {
  const issue = useIssueText();
  const refusal = useRefusalText();
  return (
    <ul>
      {IMPORT_ISSUE_CODES.map((code) => (
        <li key={code} data-code={code}>
          {issue({ column: '', code, message: FALLBACK })}
        </li>
      ))}
      {ARCHIVE_REFUSALS.map((reason) => (
        <li key={reason} data-reason={reason}>
          {refusal(reason) ?? FALLBACK}
        </li>
      ))}
    </ul>
  );
}

describe('the import reasons', () => {
  it.each(['en', 'ar'] as const)('translates every issue code and refusal (%s)', async (locale) => {
    await renderUI(<All />, { locale });
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(IMPORT_ISSUE_CODES.length + ARCHIVE_REFUSALS.length);
    const untranslated = items
      .filter((li) => li.textContent === FALLBACK || li.textContent === '')
      .map((li) => li.dataset.code ?? li.dataset.reason);
    expect(untranslated).toEqual([]);
  });
});

function Tense({ when }: { when: 'before' | 'after' }) {
  const issue = useIssueText(when);
  return (
    <ul>
      {(
        [
          'hb_quantity_zero',
          'hb_quantity_zero_archived',
          'hb_item_holds_things',
          'hb_box_from_location',
          'hb_location_in_item',
        ] as const
      ).map((code) => (
        <li key={code}>{issue({ column: '', code, message: FALLBACK })}</li>
      ))}
    </ul>
  );
}

describe('the Homebox reasons, before and after the import (#320)', () => {
  it('says what will happen on the check, and what did once it ran', async () => {
    const before = await renderUI(<Tense when="before" />);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Quantity 0 in Homebox; it comes in as 1.',
      'Quantity 0 in Homebox; it comes in archived.',
      'It holds other items, so it comes in as a box.',
      'A location that comes in as a box, as chosen.',
      'A location inside an item becomes a box.',
    ]);
    before.unmount();
    await renderUI(<Tense when="after" />);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Quantity 0 in Homebox; it came in as 1.',
      'Quantity 0 in Homebox; it came in archived.',
      'It holds other items, so it came in as a box.',
      'A location that came in as a box, as chosen.',
      'A location inside an item became a box.',
    ]);
  });

  it('calls a location inside an item a box in every language, never a container', async () => {
    for (const locale of ['ar', 'fr', 'de', 'it'] as const) {
      const view = await renderUI(<Tense when="after" />, { locale });
      const text = screen.getAllByRole('listitem')[4]?.textContent ?? '';
      expect(text, locale).not.toBe(FALLBACK);
      expect(text, locale).not.toMatch(/container|conteneur|Behälter|contenitore|حاوية/i);
      view.unmount();
    }
  });
});
