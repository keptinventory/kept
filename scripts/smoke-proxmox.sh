#!/usr/bin/env bash
# Smoke test for the Proxmox VE install (deploy/proxmox/), with no Proxmox: a clean Debian 13
# container with systemd stands in for the LXC container, and stubbed Proxmox tools for the host.
#
#   bash scripts/smoke-proxmox.sh <kept-<version>-linux-<arch>.tar.gz>   (scripts/release/tarball.sh build)
#
# The tarball must be for this machine's architecture. Everything the scripts download from
# Kept's release (SHA256SUMS, its signature, the tarball, kept-install.sh) is served from local
# files by a stub `curl`, signed with a throwaway key that the test's copies of the two scripts
# carry instead of the release key; Debian, PostgreSQL, Node and restic are downloaded for real,
# and their pinned checksums checked. It asserts:
#   1. kept-install.sh install: the signed SHA256SUMS and the tarball's checksum checked, Postgres
#      18 with pgvector in a UTF-8 cluster on 127.0.0.1 (its pins set to a build PGDG no longer
#      has, so the newest one above them is taken), Kept as uid 10001 under systemd, /readyz and
#      /version, the setup page, /root/kept.creds (root's only, with the setup code), `kept admin
#      recovery-kit`, Kept's user unable to read the owner login's password;
#   2. Postgres and Kept restarted: healthy again, no second setup code;
#   3. `update <same version> --yes`: installed again beside the first copy, healthy;
#   4. `update <next version> --yes`: the next release's own kept-install.sh, checked against its
#      signed SHA256SUMS, does the update; /version names it; an older version is refused;
#   5. a failing update (a release whose server throws and whose script writes other units):
#      rolled back, the previous release serves, with its own kept-install.sh and units;
#   6. a failure once Kept is stopped (a release whose script fails writing the units): rolled
#      back the same way, never left stopped;
#   7. a tampered tarball (its checksum differs): refused before anything stops;
#   8. `update` with a bad signature (SHA256SUMS changed after signing, signed with another key,
#      no signature bundle, a bundle without a signature): refused, Kept never stopped;
#   9. kept.sh on stubbed Proxmox tools: the default `pct create` (unprivileged, nesting=1, 2 CPU,
#      2048 MB, 8 GB, DHCP), a preset one (static IP, gateway, VLAN, ID), an address read after
#      `pct exec` failed once; and no container without a terminal or var_unattended=yes, with a
#      bad signature (the four cases of 8), when kept-install.sh doesn't match SHA256SUMS, or when
#      the template download fails.
#
# What it can't show (the real-Proxmox checklist covers it): an unprivileged LXC's uid mapping and
# AppArmor profile (this container is privileged, for systemd), the real pct/pveam/pvesh output,
# a vzdump backup and restore, a reboot of the container.
# BOOT_TIMEOUT (seconds, default 300) bounds each wait. Everything it creates is removed on exit.
set -euo pipefail

tarball=${1:?usage: smoke-proxmox.sh <kept-<version>-linux-<arch>.tar.gz>}
[[ -f $tarball ]] || {
  echo "smoke-proxmox: no file $tarball" >&2
  exit 2
}
repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
export DOCKER_CONFIG=${DOCKER_CONFIG:-/tmp/kept-docker-config}
BOOT_TIMEOUT=${BOOT_TIMEOUT:-300}
# debian:13, its multi-arch index digest read from Docker Hub (2026-11-11).
DEBIAN_IMAGE=debian:13@sha256:9c6e381421d0f48d1b8133e573f33c185ee16cbf505eda9c4a8a4791b25ea8a6

ct="kept-proxmox-smoke-$(date +%s)-$$"
cleanup() {
  local rc=$?
  if ((rc != 0)) && docker inspect "$ct" >/dev/null 2>&1; then
    echo "--- kept and its bootstrap (last 60 lines) ---" >&2
    docker exec "$ct" journalctl -u kept-bootstrap -u kept -n 60 --no-pager >&2 2>&1 || true
  fi
  docker rm -f "$ct" >/dev/null 2>&1 || true
}
trap cleanup EXIT

