#!/usr/bin/env node
// compose.yaml is Kept alone; compose.full.yaml is the same file plus Caddy (profile https),
// Ollama (profile ollama) and their volumes, kept whole so Portainer and Dockge can paste it.
// Fails when the two drift: every top-level key of compose.yaml (the project name, the x- anchors)
// and every service, network and volume in it must be in compose.full.yaml line for line, and the
// full file may add only what ADDED_IN_FULL lists. An install that switches files then keeps its
// containers, network and volumes: a changed network IPAM, say, makes Compose ask to remove the
// network.
//
// Compared as text, not parsed YAML: an entry is its lines as written, minus whole-line comments
// and blank lines, so the two files may word their comments differently and nothing else.
//
// Usage: node scripts/check-compose-files.mjs   (part of `pnpm lint`)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** What compose.full.yaml adds to compose.yaml, and compose.yaml must not hold. */
export const ADDED_IN_FULL = {
  services: ['caddy', 'ollama'],
  volumes: ['caddy-data', 'caddy-config', 'ollama'],
};

/** Top-level keys whose entries are compared one by one. */
const COLLECTIONS = new Set(['services', 'networks', 'volumes']);

const KEY = /^([A-Za-z0-9_.-]+):(.*)$/;

/** Splits lines into blocks, each starting at a line `indent` deep that is a `key:`. */
function blocks(lines, indent) {
  const out = new Map();
  let current = null;
  for (const line of lines) {
    const head = line.slice(0, indent);
    const m = head.trim() === '' && line[indent] !== ' ' ? KEY.exec(line.slice(indent)) : null;
    if (m) {
      current = [line];
      out.set(m[1], current);
    } else if (current) {
      current.push(line);
    }
  }
  return out;
}

/** A compose file as text, by top-level key: a string for a plain key (`name`, an x- anchor),
 * a Map of entry name → text for services, networks and volumes. */
export function sections(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '' && !/^\s*#/.test(l));
  const out = new Map();
  for (const [key, block] of blocks(lines, 0)) {
    const inline = KEY.exec(block[0])?.[2].trim() ?? '';
    if (COLLECTIONS.has(key) && inline === '') {
      out.set(key, new Map([...blocks(block.slice(1), 2)].map(([k, b]) => [k, b.join('\n')])));
    } else {
      out.set(key, block.join('\n'));
    }
  }
  return out;
}

/** Every problem, as one line each; empty when all is well. */
export function problems({ kept, full, added = ADDED_IN_FULL }) {
  const a = sections(kept);
  const b = sections(full);
  const isAdded = (key, name) => (added[key] ?? []).includes(name);
  const adds = Object.entries(added)
    .map(([key, names]) => `${key} ${names.join(', ')}`)
    .join(' and ');
  const out = [];
  for (const [key, value] of a) {
    const other = b.get(key);
    if (typeof value === 'string') {
      if (other === undefined) out.push(`${key}: in compose.yaml but not in compose.full.yaml`);
      else if (other !== value)
        out.push(`${key}: differs between compose.yaml and compose.full.yaml`);
      continue;
    }
    for (const [name, text] of value) {
      const where = `${key}.${name}`;
      if (isAdded(key, name)) {
        out.push(`${where}: in compose.yaml, which is Kept only (it belongs in compose.full.yaml)`);
      } else if (!(other instanceof Map) || !other.has(name)) {
        out.push(`${where}: in compose.yaml but not in compose.full.yaml`);
      } else if (other.get(name) !== text) {
        out.push(`${where}: differs between compose.yaml and compose.full.yaml`);
      }
    }
  }
  for (const [key, value] of b) {
    const mine = a.get(key);
    if (value instanceof Map) {
      for (const name of value.keys())
        if (!(mine instanceof Map && mine.has(name)) && !isAdded(key, name))
          out.push(`${key}.${name}: only in compose.full.yaml (it adds only ${adds})`);
    } else if (mine === undefined) {
      out.push(`${key}: only in compose.full.yaml (it adds only ${adds})`);
    }
  }
  for (const [key, names] of Object.entries(added)) {
    const entries = b.get(key);
    for (const name of names)
      if (!(entries instanceof Map) || !entries.has(name))
        out.push(`${key}.${name}: missing from compose.full.yaml`);
  }
  return [...new Set(out)];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const read = (p) => readFileSync(path.join(repo, p), 'utf8');
  const found = problems({ kept: read('compose.yaml'), full: read('compose.full.yaml') });
  if (found.length > 0) {
    console.error(
      'compose.yaml and compose.full.yaml out of step (scripts/check-compose-files.mjs):',
    );
    for (const p of found) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log('check-compose-files: compose.full.yaml is compose.yaml plus Caddy and Ollama');
}
