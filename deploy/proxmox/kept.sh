#!/usr/bin/env bash
# Kept on Proxmox VE: makes an unprivileged Debian 13 container and installs Kept in it, without
# Docker (Postgres, Node and Kept run under systemd inside the container). Run it as root in the
# Proxmox VE host's shell:
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh)"
#
# Or read it first: download this file and the release's SHA256SUMS, check, then run it:
#
#   curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh
#   curl -fsSLO https://github.com/keptinventory/kept/releases/download/v1.14.7/SHA256SUMS
#   sha256sum -c --ignore-missing SHA256SUMS && bash kept.sh
#
# What it does on the host: checks the host, asks (Default: nothing but the confirmation;
# Advanced: every setting), downloads the Debian 13 template if it isn't there, creates the
# container with `pct create`, runs deploy/proxmox/kept-install.sh inside it, and writes the
# container's Notes. Nothing else on the host changes: no repositories, no packages, no settings,
# no timers. Nothing is sent anywhere but the downloads (the template, this release's files from
# GitHub, Debian, PostgreSQL, Node and restic packages inside the container).
#
# kept-install.sh is downloaded from this same release and checked against the release's
# SHA256SUMS, whose signature is checked with openssl against the release key below.
#
# Every setting can be preset, which also runs it without questions when var_unattended=yes:
#   var_ctid       the container's ID                 (default: the next free one)
#   var_hostname   its name                           (kept)
#   var_cpu        CPU cores                          (2)
#   var_ram        memory in MB                       (2048)
#   var_swap       swap in MB                         (512)
#   var_disk       disk in GB                         (8)
#   var_storage    where the disk goes                (the first storage that holds containers)
#   var_tmpl_storage  where the template goes         (the first storage that holds templates)
#   var_bridge     the network bridge                 (vmbr0)
#   var_ip         dhcp, or an address with its prefix, such as 192.168.1.50/24   (dhcp)
#   var_gateway    the gateway, with a static address
#   var_vlan       a VLAN tag                         (none)
#   var_dns        DNS servers, space-separated       (the host's)
#   var_ssh_key    a public key file for root's SSH login inside the container   (none)
#   var_timezone   a time zone such as Europe/Paris   (host)
#   var_unattended yes: no questions, no confirmation
#   var_keep_failed  yes: keep the container if the install fails (default: it is destroyed)
# A root password is asked for in Advanced only (never taken from the environment); without one,
# reach the container with `pct enter <id>`.
#
# Written for Proxmox VE 8 and 9, amd64 (arm64 hosts run unofficial ports and are untested).
set -Eeuo pipefail

# This release. Bumped with compose.yaml's image at each release (scripts/proxmox.test.mjs checks).
KEPT_VERSION=1.14.7
REPO=keptinventory/kept

# The release key (cosign.pub at the repository's root; scripts/proxmox.test.mjs checks the copy).
RELEASE_KEY='-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENDxYgebb8wACsIpxmHVDuVfGcDyj
F3bCKVAFa00FNpUOkYKDvUQFLE9QLuo7tB02ihcrDaYYYvaUViVZekA9AQ==
-----END PUBLIC KEY-----'

DOCS=https://keptinventory.info/install/proxmox/
TITLE="Kept $KEPT_VERSION on Proxmox VE"

say() { printf '\033[1m%s\033[0m\n' "$*"; }
note() { printf '  %s\n' "$*"; }
die() {
  printf '\033[31mkept: %s\033[0m\n' "$1" >&2
  [[ -z ${2:-} ]] || printf '  To do it by hand: %s\n' "$2" >&2
  exit 1
}

unattended=
[[ ${var_unattended:-} == yes || ! -t 0 ]] && unattended=1

