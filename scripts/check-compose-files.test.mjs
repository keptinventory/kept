import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { problems, sections } from './check-compose-files.mjs';

// A small pair shaped like the real files: compose.yaml is Kept only, compose.full.yaml is the
// same plus Caddy, Ollama and their volumes.
const kept = `# Kept only.
name: kept

x-kept-image: &kept-image
  image: \${KEPT_IMAGE:-ghcr.io/keptinventory/kept:1.14.4}
  read_only: true

services:
  db:
    image: pgvector/pgvector:0.8.6-pg18-bookworm
    networks: [kept]

  kept:
    <<: *kept-image
    environment:
      # A proxy of your own, from .env.
      KEPT_TRUSTED_PROXIES: \${KEPT_TRUSTED_PROXIES:-}
      KEPT_LOG_LEVEL: info
    networks: [kept]

networks:
  kept:
    ipam:
      config:
        - subnet: 172.29.72.0/24
          ip_range: 172.29.72.0/25

volumes:
  kept-db: {}
`;

const caddy = `  caddy:
    profiles: [https]
    image: caddy:2.11.4-alpine
    volumes:
      - caddy-data:/data
    networks:
      kept:
        ipv4_address: 172.29.72.200

  ollama:
    profiles: [ollama]
    image: ollama/ollama:0.35.1
    volumes:
      - ollama:/root/.ollama
`;

/** compose.full.yaml from the pair: other comments, Caddy and Ollama after kept, their volumes. */
const fullOf = (k) =>
  k
    .replace('# Kept only.', '# Kept with the extras: Caddy and Ollama.')
    .replace('# A proxy of your own, from .env.', '# Caddy, unless .env names another.')
    .replace('${KEPT_TRUSTED_PROXIES:-}', '${KEPT_TRUSTED_PROXIES:-172.29.72.200}')
    .replace('\nnetworks:', `\n${caddy}\nnetworks:`)
    .replace(
      '  kept-db: {}\n',
      '  kept-db: {}\n  caddy-data: {}\n  caddy-config: {}\n  ollama: {}\n',
    );
const full = fullOf(kept);

describe('compose.yaml and compose.full.yaml in step', () => {
  it('reads the top-level keys and the entries of services, networks and volumes', () => {
    const s = sections(full);
    expect([...s.keys()]).toEqual(['name', 'x-kept-image', 'services', 'networks', 'volumes']);
    expect([...s.get('services').keys()]).toEqual(['db', 'kept', 'caddy', 'ollama']);
    expect([...s.get('volumes').keys()]).toEqual([
      'kept-db',
      'caddy-data',
      'caddy-config',
      'ollama',
    ]);
    expect(s.get('name')).toBe('name: kept');
  });

  it('passes when the full file is compose.yaml plus Caddy, Ollama and their volumes', () => {
    expect(problems({ kept, full })).toEqual([]);
  });

  it('comments and blank lines may differ', () => {
    const other = full
      .replace('      # Caddy, unless', '      # Caddy (below) is believed.\n      # x')
      .replace('  kept:\n    <<:', '\n  kept:\n    <<:');
    expect(problems({ kept, full: other })).toEqual([]);
  });

  it('a setting changed in a shared service', () => {
    const other = full.replace('KEPT_LOG_LEVEL: info', 'KEPT_LOG_LEVEL: debug');
    expect(problems({ kept, full: other })).toEqual([
      'services.kept: differs between compose.yaml and compose.full.yaml',
    ]);
  });

  it("the trusted proxy's default is the one line that may differ: Caddy's address in the full file", () => {
    expect(full).toContain('KEPT_TRUSTED_PROXIES: ${KEPT_TRUSTED_PROXIES:-172.29.72.200}');
    expect(problems({ kept, full })).toEqual([]);
    const other = full.replace(':-172.29.72.200}', ':-10.0.0.5}');
    expect(problems({ kept, full: other })).toEqual([
      'services.kept: differs between compose.yaml and compose.full.yaml',
    ]);
  });

  it("the network's IPAM changed (Compose would ask to remove the network)", () => {
    const other = full.replace('ip_range: 172.29.72.0/25', 'ip_range: 172.29.72.0/26');
    expect(problems({ kept, full: other })).toEqual([
      'networks.kept: differs between compose.yaml and compose.full.yaml',
    ]);
  });

  it('the image pin, the project name and a volume', () => {
    const other = full
      .replace('kept:1.14.4}', 'kept:1.14.3}')
      .replace('name: kept', 'name: kept-full')
      .replace('  kept-db: {}', '  kept-db:\n    external: true');
    expect(problems({ kept, full: other })).toEqual([
      'name: differs between compose.yaml and compose.full.yaml',
      'x-kept-image: differs between compose.yaml and compose.full.yaml',
      'volumes.kept-db: differs between compose.yaml and compose.full.yaml',
    ]);
  });

  it('something in compose.yaml that the full file lacks', () => {
    const other = full.replace(/ {2}db:\n(?: {4}.*\n)+\n/, '');
    expect(sections(other).get('services').has('db')).toBe(false);
    expect(problems({ kept, full: other })).toEqual([
      'services.db: in compose.yaml but not in compose.full.yaml',
    ]);
  });

  it('the full file adds only Caddy, Ollama and their volumes', () => {
    const other = full
      .replace('\nnetworks:', '\n  extra:\n    image: x\n\nnetworks:')
      .replace('name: kept\n', 'name: kept\n\nx-more: &more\n  a: 1\n');
    expect(problems({ kept, full: other })).toEqual([
      'x-more: only in compose.full.yaml (it adds only services caddy, ollama and volumes caddy-data, caddy-config, ollama)',
      'services.extra: only in compose.full.yaml (it adds only services caddy, ollama and volumes caddy-data, caddy-config, ollama)',
    ]);
  });

  it('compose.yaml is Kept only: Caddy or Ollama there is caught', () => {
    const other = kept.replace('\nnetworks:', `\n${caddy}\nnetworks:`);
    expect(problems({ kept: other, full })).toEqual([
      'services.caddy: in compose.yaml, which is Kept only (it belongs in compose.full.yaml)',
      'services.ollama: in compose.yaml, which is Kept only (it belongs in compose.full.yaml)',
    ]);
  });

  it('the full file must carry Caddy and Ollama', () => {
    const other = full.replace(caddy, '');
    expect(problems({ kept, full: other })).toEqual([
      'services.caddy: missing from compose.full.yaml',
      'services.ollama: missing from compose.full.yaml',
    ]);
  });

  it('passes on the repository itself', () => {
    const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const out = execFileSync('node', [path.join(repo, 'scripts/check-compose-files.mjs')], {
      cwd: repo,
      encoding: 'utf8',
    });
    expect(out).toContain('compose.full.yaml');
  });
});
