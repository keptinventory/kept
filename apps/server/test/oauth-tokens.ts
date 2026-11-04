import type { TestDb } from './db.js';
import { asOwner } from './tenancy.js';

// Refresh tokens as Better Auth stores them for an MCP connector (#411), written straight to the
// database so a test of a sign-out path needn't run the whole OAuth flow (oauth.test.ts does).

const CLIENT_ID = 'https://connector.example/oauth/seeded-client.json';

/** One refresh token for `userId`, for a connector registered here once. */
export async function seedRefreshToken(db: TestDb, userId: string): Promise<void> {
  await asOwner(db, async (c) => {
    await c.query(
      `INSERT INTO auth.oauth_client (client_id, redirect_uris)
       VALUES ($1, ARRAY['https://connector.example/callback']) ON CONFLICT (client_id) DO NOTHING`,
      [CLIENT_ID],
    );
    await c.query(
      `INSERT INTO auth.oauth_refresh_token (token, client_id, user_id, expires_at, created_at, scopes)
       VALUES (md5(random()::text), $1, $2, now() + interval '30 days', now(),
               ARRAY['kept:read', 'offline_access'])`,
      [CLIENT_ID, userId],
    );
  });
}

/** How many refresh tokens `userId` has. */
export async function refreshTokenCount(db: TestDb, userId: string): Promise<number> {
  const { rows } = await asOwner(db, (c) =>
    c.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM auth.oauth_refresh_token WHERE user_id = $1',
      [userId],
    ),
  );
  return rows[0]?.n ?? 0;
}
