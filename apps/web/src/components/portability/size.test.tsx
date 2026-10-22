/** useFileSize: a size in the reader's language, a count of bytes in words below a kilobyte. */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderUI } from '@/test/render';
import { useFileSize } from './size';

function Sizes({ bytes }: { bytes: number[] }) {
  const size = useFileSize();
  return (
    <ul>
      {bytes.map((b) => (
        <li key={b}>{size(b)}</li>
      ))}
    </ul>
  );
}

const shown = () => screen.getAllByRole('listitem').map((li) => li.textContent);

describe('useFileSize', () => {
  it('says bytes in words, one and many, and kilobytes and megabytes as units', async () => {
    await renderUI(<Sizes bytes={[0, 1, 2, 512, 999, 1000, 138_000, 48_200_000, 1_200_000_000]} />);
    expect(shown()).toEqual([
      '0 bytes',
      '1 byte',
      '2 bytes',
      '512 bytes',
      '999 bytes',
      '1 kB',
      '138 kB',
      '48.2 MB',
      '1.2 GB',
    ]);
  });

  it('counts bytes in Arabic with its plural forms and Arabic digits', async () => {
    await renderUI(<Sizes bytes={[0, 1, 2, 5, 11, 100]} />, { locale: 'ar' });
    expect(shown()).toEqual(['٠ بايت', 'بايت واحد', 'بايتان', '٥ بايتات', '١١ بايتًا', '١٠٠ بايت']);
  });
});
