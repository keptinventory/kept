import { AppError } from '../../http/errors.js';
import type { ArchiveImporter } from '../archive-types.js';
import { type KeptLoaded, keptReport, loadKept, totalOf } from './plan.js';
import { inspectKept, openKeptArchive } from './read.js';

// The Kept export's importer (D69), as imports/archive.ts dispatches to it
// for a `kept_zip` run: the archive opened by exact names (read.ts), inspected from its manifest,
// loaded (manifest, every row id, the codes and the history's dates) outside any transaction,
// and dry-run against the run's target without writing (plan.ts). POST …/run sends
// `import-kept` (job.ts).

export const keptImporter: ArchiveImporter<KeptLoaded> = {
  job: 'import-kept',
  open: (files, run) => openKeptArchive(files.blobs, run.id, Number(run.archive_bytes ?? 0)),
  inspect: (archive) => inspectKept(archive),
  load: (archive) => loadKept(archive),
  dryRun: async (c, run, loaded) => {
    // A Kept export's location is made when it is chosen: a check always has one.
    if (!run.location_id) throw new AppError('import_target_needed', 409);
    return {
      report: await keptReport(c.client, loaded, run.location_id),
      total: totalOf(loaded.scan),
    };
  },
};
