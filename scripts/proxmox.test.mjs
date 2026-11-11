import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The Proxmox VE install (deploy/proxmox/): what its two scripts pin must match the rest of the
// repository, so a release can't ship an installer that points at another release, another key
// or another Node than the image's. scripts/smoke-proxmox.sh runs them.

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(repo, file), 'utf8');

const host = read('deploy/proxmox/kept.sh');
const inside = read('deploy/proxmox/kept-install.sh');
const dockerfile = read('Dockerfile');

const value = (text, name) => new RegExp(`^${name}=(\\S+)$`, 'm').exec(text)?.[1];
const releaseKey = (text) => /^RELEASE_KEY='([\s\S]*?)'$/m.exec(text)?.[1];

describe('the Proxmox scripts', () => {
  it('install the release compose.yaml runs, and the one-liners name it', () => {
    const release = /ghcr\.io\/keptinventory\/kept:(\d+\.\d+\.\d+)\}/.exec(
      read('compose.yaml'),
    )?.[1];
    expect(release).toMatch(/^\d+\.\d+\.\d+$/);
    expect(value(host, 'KEPT_VERSION')).toBe(release);
    expect(value(inside, 'KEPT_VERSION')).toBe(release);
    for (const url of host.matchAll(
      /keptinventory\/kept\/(?:releases\/download\/)?v(\d+\.\d+\.\d+)\//g,
    )) {
      expect(url[1]).toBe(release);
    }
  });

  it('carry the release key, cosign.pub', () => {
    const key = read('cosign.pub').trim();
    expect(releaseKey(host)).toBe(key);
    expect(releaseKey(inside)).toBe(key);
  });

  it('install the image’s Node and restic, with the image’s restic checksums', () => {
    const node = /^ARG NODE_IMAGE=node:(\d+\.\d+\.\d+)-/m.exec(dockerfile)?.[1];
    expect(value(inside, 'NODE_VERSION')).toBe(node);
    const restic = /restic\/releases\/download\/v(\d+\.\d+\.\d+)\//.exec(dockerfile)?.[1];
    expect(value(inside, 'RESTIC_VERSION')).toBe(restic);
    for (const arch of ['amd64', 'arm64']) {
      const sum = new RegExp(
        `ADD --checksum=sha256:([0-9a-f]{64}) \\\\\\n\\s+\\S+restic_\\S+_linux_${arch}\\.bz2`,
      ).exec(dockerfile)?.[1];
      expect(sum, arch).toMatch(/^[0-9a-f]{64}$/);
      expect(inside).toContain(`${arch}) echo ${sum} ;;`);
    }
  });

  it('trust PostgreSQL’s repository key the image trusts, and its server and pgvector versions', () => {
    const key =
      /ADD --checksum=sha256:([0-9a-f]{64}) \\\n\s+https:\/\/www\.postgresql\.org\/media\/keys\/ACCC4CF8\.asc/.exec(
        dockerfile,
      )?.[1];
    expect(value(inside, 'PGDG_KEY_SHA256')).toBe(key);
    // The same upstream versions as the Home Assistant image (bookworm's builds there, trixie's here).
    const upstream = (pkg, text) => new RegExp(`${pkg}=([0-9.]+-\\d+)\\.pgdg`).exec(text)?.[1];
    for (const pkg of ['postgresql-18', 'postgresql-18-pgvector']) {
      expect(upstream(pkg, inside), pkg).toBe(upstream(pkg, dockerfile));
    }
  });

  it('create only an unprivileged container with nesting, and change nothing else on the host', () => {
    expect(host).toContain('--unprivileged 1 --features nesting=1,keyctl=0');
    // No repositories, packages, settings or timers on the host.
    for (const banned of ['apt-get', 'apt ', 'sysctl', 'systemctl', 'crontab', '/etc/apt']) {
      expect(host, banned).not.toContain(banned);
    }
  });

  it('never put a middle dot in what they print', () => {
    expect(host).not.toContain('·');
    expect(inside).not.toContain('·');
  });
});
