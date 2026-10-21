// The URL filter keys a list owns, apart from the list: its route's `listSearch` reads them
// in the route's definition, which is in the entry chunk, while the list loads on demand.

/** The webhooks list's filters. */
export const WEBHOOK_FILTERS = ['state'] as const;