step() { printf '\n\033[1m-- %s\033[0m\n' "$*"; }
ok() { printf '   ok: %s\n' "$*"; }
fail() {
  printf '\033[31msmoke-proxmox: %s\033[0m\n' "$*" >&2
  exit 1
}
in_ct() { docker exec "$ct" bash -c "$1"; }

step "a clean Debian 13 with systemd"
docker run -d --name "$ct" --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
  --tmpfs /run --tmpfs /run/lock "$DEBIAN_IMAGE" bash -c \
  'apt-get update -q >/dev/null && DEBIAN_FRONTEND=noninteractive apt-get install -y -q --no-install-recommends systemd systemd-sysv ca-certificates curl openssl perl >/dev/null && exec /lib/systemd/systemd' \
  >/dev/null
for ((i = 0; i < BOOT_TIMEOUT; i += 2)); do
  state=$(docker exec "$ct" systemctl is-system-running 2>/dev/null || true)
  [[ $state == running || $state == degraded ]] && break
  sleep 2
done
[[ $state == running || $state == degraded ]] || fail "systemd didn't start in the container ($state)"
ok "systemd $state"

step "the release, served locally and signed with a throwaway key"
version=$(tar -xzOf "$tarball" kept/release.env | sed -n 's/^KEPT_VERSION=//p')
[[ -n $version ]] || fail "the tarball's release.env names no version"
[[ $(basename "$tarball") =~ -linux-(x64|arm64)\.tar\.gz$ ]] ||
  fail "$tarball is not named kept-<version>-linux-<x64|arm64>.tar.gz"
arch_name=${BASH_REMATCH[1]}
# The next releases: the patch number bumped. +1 a good one, +2 one whose server throws, +3 one
# whose script fails once Kept is stopped, +4 one only its signature matters for.
bump() {
  local core=${1%%-*} x y z
  IFS=. read -r x y z <<<"$core"
  echo "$x.$y.$((z + $2))"
}
next=$(bump "$version" 1)
broken=$(bump "$version" 2)
failing=$(bump "$version" 3)
future=$(bump "$version" 4)
docker cp "$tarball" "$ct:/root/kept.tar.gz"
docker cp "$repo/deploy/proxmox/kept-install.sh" "$ct:/root/kept-install.orig.sh"
docker cp "$repo/deploy/proxmox/kept.sh" "$ct:/root/kept.orig.sh"
docker exec -i "$ct" bash -s -- "$arch_name" "$version" "$next" "$broken" "$failing" "$future" <<'EOF'
set -euo pipefail
arch_name=$1 version=$2 next=$3 broken=$4 failing=$5 future=$6
mkdir -p /stub/bin /stub/keys && cd /stub/keys
openssl ecparam -name prime256v1 -genkey -noout -out key.pem
openssl ec -in key.pem -pubout -out pub.pem 2>/dev/null
# A second throwaway key, which the scripts don't carry.
openssl ecparam -name prime256v1 -genkey -noout -out other.pem
# sign <dir> <key>: <dir>/SHA256SUMS.sigstore.json, the signature where cosign's bundle has it.
cat >/stub/bin/sign <<'SIGN'
#!/bin/bash
set -euo pipefail
openssl dgst -sha256 -sign "/stub/keys/$2" -out /tmp/sig.der "$1/SHA256SUMS"
printf '{"mediaType":"application/vnd.dev.sigstore.bundle.v0.3+json","messageSignature":{"messageDigest":{"algorithm":"SHA2_256","digest":"x"},"signature":"%s"}}' \
  "$(base64 -w0 /tmp/sig.der)" >"$1/SHA256SUMS.sigstore.json"
