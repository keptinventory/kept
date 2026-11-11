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
#      18 with pgvector in a UTF-8 cluster on 127.0.0.1, Kept as uid 10001 under systemd, /readyz
#      and /version, the setup page, /root/kept.creds (root's only, with the setup code), `kept
#      admin recovery-kit`, Kept's user unable to read the owner login's password;
#   2. Postgres and Kept restarted: healthy again, no second setup code;
#   3. `update <same version> --yes`: installed again beside the first copy, healthy;
#   4. `update <next version> --yes`: the next release's own kept-install.sh, checked against its
#      signed SHA256SUMS, does the update; /version names it; an older version is refused;
#   5. a failing update (a tarball whose server throws): rolled back, the previous release serves;
#   6. a tampered tarball (its checksum differs): refused before anything stops;
#   7. kept.sh on stubbed Proxmox tools: the default `pct create` (unprivileged, nesting=1, 2 CPU,
#      2048 MB, 8 GB, DHCP), a preset one (static IP, gateway, VLAN, ID), and no container when
#      kept-install.sh doesn't match SHA256SUMS or the template download fails.
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
# The next releases: the patch number bumped, once for a good one and twice for a broken one.
bump() {
  local core=${1%%-*} x y z
  IFS=. read -r x y z <<<"$core"
  echo "$x.$y.$((z + $2))"
}
next=$(bump "$version" 1)
broken=$(bump "$version" 2)
docker cp "$tarball" "$ct:/root/kept.tar.gz"
docker cp "$repo/deploy/proxmox/kept-install.sh" "$ct:/root/kept-install.orig.sh"
docker cp "$repo/deploy/proxmox/kept.sh" "$ct:/root/kept.orig.sh"
in_ct "
set -euo pipefail
mkdir -p /stub/bin /stub/keys && cd /stub/keys
openssl ecparam -name prime256v1 -genkey -noout -out key.pem
openssl ec -in key.pem -pubout -out pub.pem 2>/dev/null
# A script copy with the throwaway key and the given version in place of the release's.
copy() { # <source> <version> <dest>
  awk -v key=\"\$(cat pub.pem)\" '
    /^RELEASE_KEY=/ { print \"RELEASE_KEY='\''\" key \"'\''\"; skip = 1; next }
    skip && /^-----END PUBLIC KEY-----/ { skip = 0; next }
    skip { next }
    { print }' \"\$1\" | sed \"s/^KEPT_VERSION=.*/KEPT_VERSION=\$2/\" >\"\$3\"
  chmod 0755 \"\$3\"
}
# A release folder like GitHub's: the tarball, SHA256SUMS and its signature (as cosign writes it).
release() { # <version> <tarball>
  local d=/stub/releases/\$1
  mkdir -p \$d /stub/raw/\$1
  cp \"\$2\" \$d/kept-\$1-linux-$arch_name.tar.gz
  copy /root/kept-install.orig.sh \$1 /stub/raw/\$1/kept-install.sh
  copy /root/kept.orig.sh \$1 /stub/raw/\$1/kept.sh
  cp /stub/raw/\$1/kept-install.sh /stub/raw/\$1/kept.sh \$d/
  (cd \$d && sha256sum kept-*.tar.gz kept.sh kept-install.sh >SHA256SUMS && rm kept.sh kept-install.sh)
  openssl dgst -sha256 -sign key.pem -out /tmp/sig.der \$d/SHA256SUMS
  printf '{\"mediaType\":\"application/vnd.dev.sigstore.bundle.v0.3+json\",\"messageSignature\":{\"messageDigest\":{\"algorithm\":\"SHA2_256\",\"digest\":\"x\"},\"signature\":\"%s\"}}' \
    \"\$(base64 -w0 /tmp/sig.der)\" >\$d/SHA256SUMS.sigstore.json
}
release $version /root/kept.tar.gz
# The next release: the same files, with release.env naming $next.
mkdir -p /tmp/next && tar -xzf /root/kept.tar.gz -C /tmp/next
sed -i 's/^KEPT_VERSION=.*/KEPT_VERSION=$next/' /tmp/next/kept/release.env
tar -czf /root/next.tar.gz -C /tmp/next kept && rm -rf /tmp/next
release $next /root/next.tar.gz
# A broken one: its server throws at start.
mkdir -p /tmp/broken && tar -xzf /root/kept.tar.gz -C /tmp/broken
sed -i 's/^KEPT_VERSION=.*/KEPT_VERSION=$broken/' /tmp/broken/kept/release.env
echo 'throw new Error(\"broken on purpose: the rollback test\");' >/tmp/broken/kept/apps/server/dist/main.js
tar -czf /root/broken.tar.gz -C /tmp/broken kept && rm -rf /tmp/broken
# curl: Kept's release files from /stub, everything else from the network.
mv /usr/bin/curl /usr/bin/curl.real
cat >/usr/bin/curl <<'EOF'
#!/bin/bash
out= url=
args=(\"\$@\")
for ((i = 0; i < \${#args[@]}; i++)); do
  case \"\${args[i]}\" in
    -o) out=\${args[i+1]} ;;
    https://*) url=\${args[i]} ;;
  esac
done
case \"\$url\" in
  https://github.com/keptinventory/kept/releases/download/v*)
    rest=\${url#https://github.com/keptinventory/kept/releases/download/v}
    src=/stub/releases/\${rest%%/*}/\${rest#*/} ;;
  https://raw.githubusercontent.com/keptinventory/kept/v*/deploy/proxmox/*)
    rest=\${url#https://raw.githubusercontent.com/keptinventory/kept/v}
    src=/stub/raw/\${rest%%/*}/\${rest##*/} ;;
  *) exec /usr/bin/curl.real \"\$@\" ;;
esac
[[ -f \$src ]] || { echo \"curl (stub): 404 \$url\" >&2; exit 22; }
if [[ -n \$out ]]; then cp \"\$src\" \"\$out\"; else cat \"\$src\"; fi
EOF
chmod 0755 /usr/bin/curl
"
ok "releases $version and $next, signed; a broken one; curl stubbed for Kept's release files"

step "1. install"
in_ct "KEPT_CTID=123 bash /stub/raw/$version/kept-install.sh install" 2>&1 | tail -n 25
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

step "5. a failing update rolls back"
sum=$(in_ct "sha256sum /root/broken.tar.gz | cut -d' ' -f1")
if out=$(in_ct "KEPT_TARBALL=/root/broken.tar.gz KEPT_TARBALL_SHA256=$sum update --yes" 2>&1); then
  echo "$out" >&2
  fail "the broken update reported success"
fi
echo "$out" | tail -n 4
grep -q "rolled back" <<<"$out" || fail "the failed update didn't say it rolled back"
got=$(in_ct "curl.real -fsS http://127.0.0.1:8080/version")
[[ $got == *"\"version\":\"$next\""* ]] || fail "/version says $got after the rollback"
ok "rolled back: $next serves again"

step "6. a tampered tarball is refused"
in_ct "printf x >>/stub/releases/$next/kept-$next-linux-$arch_name.tar.gz"
if out=$(in_ct "update $next --yes" 2>&1); then fail "a tampered tarball was installed"; fi
grep -q "does not match its SHA-256" <<<"$out" || {
  echo "$out" >&2
  fail "the tampered tarball wasn't refused for its checksum"
}
in_ct "systemctl is-active kept" >/dev/null || fail "Kept was stopped for a refused update"
ok "refused before anything stopped"

step "7. kept.sh on stubbed Proxmox tools"
in_ct "
set -euo pipefail
mkdir -p /stub/pve
cat >/stub/pve/pveversion <<'EOF'
#!/bin/sh
echo 'pve-manager/9.0.10/0123456789abcdef (running kernel: 6.14.8-2-pve)'
EOF
cat >/stub/pve/pvesh <<'EOF'
#!/bin/bash
case \"\$*\" in
  *storage*rootdir*) echo '[{\"storage\":\"local-lvm\",\"avail\":107374182400,\"active\":1,\"type\":\"lvmthin\"}]' ;;
  *storage*vztmpl*) echo '[{\"storage\":\"local\",\"avail\":53687091200,\"active\":1,\"type\":\"dir\"}]' ;;
  *nextid*--vmid*) [[ \$* != *' 100'* ]] ;;
  *nextid*) echo 100 ;;
  *) exit 1 ;;
esac
EOF
cat >/stub/pve/pveam <<'EOF'
#!/bin/bash
a=\$(dpkg --print-architecture)
case \"\$1\" in
  update) exit 0 ;;
  available) printf 'system          debian-12-standard_12.12-1_%s.tar.zst\nsystem          debian-13-standard_13.1-1_%s.tar.zst\nsystem          debian-13-standard_13.1-2_%s.tar.zst\n' \$a \$a \$a ;;
  list) exit 0 ;;
  download) [[ -z \${STUB_TEMPLATE_FAILS:-} ]] ;;
