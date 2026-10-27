import { MODULE_IDS, PRESETS } from '@kept/shared';
import { z } from 'zod';
import type { ArchiveRunRow } from './archive-types.js';

// A Homebox import into a new location (1.13.0) doesn't make it when the location is chosen: the
// run keeps what it will be (`import_runs.new_location`), the check plans against that, and
// POST /imports/:id/run makes it (imports/archive.ts), so an import left at its check leaves no
// location behind.

/** A Homebox import's new location, kept on the run (`new_location`) until Import makes it. */
export const PendingLocation = z.object({
  name: z.string(),
  kind: z.string(),
  timezone: z.string(),
  currency: z.string(),
  languages: z.array(z.string()).optional(),
  preset: z.enum(PRESETS),
  /** Modules on top of the preset: what the backup uses, as ticked in What to track. */
  modules: z.array(z.enum(MODULE_IDS)).default([]),
  alsoPersonal: z.boolean(),
});
export type PendingLocation = z.infer<typeof PendingLocation>;

/** The run's pending new location, when it has one that reads. */
export function pendingOf(run: Pick<ArchiveRunRow, 'new_location'>): PendingLocation | null {
  const parsed = PendingLocation.safeParse(run.new_location);
  return parsed.success ? parsed.data : null;
}
