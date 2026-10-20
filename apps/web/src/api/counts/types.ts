/**
 * Counts' wire types (1.14, #172), as `apps/server/src/sessions/counts.ts` answers them.
 */
import type { ScanSessionAction } from '@kept/shared';

export type Named = { id: string; name: string };
export type CountBy = { id: string | null; displayName: string };
export type CountTarget = {
  type: 'place' | 'thing' | 'location';
  id: string;
  name: string;
  inside?: boolean;
};

export type CountSummary = {
  id: string;
  kind: 'count' | 'box_check';
  at: string;
  by: CountBy;
  target: CountTarget;
  found: number;
  expected: number | null;
  /** Null for a count saved before 1.14 ("not recorded"). */
  missing: number | null;
  notHere: number;
  undone: boolean;
};

export type CountsParams = {
  q?: string;
  kind?: 'count' | 'box_check';
  placeId?: string;
  by?: string;
  had?: 'missing';
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
};

export type ResultLine = {
  thing: { id: string; name: string | null; shortCode: string | null; trashed: boolean };
  result: ScanSessionAction;
  was: Named | null;
  now: Named | null;
  area: Named | null;
  foundQty: string | null;
  expectedQty: string | null;
  readAt: string;
  readBy: CountBy | null;
};

export type CountResult = {
  session: {
    id: string;
    locationId: string;
    target: CountTarget;
    by: CountBy;
    finishedBy: CountBy | null;
    startedAt: string;
    finishedAt: string | null;
    expected: number | null;
    seen: number;
    notHere: number;
    moved: number;
    skipped: number;
    missing: number | null;
    elsewhere: number | null;
    onLoan: number | null;
    inRepair: number | null;
    notCounted: number | null;
    recorded: boolean;
    countedPlaceIds: string[] | null;
    schedule: Named | null;
    readers: CountBy[];
    undone: boolean;
  };
  lines: ResultLine[];
  previous: { id: string; finishedAt: string } | null;
  compare: { newlyMissing: string[]; foundAgain: string[]; newThings: string[] } | null;
};

export type BoxCheckDetail = {
  id: string;
  locationId: string;
  at: string;
  by: CountBy;
  container: Named;
  lines: {
    thing: { id: string; name: string | null; trashed: boolean };
    expectedQty: string;
    foundQty: string;
  }[];
};

export type StartCountBody = {
  id: string;
  target: { placeId: string; inside: boolean } | { containerId: string } | { locationId: string };
  startedAt?: string;
  countedPlaceIds?: string[];
};

export type OpenCount = {
  session: {
    id: string;
    target: CountTarget;
    startedAt: string;
    lastReadAt: string;
    by: CountBy;
    readers: CountBy[];
    lines: number;
    countedPlaceIds: string[] | null;
  } | null;
};

export type CountLines = {
  finishedAt: string | null;
  countedPlaceIds: string[] | null;
  lines: {
    thingId: string;
    action: ScanSessionAction;
    readAt: string;
    readBy: CountBy | null;
    foundQty: string | null;
  }[];
};