work=$(mktemp -d)
ctid_created=
cleanup() {
  local rc=$?
  rm -rf "$work"
  if ((rc != 0)) && [[ -n $ctid_created ]]; then
    if [[ ${var_keep_failed:-} == yes ]]; then
      printf 'kept: container %s is kept as it is (var_keep_failed=yes); remove it with: pct stop %s; pct destroy %s --purge\n' \
        "$ctid_created" "$ctid_created" "$ctid_created" >&2
    else
      printf 'kept: removing the unfinished container %s\n' "$ctid_created" >&2
      pct stop "$ctid_created" >/dev/null 2>&1 || true
      pct destroy "$ctid_created" --purge >/dev/null 2>&1 || true
    fi
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# ---------------------------------------------------------------------------------------------
# Preflight: before any question, and before anything is made

preflight() {
  say "Checking this host"
  [[ $EUID -eq 0 ]] || die "run this as root, in the Proxmox VE host's shell"
  local tool
  for tool in pveversion pct pvesh pveam curl openssl perl; do
    command -v "$tool" >/dev/null || die "$tool is missing: this has to run on a Proxmox VE host"
  done
  pve_major=$(pveversion | sed -n 's|^pve-manager/\([0-9]*\)\..*|\1|p')
  [[ $pve_major == 8 || $pve_major == 9 ]] ||
    die "this is Proxmox VE '$(pveversion)'; Kept's script is written for 8 and 9"
  arch=$(dpkg --print-architecture)
  [[ $arch == amd64 || $arch == arm64 ]] || die "Kept runs on amd64 or arm64, not $arch"
  node=$(hostname)
  getent hosts github.com >/dev/null || die "this host can't resolve github.com: check its DNS"
  note "Proxmox VE $(pveversion | sed -n 's|^pve-manager/\([^/]*\)/.*|\1|p'), $arch, node $node"
}

# Storages holding <content> (rootdir or vztmpl), active: "name avail_bytes" lines, from the API.
storages() {
  pvesh get "/nodes/$node/storage" --content "$1" --enabled 1 --output-format json |
    perl -MJSON::PP -e 'my $s = decode_json(join "", <STDIN>);
      for (@$s) { print "$_->{storage} ", ($_->{avail} // 0), "\n" if $_->{active} }'
}

# ---------------------------------------------------------------------------------------------
# Settings

ctid=${var_ctid:-}
hostname=${var_hostname:-kept}
cpu=${var_cpu:-2}
ram=${var_ram:-2048}
swap=${var_swap:-512}
disk=${var_disk:-8}
storage=${var_storage:-}
tmpl_storage=${var_tmpl_storage:-}
bridge=${var_bridge:-vmbr0}
ip=${var_ip:-dhcp}
gateway=${var_gateway:-}
vlan=${var_vlan:-}
dns=${var_dns:-}
ssh_key=${var_ssh_key:-}
timezone=${var_timezone:-host}
password=

wt() { whiptail --backtitle "$TITLE" "$@" 3>&1 1>&2 2>&3; }

# One Advanced question; Cancel stops without changing anything.
askbox() { # <variable> <question>
  local value
  value=$(wt --title "Advanced" --inputbox "$2" 10 70 "${!1}") || die "cancelled: nothing was made"
  printf -v "$1" '%s' "$value"
}

choose() {
  [[ -z $unattended ]] || return 0
  command -v whiptail >/dev/null || die "whiptail is missing; preset the var_* settings and run with var_unattended=yes"
  local mode
  mode=$(wt --title "$TITLE" --menu "Kept in an unprivileged Debian 13 container, without Docker.\n\nDefault: $cpu CPU, $ram MB memory, $disk GB disk, DHCP on $bridge." 15 70 2 \
    default "Default settings" advanced "Choose every setting") || die "cancelled: nothing was made"
  [[ $mode == advanced ]] || return 0
  askbox ctid "Container ID (empty: the next free one)"
  askbox hostname "Host name"
  askbox cpu "CPU cores"
  askbox ram "Memory in MB"
  askbox disk "Disk in GB (photos and documents live on it)"
  local list
  list=$(storages rootdir | awk '{ printf "%s ", $1 }')
  askbox storage "Storage for the disk (empty: the first one). Holds containers here: $list"
  askbox bridge "Network bridge"
  askbox ip "IPv4: dhcp, or an address with its prefix such as 192.168.1.50/24"
  [[ $ip == dhcp ]] || askbox gateway "Gateway"
  askbox vlan "VLAN tag (empty: none)"
  askbox dns "DNS servers, space-separated (empty: the host's)"
  askbox ssh_key "A public key file on this host for SSH into the container as root (empty: none)"
  askbox timezone "Time zone, such as Europe/Paris (host: the host's)"
  local p1 p2
  p1=$(wt --title "Advanced" --passwordbox "Root password inside the container (empty: none; use pct enter)" 10 70) ||
    die "cancelled: nothing was made"
  if [[ -n $p1 ]]; then
    p2=$(wt --title "Advanced" --passwordbox "The same password again" 10 70) || die "cancelled: nothing was made"
    [[ $p1 == "$p2" ]] || die "the two passwords differ: nothing was made"
    password=$p1
  fi
}

check_settings() {
  [[ $cpu =~ ^[1-9][0-9]*$ ]] || die "CPU cores: a whole number, not '$cpu'"
  [[ $ram =~ ^[0-9]+$ && $ram -ge 1024 ]] || die "memory: at least 1024 MB, not '$ram'"
  [[ $swap =~ ^[0-9]+$ ]] || die "swap: a number of MB, not '$swap'"
  [[ $disk =~ ^[0-9]+$ && $disk -ge 4 ]] || die "disk: at least 4 GB, not '$disk'"
  [[ $hostname =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$ ]] || die "'$hostname' is not a host name"
  [[ -d /sys/class/net/$bridge ]] || die "there is no bridge $bridge on this host" "ip link show"
  if [[ $ip != dhcp ]]; then
    [[ $ip =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}$ ]] || die "the address needs its prefix, such as 192.168.1.50/24, not '$ip'"
    [[ $gateway =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || die "a static address needs a gateway, such as 192.168.1.1"
  fi
  [[ -z $vlan || $vlan =~ ^[0-9]+$ ]] || die "the VLAN tag is a number, not '$vlan'"
  [[ -z $ssh_key || -f $ssh_key ]] || die "there is no file $ssh_key"
  [[ $timezone == host || -f /usr/share/zoneinfo/$timezone ]] || die "'$timezone' is not a time zone"

  local line avail
  if [[ -z $storage ]]; then
    storage=$(storages rootdir | awk 'NR == 1 { print $1 }')
    [[ -n $storage ]] || die "no active storage here holds containers" "pvesm status --content rootdir"
  fi
  line=$(storages rootdir | awk -v s="$storage" '$1 == s')
  [[ -n $line ]] || die "storage '$storage' doesn't hold containers (or isn't active)" "pvesm status --content rootdir"
  avail=${line#* }
  ((avail / 1073741824 >= disk)) || die "storage '$storage' has $((avail / 1073741824)) GB free; the disk needs $disk GB"

  if [[ -z $tmpl_storage ]]; then
    tmpl_storage=$(storages vztmpl | awk 'NR == 1 { print $1 }')
    [[ -n $tmpl_storage ]] || die "no active storage here holds templates" "pvesm status --content vztmpl"
  fi

  if [[ -z $ctid ]]; then
    ctid=$(pvesh get /cluster/nextid)
  else
    [[ $ctid =~ ^[0-9]+$ ]] || die "the container ID is a number, not '$ctid'"
    pvesh get /cluster/nextid --vmid "$ctid" >/dev/null 2>&1 || die "ID $ctid is taken"
  fi
}

# ---------------------------------------------------------------------------------------------
# Downloads, checked before anything is made

# The bundle's signature: base64 DER ECDSA over the file, checked against RELEASE_KEY.
verify_signature() { # <file> <bundle>
  local json sig
  json=$(tr -d ' \t\r\n' <"$2")
  json=${json#*\"messageSignature\":}
  json=${json#*\"signature\":\"}
  sig=${json%%\"*}
  [[ $sig =~ ^[A-Za-z0-9+/=]+$ ]] || die "the release's SHA256SUMS signature is missing"
  printf '%s\n' "$RELEASE_KEY" >"$work/key.pem"
  printf '%s' "$sig" | openssl base64 -d -A >"$work/sig.der"
  openssl dgst -sha256 -verify "$work/key.pem" -signature "$work/sig.der" "$1" >/dev/null 2>&1 ||
    die "the release's SHA256SUMS doesn't verify with the release key: stopping"
}

fetch() { curl -fsSL --retry 3 --proto '=https' -o "$2" "$1" || die "could not download $1"; }

get_installer() {
  say "Kept $KEPT_VERSION's installer"
  local base="https://github.com/$REPO/releases/download/v$KEPT_VERSION" want
  fetch "$base/SHA256SUMS" "$work/SHA256SUMS"
  fetch "$base/SHA256SUMS.sigstore.json" "$work/SHA256SUMS.sigstore.json"
  verify_signature "$work/SHA256SUMS" "$work/SHA256SUMS.sigstore.json"
  local name=arm64 tarball
  [[ $arch == amd64 ]] && name=x64
  tarball=kept-$KEPT_VERSION-linux-$name.tar.gz
  grep -q "  $tarball\$" "$work/SHA256SUMS" || die "release $KEPT_VERSION has no $tarball"
  fetch "https://raw.githubusercontent.com/$REPO/v$KEPT_VERSION/deploy/proxmox/kept-install.sh" "$work/kept-install.sh"
  want=$(awk '$2 == "kept-install.sh" { print $1 }' "$work/SHA256SUMS")
  [[ -n $want && $(sha256sum "$work/kept-install.sh" | cut -d' ' -f1) == "$want" ]] ||
    die "kept-install.sh doesn't match the release's SHA256SUMS: stopping"
  note "kept-install.sh checked against the signed SHA256SUMS"
}

# The newest Debian 13 template for this architecture, downloaded if it isn't on the storage yet.
get_template() {
  say "The Debian 13 template"
  pveam update >/dev/null || die "the template list could not be updated (network or DNS)" "pveam update"
  template=$(pveam available --section system |
    awk -v a="$arch" '{ for (i = 1; i <= NF; i++) if ($i ~ ("^debian-13-standard_.*_" a "\\.tar\\.(zst|xz|gz)$")) print $i }' |
    sort -V | tail -n1)
  [[ -n $template ]] || die "no Debian 13 template for $arch in the template list" "pveam available --section system"
  if ! pveam list "$tmpl_storage" | grep -q "vztmpl/$template"; then
    pveam download "$tmpl_storage" "$template" >/dev/null ||
      die "the template download failed (this host's network or the storage)" "pveam download $tmpl_storage $template"
  fi
  note "$tmpl_storage:vztmpl/$template"
}

# ---------------------------------------------------------------------------------------------
# The container

build_command() {
  local net0="name=eth0,bridge=$bridge,ip=$ip"
  [[ $ip == dhcp ]] || net0+=",gw=$gateway"
  [[ -z $vlan ]] || net0+=",tag=$vlan"
  # shellcheck disable=SC2054 # the commas are pct's, inside one argument
  create=(pct create "$ctid" "$tmpl_storage:vztmpl/$template"
    --arch "$arch" --ostype debian --hostname "$hostname"
    --cores "$cpu" --memory "$ram" --swap "$swap" --rootfs "$storage:$disk"
    --net0 "$net0" --unprivileged 1 --features nesting=1,keyctl=0
    --onboot 1 --timezone "$timezone" --tags kept)
  [[ -z $dns ]] || create+=(--nameserver "$dns")
  [[ -z $ssh_key ]] || create+=(--ssh-public-keys "$ssh_key")
}

confirm() {
  local text
  text="Container $ctid ($hostname): unprivileged Debian 13, $cpu CPU, $ram MB memory, $disk GB on $storage, $ip on $bridge${vlan:+ VLAN $vlan}.
Then Kept $KEPT_VERSION inside it, at port 8080.

$(printf '%q ' "${create[@]}")${password:+
(the root password is set after the start, not on this line)}"
  say "The container"
  printf '%s\n' "$text"
  [[ -z $unattended ]] || return 0
  wt --title "Create it?" --yesno "$text" 22 78 || die "cancelled: nothing was made"
}

create_container() {
  say "Creating container $ctid"
  "${create[@]}" >/dev/null || die "pct create failed"
  ctid_created=$ctid
  pct start "$ctid"
  if [[ -n $password ]]; then
    printf 'root:%s\n' "$password" | pct exec "$ctid" -- chpasswd
  fi
  # Its address, once the network is up and DNS answers inside it.
  local i
  for ((i = 0; i < 60; i++)); do
    address=$(pct exec "$ctid" -- ip -4 -o addr show dev eth0 scope global 2>/dev/null |
      awk '{ split($4, a, "/"); print a[1]; exit }')
    [[ -n $address ]] && pct exec "$ctid" -- getent hosts deb.debian.org >/dev/null 2>&1 && break
    sleep 2
  done
  [[ -n $address ]] || die "container $ctid got no IPv4 address on $bridge in 2 minutes"
  pct exec "$ctid" -- getent hosts deb.debian.org >/dev/null 2>&1 || die "container $ctid can't resolve names: check DNS"
  note "address $address"
}

install_kept() {
  say "Installing Kept inside container $ctid (a few minutes)"
  pct push "$ctid" "$work/kept-install.sh" /root/kept-install.sh --perms 0755
  pct exec "$ctid" -- env KEPT_URL="http://$address:8080" KEPT_CTID="$ctid" bash /root/kept-install.sh install ||
    die "the install inside container $ctid failed (its output is above)"
  pct exec "$ctid" -- rm -f /root/kept-install.sh
}

finish() {
  local notes
  notes="## Kept

- **Address:** http://$address:8080 (the first account made there becomes the admin; the setup code is in \`/root/kept.creds\`)
- **Update:** \`update\` in this container's console
- **Backups:** add this container to a backup job (Datacenter, Backup), mode snapshot
- **Keys:** \`kept admin recovery-kit\` in the console; keep it off this server
- **Guide:** $DOCS"
  pct set "$ctid" --description "$notes" >/dev/null || true
  ctid_created=
  say "Kept is running"
  cat <<EOF

  Open    http://$address:8080
          The first account made there becomes the instance admin; it asks for the setup code
          in /root/kept.creds inside the container (pct exec $ctid -- cat /root/kept.creds).
  Keys    pct exec $ctid -- kept admin recovery-kit
          Keep that text somewhere other than this server.
  Update  pct enter $ctid, then: update
  Backup  add container $ctid to a backup job (Datacenter, Backup), mode snapshot, or:
          vzdump $ctid --mode snapshot
  Guide   $DOCS

  The same is in the container's Notes. Printed labels carry the address: give the container a
  fixed address (a DHCP reservation, or var_ip) before you print any.
EOF
}

preflight
choose
check_settings
get_installer
get_template
build_command
confirm
create_container
install_kept
finish
