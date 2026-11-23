import type pg from 'pg';
import { z } from 'zod';
import { type Scope, withScope } from '../db/scope.js';
import { defineJob, type JobDefinition } from '../jobs/boss.js';
import { JOB_POLICIES } from '../jobs/policies.js';
import type { JobQueue } from '../jobs/queue.js';
import type { SystemJobDeps } from '../jobs/system.js';
import type { BlobStore } from '../storage/blob-store.js';
import { InvalidVisualImage, prepareVisualImage, readVisualSource } from './image.js';
import { localVisualProvider, type VisualProvider } from './provider.js';
import { storeVisualVector, type VisualSource, validVector, visualSource } from './store.js';

const INDEX_JOB = 'visual-index';
const Data = z.strictObject({ attachmentId: z.uuid() });

/** Enqueue opaque attachment IDs on the user's write transaction, as other tenant jobs do. */
export async function enqueueVisualIndex(
  jobs: JobQueue | null,
  client: pg.ClientBase,
  attachmentIds: string[],
  enabled = localVisualProvider() !== null,
) {
  if (!jobs || !enabled) return;
  for (const attachmentId of attachmentIds) {
    await jobs.sendTenant(
      client,
      INDEX_JOB,
      { attachmentId },
      {
        singletonKey: `visual:${attachmentId}`,
        singletonSeconds: 30,
      },
    );
  }
}

function sameSource(before: VisualSource, current: VisualSource | undefined): boolean {
  return (
    current !== undefined &&
    before.file_id === current.file_id &&
    before.location_id === current.location_id &&
    before.content_hash === current.content_hash &&
    before.storage_key === current.storage_key
  );
}

/** A tenant job takes fresh grants before blob access and inference. Commit is guarded again by
 * the database door, which rejects a changed photo or ended grant even during an encode. */
export async function indexVisualAttachment(
  pool: pg.Pool,
  scope: Scope,
  blobs: BlobStore,
  provider: VisualProvider,
  attachmentId: string,
  finalAttempt = true,
): Promise<'stored' | 'skipped' | 'failed'> {
  const source = () =>
    withScope(pool, scope, (_tx, client) =>
      visualSource(client, attachmentId, provider.generation),
    );
  const found = await source();
  if (!found || found.ready) return 'skipped';
  let original: Buffer | undefined;
  let image: Buffer | undefined;
  let vector: number[] | null = null;
  try {
    original = await readVisualSource(
      blobs,
      found.storage_key,
      Number(found.bytes),
      found.content_hash,
    );
    image = await prepareVisualImage(original);
    const check = await source();
    if (!sameSource(found, check) || check?.ready) return 'skipped';
    vector = await provider.encodeImage(image);
    if (!validVector(vector)) throw new Error('Invalid visual vector');
  } catch (error) {
    if (!(error instanceof InvalidVisualImage) && !finalAttempt) {
      throw new Error('Visual index job will retry.');
    }
    vector = null;
  } finally {
    original?.fill(0);
    image?.fill(0);
  }
  const stored = await withScope(pool, scope, (_tx, client) =>
    storeVisualVector(client, found, provider.generation, vector),
  );
  return stored ? (vector ? 'stored' : 'failed') : 'skipped';
}

export function visualIndexJobs(deps: SystemJobDeps): JobDefinition[] {
  const provider = localVisualProvider();
  return [
    defineJob({
      name: INDEX_JOB,
      kind: 'tenant',
      policy: JOB_POLICIES[INDEX_JOB],
      handler: async ({ data, scope, client, job }) => {
        if (!provider || !deps.pools.app || !deps.files) return;
        const { attachmentId } = Data.parse(data);
        // The tenant dispatcher holds its scope connection idle while the fresh authorization
        // transactions and bounded model call run. It never holds a source lock during inference.
        await client.query(`SET LOCAL idle_in_transaction_session_timeout = '100s'`);
        await indexVisualAttachment(
          deps.pools.app,
          scope,
          deps.files.blobs,
          provider,
          attachmentId,
          !job || job.retryCount >= job.retryLimit,
        );
      },
    }),
  ];
}
