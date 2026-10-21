import { describe, expect, it } from 'vitest';
import type { CountResult } from '@/api/counts/types';
import { countCsv } from './csv';

const line = (over: Partial<CountResult['lines'][number]>): CountResult['lines'][number] => ({
  thing: { id: 'a', name: 'HD webcam', shortCode: 'K7D2QX', trashed: false },
  result: 'seen',
  was: { id: 'p', name: 'Corner desk' },
  now: { id: 'p', name: 'Corner desk' },
  area: null,
  foundQty: null,
  expectedQty: null,
  readAt: '2026-10-20T10:00:00.000Z',
  readBy: null,
  ...over,
});

describe('a count as CSV', () => {
  it('has a row per thing, quotes what needs quoting, and never starts a formula', () => {
    const r = {
      session: { finishedAt: '2026-10-20T11:00:00.000Z' },
      lines: [
        line({}),
        line({
          thing: { id: 'b', name: '=SUM(A1), "big"', shortCode: null, trashed: true },
          result: 'missing',
          foundQty: '2',
          expectedQty: '6',
        }),
      ],
    } as unknown as CountResult;
    expect(countCsv(r).split('\r\n')).toEqual([
      '﻿thing,short_id,where_expected,result,found,of,where_now',
      'HD webcam,K7D2QX,Corner desk,seen,,,Corner desk',
      `"'=SUM(A1), ""big""",,Corner desk,missing (trashed),2,6,Corner desk`,
      '',
    ]);
  });
});
