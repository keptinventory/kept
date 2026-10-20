import type { JobDefinition } from '../jobs/boss.js';
import type { SystemJobDeps } from '../jobs/system.js';

/** This area's jobs, aggregated by jobs/inventory.ts. None in step 2: derivatives are made in the
 * upload request, and unattached files are purged by trash/jobs.ts (kept.purge_orphan_files).
 * Step 3's PDF extraction lands here. */
export function fileJobs(_deps: SystemJobDeps): JobDefinition[] {
  return [];
}