esac
EOF
cat >/stub/pve/pct <<'EOF'
#!/bin/bash
echo \"pct \$*\" >>/stub/pct.log
case \"\$1\" in
  exec)
    case \"\$*\" in
      *' ip -4 '*) echo '2: eth0    inet 10.0.0.5/24 brd 10.0.0.255 scope global eth0' ;;
    esac ;;
esac
exit 0
EOF
chmod 0755 /stub/pve/*
"
host() { in_ct "export PATH=/stub/pve:\$PATH var_unattended=yes var_bridge=eth0 $1; bash /stub/raw/$version/kept.sh </dev/null"; }
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
in_ct "grep -q 'pct exec 100 -- env KEPT_URL=http://10.0.0.5:8080 KEPT_CTID=100 bash /root/kept-install.sh install' /stub/pct.log" ||
  fail "kept.sh didn't run the installer with the container's address"
in_ct "grep -q '^pct set 100 --description' /stub/pct.log" || fail "kept.sh wrote no Notes"
ok "defaults: $create"
in_ct ": >/stub/pct.log"
host "var_ctid=105 var_cpu=1 var_ram=1024 var_disk=6 var_ip=192.168.1.50/24 var_gateway=192.168.1.1 var_vlan=20 var_hostname=inventory" \
  >/tmp/kept-proxmox-host.log 2>&1 || {
  cat /tmp/kept-proxmox-host.log >&2
  fail "kept.sh failed with presets"
}
create=$(in_ct "grep '^pct create' /stub/pct.log")
for want in 'pct create 105 ' '--cores 1' '--memory 1024' '--rootfs local-lvm:6' '--hostname inventory' \
  '--net0 name=eth0,bridge=eth0,ip=192.168.1.50/24,gw=192.168.1.1,tag=20'; do
  [[ $create == *"$want"* ]] || fail "the preset pct create lacks '$want': $create"
done
ok "presets: $create"
in_ct ": >/stub/pct.log; echo '# tampered' >>/stub/raw/$version/kept-install.sh"
if host "" >/tmp/kept-proxmox-host.log 2>&1; then fail "kept.sh went on with a tampered kept-install.sh"; fi
grep -q "doesn't match the release's SHA256SUMS" /tmp/kept-proxmox-host.log || fail "no checksum refusal: $(cat /tmp/kept-proxmox-host.log)"
in_ct "! grep -q '^pct create' /stub/pct.log" || fail "a container was made for a tampered installer"
ok "a tampered kept-install.sh: refused, no container"
in_ct "sed -i '\$d' /stub/raw/$version/kept-install.sh"
if host "STUB_TEMPLATE_FAILS=1" >/tmp/kept-proxmox-host.log 2>&1; then fail "kept.sh went on without a template"; fi
grep -q "the template download failed" /tmp/kept-proxmox-host.log || fail "no template refusal: $(cat /tmp/kept-proxmox-host.log)"
in_ct "! grep -q '^pct create' /stub/pct.log" || fail "a container was made without a template"
ok "a failed template download: a plain message, no container"
rm -f /tmp/kept-proxmox-host.log

printf '\n\033[32msmoke-proxmox: every check passed (%s, linux-%s)\033[0m\n' "$version" "$arch_name"
