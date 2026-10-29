/** Carries an ingress request's origin (Home Assistant's, D273) from the request conversion
 * (auth/http.ts authHeaders) to Better Auth's trustedOrigins (auth/auth.ts). It is always removed
 * first and set only from `req.ingress` (http/ingress.ts), so a client can't supply it. */
export const INGRESS_ORIGIN_HEADER = 'x-kept-ingress-origin';
