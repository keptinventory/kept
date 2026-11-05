import type pg from 'pg';
import type { Sealed } from '../crypto/envelope.js';
import type { SecretKeys } from '../crypto/keyring.js';
import { withSystem } from '../db/scope.js';
import { openPaperlessConfig, type PaperlessConfig } from './config.js';

/**
 * A location's Paperless connection with its token, opened. kept_app never reads the token, so
 * this reads as kept_system: the caller has passed kept_app's own checks first. `keys` is asked
 * only when there is a connection to open. The token stays in memory; nothing here logs it.
 */
export async function openConnection(
  system: pg.Pool,
  keys: () => SecretKeys,
  locationId: string,
): Promise<{ id: string; config: PaperlessConfig } | null> {
  const row = await withSystem(system, async (_tx, c) => {
    const { rows } = await c.query<{ id: string; config_ciphertext: Sealed }>(
      'SELECT id, config_ciphertext FROM kept.paperless_config($1)',
      [locationId],
    );
    return rows[0] ?? null;
  });
  if (!row) return null;
  return {
    id: row.id,
    config: openPaperlessConfig(keys().get().keyring, row.id, row.config_ciphertext),
  };
}
