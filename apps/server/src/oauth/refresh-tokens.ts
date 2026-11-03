import type pg from 'pg';

// Better Auth's refresh tokens for MCP connectors (#411), ended where Kept ends sessions. A leaf
// module on purpose: auth/auth.ts and auth/security.ts import it, so it imports nothing of Kept's.

/** Ends every refresh token `userId` holds: a password reset or change, a two-factor reset and
 * signing out everywhere end them with the sessions. Kept's grant rows stay, so a connector
 * signs in again rather than being removed from Connections. */
export async function endRefreshTokens(db: pg.ClientBase | pg.Pool, userId: string): Promise<void> {
  await db.query('DELETE FROM auth.oauth_refresh_token WHERE user_id = $1', [userId]);
}
