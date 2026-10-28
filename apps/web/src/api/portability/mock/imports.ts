/**
 * Mock handlers for archive imports (T8, T9, T11, T14) and alias enrichment (T15). An archive run
 * is a draft with no location until its target is set; the upload checks the declared SHA-256;
 * inspect reads the archive's summary; the dry run needs the target (and, for Homebox, the
 * choices). Step 3's run routes (view, list, dry run, run, cancel) are answered here for archive
 * runs and passed on (PASS) for CSV runs, whose handlers are api/capture/mock/imports.ts.
 *
 * An archive whose declared sha256 starts with `bad` is read as hostile: inspect answers 400
 * `archive_invalid` with the reason `symlink`, and the run fails.
 */
import {
  ARCHIVE_SOURCES,
  HomeboxChoices,
  PASSPHRASE_MIN,
  presetModules,
  ZIP_LIMITS,
} from '@kept/shared';
import { capturePaths as cp } from '../../capture/paths';
import { accessOf, newId, now, recordEvent, versionError } from '../../inventory/mock/db';
import type { MockState } from '../../mock/fixtures';
import {
  err,
  forbidden,
  type MockRoute,
  notFound,
  PASS,
  reply,
  route,
  sessionGate,
} from '../../mock/kit';
import { portabilityPaths as p } from '../paths';
import type {
  ArchiveImportRun,
  ArchiveInspect,
  CreateArchiveImportBody,
  EnrichEstimate,
  HomeboxConnectBody,
  ImportRepairBody,
  ImportTargetBody,
} from '../types';
import { HOMEBOX_MAPPING, PORTABILITY_IDS, pt } from './state';

/** Rows applied per GET while running, like the CSV mock's chunks. */
const CHUNK = 8;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

