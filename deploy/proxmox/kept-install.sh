#!/usr/bin/env bash
# Kept inside a Debian 13 container, without Docker: Postgres 18 with pgvector, Node, restic and
# Kept's release tarball, run by systemd. deploy/proxmox/kept.sh pushes this file into the new
# container and runs `kept-install.sh install`; it then stays installed for updates.
#
#   kept-install.sh install            install this release (what kept.sh runs)
#   update [<version>] [--yes]         installed as /usr/bin/update: the newest release, or <version>
#   kept-install.sh bootstrap          kept-bootstrap.service: the database and its four logins
#   kept-install.sh migrate            kept.service, before Kept starts: `kept migrate`
#   kept-install.sh cli <args>         installed as /usr/local/bin/kept: Kept's command line
#
# Where things live:
#   /opt/kept/releases/<version>   each release's files (root's, read-only to Kept)
#   /opt/kept/current              a link to the running release; an update switches it
#   /opt/kept/node                 a link to Node, from nodejs.org
#   /etc/kept/kept.env             Kept's settings (root's; Kept reads it)
#   /etc/kept/config               Kept's keys and its database passwords (Kept's own)
#   /etc/kept/owner                the database owner's password (root's alone)
#   /var/lib/kept                  photos, documents and the rest of Kept's files
#   /root/kept.creds               the address, the setup code and where the keys are
#
# Every download is pinned: Node and restic by their SHA-256, the Postgres repository by its key's
# SHA-256, Postgres and pgvector by version, and Kept's tarball by SHA256SUMS, whose signature is
# checked with openssl against the release key below (cosign.pub in the repository). Nothing runs
# on a timer: an update happens when you run `update`.
#
# For tests and offline installs: KEPT_TARBALL=<file> with KEPT_TARBALL_SHA256=<its sha256> installs
# that tarball instead of downloading this release's, without a signature check.
set -Eeuo pipefail
umask 022

# This release. Bumped with compose.yaml's image at each release (scripts/proxmox.test.mjs checks).
KEPT_VERSION=1.14.7
REPO=keptinventory/kept

# The release key (cosign.pub at the repository's root; scripts/proxmox.test.mjs checks the copy).
RELEASE_KEY='-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENDxYgebb8wACsIpxmHVDuVfGcDyj
F3bCKVAFa00FNpUOkYKDvUQFLE9QLuo7tB02ihcrDaYYYvaUViVZekA9AQ==
-----END PUBLIC KEY-----'

# Node: the image's version (Dockerfile's NODE_IMAGE), the SHA-256s from nodejs.org's
# https://nodejs.org/dist/v24.21.0/SHASUMS256.txt.
NODE_VERSION=24.21.0
node_sha256() {
  case "$1" in
    x64) echo 6e1db87ef58b8819e5d5402eff1536491b18edd8eb7bee5ef7897876e88dc5ff ;;
    arm64) echo 724282c3b43aec998aa9527380465b45d229e021b58035f5f4f63095eabfe5d5 ;;
  esac
}

# restic: the image's version and checksums (Dockerfile, from the release's SHA256SUMS).
RESTIC_VERSION=0.19.1
restic_sha256() {
  case "$1" in
    amd64) echo f415415624dcc452f2a02b8c33641791a8c6d6d3b65bbb3543fcf9a25151585c ;;
    arm64) echo a5f64aaab53d51e311fa3829124c5b703f2d14cf187d8640b6be3b2b49376465 ;;
  esac
}

# PostgreSQL's repository (PGDG): its key by the SHA-256 the Dockerfile pins (fingerprint
# B97B 0AFC AA1A 47F0 44F2 44A0 7FCC 7D46 ACCC 4CF8), and the versions in trixie-pgdg's index for
# amd64 and arm64 (apt.postgresql.org, read 2026-11-11). An update installs newer pins, never older.
PGDG_KEY_SHA256=0144068502a1eddd2a0280ede10ef607d1ec592ce819940991203941564e8e76
PG_PACKAGES=(
  postgresql-common=293.pgdg13+1
  postgresql-client-18=18.6-1.pgdg13+2
  postgresql-18=18.6-1.pgdg13+2
  postgresql-18-pgvector=0.8.7-1.pgdg13+1
)

