// The URL filter keys a list owns, apart from the list: its route's `listSearch` reads them
// in the route's definition, which is in the entry chunk, while the list loads on demand.

/** The share links list's filters. */
export const SHARE_LINK_FILTERS = ['state', 'scope'] as const;

/** The public page's list's filters. */
export const SHARED_FILTERS = ['type', 'condition'] as const;
