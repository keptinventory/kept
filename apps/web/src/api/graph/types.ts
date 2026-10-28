/**
 * The graph view's read (#207), as `apps/server/src/graph/view.ts` answers it. Only the graph's
 * own chunk and the mock import these: nothing here is in the main bundle.
 */

export type GraphFlag = 'low' | 'lent' | 'due';

export type GraphPlace = {
  id: string;
  parentId: string | null;
  name: string;
  kindKey: string;
  shortCode: string | null;
  isUnplaced: boolean;
};

export type GraphThing = {
  id: string;
  name: string;
  shortCode: string | null;
  placeId: string | null;
  containerId: string | null;
  isContainer: boolean;
  typeKey: string | null;
  typeName: string | null;
  tagIds: string[];
};

export type GraphTag = { id: string; name: string; colour: string | null };

/** GET /api/v1/locations/:id/graph */
export type GraphView = {
  locationId: string;
  places: GraphPlace[];
  /** Containers first, then A to Z, up to the server's cap. */
  things: GraphThing[];
  /** Every holder's direct number of things, those past the cap too. */
  counts: { holderId: string; things: number }[];
  /** Things past the cap. */
  more: number;
  attention: { subjectId: string; holderId: string | null; kind: GraphFlag }[];
  tags: GraphTag[];
};