PREFIX=/opt/kept
ETC=/etc/kept
ENV_FILE=$ETC/kept.env
CONFIG=$ETC/config
OWNER=$ETC/owner
DATA=/var/lib/kept
LIB=/usr/local/lib/kept
SOCKET=/var/run/postgresql
PG_CLUSTER=main
CREDS=/root/kept.creds

say() { printf '\033[1m%s\033[0m\n' "$*"; }
note() { printf '  %s\n' "$*"; }
die() {
  printf '\033[31mkept: %s\033[0m\n' "$*" >&2
  exit 1
}

need_root() { [[ $EUID -eq 0 ]] || die "run this as root"; }

# dpkg's name for this machine: amd64 or arm64.
deb_arch() {
  local a
  a=$(dpkg --print-architecture)
  [[ $a == amd64 || $a == arm64 ]] || die "Kept runs on amd64 or arm64, not $a"
  echo "$a"
}

# Node's and the tarball's name for it.
node_arch() { if [[ $(deb_arch) == amd64 ]]; then echo x64; else echo arm64; fi; }

sha256_ok() { [[ $(sha256sum "$1" | cut -d' ' -f1) == "$2" ]]; }

fetch() { # <url> <file>
  curl -fsSL --retry 3 --retry-delay 2 --proto '=https' -o "$2" "$1" || die "could not download $1"
}

# Versions compared as Debian does, with a prerelease (1.15.0-rc.1) before its release.
version_lt() {
  local t='~'
  dpkg --compare-versions "${1/-/$t}" lt "${2/-/$t}"
}

ask_yes() { # <question>: true for y or yes, from the terminal
  local answer
  [[ -r /dev/tty ]] || return 1
  read -r -p "$1 [y/N] " answer </dev/tty || return 1
  [[ ${answer,,} == y || ${answer,,} == yes ]]
}

# One value from an env file (the last line that sets it).
env_value() { sed -n "s/^$2=//p" "$1" 2>/dev/null | tail -n1; }

# ---------------------------------------------------------------------------------------------
# Signatures