SIGN
# restore <version>: its SHA256SUMS and signature as they were signed.
cat >/stub/bin/restore <<'RESTORE'
#!/bin/bash
cp /stub/pristine/$1/* /stub/releases/$1/
RESTORE
chmod 0755 /stub/bin/*
# A script copy with the throwaway key and the given version in place of the release's.
copy() { # <source> <version> <dest>
  awk -v key="$(cat pub.pem)" '
    /^RELEASE_KEY=/ { print "RELEASE_KEY='"'"'" key "'"'"'"; skip = 1; next }
    skip && /^-----END PUBLIC KEY-----/ { skip = 0; next }
    skip { next }
    { print }' "$1" | sed "s/^KEPT_VERSION=.*/KEPT_VERSION=$2/" >"$3"
  chmod 0755 "$3"
}
# A release folder like GitHub's: the tarball, SHA256SUMS and its signature (as cosign writes it).
release() { # <version> <tarball> [<sed script for its kept-install.sh>]
  local d=/stub/releases/$1
  mkdir -p "$d" "/stub/raw/$1" "/stub/pristine/$1"
  cp "$2" "$d/kept-$1-linux-$arch_name.tar.gz"
  copy /root/kept-install.orig.sh "$1" "/stub/raw/$1/kept-install.sh"
  [[ -z ${3:-} ]] || sed -i "$3" "/stub/raw/$1/kept-install.sh"
  copy /root/kept.orig.sh "$1" "/stub/raw/$1/kept.sh"
  cp "/stub/raw/$1/kept-install.sh" "/stub/raw/$1/kept.sh" "$d/"
  (cd "$d" && sha256sum kept-*.tar.gz kept.sh kept-install.sh >SHA256SUMS && rm kept.sh kept-install.sh)
  /stub/bin/sign "$d" key.pem
  cp "$d/SHA256SUMS" "$d/SHA256SUMS.sigstore.json" "/stub/pristine/$1/"
}
# A copy of the tarball naming another version, changed by <command> run in its folder.
retar() { # <version> <out> [<command>]
  rm -rf /tmp/retar && mkdir -p /tmp/retar && tar -xzf /root/kept.tar.gz -C /tmp/retar
  sed -i "s/^KEPT_VERSION=.*/KEPT_VERSION=$1/" /tmp/retar/kept/release.env
  [[ -z ${3:-} ]] || (cd /tmp/retar/kept && eval "$3")
  tar -czf "$2" -C /tmp/retar kept && rm -rf /tmp/retar
}
# The first release pins Postgres to a build trixie-pgdg no longer has (18.5 was gone on
# 2026-11-12): the install takes the newest one above it.
release "$version" /root/kept.tar.gz \
  's/^  postgresql-client-18=.*/  postgresql-client-18=18.5-1.pgdg13+1/; s/^  postgresql-18=.*/  postgresql-18=18.5-1.pgdg13+1/'
retar "$next" /root/next.tar.gz
release "$next" /root/next.tar.gz
# Its server throws at start, and its script writes a unit the rollback must take back.
retar "$broken" /root/broken.tar.gz \
  "echo 'throw new Error(\"broken on purpose: the rollback test\");' >apps/server/dist/main.js"
release "$broken" /root/broken.tar.gz 's/^Description=Kept$/Description=Kept (the broken release)/'
# Its script fails writing the units, once Kept is stopped.
retar "$failing" /root/failing.tar.gz
release "$failing" /root/failing.tar.gz '/^install_units() {$/a\  false # the smoke: a failure once Kept is stopped'
# Only its signature is ever read.
release "$future" /root/next.tar.gz
rm -f /root/broken.tar.gz /root/failing.tar.gz

# pg_pick, alone: the pin when the repository has it, else the newest above it, never older.
eval "$(sed -n '/^pg_pick() {/,/^}/p' /root/kept-install.orig.sh)"
[[ $(pg_pick 18.6-1.pgdg13+2 18.6-1.pgdg13+2 18.4-1.pgdg13+1) == 18.6-1.pgdg13+2 ]]
[[ $(pg_pick 18.5-1.pgdg13+1 18.6-1.pgdg13+2 18.4-1.pgdg13+1 18.3-1.pgdg13+1) == 18.6-1.pgdg13+2 ]]
[[ $(pg_pick 18.5-1.pgdg13+1 18.6-1.pgdg13+2 18.7-1.pgdg13+1) == 18.7-1.pgdg13+1 ]]
if pg_pick 18.7-1.pgdg13+1 18.6-1.pgdg13+2 18.4-1.pgdg13+1 >/dev/null; then
  echo "pg_pick went below the pin" >&2
  exit 1
