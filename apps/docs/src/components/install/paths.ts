/**
 * The install page's paths (#492): the ways to run Kept that the page walks through, in the
 * picker's order, grouped as the picker shows them. A path is a section of the page
 * (InstallPath.astro) whose id is the path's id, so `/install/#kubernetes` opens Kubernetes.
 *
 * To add a path (an app store, once its listing exists): its id here, its name and hint in
 * words.ts (`install.paths`), and an `<InstallPath id="…">` on every language's page. The tests
 * check all three.
 */

export type PathGroup = 'terminal' | 'oneClick';

export const INSTALL_PATHS = [
  { id: 'compose', group: 'terminal' },
  { id: 'kubernetes', group: 'terminal' },
  { id: 'source', group: 'terminal' },
  { id: 'proxmox', group: 'terminal' },
  { id: 'home-assistant', group: 'oneClick' },
  { id: 'unraid', group: 'oneClick' },
] as const satisfies readonly { id: string; group: PathGroup }[];

export type PathId = (typeof INSTALL_PATHS)[number]['id'];

export const PATH_IDS: readonly PathId[] = INSTALL_PATHS.map((path) => path.id);

/** The groups, in the picker's order. */
export const GROUPS: readonly PathGroup[] = ['terminal', 'oneClick'];

/** The path shown when the address names none. */
export const DEFAULT_PATH: PathId = 'compose';

export function isPathId(value: string): value is PathId {
  return (PATH_IDS as readonly string[]).includes(value);
}

/**
 * The path an address's hash opens: the path itself (`#kubernetes`), or the path whose section
 * holds the element the hash names (a link into a step), found by `owner`. Null for an empty
 * hash or one that names nothing inside a path, such as a heading further down the page.
 */
export function pathFromHash(
  hash: string,
  owner: (id: string) => string | null | undefined = () => null,
): PathId | null {
  let id = hash.replace(/^#/, '');
  if (!id) return null;
  try {
    id = decodeURIComponent(id);
  } catch {
    return null;
  }
  if (isPathId(id)) return id;
  const found = owner(id);
  return found && isPathId(found) ? found : null;
}

/** The hash a path is linked by. */
export function hashOf(id: PathId): string {
  return `#${id}`;
}