# The bundle's signature (cosign sign-blob with the release key): a base64 DER ECDSA signature over
# the file, checked with openssl against RELEASE_KEY.
verify_signature() { # <file> <bundle>
  local json sig work
  json=$(tr -d ' \t\r\n' <"$2")
  json=${json#*\"messageSignature\":}
  json=${json#*\"signature\":\"}
  sig=${json%%\"*}
  [[ $sig =~ ^[A-Za-z0-9+/=]+$ ]] || die "$2 holds no signature"
  work=$(mktemp -d)
  printf '%s\n' "$RELEASE_KEY" >"$work/key.pem"
  printf '%s' "$sig" | openssl base64 -d -A >"$work/sig.der"
  if ! openssl dgst -sha256 -verify "$work/key.pem" -signature "$work/sig.der" "$1" >/dev/null 2>&1; then
    rm -rf "$work"
    die "the signature on $(basename "$1") does not verify with the release key: not installing it"
  fi
  rm -rf "$work"
}

# Downloads <version>'s SHA256SUMS and its signature into <dir> and checks the signature.
fetch_sums() { # <version> <dir>
  local base="https://github.com/$REPO/releases/download/v$1"
  fetch "$base/SHA256SUMS" "$2/SHA256SUMS"
  fetch "$base/SHA256SUMS.sigstore.json" "$2/SHA256SUMS.sigstore.json"
  verify_signature "$2/SHA256SUMS" "$2/SHA256SUMS.sigstore.json"
}

# Checks <dir>/<name> against <dir>/SHA256SUMS.
check_sum() { # <dir> <name>
  local want
  want=$(awk -v n="$2" '$2 == n { print $1 }' "$1/SHA256SUMS")
  [[ -n $want ]] || die "SHA256SUMS lists no $2"
  sha256_ok "$1/$2" "$want" || die "$2 does not match its SHA-256 in SHA256SUMS: not installing it"
}

# ---------------------------------------------------------------------------------------------
# The parts

apt_install() { DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "$@"; }

base_packages() {
  say "Debian packages"
  apt-get update -q
  # openssh-client is restic's SFTP transport; bzip2 unpacks restic; openssl checks signatures.
  apt_install ca-certificates curl openssl bzip2 openssh-client iproute2 >/dev/null
}

# Each pinned package that is missing or older than its pin; never a downgrade (apt upgrade may
# already have gone past a pin).
pg_packages() {
  local want=() p name ver have
  for p in "${PG_PACKAGES[@]}"; do
    name=${p%%=*} ver=${p#*=}
    have=$(dpkg-query -W -f '${Status} ${Version}' "$name" 2>/dev/null || true)
    if [[ $have != "install ok installed "* ]] || dpkg --compare-versions "${have##* }" lt "$ver"; then
      want+=("$p")
    fi
  done
  [[ ${#want[@]} -gt 0 ]] || return 0
  say "PostgreSQL 18 and pgvector"
  if [[ ! -f /usr/share/keyrings/pgdg.asc ]]; then
    local tmp
    tmp=$(mktemp)
    fetch https://www.postgresql.org/media/keys/ACCC4CF8.asc "$tmp"
    sha256_ok "$tmp" "$PGDG_KEY_SHA256" || die "PostgreSQL's repository key does not match its pinned SHA-256"
    install -m 0644 "$tmp" /usr/share/keyrings/pgdg.asc
    rm -f "$tmp"
  fi
  echo 'deb [signed-by=/usr/share/keyrings/pgdg.asc] https://apt.postgresql.org/pub/repos/apt trixie-pgdg main' \
    >/etc/apt/sources.list.d/pgdg.list
  apt-get update -q
  # Kept makes its own cluster below (UTF-8, whatever the container's locale), so the package
  # makes none.
  if [[ ! -f /etc/postgresql-common/createcluster.conf ]]; then
    apt_install "${PG_PACKAGES[0]}" >/dev/null
    sed -ri 's/^#?\s*create_main_cluster\s*=.*/create_main_cluster = false/' /etc/postgresql-common/createcluster.conf
  fi
  apt_install "${want[@]}" >/dev/null
  note "$(/usr/lib/postgresql/18/bin/postgres --version)"
}

pg_cluster() {
  if ! pg_lsclusters -h 2>/dev/null | awk '{ print $1 "/" $2 }' | grep -qx "18/$PG_CLUSTER"; then
    say "The database cluster"
    # C.UTF-8 is built into Debian's C library: no locale to generate, and the database is UTF-8
    # even when the container's own locale is unset.
    pg_createcluster --locale=C.UTF-8 --encoding=UTF8 18 "$PG_CLUSTER" -- \
      --auth-local=peer --auth-host=scram-sha-256 >/dev/null
  fi
  local conf=/etc/postgresql/18/$PG_CLUSTER
  # Only this container talks to it. Huge pages can't be had in a container: `try` falls back.
  cat >"$conf/conf.d/kept.conf" <<'EOF'
# Kept (deploy/proxmox/kept-install.sh): only this container connects.
listen_addresses = '127.0.0.1'
port = 5432
huge_pages = try
EOF
  # Root reaches the superuser over the socket (the bootstrap does), through this map only.
  if ! grep -q '^local all postgres peer map=kept' "$conf/pg_hba.conf"; then
    sed -i '1i local all postgres peer map=kept' "$conf/pg_hba.conf"
    printf 'kept root postgres\nkept postgres postgres\n' >>"$conf/pg_ident.conf"
  fi
  systemctl enable -q postgresql
  systemctl restart "postgresql@18-$PG_CLUSTER"
}

node_install() {
  local arch dir tmp
  arch=$(node_arch)
  dir=$PREFIX/node-v$NODE_VERSION-linux-$arch
  if [[ ! -x $dir/bin/node ]]; then
    say "Node $NODE_VERSION"
    tmp=$(mktemp -d)
    fetch "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-$arch.tar.gz" "$tmp/node.tar.gz"
    sha256_ok "$tmp/node.tar.gz" "$(node_sha256 "$arch")" || die "Node's tarball does not match its pinned SHA-256"
    mkdir -p "$PREFIX"
    tar -xzf "$tmp/node.tar.gz" -C "$tmp"
    rm -rf "$dir"
    mv "$tmp/node-v$NODE_VERSION-linux-$arch" "$dir"
    rm -rf "$tmp"
  fi
  ln -sfn "$dir" "$PREFIX/node.new" && mv -T "$PREFIX/node.new" "$PREFIX/node"
}

restic_install() {
  if [[ -x /usr/local/bin/restic ]] && /usr/local/bin/restic version 2>/dev/null | grep -q "restic $RESTIC_VERSION "; then
    return 0
  fi
  say "restic $RESTIC_VERSION"
  local arch tmp
  arch=$(deb_arch)
  tmp=$(mktemp -d)
  fetch "https://github.com/restic/restic/releases/download/v$RESTIC_VERSION/restic_${RESTIC_VERSION}_linux_$arch.bz2" "$tmp/restic.bz2"
  sha256_ok "$tmp/restic.bz2" "$(restic_sha256 "$arch")" || die "restic does not match its pinned SHA-256"
  bunzip2 "$tmp/restic.bz2"
  install -m 0755 "$tmp/restic" /usr/local/bin/restic
  rm -rf "$tmp"
}

user_and_folders() {
  # uid 10001, as in the image (above Debian's system range, so not --system).
  getent group kept >/dev/null || groupadd --gid 10001 kept
  getent passwd kept >/dev/null ||
    useradd --uid 10001 --gid 10001 --home-dir "$DATA" --no-create-home --shell /usr/sbin/nologin kept
  install -d -m 0755 "$PREFIX" "$PREFIX/releases" "$LIB"
  # /etc/kept: root's, Kept may read in it; its keys folder is Kept's own; the owner's password root's.
  install -d -m 0750 -o root -g kept "$ETC"
  install -d -m 0700 -o kept -g kept "$CONFIG" "$DATA"
  install -d -m 0700 -o root -g root "$OWNER"
  # The container's ID on its Proxmox host (kept.sh passes it), for the backup line `update` prints.
  [[ -z ${KEPT_CTID:-} ]] || echo "$KEPT_CTID" >"$ETC/proxmox-ctid"
}

# Downloads (or takes KEPT_TARBALL) and unpacks a release beside the others. Prints its folder.
unpack_release() { # <version>
  local version=$1 arch name tmp dir release_env
  arch=$(node_arch)
  tmp=$(mktemp -d)
  if [[ -n ${KEPT_TARBALL:-} ]]; then
    [[ -n ${KEPT_TARBALL_SHA256:-} ]] || die "KEPT_TARBALL needs KEPT_TARBALL_SHA256"
    sha256_ok "$KEPT_TARBALL" "$KEPT_TARBALL_SHA256" || die "$KEPT_TARBALL does not match KEPT_TARBALL_SHA256"
    echo "  (a local tarball: $KEPT_TARBALL, checked by its SHA-256 only)" >&2
    cp "$KEPT_TARBALL" "$tmp/kept.tar.gz"
  else
    name=kept-$version-linux-$arch.tar.gz
    fetch_sums "$version" "$tmp"
    fetch "https://github.com/$REPO/releases/download/v$version/$name" "$tmp/$name"
    check_sum "$tmp" "$name"
    mv "$tmp/$name" "$tmp/kept.tar.gz"
  fi
  release_env=$(tar -xzOf "$tmp/kept.tar.gz" kept/release.env) || die "the tarball holds no kept/release.env"
  version=$(sed -n 's/^KEPT_VERSION=//p' <<<"$release_env")
  [[ -n $version ]] || die "the tarball's release.env names no version"
  # The release names the Node it was built with; this script installs the same major.
  local built_with
  built_with=$(sed -n 's/^KEPT_NODE_VERSION=//p' <<<"$release_env")
  [[ -z $built_with || ${built_with%%.*} == "${NODE_VERSION%%.*}" ]] ||
    die "Kept $version was built with Node $built_with; this script installs Node $NODE_VERSION"
  dir=$PREFIX/releases/$version
  # Reinstalling the running version: the new copy goes beside it, under a new name.
  [[ ! -e $dir ]] || dir=$dir+$(date -u +%Y%m%d%H%M%S)
  mkdir -p "$dir.part"
  tar -xzf "$tmp/kept.tar.gz" -C "$dir.part" --strip-components=1 --no-same-owner
  mv "$dir.part" "$dir"
  rm -rf "$tmp"
  echo "$dir"
}

switch_to() { # <release folder>
  ln -sfn "$1" "$PREFIX/current.new"
  mv -T "$PREFIX/current.new" "$PREFIX/current"
}

# Kept's settings, written once; an update never rewrites them.
write_env() { # <public url>
  [[ -f $ENV_FILE ]] && return 0
  say "Kept's settings: $ENV_FILE"
  local tmp
  tmp=$(mktemp "$ETC/.kept.env.XXXXXX")
  cat >"$tmp" <<EOF
# Kept's settings for this install. Change one, then: systemctl restart kept
# Every setting: https://keptinventory.info/reference/configuration/
# The release's own (version, commit, source) come from /opt/kept/current/release.env.
NODE_ENV=production
KEPT_PORT=8080
KEPT_CONFIG_DIR=$CONFIG
KEPT_DATA_DIR=$DATA
KEPT_RESTIC_BIN=/usr/local/bin/restic
# The three runtime logins, over 127.0.0.1, their passwords from files kept-bootstrap made.
KEPT_DATABASE_URL=postgres://kept_app@127.0.0.1:5432/kept
KEPT_AUTH_DATABASE_URL=postgres://kept_auth@127.0.0.1:5432/kept
KEPT_SYSTEM_DATABASE_URL=postgres://kept_system@127.0.0.1:5432/kept
KEPT_DB_APP_PASSWORD_FILE=$CONFIG/database/kept_app
KEPT_DB_AUTH_PASSWORD_FILE=$CONFIG/database/kept_auth
KEPT_DB_SYSTEM_PASSWORD_FILE=$CONFIG/database/kept_system
KEPT_LOG_FORMAT=json
EOF
  # The address and the setup code, from Kept's own `kept init` (it checks the address and makes
  # the code), into a scratch folder: its .env is a Compose file, so only these two lines are kept.
  local scratch
  scratch=$(mktemp -d)
  "$PREFIX/node/bin/node" "$PREFIX/current/apps/server/dist/cli/index.js" init --url "$1" --dir "$scratch" \
    </dev/null >"$scratch/init.log" 2>&1 || {
    cat "$scratch/init.log" >&2
    rm -rf "$scratch" "$tmp"
    die "kept init refused the address $1"
  }
  {
    echo "# The address people open Kept at (labels carry it) and the first run's setup code."
    grep -E '^KEPT_(PUBLIC_URL|SETUP_CODE)=' "$scratch/.env"
  } >>"$tmp"
  rm -rf "$scratch"
  chown root:kept "$tmp"
  chmod 0640 "$tmp"
  mv "$tmp" "$ENV_FILE"
}

install_units() {
  install -m 0755 "$(readlink -f "${BASH_SOURCE[0]}")" "$LIB/kept-install.sh.new"
  mv "$LIB/kept-install.sh.new" "$LIB/kept-install.sh"
  printf '#!/bin/sh\n# Kept: update to the newest release, or to the one given.\nexec %s update "$@"\n' \
    "$LIB/kept-install.sh" >/usr/bin/update
  printf '#!/bin/sh\n# Kept'"'"'s command line, as Kept'"'"'s user, with this install'"'"'s settings.\nexec %s cli "$@"\n' \
    "$LIB/kept-install.sh" >/usr/local/bin/kept
  chmod 0755 /usr/bin/update /usr/local/bin/kept

  cat >/etc/systemd/system/kept-bootstrap.service <<EOF
# Kept's database, its four logins and its extensions (as Compose's bootstrap service), on every
# boot: what is missing is made, every login's password set to the one in its file.
[Unit]
Description=Kept: the database and its logins
After=postgresql@18-$PG_CLUSTER.service
Requires=postgresql@18-$PG_CLUSTER.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=$LIB/kept-install.sh bootstrap

[Install]
WantedBy=multi-user.target
EOF

  cat >/etc/systemd/system/kept.service <<EOF
# Kept. Its migrations run first (as root, which hands them the owner login; Kept itself never
# holds it), then the server on port 8080 as the user kept.
[Unit]
Description=Kept
After=network-online.target kept-bootstrap.service postgresql@18-$PG_CLUSTER.service
Wants=network-online.target
Requires=kept-bootstrap.service

[Service]
Type=simple
User=kept
Group=kept
WorkingDirectory=$DATA
Environment=HOME=$DATA
Environment=PATH=/usr/lib/postgresql/18/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStartPre=+$LIB/kept-install.sh migrate
ExecStart=$PREFIX/node/bin/node --env-file=$PREFIX/current/release.env --env-file=$ENV_FILE --import $PREFIX/current/apps/server/dist/observability/tracing.js $PREFIX/current/apps/server/dist/main.js
Restart=on-failure
RestartSec=5
TimeoutStartSec=15min
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
ReadWritePaths=$DATA $CONFIG

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable -q kept-bootstrap.service kept.service
}

# Kept's port, from its settings.
port() { local p; p=$(env_value "$ENV_FILE" KEPT_PORT); echo "${p:-8080}"; }

# Waits for /readyz (Kept serves and its database answers) and for /version to name <version>.
wait_healthy() { # <version> <seconds>
  local i got
  for ((i = 0; i < $2; i += 2)); do
    # Starting (the migrations) or running. Failed, stopped or waiting to restart after a crash
    # is an answer too.
    case $(systemctl show -p ActiveState --value kept.service)/$(systemctl show -p SubState --value kept.service) in
      */auto-restart) return 1 ;;
      active/* | activating/* | reloading/*) ;;
      *) return 1 ;;
    esac
    if curl -fsS -o /dev/null "http://127.0.0.1:$(port)/readyz" 2>/dev/null; then
      got=$(curl -fsS "http://127.0.0.1:$(port)/version" 2>/dev/null | sed -n 's/.*"version":"\([^"]*\)".*/\1/p')
      [[ $got == "$1" ]] && return 0
    fi
    sleep 2
  done
  return 1
}

# The release the current link names, from its release.env.
current_version() { env_value "$PREFIX/current/release.env" KEPT_VERSION; }

write_creds() {
  local url code
  url=$(env_value "$ENV_FILE" KEPT_PUBLIC_URL)
  code=$(env_value "$ENV_FILE" KEPT_SETUP_CODE)
  (
    umask 077
    cat >"$CREDS" <<EOF
Kept on this container

Address:     $url
Setup code:  $code   (asked for once, when the first account is made: it becomes the admin)

Kept's keys are in $CONFIG/secrets.json and its database passwords under $CONFIG/database
and $OWNER. The keys and your backups together are what brings Kept back: print the recovery
kit with \`kept admin recovery-kit\` and keep it somewhere other than this container.

Settings:  $ENV_FILE (then: systemctl restart kept)
Update:    update
Logs:      journalctl -u kept
EOF
  )
}

# ---------------------------------------------------------------------------------------------
# Commands

cmd_install() {
  need_root
  # shellcheck source=/dev/null
  . /etc/os-release
  [[ ${ID:-} == debian && ${VERSION_ID:-} == 13 ]] || die "this is for Debian 13; this container runs ${PRETTY_NAME:-something else}"
  [[ -d /run/systemd/system ]] || die "systemd isn't running here (in a Proxmox container, it needs nesting=1)"
  deb_arch >/dev/null
  export LANG=C.UTF-8

  base_packages
  pg_packages
  pg_cluster
  node_install
  restic_install
  user_and_folders

  say "Kept $KEPT_VERSION"
  local dir version url
  dir=$(unpack_release "$KEPT_VERSION")
  switch_to "$dir"
  version=$(current_version)
  note "$dir"
  # The container's address unless KEPT_URL names one (kept.sh passes the one it read).
  url=${KEPT_URL:-http://$(ip -4 -o addr show scope global | awk '{ split($4, a, "/"); print a[1]; exit }'):8080}
  write_env "$url"
  install_units

  say "Starting Kept"
  systemctl restart kept-bootstrap.service
  systemctl restart kept.service
  wait_healthy "$version" 300 || {
    journalctl -u kept-bootstrap -u kept -n 40 --no-pager >&2 || true
    die "Kept didn't answer on port $(port) within 5 minutes (journalctl -u kept)"
  }
  write_creds
  say "Kept $version is running at $(env_value "$ENV_FILE" KEPT_PUBLIC_URL)"
  note "Setup code: $(env_value "$ENV_FILE" KEPT_SETUP_CODE) (also in $CREDS)"
}

cmd_bootstrap() {
  need_root
  local psql=(psql -h "$SOCKET" -U postgres -v ON_ERROR_STOP=1 -qAt)
  for _ in $(seq 60); do
    pg_isready -q -h "$SOCKET" -U postgres && break
    sleep 1
  done
  [[ $("${psql[@]}" -d postgres -c "SELECT 1 FROM pg_database WHERE datname = 'kept'") == 1 ]] ||
    "${psql[@]}" -d postgres -c 'CREATE DATABASE kept' >/dev/null
  install -d -m 0700 -o root -g root "$OWNER"
  install -d -m 0700 -o kept -g kept "$CONFIG"
  env PGHOST="$SOCKET" PGUSER=postgres PGDATABASE=kept \
    KEPT_DB_OWNER_PASSWORD_FILE="$OWNER/kept_owner" \
    KEPT_DB_APP_PASSWORD_FILE="$CONFIG/database/kept_app" \
    KEPT_DB_AUTH_PASSWORD_FILE="$CONFIG/database/kept_auth" \
    KEPT_DB_SYSTEM_PASSWORD_FILE="$CONFIG/database/kept_system" \
    "$PREFIX/node/bin/node" "$PREFIX/current/apps/server/dist/cli/index.js" bootstrap
  chown -R kept:kept "$CONFIG"
  chown -R root:root "$OWNER"
  chmod -R go-rwx "$OWNER" "$CONFIG"
}

# Runs Kept's command line as kept. As root it lends the owner login for that one command, from a
# copy removed afterwards, as kept.service does for the migrations.
run_kept() { # <args...>
  local node=$PREFIX/node/bin/node cli=$PREFIX/current/apps/server/dist/cli/index.js
  local files=(--env-file="$PREFIX/current/release.env" --env-file="$ENV_FILE")
  if [[ $EUID -ne 0 ]]; then
    exec "$node" "${files[@]}" "$cli" "$@"
  fi
  local lend rc=0
  lend=$(mktemp -d /run/kept-owner.XXXXXX)
  install -m 0400 -o kept -g kept "$OWNER/kept_owner" "$lend/kept_owner"
  chown kept:kept "$lend"
  (cd "$DATA" && setpriv --reuid=kept --regid=kept --init-groups --reset-env -- \
    env PATH=/usr/lib/postgresql/18/bin:/usr/local/bin:/usr/bin:/bin HOME="$DATA" \
    KEPT_OWNER_DATABASE_URL=postgres://kept_owner@127.0.0.1:5432/kept \
    KEPT_DB_OWNER_PASSWORD_FILE="$lend/kept_owner" \
    "$node" "${files[@]}" "$cli" "$@") || rc=$?
  rm -rf "$lend"
  return "$rc"
}

cmd_migrate() {
  need_root
  run_kept migrate
}

cmd_cli() { run_kept "$@"; }

# update [<version>] [--yes]: the newest release (or <version>), after asking. With KEPT_TARBALL,
# that tarball's version.
cmd_update() {
  need_root
  local target='' yes=
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -y | --yes) yes=1 ;;
      -h | --help)
        echo "update [<version>] [--yes]: Kept's newest release, or <version>, after asking"
        return 0
        ;;
      -*) die "unknown option $1" ;;
      *) target=${1#v} ;;
    esac
    shift
  done
  local current
  current=$(current_version)
  [[ -n $current ]] || die "no Kept install here ($PREFIX/current); install with kept-install.sh install"
  if [[ -n ${KEPT_TARBALL:-} ]]; then
    target=$(tar -xzOf "$KEPT_TARBALL" kept/release.env | sed -n 's/^KEPT_VERSION=//p')
  elif [[ -z $target ]]; then
    target=$(curl -fsSL --proto '=https' "https://api.github.com/repos/$REPO/releases/latest" |
      sed -n 's/.*"tag_name": *"v\([^"]*\)".*/\1/p' | head -n1)
    [[ -n $target ]] || die "could not read the newest release from GitHub"
    if [[ $target == "$current" ]]; then
      echo "Kept $current is the newest release."
      return 0
    fi
  fi
  [[ $target =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || die "'$target' is not a Kept version"
  if version_lt "$target" "$current" && [[ ${KEPT_ALLOW_DOWNGRADE:-} != 1 ]]; then
    die "$target is older than the running $current. A downgrade is for a restore: KEPT_ALLOW_DOWNGRADE=1 update $target"
  fi

  local ctid
  ctid=$(cat "$ETC/proxmox-ctid" 2>/dev/null || echo '<CTID>')
  if [[ $target == "$current" ]]; then say "Kept $current: installing it again"; else say "Kept $current → $target"; fi
  echo "A backup first, from the Proxmox host's shell (it keeps the database and every file):"
  echo "  vzdump $ctid --mode snapshot      (or: pct snapshot $ctid before-kept-$target)"
  if [[ -z $yes ]] && ! ask_yes "Update now?"; then
    echo "Nothing changed."
    return 0
  fi

  # Another release's own script does its update: it carries that release's pins (Node,
  # Postgres) and the checksums. It is checked against the release's signed SHA256SUMS first.
  if [[ -z ${KEPT_TARBALL:-} && $target != "$KEPT_VERSION" ]]; then
    local tmp
    tmp=$(mktemp -d)
    fetch_sums "$target" "$tmp"
    fetch "https://raw.githubusercontent.com/$REPO/v$target/deploy/proxmox/kept-install.sh" "$tmp/kept-install.sh"
    check_sum "$tmp" kept-install.sh
    note "kept-install.sh from $target, checked against its signed SHA256SUMS"
    exec bash "$tmp/kept-install.sh" apply "$target"
  fi
  cmd_apply "$target"
}

# The update itself, by the target release's own script. On a failed start it switches back.
cmd_apply() {
  need_root
  local target=$1 previous previous_node dir
  export LANG=C.UTF-8
  previous=$(readlink -f "$PREFIX/current")
  previous_node=$(readlink -f "$PREFIX/node")
  apt-get update -q >/dev/null
  pg_packages
  node_install
  restic_install
  dir=$(unpack_release "$target")
  target=$(env_value "$dir/release.env" KEPT_VERSION)
  note "unpacked into $dir"

  say "Stopping Kept, switching to $target, starting it"
  systemctl stop kept.service
  switch_to "$dir"
  install_units
  if systemctl start kept.service && wait_healthy "$target" 300; then
    # The previous release stays for one more update; older ones go.
    local keep
    for keep in "$PREFIX"/releases/*; do
      [[ $keep == "$dir" || $keep == "$previous" ]] || rm -rf "$keep"
    done
    say "Kept $target is running"
    return 0
  fi

  journalctl -u kept -n 30 --no-pager >&2 || true
  say "Kept $target did not start: switching back to $(env_value "$previous/release.env" KEPT_VERSION)"
  systemctl stop kept.service || true
  switch_to "$previous"
  ln -sfn "$previous_node" "$PREFIX/node.new" && mv -T "$PREFIX/node.new" "$PREFIX/node"
  rm -rf "$dir"
  if systemctl start kept.service && wait_healthy "$(env_value "$previous/release.env" KEPT_VERSION)" 300; then
    die "the update to $target failed and was rolled back: Kept $(current_version) is running again (journalctl -u kept says why)"
  fi
  die "the update to $target failed, and the previous release didn't start either. If $target migrated the database more than one release ahead, restore the backup (vzdump or the snapshot), or start the previous release with KEPT_ALLOW_DOWNGRADE=1 in $ENV_FILE"
}

case "${1:-}" in
  install) shift; cmd_install "$@" ;;
  update) shift; cmd_update "$@" ;;
  apply) shift; cmd_apply "$@" ;;
  bootstrap) shift; cmd_bootstrap ;;
  migrate) shift; cmd_migrate ;;
  cli) shift; cmd_cli "$@" ;;
  *)
    awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"
    exit 2
    ;;
esac