fi

# curl: Kept's release files from /stub, everything else from the network.
mv /usr/bin/curl /usr/bin/curl.real
cat >/usr/bin/curl <<'CURL'
#!/bin/bash
out= url=
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  case "${args[i]}" in
    -o) out=${args[i+1]} ;;
    https://*) url=${args[i]} ;;
  esac
done
case "$url" in
  https://github.com/keptinventory/kept/releases/download/v*)
    rest=${url#https://github.com/keptinventory/kept/releases/download/v}
    src=/stub/releases/${rest%%/*}/${rest#*/} ;;
  https://raw.githubusercontent.com/keptinventory/kept/v*/deploy/proxmox/*)
    rest=${url#https://raw.githubusercontent.com/keptinventory/kept/v}
    src=/stub/raw/${rest%%/*}/${rest##*/} ;;
  *) exec /usr/bin/curl.real "$@" ;;
esac
[[ -f $src ]] || { echo "curl (stub): 404 $url" >&2; exit 22; }
if [[ -n $out ]]; then cp "$src" "$out"; else cat "$src"; fi
CURL
chmod 0755 /usr/bin/curl
EOF
ok "releases $version to $future, signed; pg_pick keeps to its pin or above; curl stubbed for Kept's release files"

# The four ways a signature goes wrong, on <version>'s release: tamper <case> <version>.
tamper() {
  case "$1" in
    changed) in_ct "echo '0000000000000000000000000000000000000000000000000000000000000000  extra' >>/stub/releases/$2/SHA256SUMS" ;;
    other-key) in_ct "/stub/bin/sign /stub/releases/$2 other.pem" ;;
    no-bundle) in_ct "rm /stub/releases/$2/SHA256SUMS.sigstore.json" ;;
    empty-bundle) in_ct "echo '{}' >/stub/releases/$2/SHA256SUMS.sigstore.json" ;;
  esac
}
# What each one is refused with: kept-install.sh's words, then kept.sh's.
refusal() { # <case> <install|host> <version>
  case "$1/$2" in
    changed/install | other-key/install) echo "the signature on SHA256SUMS does not verify with the release key" ;;
    changed/host | other-key/host) echo "the release's SHA256SUMS doesn't verify with the release key" ;;
    no-bundle/*) echo "could not download https://github.com/keptinventory/kept/releases/download/v$3/SHA256SUMS.sigstore.json" ;;
    empty-bundle/install) echo "SHA256SUMS.sigstore.json holds no signature" ;;
    empty-bundle/host) echo "the release's SHA256SUMS signature is missing" ;;
  esac
}
signature_cases=(changed other-key no-bundle empty-bundle)
# Every unit file and command the install writes, by checksum.
units_sum() {
  in_ct "sha256sum /usr/local/lib/kept/kept-install.sh /etc/systemd/system/kept.service /etc/systemd/system/kept-bootstrap.service /usr/bin/update /usr/local/bin/kept"
}

step "1. install"
out=$(in_ct "KEPT_CTID=123 bash /stub/raw/$version/kept-install.sh install" 2>&1) || {
  echo "$out" >&2
  fail "the install failed"
}
echo "$out" | tail -n 25
grep -q "postgresql-18 18.5-1.pgdg13+1 is no longer in PostgreSQL's repository: installing 18\." <<<"$out" ||
  fail "the install didn't say it took a newer build for the missing pin"
pg=$(in_ct "dpkg-query -W -f '\${Version}' postgresql-18")
in_ct "dpkg --compare-versions '$pg' gt 18.5-1.pgdg13+1" || fail "postgresql-18 $pg is not above its pin"
[[ $pg == 18.* ]] || fail "postgresql-18 is $pg"
ok "the pin PGDG dropped: postgresql-18 $pg, the newest above it"
in_ct "systemctl is-active kept" >/dev/null || fail "kept.service is not active"
in_ct "curl.real -fsS http://127.0.0.1:8080/readyz" >/dev/null || fail "/readyz is not 200"
got=$(in_ct "curl.real -fsS http://127.0.0.1:8080/version")
[[ $got == *"\"version\":\"$version\""* ]] || fail "/version says $got"
ok "/readyz 200, /version $version"
in_ct "curl.real -fsS http://127.0.0.1:8080/ | grep -qi '<html'" || fail "/ serves no page"
ok "the web app is served"
# shellcheck disable=SC2016 # expanded inside the container
uid=$(in_ct 'stat -c %u /proc/$(systemctl show -p MainPID --value kept)')
[[ $uid == 10001 ]] || fail "Kept runs as uid $uid"
ok "Kept runs as uid 10001"
enc=$(in_ct "psql -h /var/run/postgresql -U postgres -d kept -Atc 'SHOW server_encoding'")
[[ $enc == UTF8 ]] || fail "the database is $enc"
in_ct "psql -h /var/run/postgresql -U postgres -d kept -Atc \"SELECT extname FROM pg_extension\" | grep -qx vector" ||
  fail "pgvector isn't in the database"
listen=$(in_ct "psql -h /var/run/postgresql -U postgres -Atc 'SHOW listen_addresses'")
[[ $listen == 127.0.0.1 ]] || fail "Postgres listens on $listen"
ok "Postgres: UTF8, vector, 127.0.0.1 only"
[[ $(in_ct "stat -c %a /root/kept.creds") == 600 ]] || fail "/root/kept.creds is not 0600"
code=$(in_ct "sed -n 's/^Setup code: *\([0-9A-Z-]*\).*/\1/p' /root/kept.creds")
[[ $code =~ ^[0-9A-Z]{3}-[0-9A-Z]{3}$ ]] || fail "no setup code in /root/kept.creds"
[[ $(in_ct "cat /etc/kept/proxmox-ctid") == 123 ]] || fail "the CT ID wasn't recorded"
ok "/root/kept.creds (0600) holds the setup code"
in_ct "kept admin recovery-kit | head -n1" | grep -qx 'KEPT RECOVERY KIT' || fail "kept admin recovery-kit failed"
ok "kept admin recovery-kit"
if in_ct "setpriv --reuid=kept --regid=kept --init-groups cat /etc/kept/owner/kept_owner" >/dev/null 2>&1; then
  fail "Kept's user can read the owner login's password"
