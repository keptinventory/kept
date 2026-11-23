import { randomUUID } from 'node:crypto';
import {
  VISUAL_INPUT_TTL_MS,
  type VisualSearchInputResponse,
  type VisualSearchRequest,
  type VisualSearchResult,
} from '@kept/shared';
import type pg from 'pg';
import { type Scope, withScope } from '../db/scope.js';
import { AppError, invalid, notFound } from '../http/errors.js';
import { InvalidVisualImage, prepareVisualImage } from './image.js';
import type { VisualProvider } from './provider.js';
import {
  EMPTY_COVERAGE,
  validVector,
  visualCoverage,
  visualLocations,
  visualMatches,
} from './store.js';

// Provisional model-specific cutoffs. Household qualification must measure abstention separately.
const TEXT_MIN_SCORE = 0.2;
const PHOTO_MIN_SCORE = 0.58;
const AMBIGUITY_MARGIN = 0.035;
const MAX_INPUTS = 128;
const MAX_INPUTS_PER_USER = 3;
const MAX_ACTIVE_QUERIES = 4;

type Input = {
  userId: string;
  principal: string;
  locations: string[];
  generation: string;
  vector: number[];
  expiresAt: number;
  timer: NodeJS.Timeout;
};

export const visualUnavailable = () =>
  new AppError('internal', 503, 'Visual search is unavailable.');
const emptyResult = (outcome: VisualSearchResult['outcome']): VisualSearchResult => ({
  matches: [],
  coverage: EMPTY_COVERAGE,
  outcome,
});

const sameLocations = (left: string[], right: string[]) =>
  left.length === right.length && left.every((id, index) => id === right[index]);

/** Search retains only a bounded, short-lived vector in this app process. Neither a query nor
 * its supplied bytes is written to inventory, disk, job state, audit records or backups. */
export class VisualQueries {
  private readonly inputs = new Map<string, Input>();
  private readonly active = new Set<string>();

  constructor(
    private readonly pool: pg.Pool,
    private readonly provider: VisualProvider | null,
  ) {}

  private reserve(userId: string): () => void {
    if (this.active.size >= MAX_ACTIVE_QUERIES || this.active.has(userId)) {
      throw new AppError('rate_limited', 429, 'Finish the current visual search first.');
    }
    this.active.add(userId);
    return () => this.active.delete(userId);
  }

  private remove(id: string): void {
    const entry = this.inputs.get(id);
    if (entry) clearTimeout(entry.timer);
    this.inputs.delete(id);
  }

  close(): void {
    for (const id of this.inputs.keys()) this.remove(id);
  }

  cancel(scope: Scope, principal: string, id: string): void {
    const entry = this.inputs.get(id);
    if (entry?.userId === scope.userId && entry.principal === principal) this.remove(id);
  }

  async input(
    scope: Scope,
    principal: string,
    bytes: Buffer,
    requested?: string[],
  ): Promise<VisualSearchInputResponse> {
    const provider = this.provider;
    if (!provider) throw visualUnavailable();
    const expiry = Date.now() + VISUAL_INPUT_TTL_MS;
    // Count reserved as well as finished inputs, so racing encodes can't exceed the bound.
    const userCount = Array.from(this.inputs.values()).filter(
      (entry) => entry.userId === scope.userId,
    ).length;
    if (this.inputs.size + this.active.size >= MAX_INPUTS || userCount >= MAX_INPUTS_PER_USER) {
      throw new AppError(
        'rate_limited',
        429,
        'Cancel another visual query or wait for it to expire.',
      );
    }
    const release = this.reserve(scope.userId);
    try {
      const locations = await withScope(this.pool, scope, (_tx, client) =>
        visualLocations(client, requested),
      );
      if (locations.length === 0 || (requested && new Set(requested).size !== locations.length)) {
        throw notFound();
      }
      let image: Buffer;
      try {
        image = await prepareVisualImage(bytes);
      } catch (error) {
        if (error instanceof InvalidVisualImage)
          throw invalid('Send a supported image within the size and pixel limits.');
        throw error;
      }
      let vector: number[];
      try {
        const current = await withScope(this.pool, scope, (_tx, client) =>
          visualLocations(client, locations),
        );
        if (!sameLocations(locations, current)) throw notFound();
        vector = await provider.encodeImage(image).catch(() => {
          throw visualUnavailable();
        });
      } finally {
        image.fill(0);
      }
      if (!validVector(vector)) throw visualUnavailable();
      const current = await withScope(this.pool, scope, (_tx, client) =>
        visualLocations(client, locations),
      );
      if (Date.now() >= expiry || !sameLocations(locations, current)) throw notFound();
      const inputId = randomUUID();
      const timer = setTimeout(() => this.remove(inputId), expiry - Date.now()).unref();
      this.inputs.set(inputId, {
        userId: scope.userId,
        principal,
        locations,
        generation: provider.generation,
        vector,
        expiresAt: expiry,
        timer,
      });
      return { inputId, expiresAt: new Date(expiry).toISOString() };
    } finally {
      bytes.fill(0);
      release();
    }
  }

