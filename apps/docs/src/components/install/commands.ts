/**
 * The install page's commands and the lines Kept prints back (#492), shared by every language's
 * page: a command is the same in every language, and one copy can't fall a release behind.
 *
 * Each command is copied from the page that explains it (install/compose.md, the chart's
 * README, admin/upgrades.md, CONTRIBUTING.md, install/proxmox.md and deploy/proxmox/kept.sh's
 * header); each printed line from the code that prints it
 * (the server's `kept init` and recovery kit, the chart's NOTES.txt, the Home Assistant app's
 * start, the Unraid image's start). install.test.ts checks every one against its source.
 *
 * The release is the one compose.yaml runs by default, which the release script sets with each
 * release, so the download address and the chart's version move with it.
 */
import compose from '../../../../../compose.yaml?raw';

const pinned = /image: \$\{KEPT_IMAGE:-ghcr\.io\/keptinventory\/kept:(\d+\.\d+\.\d+)\}/.exec(
  compose,
);
if (!pinned?.[1]) throw new Error('compose.yaml names no release image');

/** The release compose.yaml runs, such as `1.14.6`. */
export const RELEASE: string = pinned[1];

/** The address `init` is given in the docs' examples. */
const EXAMPLE_ADDRESS = 'http://kept.home.arpa:8080';

export const commands = {
  compose: {
    download: [
      'mkdir kept && cd kept',
      `curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v${RELEASE}/compose.yaml`,
    ].join('\n'),
    init: 'docker compose run --rm init',
    start: 'docker compose up -d',
    recoveryKit: 'docker compose exec kept kept admin recovery-kit',
    update: ['docker compose pull', 'docker compose up -d'].join('\n'),
  },
  source: {
    clone: 'git clone https://github.com/keptinventory/kept.git && cd kept',
    build: 'docker build -t kept:local .',
    init: ['echo KEPT_IMAGE=kept:local >> .env', 'docker compose run --rm init'].join('\n'),
    update: ['git pull', 'docker build -t kept:local .', 'docker compose up -d'].join('\n'),
  },
  proxmox: {
    install: `bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v${RELEASE}/deploy/proxmox/kept.sh)"`,
    creds: 'pct exec <CTID> -- cat /root/kept.creds',
    recoveryKit: 'pct exec <CTID> -- kept admin recovery-kit',
    update: 'update',
  },
  kubernetes: {
    secrets: [
      'kubectl create namespace kept',
      'pw() { openssl rand -hex 32; }',
      '# The four database logins (always).',
      'kubectl -n kept create secret generic kept-db \\',
      '  --from-literal=KEPT_DB_OWNER_PASSWORD="$(pw)" --from-literal=KEPT_DB_APP_PASSWORD="$(pw)" \\',
      '  --from-literal=KEPT_DB_AUTH_PASSWORD="$(pw)" --from-literal=KEPT_DB_SYSTEM_PASSWORD="$(pw)"',
      "# The bundled Postgres's superuser (or, for external Postgres with roles.create, the server admin's password).",
      'kubectl -n kept create secret generic kept-postgres --from-literal=POSTGRES_PASSWORD="$(pw)"',
    ].join('\n'),
    install: [
      `helm install kept oci://ghcr.io/keptinventory/charts/kept --version ${RELEASE} -n kept \\`,
      '  --set publicUrl=https://kept.example.org \\',
      '  --set roles.existingSecret=kept-db --set postgres.superuserSecret=kept-postgres',
    ].join('\n'),
    setupCode: "kubectl -n kept logs deploy/kept | grep 'KEPT SETUP CODE'",
    recoveryKit:
      'kubectl -n kept exec deploy/kept -- kept admin recovery-kit > kept-recovery-kit.txt',
    test: 'helm test kept -n kept',
  },
  unraid: {
    // Typed in the container's Console (Docker tab), as install/unraid.md says.
    recoveryKit: 'kept admin recovery-kit',
  },
} as const;

/** What Kept prints, as it prints it; `XXX-XXX` stands for the code. */
export const printed = {
  init: [
    'Wrote .env.',
    '',
    'KEPT SETUP CODE: XXX-XXX',
    '',
    `Next: docker compose up -d, then open ${EXAMPLE_ADDRESS} and enter the setup code.`,
  ].join('\n'),
  initAgain:
    'A .env is here already. Update its address and setup code, and keep everything else? [Y/n]',
  initUpdated: ['Updated .env.', '', 'KEPT SETUP CODE: XXX-XXX'].join('\n'),
  setupCode: 'KEPT SETUP CODE: XXX-XXX',
  recoveryKit: 'KEPT RECOVERY KIT',
  helmInstalled: `Kept ${RELEASE} is installed as "kept" in namespace "kept".`,
  proxmox: 'Kept is running',
  homeAssistant: `Kept is at http://homeassistant.local:8080 (change it in Configuration: "Kept's address")`,
  unraid: 'app: Kept is at http://tower.local:8080',
} as const;