fi
in_ct "! setpriv --reuid=kept --regid=kept --init-groups touch /etc/kept/kept.env 2>/dev/null" ||
  fail "Kept's user can write its settings"
ok "Kept's user can't read the owner's password or change its settings"

step "2. restart Postgres and Kept"
in_ct "systemctl restart postgresql@18-main && systemctl restart kept-bootstrap kept"
in_ct "for i in \$(seq 90); do curl.real -fsS -o /dev/null http://127.0.0.1:8080/readyz 2>/dev/null && exit 0; sleep 2; done; exit 1" ||
  fail "not healthy after the restart"
[[ $(in_ct "journalctl -u kept --no-pager | grep -c 'KEPT SETUP CODE' || true") -le 1 ]] || fail "a second setup code"
ok "healthy again"

step "3. update to the same version"
in_ct "update $version --yes" 2>&1 | tail -n 6
got=$(in_ct "curl.real -fsS http://127.0.0.1:8080/version")
[[ $got == *"\"version\":\"$version\""* ]] || fail "/version says $got after the reinstall"
[[ $(in_ct "ls /opt/kept/releases | wc -l") == 2 ]] || fail "expected two release folders: $(in_ct 'ls /opt/kept/releases')"
ok "installed again beside the first copy, healthy"

step "4. update to the next version, by its own script"
out=$(in_ct "update $next --yes" 2>&1) || {
  echo "$out" >&2
  fail "the update to $next failed"
}
echo "$out" | tail -n 6
grep -q "kept-install.sh from $next, checked against its signed SHA256SUMS" <<<"$out" ||
  fail "the update didn't hand over to $next's script"
