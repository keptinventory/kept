/**
 * Which sidebar groups are folded (Tracking, Tools), remembered per device. Unfolded by default,
 * and when storage is unavailable (private mode, blocked storage): the choice then lasts for the
 * page only.
 */
import { useSyncExternalStore } from 'react';

export type FoldableGroup = 'tracking' | 'tools';
export const NAV_FOLDS_KEY = 'kept.sidebar.folded';
const GROUPS: readonly FoldableGroup[] = ['tracking', 'tools'];

function read(): FoldableGroup[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(NAV_FOLDS_KEY) ?? '[]');
    return Array.isArray(parsed) ? GROUPS.filter((g) => parsed.includes(g)) : [];
  } catch {
    return [];
  }
}

function write(folded: readonly FoldableGroup[]): void {
  try {
    if (folded.length) localStorage.setItem(NAV_FOLDS_KEY, JSON.stringify(folded));
    else localStorage.removeItem(NAV_FOLDS_KEY);
  } catch {
    // No storage: folded for this page only.
  }
}

let folded: readonly FoldableGroup[] | null = null;
const listeners = new Set<() => void>();
const current = () => {
  folded ??= read();
  return folded;
};

export function toggleNavFold(group: FoldableGroup): void {
  const now = current();
  folded = now.includes(group) ? now.filter((g) => g !== group) : [...now, group];
  write(folded);
  for (const l of listeners) l();
}

/** Reads the stored folds again on next use (tests). */
export function resetNavFolds(): void {
  folded = null;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useNavFolds(): readonly FoldableGroup[] {
  return useSyncExternalStore(subscribe, current, current);
}