  async status(scope: Scope, requested?: string[]) {
    const provider = this.provider;
    if (!provider) return EMPTY_COVERAGE;
    return withScope(this.pool, scope, async (_tx, client) =>
      visualCoverage(client, provider.generation, await visualLocations(client, requested)),
    );
  }

  private async inputVector(scope: Scope, principal: string, id: string): Promise<Input> {
    const input = this.inputs.get(id);
    if (input?.userId !== scope.userId || input.principal !== principal) throw notFound();
    const current = await withScope(this.pool, scope, (_tx, client) =>
      visualLocations(client, input.locations),
    );
    if (
      input.expiresAt <= Date.now() ||
      input.generation !== this.provider?.generation ||
      !sameLocations(input.locations, current)
    ) {
      this.remove(id);
      throw notFound();
    }
    return input;
  }

  async search(
    scope: Scope,
    principal: string,
    body: VisualSearchRequest,
  ): Promise<VisualSearchResult> {
    const provider = this.provider;
    if (!provider) return emptyResult('unavailable');
    const release = this.reserve(scope.userId);
    try {
      const input =
        'inputId' in body ? await this.inputVector(scope, principal, body.inputId) : null;
      const requested = body.locationIds;
      const admitted = input
        ? input.locations.filter((id) => !requested || requested.includes(id))
        : await withScope(this.pool, scope, (_tx, client) => visualLocations(client, requested));
      const start = await withScope(this.pool, scope, (_tx, client) =>
        visualCoverage(client, provider.generation, admitted),
      );
      if (start.ready === 0) return this.result(start, [], body.limit ?? 10);
      let vector: number[];
      try {
        vector = 'text' in body ? await provider.encodeText(body.text) : (input?.vector ?? []);
      } catch {
        return emptyResult('unavailable');
      }
      if (!validVector(vector)) return emptyResult('unavailable');
      if (input && 'inputId' in body) await this.inputVector(scope, principal, body.inputId);
      const limit = body.limit ?? 10;
      return withScope(this.pool, scope, async (_tx, client) => {
        if (input && 'inputId' in body) {
          const allowed = await visualLocations(client, input.locations);
          if (this.inputs.get(body.inputId) !== input || !sameLocations(input.locations, allowed)) {
            this.remove(body.inputId);
            throw notFound();
          }
        }
        const current = await visualLocations(client, admitted);
        const coverage = await visualCoverage(client, provider.generation, current);
        const matches = await visualMatches(
          client,
          provider.generation,
          current,
          vector,
          input ? PHOTO_MIN_SCORE : TEXT_MIN_SCORE,
          Math.max(limit, 2),
        );
        return this.result(coverage, matches, limit);
      });
    } finally {
      release();
    }
  }

  private result(
    coverage: VisualSearchResult['coverage'],
    matches: VisualSearchResult['matches'],
    limit: number,
  ): VisualSearchResult {
    const [first, second] = matches;
    const ambiguous =
      first &&
      second &&
      first.score - second.score < AMBIGUITY_MARGIN &&
      first.path.map(({ id }) => id).join('/') !== second.path.map(({ id }) => id).join('/');
    const outcome = ambiguous
      ? 'ambiguous'
      : first
        ? 'matches'
        : coverage.pending + coverage.failed + coverage.paused > 0
          ? 'partial_coverage'
          : 'no_close_match';
    return { outcome, coverage, matches: matches.slice(0, limit) };
  }
}
