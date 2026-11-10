/**
 * Every step-6 Connections path the web app calls, from the server's route tables: tokens
 * and recent changes (`apps/server/src/tokens/routes.ts`), OAuth consent (`oauth/routes.ts`),
 * linking Home Assistant (`homeassistant/routes.ts`) and location webhooks (`webhooks/routes.ts`). A path the server names
 * differently is fixed here and nowhere else. T26's contract check reads `CONNECTIONS_METHODS`
 * against the server's openapi.json.
 */

const V1 = '/api/v1';
const seg = (value: string) => encodeURIComponent(value);

export const connectionsPaths = {
  // ----- tokens and connected apps; an OAuth app is a token of kind `oauth` -----------
  tokens: `${V1}/tokens`,
  token: (id: string) => `${V1}/tokens/${seg(id)}`,
  changes: `${V1}/connections/changes`,

  // ----- OAuth consent: the plugin's query string is passed through as is -----------
  oauthConsent: `${V1}/oauth/consent`,

  // ----- linking Home Assistant (#376): the person's side only -----------
  homeAssistantLinks: `${V1}/home-assistant/link-requests`,
  homeAssistantApprove: (id: string) => `${V1}/home-assistant/link-requests/${seg(id)}/approve`,
  homeAssistantDecline: (id: string) => `${V1}/home-assistant/link-requests/${seg(id)}/decline`,

  // ----- location webhooks -----------
  locationWebhooks: (locationId: string) => `${V1}/locations/${seg(locationId)}/webhooks`,
  webhook: (id: string) => `${V1}/webhooks/${seg(id)}`,
  webhookRotateSecret: (id: string) => `${V1}/webhooks/${seg(id)}/rotate-secret`,
  webhookTest: (id: string) => `${V1}/webhooks/${seg(id)}/test`,
  webhookDeliveries: (id: string) => `${V1}/webhooks/${seg(id)}/deliveries`,
};

export const CONNECTIONS_METHODS: Record<keyof typeof connectionsPaths, readonly string[]> = {
  tokens: ['GET', 'POST'],
  token: ['PATCH', 'DELETE'],
  changes: ['GET'],
  oauthConsent: ['GET', 'POST'],
  homeAssistantLinks: ['GET'],
  homeAssistantApprove: ['POST'],
  homeAssistantDecline: ['POST'],
  locationWebhooks: ['GET', 'POST'],
  webhook: ['PATCH', 'DELETE'],
  webhookRotateSecret: ['POST'],
  webhookTest: ['POST'],
  webhookDeliveries: ['GET'],
};