got=$(in_ct "curl.real -fsS http://127.0.0.1:8080/version")
[[ $got == *"\"version\":\"$next\""* ]] || fail "/version says $got after the update"
if in_ct "update $version --yes" >/dev/null 2>&1; then fail "a downgrade went through without KEPT_ALLOW_DOWNGRADE"; fi
ok "$next is running; a downgrade is refused"

step "5. a failing update rolls back, with the previous script and its units"
before=$(units_sum)
if out=$(in_ct "update $broken --yes" 2>&1); then
  echo "$out" >&2
  fail "the broken update reported success"
fi
echo "$out" | tail -n 4
grep -q "kept-install.sh from $broken, checked against its signed SHA256SUMS" <<<"$out" ||
  fail "the update didn't hand over to $broken's script"
grep -q "rolled back" <<<"$out" || fail "the failed update didn't say it rolled back"
got=$(in_ct "curl.real -fsS http://127.0.0.1:8080/version")
[[ $got == *"\"version\":\"$next\""* ]] || fail "/version says $got after the rollback"
[[ $(units_sum) == "$before" ]] || fail "the units and scripts weren't put back: $(units_sum)"
[[ $(in_ct "systemctl show -p Description --value kept") == Kept ]] || fail "systemd still has the broken release's unit"
in_ct "! test -e /usr/local/lib/kept/kept-install.sh.previous && ! test -e /opt/kept/releases/$broken" ||
  fail "the rollback left the broken release or the saved script behind"
ok "rolled back: $next serves, with its own kept-install.sh and units"

step "6. a failure once Kept is stopped rolls back"
if out=$(in_ct "update $failing --yes" 2>&1); then
  echo "$out" >&2
  fail "the failing update reported success"
fi
echo "$out" | tail -n 4
grep -q "rolled back" <<<"$out" || {
  echo "$out" >&2
  fail "a failure writing the units didn't roll back"
}
in_ct "systemctl is-active kept" >/dev/null || fail "Kept was left stopped"
got=$(in_ct "curl.real -fsS http://127.0.0.1:8080/version")
[[ $got == *"\"version\":\"$next\""* ]] || fail "/version says $got after the rollback"
[[ $(units_sum) == "$before" ]] || fail "the units and scripts weren't put back: $(units_sum)"
ok "rolled back: $next serves, never left stopped"

step "7. a tampered tarball is refused"
in_ct "printf x >>/stub/releases/$next/kept-$next-linux-$arch_name.tar.gz"
if out=$(in_ct "update $next --yes" 2>&1); then fail "a tampered tarball was installed"; fi
grep -q "does not match its SHA-256" <<<"$out" || {
  echo "$out" >&2
  fail "the tampered tarball wasn't refused for its checksum"
}
in_ct "systemctl is-active kept" >/dev/null || fail "Kept was stopped for a refused update"
ok "refused before anything stopped"

step "8. update refuses a bad signature, before anything stops"
for case in "${signature_cases[@]}"; do
  tamper "$case" "$future"
  if out=$(in_ct "update $future --yes" 2>&1); then
    echo "$out" >&2
    fail "$case: the update went through"
  fi
  want=$(refusal "$case" install "$future")
  grep -qF "$want" <<<"$out" || {
    echo "$out" >&2
    fail "$case: not refused with '$want'"
  }
  in_ct "systemctl is-active kept" >/dev/null || fail "$case: Kept was stopped"
  got=$(in_ct "curl.real -fsS http://127.0.0.1:8080/version")
  [[ $got == *"\"version\":\"$next\""* ]] || fail "$case: /version says $got"
  in_ct "! test -e /opt/kept/releases/$future" || fail "$case: $future was unpacked"
  in_ct "/stub/bin/restore $future"
  ok "$case: refused ($want), $next still serves"
