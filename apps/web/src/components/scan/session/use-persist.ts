/**
 * Where this phone keeps a scan session in progress: the person's offline database where it is
 * open (./persist.ts `dexiePersist`), else the page's memory (a browser without IndexedDB, the
 * component tests).
 */
import { useMemo } from 'react';
import type { KeptDb } from '@/offline/db';
import type { ScanStore } from '../resolve';
import { dexiePersist, memoryPersist, type SessionPersist } from './persist';

let page: SessionPersist | null = null;

export function useSessionPersist(store: ScanStore | null): SessionPersist {
  return useMemo(() => {
    // The Dexie store, without importing it (it is loaded on demand, with Dexie).
    const db = (store as { db?: KeptDb } | null)?.db;
    if (db && 'scanReads' in db) return dexiePersist(db);
    page ??= memoryPersist();
    return page;
  }, [store]);
}