export function importRoutes(state: MockState): MockRoute[] {
  const s = () => pt(state);
  const access = () => accessOf(state);
  const find = (id: string | undefined) => s().archiveRuns.find((r) => r.id === id);
  /** The run as its viewer may see it: the creator before a target, admins of the target after. */
  const visibleRun = (id: string | undefined) => {
    const run = find(id);
    if (!run) return undefined;
    if (run.locationId && !access().isAdmin(run.locationId)) return undefined;
    return run;
  };
  const touch = (run: ArchiveImportRun) => {
    run.updatedAt = now();
    run.rowVersion += 1;
  };
  const tick = (run: ArchiveImportRun) => {
    if (run.status !== 'running') return;
    run.progress = Math.min(run.total ?? 0, run.progress + CHUNK);
    if (run.progress >= (run.total ?? 0)) {
      run.status = 'done';
      run.finishedAt = now();
      // As the server's Homebox job does (imports/homebox/job.ts): a finished run's archive is
      // deleted, and the run no longer names it.
      if (run.source === 'homebox_zip') {
        run.archiveReadyAt = null;
        run.bytes = 0;
        run.sha256 = '';
      }
    }
    touch(run);
  };
  const summaryOf = (run: ArchiveImportRun): ArchiveInspect =>
    run.source === 'homebox_zip'
      ? {
          source: 'homebox_zip',
          sourceVersion: run.sourceVersion,
          collections: [
            {
              id: newId(),
              name: 'Home',
              counts: {
                entities: 13,
                locations: 8,
                attachments: 2,
                maintenance: 1,
                tags: 7,
                types: 2,
              },
              exportedAt: now(),
              mapping: HOMEBOX_MAPPING,
            },
          ],
        }
      : {
          source: 'kept_zip',
          sourceVersion: '0.1.0',
          kept: {
            locationName: 'Home',
            kind: 'apartment',
            exportedAt: now(),
            keptVersion: '0.1.0',
            counts: { places: 7, things: 14, files: 6, history: 120 },
            includesSecrets: false,
            members: [
              { name: 'Ibrahim', role: 'owner' },
              { name: 'Bruce', role: 'admin' },
            ],
          },
        };

  return [
    route('POST', p.importsArchive, ({ body }) => {
      const gate = sessionGate(state);
      if (gate) return gate;
      const b = body as CreateArchiveImportBody;
      if (!(ARCHIVE_SOURCES as readonly string[]).includes(b.source))
        return err(400, 'validation', 'Check body.source.');
      if (!/^[0-9a-f]{64}$/.test(b.sha256 ?? ''))
        return err(400, 'validation', 'Check body.sha256.');
      if (b.bytes > ZIP_LIMITS.archiveBytes)
        return err(413, 'archive_too_large', 'This archive is too large to import.', undefined, {
          reason: 'too_large',
        });
      const existing = find(b.id);
      if (existing) return reply(201, existing);
      const run: ArchiveImportRun = {
        id: b.id,
        locationId: null,
        source: b.source,
        sourceVersion: null,
        status: 'draft',
        bytes: b.bytes,
        sha256: b.sha256,
        archiveReadyAt: null,
        inspect: null,
        choices: null,
        secrets: null,
        progress: 0,
        total: null,
        createdAt: now(),
        startedAt: null,
        finishedAt: null,
        error: null,
        updatedAt: now(),
        rowVersion: 1,
      };
      s().archiveRuns.unshift(run);
      return reply(201, run);
    }),

    route('PUT', p.importArchive(':id'), ({ params, headers }) => {
      const run = visibleRun(params.id);
      if (!run) return notFound();
      if (headers['x-kept-sha256'] !== run.sha256)
        return err(
          400,
          'checksum_mismatch',
          "The bytes that arrived don't match X-Kept-Sha256. Upload the file again.",
        );
      if (!run.archiveReadyAt) {
        run.archiveReadyAt = now();
        touch(run);
      }
      return run;
    }),

    route('POST', p.importInspect(':id'), ({ params }) => {
      const run = visibleRun(params.id);
      if (!run) return notFound();
      if (!run.archiveReadyAt) return err(409, 'conflict', 'Upload the archive first.');
      if (run.sha256.startsWith('bad')) {
        run.status = 'failed';
        run.error = 'archive_invalid';
        run.reason = 'symlink';
        touch(run);
        return err(400, 'archive_invalid', "Kept can't read this archive.", undefined, {
          reason: 'symlink',
        });
      }
      run.inspect ??= summaryOf(run);
      if (run.inspect.source === 'kept_zip' && run.inspect.kept.includesSecrets)
        run.secrets ??= { present: true, unlocked: false };
      touch(run);
      return run.inspect;
    }),

    route('POST', p.importTarget(':id'), ({ params, body }) => {
      const run = visibleRun(params.id);
      if (!run) return notFound();
      if (run.locationId || run.newLocation)
        return err(409, 'conflict', 'This import already has its location.');
      const b = body as ImportTargetBody;
      if ('newLocation' in b && run.source === 'homebox_zip') {
        // As the server does from 1.13.0: the new location is made when the import runs.
        run.newLocation = {
          name: b.newLocation.name,
          kind: b.newLocation.kind,
          timezone: b.newLocation.timezone,
          currency: b.newLocation.currency,
          preset: b.newLocation.preset ?? 'essentials',
          modules: b.newLocation.modules ?? [],
          alsoPersonal: b.newLocation.alsoPersonal === true,
        };
      } else if ('locationId' in b) {
        if (run.source === 'kept_zip')
          return err(400, 'validation', 'A Kept export goes into a new location.');
        if (!access().visible(b.locationId)) return notFound();
        if (!access().isAdmin(b.locationId)) return forbidden();
        run.locationId = b.locationId;
      } else {
        const home = state.locations.find((l) => l.kind !== 'personal') ?? state.locations[0];
        if (!home) return err(409, 'conflict', 'No location to copy.');
        const id = newId();
        state.locations.push({
          ...home,
          id,
          name: b.newLocation.name,
          kind: b.newLocation.kind,
          role: 'owner',
          timezone: b.newLocation.timezone,
          currency: b.newLocation.currency,
        });
        run.locationId = id;
      }
      touch(run);
      return run;
    }),

    route('POST', p.importChoices(':id'), ({ params, body, headers }) => {
      const run = visibleRun(params.id);
      if (!run) return notFound();
      if (run.source !== 'homebox_zip')
        return err(400, 'validation', 'Only a Homebox import has these choices.');
      const stale = versionError(headers, run);
      if (stale) return reply(stale.status, stale.body);
      const parsed = HomeboxChoices.safeParse((body as { choices?: unknown }).choices);
      if (!parsed.success) return err(400, 'validation', 'Check body.choices.');
      run.choices = parsed.data;
      if (run.status === 'checked') run.status = 'draft';
      touch(run);
      return run;
    }),

    route('POST', p.importHomeboxConnect(':id'), ({ params, body }) => {
      const run = visibleRun(params.id);
      if (!run) return notFound();
      const b = body as HomeboxConnectBody;
      let host: string;
      try {
        const url = new URL(b.baseUrl);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('scheme');
        host = url.hostname;
      } catch {
        return err(400, 'validation', 'Check body.baseUrl.');
      }
      if (PRIVATE_HOST.test(host) && !state.admin.settings.ssrfAllowPrivate)
        return err(400, 'private_address', 'That address is on a private network.');
      const collection =
        run.inspect?.source === 'homebox_zip' ? run.inspect.collections[0] : undefined;
      return {
        version: 'v0.26.2',
        collections: [
          { id: collection?.id ?? newId(), name: collection?.name ?? 'Home', currency: 'USD' },
        ],
        members: [
          { name: 'Ibrahim', email: 'ibrahim@example.com' },
          { name: 'Louis', email: 'louis@example.com' },
        ],
      };
    }),

    route('POST', p.importPassphrase(':id'), ({ params, body }) => {
      const run = visibleRun(params.id);
      if (!run) return notFound();
      if (!run.secrets?.present) return err(409, 'conflict', 'This export holds no secrets.');
      const tries = s().passphraseTries[run.id] ?? 0;
      if (tries >= 10)
        return err(429, 'rate_limited', 'Too many attempts. Try again later.', undefined, {
          retryAfter: 3600,
        });
      const pass = (body as { passphrase?: string }).passphrase ?? '';
      if (pass.length < PASSPHRASE_MIN || pass !== PORTABILITY_IDS.passphrase) {
        s().passphraseTries[run.id] = tries + 1;
        return err(400, 'passphrase_wrong', "That passphrase doesn't open this export's secrets.");
      }
      run.secrets = { present: true, unlocked: true };
      touch(run);
      return run;
    }),

    route('GET', p.importEnrichEstimate(':id'), ({ params }) => {
      const run = visibleRun(params.id);
      if (!run) return notFound();
      if (run.status !== 'done') return err(409, 'conflict', 'Finish the import first.');
      // As the server (enrich/routes.ts): AI capture on in the run's location, else no offer.
      const loc = state.locations.find((l) => l.id === run.locationId);
      const ai =
        loc?.effectiveModules?.includes('ai_capture') ??
        (loc?.providerResolved === true && loc.modules.includes('ai_capture'));
      if (!ai)
        return err(400, 'ai_unavailable', 'Connect AI and turn on AI capture for this location.');
      const things = run.total ?? 0;
      const calls = Math.ceil(things / 20);
      const estimate: EnrichEstimate = {
        things,
        calls,
        tokens: { input: calls * 1_400, output: calls * 600 },
        cost: { amount: '0.03', currency: 'USD' },
        costSource: 'price_table',
        payer: { scope: 'account', label: 'Home' },
        provider: { kind: 'groq', model: 'qwen/qwen3.8-27b' },
      };
      return estimate;
    }),

    route('GET', p.importRepair(':id'), ({ params }) => {
      const run = visibleRun(params.id);
      if (!run) return notFound();
      if (run.source !== 'homebox_zip' || !run.startedAt)
        return err(409, 'conflict', 'Only a Homebox import that ran can be repaired.');
      return s().repairs[run.id] ?? { zero: [], containerTypes: [], renames: [], sold: [] };
    }),

    route('POST', p.importRepair(':id'), ({ params, body }) => {
      const run = visibleRun(params.id);
      if (!run?.locationId) return notFound();
      const plan = s().repairs[run.id] ?? { zero: [], containerTypes: [], renames: [], sold: [] };
      const b = body as ImportRepairBody;
      const before = structuredClone(plan);
      const things = [...(b.zero ? plan.zero : []), ...(b.sold ? plan.sold : [])];
      const types = new Set([
        ...(b.containerTypes ? plan.containerTypes.map((y) => y.typeId) : []),
        ...(b.names ? plan.renames.map((y) => y.typeId) : []),
      ]);
      if (things.length === 0 && types.size === 0)
        return err(400, 'validation', 'There is nothing to repair.');
      const next = {
        zero: b.zero ? [] : plan.zero,
        containerTypes: b.containerTypes ? [] : plan.containerTypes,
        renames: b.names ? [] : plan.renames,
        sold: b.sold ? [] : plan.sold,
      };
      s().repairs[run.id] = next;
      const actor = { id: state.me.user.id, displayName: state.me.user.displayName };
      const restore = () => {
        s().repairs[run.id] = before;
      };
      let first = true;
      for (const t of things.length > 0 ? things : [{ thingId: run.id, name: 'Import' }]) {
        recordEvent(state.inventory, actor, {
          action: things.length > 0 ? 'thing.lifecycle' : 'import.repair',
          entity: { type: 'thing', id: t.thingId },
          locationId: run.locationId,
          name: t.name,
          // One undo of all of them puts the whole repair back.
          undo: first ? restore : () => {},
        });
        first = false;
      }
      return { repaired: { things: things.length, types: types.size }, plan: next };
    }),

    route('POST', p.importEnrich(':id'), ({ params }) => {
      const run = visibleRun(params.id);
      if (!run) return notFound();
      if (run.status !== 'done') return err(409, 'conflict', 'Finish the import first.');
      return reply(202, { jobId: newId() });
    }),

    // ----- step 3's run routes, for archive runs --------------------------------------------------
    route('GET', cp.importRun(':id'), ({ params }) => {
      if (!find(params.id)) return PASS;
      const run = visibleRun(params.id);
      if (!run) return notFound();
      tick(run);
      return run;
    }),

    route('GET', cp.imports, ({ query }) => {
      const gate = sessionGate(state);
      if (gate) return gate;
      const locationId = query.get('locationId');
      const mine = (id: string | null) =>
        id === null ? !locationId : access().isAdmin(id) && (!locationId || id === locationId);
      const strip = <T extends { report?: unknown }>({ report: _r, ...r }: T) => r;
      return {
        items: [
          ...s()
            .archiveRuns.filter((r) => mine(r.locationId))
            .map(strip),
          ...state.capture.imports.filter((r) => mine(r.locationId)).map(strip),
        ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        next_cursor: null,
      };
    }),

    route('POST', cp.importDryRun(':id'), ({ params }) => {
      if (!find(params.id)) return PASS;
      const run = visibleRun(params.id);
      if (!run) return notFound();
      if (!run.locationId && !run.newLocation)
        return err(409, 'import_target_needed', 'Choose where to import it first.');
      if (run.status !== 'draft' && run.status !== 'checked')
        return err(409, 'conflict', `This import is ${run.status}; a dry run is before it starts.`);
      if (run.source === 'homebox_zip' && !run.choices)
        return err(400, 'validation', 'Make the choices first.');
      run.report ??=
        run.source === 'homebox_zip'
          ? {
              source: 'homebox_zip',
              summary: {
                places: 8,
                things: 5,
                containers: 1,
                purchases: 2,
                warranties: 1,
                services: 1,
                schedules: 0,
                attachments: 2,
                links: 0,
                tags: 7,
                types: 2,
                fieldsAdded: 0,
                legacyCodes: 6,
                skipped: 8,
                asText: 0,
                refusedFiles: 0,
              },
              rows: [],
            }
          : {
              source: 'kept_zip',
              summary: {
                places: 7,
                things: 14,
                attachments: 9,
                files: 6,
                codesAdopted: 13,
                codesReissued: 1,
                history: 118,
                historyDropped: 2,
                secrets: run.secrets?.present ? 3 : 0,
                secretsWithheld: run.secrets?.present ? 0 : 2,
                skipped: 0,
                asText: 0,
                members: [{ name: 'Bruce', role: 'admin' }],
              },
              rows: [],
            };
      run.status = 'checked';
      run.total = run.report.summary.things + run.report.summary.places;
      touch(run);
      return { report: run.report };
    }),

    route('POST', cp.importStart(':id'), ({ params }) => {
      if (!find(params.id)) return PASS;
      const run = visibleRun(params.id);
      if (!run) return notFound();
      if (run.status !== 'checked' && run.status !== 'failed')
        return err(
          409,
          'conflict',
          run.status === 'draft' ? 'Run the dry run first.' : `This import is ${run.status}.`,
        );
      const pending = run.newLocation;
      if (pending) {
        const home = state.locations.find((l) => l.kind !== 'personal') ?? state.locations[0];
        if (!home) return err(409, 'conflict', 'No location to copy.');
        const id = newId();
        state.locations.push({
          ...home,
          id,
          name: pending.name,
          kind: pending.kind as typeof home.kind,
          role: 'owner',
          preset: pending.preset,
          modules: [...new Set([...presetModules(pending.preset), ...pending.modules])],
          timezone: pending.timezone,
          currency: pending.currency,
        });
        if (pending.alsoPersonal) {
          const personal = state.locations.find((l) => l.kind === 'personal');
          if (personal) {
            personal.preset = pending.preset;
            personal.modules = [...new Set([...presetModules(pending.preset), ...pending.modules])];
          }
        }
        run.locationId = id;
        run.newLocation = null;
      }
      run.status = 'running';
      run.startedAt ??= now();
      run.error = null;
      touch(run);
      return reply(202, run);
    }),

    route('POST', cp.importCancel(':id'), ({ params }) => {
      if (!find(params.id)) return PASS;
      const run = visibleRun(params.id);
      if (!run) return notFound();
      if (run.status !== 'done' && run.status !== 'cancelled') {
        run.status = 'cancelled';
        run.finishedAt = now();
        touch(run);
      }
      return run;
    }),
  ];
}