done

step "9. kept.sh on stubbed Proxmox tools"
docker exec -i "$ct" bash -s <<'EOF'
set -euo pipefail
mkdir -p /stub/pve
cat >/stub/pve/pveversion <<'STUB'
#!/bin/sh
echo 'pve-manager/9.0.10/0123456789abcdef (running kernel: 6.14.8-2-pve)'
STUB
cat >/stub/pve/pvesh <<'STUB'
#!/bin/bash
case "$*" in
  *storage*rootdir*) echo '[{"storage":"local-lvm","avail":107374182400,"active":1,"type":"lvmthin"}]' ;;
  *storage*vztmpl*) echo '[{"storage":"local","avail":53687091200,"active":1,"type":"dir"}]' ;;
  *nextid*--vmid*) [[ $* != *' 100'* ]] ;;
  *nextid*) echo 100 ;;
  *) exit 1 ;;
esac
STUB
cat >/stub/pve/pveam <<'STUB'
#!/bin/bash
a=$(dpkg --print-architecture)
case "$1" in
  update) exit 0 ;;
  available) printf 'system          debian-12-standard_12.12-1_%s.tar.zst\nsystem          debian-13-standard_13.1-1_%s.tar.zst\nsystem          debian-13-standard_13.1-2_%s.tar.zst\n' $a $a $a ;;
  list) exit 0 ;;
  download) [[ -z ${STUB_TEMPLATE_FAILS:-} ]] ;;
esac
STUB
# pct: logged; `pct exec ... ip -4` prints an address, or fails the first time with
# STUB_EXEC_FAILS_ONCE (a container still starting).
cat >/stub/pve/pct <<'STUB'
#!/bin/bash
echo "pct $*" >>/stub/pct.log
case "$1" in
  exec)
    case "$*" in
      *' ip -4 '*)
        if [[ -n ${STUB_EXEC_FAILS_ONCE:-} && ! -e /stub/exec-failed ]]; then
          touch /stub/exec-failed
          echo 'error: container is not running yet' >&2
          exit 255
        fi
        echo '2: eth0    inet 198.51.100.5/24 brd 198.51.100.255 scope global eth0' ;;
    esac ;;
