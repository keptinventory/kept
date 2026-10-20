/**
 * A scan session kept on the phone as it happens (#168), so a reload, a crash or closing the app
 * loses nothing: "Resume session" on Scan picks it up. One session per phone at a time.
 *
 * In the person's offline database (offline/db.ts v5): the session without its reads in
 * `scanSessions`, and one row per code handled in `scanReads`, so a read writes a few bytes, not
 * the session's 5,000 lines. A 401 clears both with the rest of the cache (offline/wipe.ts); a
 * sign-out deletes the database. Where the browser has no IndexedDB, the page's memory holds it.
 */
import type { KeptDb, ScanReadRow } from '@/offline/db';
import type { Session, SessionRead } from './model';

export interface SessionPersist {
  /** The session on this phone, or null. */
  load(): Promise<Session | null>;
  /** Writes what changed from `prev` to `next` (`prev` null: a new session, replacing any). */
  save(prev: Session | null, next: Session): Promise<void>;
  clear(id: string): Promise<void>;
}

type Head = Omit<Session, 'reads' | 'keys'>;
const headOf = ({ reads: _r, keys: _k, ...head }: Session): Head => head;

const sameHead = (a: Session, b: Session) =>
  a.id === b.id &&
  a.paused === b.paused &&
  a.contents === b.contents &&
  a.current === b.current &&
  a.targets === b.targets &&
  a.expected === b.expected &&
  a.saving === b.saving &&
  // A count's choices on its summary (#172): "I checked it", found counts, the shared count.
  a.areas === b.areas &&
  a.checked === b.checked &&
  a.qty === b.qty &&
  a.shared === b.shared;

/** What `save` has to write: keys added, keys gone, reads replaced under the same key. */
function changes(prev: Session, next: Session) {
  const before = new Set(prev.keys);
  const after = new Set(next.keys);
  const readOf = (s: Session, key: string) => s.reads.find((r) => r.key === key) ?? null;
  return {
    added: next.keys.filter((k) => !before.has(k)),
    gone: prev.keys.filter((k) => !after.has(k)),
    replaced: next.keys.filter((k) => before.has(k) && readOf(prev, k) !== readOf(next, k)),
    readOf: (key: string) => readOf(next, key),
  };
}

export function dexiePersist(db: KeptDb): SessionPersist {
  let seq: number | null = null;
  const nextSeq = async (sessionId: string) => {
    if (seq === null) {
      const rows = await db.scanReads.where('sessionId').equals(sessionId).toArray();
      seq = rows.reduce((m, r) => Math.max(m, r.seq), 0);
    }
    seq += 1;
    return seq;
  };
  return {
    async load() {
      const [row] = await db.scanSessions.orderBy('id').reverse().limit(1).toArray();
      if (!row) return null;
      const rows = (await db.scanReads.where('sessionId').equals(row.id).toArray()).sort(
        (a, b) => a.seq - b.seq,
      );
      seq = rows.reduce((m, r) => Math.max(m, r.seq), 0);
      return {
        ...(row.session as Head),
        keys: rows.map((r) => r.key),
        reads: rows.flatMap((r) => (r.read ? [r.read as SessionRead] : [])),
      };
    },
    async save(prev, next) {
      await db.transaction('rw', db.scanSessions, db.scanReads, async () => {
        if (!prev || prev.id !== next.id) {
          await db.scanSessions.where('id').notEqual(next.id).delete();
          await db.scanReads.where('sessionId').notEqual(next.id).delete();
          await db.scanReads.where('sessionId').equals(next.id).delete();
          await db.scanSessions.put({ id: next.id, session: headOf(next), updatedAt: Date.now() });
          seq = 0;
          const rows: ScanReadRow[] = [];
          for (const key of next.keys) {
            rows.push({
              sessionId: next.id,
              key,
              seq: await nextSeq(next.id),
              read: next.reads.find((r) => r.key === key) ?? null,
            });
          }
          await db.scanReads.bulkPut(rows);
          return;
        }
        if (!sameHead(prev, next)) {
          await db.scanSessions.put({ id: next.id, session: headOf(next), updatedAt: Date.now() });
        }
        const c = changes(prev, next);
        if (c.gone.length > 0) {
          await db.scanReads.bulkDelete(c.gone.map((k) => [next.id, k] as [string, string]));
        }
        for (const key of c.replaced) {
          await db.scanReads.update([next.id, key], { read: c.readOf(key) });
        }
        const rows: ScanReadRow[] = [];
        for (const key of c.added) {
          rows.push({
            sessionId: next.id,
            key,
            seq: await nextSeq(next.id),
            read: c.readOf(key),
          });
        }
        if (rows.length > 0) await db.scanReads.bulkPut(rows);
      });
    },
    async clear(id) {
      await db.transaction('rw', db.scanSessions, db.scanReads, async () => {
        await db.scanSessions.delete(id);
        await db.scanReads.where('sessionId').equals(id).delete();
      });
      seq = null;
    },
  };
}

/** The page's memory: a browser without IndexedDB, and the component tests. */
export function memoryPersist(): SessionPersist {
  let held: Session | null = null;
  return {
    load: async () => held,
    save: async (_prev, next) => {
      held = next;
    },
    clear: async (id) => {
      if (held?.id === id) held = null;
    },
  };
}
