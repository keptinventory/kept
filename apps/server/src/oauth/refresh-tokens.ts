import type pg from 'pg';

// Better Auth's refresh tokens for MCP connectors (#411), ended where Kept ends sessions. A leaf
// module on purpose: auth/auth.ts and auth/security.ts import it, so it imports nothing of Kept's.

/** Ends every refresh token `userId` holds. One rule: whatever signs out the person's other
 * devices ends them too (a password reset or change, a second-factor or passkey change, unlinking
 * an outside sign-in, an email change, "Sign out of all other devices", signing out everywhere,
 * disabling the account). Kept's grant rows stay, so a connector signs in again rather than being
 * removed from Connections. One exception: asking to delete the account signs out the other
 * devices but keeps these. The database pauses connectors while the account waits (migration
 * 0114), and keeping the account gives them back with no new sign-in. */
export async function endRefreshTokens(db: pg.ClientBase | pg.Pool, userId: string): Promise<void> {
  await db.query('DELETE FROM auth.oauth_refresh_token WHERE user_id = $1', [userId]);
}