esac
exit 0
STUB
chmod 0755 /stub/pve/*
EOF
# kept.sh, unattended unless <preset> says otherwise, its stdin not a terminal.
host() { in_ct "export PATH=/stub/pve:\$PATH var_unattended=yes var_bridge=eth0 $1; bash /stub/raw/$version/kept.sh </dev/null"; }
no_container() { in_ct "! grep -q '^pct create' /stub/pct.log"; }
host "" >/tmp/kept-proxmox-host.log 2>&1 || {
  cat /tmp/kept-proxmox-host.log >&2
  fail "kept.sh failed with the defaults"
}
create=$(in_ct "grep '^pct create' /stub/pct.log")
for want in 'pct create 100 local:vztmpl/debian-13-standard_13.1-2_' '--unprivileged 1' '--features nesting=1,keyctl=0' \
  '--cores 2' '--memory 2048' '--swap 512' '--rootfs local-lvm:8' '--net0 name=eth0,bridge=eth0,ip=dhcp' \
  '--onboot 1' '--timezone host' '--hostname kept'; do
  [[ $create == *"$want"* ]] || fail "the default pct create lacks '$want': $create"
done
in_ct "grep -q 'pct exec 100 -- env KEPT_URL=http://198.51.100.5:8080 KEPT_CTID=100 bash /root/kept-install.sh install' /stub/pct.log" ||
  fail "kept.sh didn't run the installer with the container's address"
in_ct "grep -q '^pct set 100 --description' /stub/pct.log" || fail "kept.sh wrote no Notes"
ok "defaults: $create"
in_ct ": >/stub/pct.log"
host "var_ctid=105 var_cpu=1 var_ram=1024 var_disk=6 var_ip=192.0.2.50/24 var_gateway=192.0.2.1 var_vlan=20 var_hostname=inventory" \
  >/tmp/kept-proxmox-host.log 2>&1 || {
  cat /tmp/kept-proxmox-host.log >&2
  fail "kept.sh failed with presets"
}
create=$(in_ct "grep '^pct create' /stub/pct.log")
for want in 'pct create 105 ' '--cores 1' '--memory 1024' '--rootfs local-lvm:6' '--hostname inventory' \
  '--net0 name=eth0,bridge=eth0,ip=192.0.2.50/24,gw=192.0.2.1,tag=20'; do
  [[ $create == *"$want"* ]] || fail "the preset pct create lacks '$want': $create"
done
ok "presets: $create"

in_ct ": >/stub/pct.log; rm -f /stub/exec-failed"
host "STUB_EXEC_FAILS_ONCE=1" >/tmp/kept-proxmox-host.log 2>&1 || {
  cat /tmp/kept-proxmox-host.log >&2
  fail "kept.sh stopped when pct exec failed once"
}
[[ $(in_ct "grep -c ' ip -4 ' /stub/pct.log") -ge 2 ]] || fail "kept.sh didn't ask for the address again"
in_ct "grep -q 'KEPT_URL=http://198.51.100.5:8080' /stub/pct.log && ! grep -q '^pct destroy' /stub/pct.log" ||
  fail "kept.sh didn't go on with the address after pct exec failed once"
ok "pct exec failing once: asked again, the address read, the container kept"

for preset in "" "var_unattended=no"; do
  in_ct ": >/stub/pct.log"
  if in_ct "export PATH=/stub/pve:\$PATH var_bridge=eth0 $preset; bash /stub/raw/$version/kept.sh </dev/null" \
    >/tmp/kept-proxmox-host.log 2>&1; then
    fail "kept.sh ran without a terminal and without var_unattended=yes (${preset:-nothing preset})"
  fi
  grep -q "this asks its questions in a terminal: .*set var_unattended=yes" /tmp/kept-proxmox-host.log ||
    fail "no plain message without a terminal: $(cat /tmp/kept-proxmox-host.log)"
  no_container || fail "a container was made without a terminal"
done
ok "no terminal and no var_unattended=yes: a plain message, no container"

for case in "${signature_cases[@]}"; do
  in_ct ": >/stub/pct.log"
  tamper "$case" "$version"
  if host "" >/tmp/kept-proxmox-host.log 2>&1; then fail "$case: kept.sh went on"; fi
  want=$(refusal "$case" host "$version")
  grep -qF "$want" /tmp/kept-proxmox-host.log || fail "$case: not refused with '$want': $(cat /tmp/kept-proxmox-host.log)"
  no_container || fail "$case: a container was made"
  in_ct "/stub/bin/restore $version"
  ok "$case: refused ($want), no container"
done

in_ct ": >/stub/pct.log; echo '# tampered' >>/stub/raw/$version/kept-install.sh"
if host "" >/tmp/kept-proxmox-host.log 2>&1; then fail "kept.sh went on with a tampered kept-install.sh"; fi
grep -q "doesn't match the release's SHA256SUMS" /tmp/kept-proxmox-host.log || fail "no checksum refusal: $(cat /tmp/kept-proxmox-host.log)"
no_container || fail "a container was made for a tampered installer"
ok "a tampered kept-install.sh: refused, no container"
in_ct "sed -i '\$d' /stub/raw/$version/kept-install.sh"
if host "STUB_TEMPLATE_FAILS=1" >/tmp/kept-proxmox-host.log 2>&1; then fail "kept.sh went on without a template"; fi
grep -q "the template download failed" /tmp/kept-proxmox-host.log || fail "no template refusal: $(cat /tmp/kept-proxmox-host.log)"
no_container || fail "a container was made without a template"
ok "a failed template download: a plain message, no container"
rm -f /tmp/kept-proxmox-host.log

printf '\n\033[32msmoke-proxmox: every check passed (%s, linux-%s)\033[0m\n' "$version" "$arch_name"
