// The URL filter keys a list owns, apart from the list: its route's `listSearch` reads them
// in the route's definition, which is in the entry chunk, while the list loads on demand.

/** The connections list's filters. */
export const CONNECTION_FILTERS = ['location', 'kind', 'state'] as const;
