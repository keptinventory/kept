import type { ImportIssue, ImportIssueRef } from '@kept/shared';
import {
  type PaperlessClient,
  PaperlessError,
  type PaperlessErrorCode,
  paperlessTitle,
} from '../../paperless/client.js';
import type { ArchiveReportRow } from '../archive-types.js';
import type { HbOp } from './plan.js';

// The titles a Homebox import's Paperless links take from Paperless (#422). The job asks between
// a chunk's files and its transaction, never inside it, so no database transaction waits on
// Paperless. What is asked is only ever the connection's own address and a document's number:
// paperlessDocumentOf() has already read the number out of a link at that address, and the URL
// the export names is never fetched (the client's guards apply, as for every Paperless call).
//
// Bounded, so a slow or dead Paperless costs an import little:
// - each document once, TITLE_CONCURRENCY at a time, each call within the client's own 10 seconds;
// - the first failure that isn't about one document (no answer, a refused token, an answer that
//   isn't Paperless's) ends the asking for the whole run; those already on their way finish;
// - TITLE_BUDGET_MS of asking in all: a Paperless that answers, slowly, gets no more than that.
// Whatever isn't answered keeps Homebox's title (plan.ts). Nothing here logs or stores an error:
// the reason is a code, and the report holds a count.

/** Calls at once: Link from Paperless asks for at most 20, and this may be thousands. */
export const TITLE_CONCURRENCY = 4;
/** The most time one run spends asking. At 100 ms a document that is about 12,000 documents. */
export const TITLE_BUDGET_MS = 5 * 60_000;

export type TitleSource = Pick<PaperlessClient, 'document'>;
export type TitlesStopped = PaperlessErrorCode | 'budget' | 'no_connection';

/** Why asking should end after `err`, or null when it was only about that document. */
function stopReason(err: unknown): TitlesStopped | null {
  if (!(err instanceof PaperlessError)) return 'failed';
  if (err.reason === 'not_found') return null;
  if (err.reason === 'auth_failed' && err.upstreamStatus === 403) return null;
  return err.reason;
}

export class PaperlessTitles {
  readonly #open: () => Promise<TitleSource | null>;
  readonly #budgetMs: number;
  readonly #now: () => number;
  readonly #titles = new Map<number, string>();
  readonly #asked = new Set<number>();
  #source: TitleSource | null = null;
  #spentMs = 0;
  /** What ended the asking, as a code; null while it goes on. */
  stopped: TitlesStopped | null = null;

  constructor(
    open: () => Promise<TitleSource | null>,
    opts: { budgetMs?: number; now?: () => number } = {},
  ) {
    this.#open = open;
    this.#budgetMs = opts.budgetMs ?? TITLE_BUDGET_MS;
    this.#now = opts.now ?? Date.now;
  }

  /** Asks for the titles of these steps' links. Never throws: what fails is simply not known. */
  async fetch(steps: readonly HbOp[]): Promise<void> {
    const ids: number[] = [];
    for (const op of steps) {
      if (op.op !== 'paperless_link' || this.#asked.has(op.documentId)) continue;
      this.#asked.add(op.documentId);
      ids.push(op.documentId);
    }
    if (this.stopped || ids.length === 0) return;
    const source = await this.#connect();
    if (!source) return;
    const started = this.#now();
    let next = 0;
    const worker = async () => {
      while (!this.stopped && next < ids.length) {
        if (this.#spentMs + (this.#now() - started) >= this.#budgetMs) {
          this.stopped = 'budget';
          return;
        }
        const id = ids[next++] as number;
        try {
          const title = paperlessTitle((await source.document(id)).title);
          if (title) this.#titles.set(id, title);
        } catch (err) {
          this.stopped ??= stopReason(err);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(TITLE_CONCURRENCY, ids.length) }, worker));
    this.#spentMs += this.#now() - started;
  }

  /** The document's title in Paperless, when it gave one. */
  titleOf(documentId: number): string | undefined {
    return this.#titles.get(documentId);
  }

  /** Opened once, and only for a run with a link to ask about. */
  async #connect(): Promise<TitleSource | null> {
    if (this.#source) return this.#source;
    try {
      this.#source = await this.#open();
    } catch {
      this.#source = null;
    }
    if (!this.#source) this.stopped = 'no_connection';
    return this.#source;
  }
}

const NOTE_REF: ImportIssueRef = { kind: 'file', id: 'paperless-titles', name: 'Paperless' };

/**
 * The run's stored report with `kept` more links noted as keeping Homebox's title: one row however
 * many links, added to across chunks and a resumed run. It counts, and names nothing Paperless
 * said. A run with no stored report (null) stays as it is.
 */
export function withTitlesKept(report: unknown, kept: number): object | null {
  const stored = report as { rows?: ArchiveReportRow[] } | null;
  if (!stored?.rows) return null;
  const before = stored.rows.find((r) => r.ref.id === NOTE_REF.id)?.issues[0]?.params?.count ?? 0;
  const issue: ImportIssue = {
    column: '',
    code: 'hb_paperless_titles_kept',
    params: { count: before + kept },
    message: "Kept couldn't get these links' titles from Paperless, so they keep Homebox's.",
    ref: NOTE_REF,
  };
  return {
    ...stored,
    rows: [
      ...stored.rows.filter((r) => r.ref.id !== NOTE_REF.id),
      { status: 'ok', ref: NOTE_REF, issues: [issue] } satisfies ArchiveReportRow,
    ],
  };
}
