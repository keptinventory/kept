#!/usr/bin/env bash
# The release tarballs, for installs without Docker (deploy/proxmox/): the image's /app tree as
# kept-<version>-linux-x64.tar.gz and kept-<version>-linux-arm64.tar.gz, built from the same
# Dockerfile stages as the image (`--target app-tarball`), then one SHA256SUMS over both tarballs
# and the two Proxmox scripts, signed with the release's cosign key. The installer checks that
# signature against the public key it carries (cosign.pub) with openssl, then each file's
# SHA-256 against SHA256SUMS: no cosign is needed inside the container.
#
#   bash scripts/release/tarball.sh build <version> <amd64|arm64> <out-dir>
#       builds this commit (`git archive HEAD`) for that platform; writes
#       <out-dir>/kept-<version>-linux-<x64|arm64>.tar.gz and checks what is in it
#   bash scripts/release/tarball.sh sums <dir>
#       writes <dir>/SHA256SUMS over the tarballs in <dir> and deploy/proxmox/kept.sh and
#       kept-install.sh (copied into <dir>, so `sha256sum -c` finds them)
#   bash scripts/release/tarball.sh sign <dir>
#       signs <dir>/SHA256SUMS into <dir>/SHA256SUMS.sigstore.json (KEPT_COSIGN_KEY, COSIGN_PASSWORD,
#       KEPT_RELEASE_TLOG as scripts/release/sign.sh), then verifies it with cosign and the way the
#       installer does
#
# Settings (environment): KEPT_RELEASE_BUILDER (a buildx builder; the default one otherwise),
# KEPT_RELEASE_CACHE_FROM (buildx --cache-from), KEPT_RELEASE_SOURCE (the repository URL stamped
# in release.env; default https://github.com/keptinventory/kept).
set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$repo"

die() {
  printf 'tarball: %s\n' "$*" >&2
  exit 1
}
note() { echo "tarball: $*"; }

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# Node's name for the architecture, as in Node's own tarballs.
node_arch() {
  case "$1" in
    amd64) echo x64 ;;
    arm64) echo arm64 ;;
    *) die "the architecture is amd64 or arm64, not '$1'" ;;
  esac
}

build() {
  local version=$1 arch=$2 out=$3 name tmp commit source builder=() cache=() file listing
  [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || die "'$version' is not a version"
  name=$(node_arch "$arch")
  mkdir -p "$out"
  out=$(cd "$out" && pwd)
  commit=$(git rev-parse HEAD)
  source=${KEPT_RELEASE_SOURCE:-https://github.com/keptinventory/kept}
  [[ -n ${KEPT_RELEASE_BUILDER:-} ]] && builder=(--builder "$KEPT_RELEASE_BUILDER")
  [[ -n ${KEPT_RELEASE_CACHE_FROM:-} ]] && cache=(--cache-from "$KEPT_RELEASE_CACHE_FROM")
  tmp=$(mktemp -d "${TMPDIR:-/tmp}/kept-tarball.XXXXXX")
  # shellcheck disable=SC2064 # the path is fixed now
  trap "rm -rf '$tmp'" EXIT

  # Exactly the commit: no uncommitted or ignored file reaches the build.
  mkdir -p "$tmp/src"
  git archive --format=tar "$commit" | tar -x -C "$tmp/src"
  note "building linux/$arch of ${commit:0:12} as $version"
  docker buildx build ${builder[@]+"${builder[@]}"} --platform "linux/$arch" --target app-tarball \
    --build-arg "VERSION=$version" --build-arg "REVISION=$commit" --build-arg "SOURCE=$source" \
    ${cache[@]+"${cache[@]}"} --output "type=tar,dest=$tmp/kept.tar" "$tmp/src" >"$tmp/build.log" 2>&1 || {
    cp "$tmp/build.log" "$out/build-$arch.log"
    tail -n 30 "$tmp/build.log" >&2
    die "the build failed (the whole log: $out/build-$arch.log)"
  }
  file=$out/kept-$version-linux-$name.tar.gz
  gzip -9 -n <"$tmp/kept.tar" >"$file"

  # What the installer relies on: the entry points, release.env naming this version and commit,
  # and the platform's own prebuilt sharp.
  listing=$(tar -tzf "$file")
  for path in kept/apps/server/dist/main.js kept/apps/server/dist/cli/index.js \
    kept/apps/server/dist/observability/tracing.js kept/apps/web/dist/index.html \
    kept/apps/server/migrations/meta/_journal.json kept/release.env kept/THIRD-PARTY-NOTICES.txt kept/LICENSE; do
    grep -qx "$path" <<<"$listing" || grep -qx "./$path" <<<"$listing" || die "$path is missing from $file"
  done
  grep -q "node_modules/\.pnpm/@img+sharp-linux-$name@" <<<"$listing" ||
    die "$file has no prebuilt sharp for linux-$name"
  tar -xzOf "$file" kept/release.env >"$tmp/release.env"
  grep -qx "KEPT_VERSION=$version" "$tmp/release.env" || die "release.env doesn't name $version"
  grep -qx "KEPT_REVISION=$commit" "$tmp/release.env" || die "release.env doesn't name $commit"
  note "$file ($(du -h "$file" | cut -f1), sha256 $(sha256_of "$file"))"
}

sums() {
  local dir=$1 f
  [[ -d $dir ]] || die "$dir is not a directory"
  cp deploy/proxmox/kept.sh deploy/proxmox/kept-install.sh "$dir/"
  (
    cd "$dir"
    shopt -s nullglob
    local files=(kept-*-linux-*.tar.gz kept.sh kept-install.sh)
    [[ ${#files[@]} -gt 2 ]] || die "no tarball in $dir"
    : >SHA256SUMS
    for f in "${files[@]}"; do printf '%s  %s\n' "$(sha256_of "$f")" "$f" >>SHA256SUMS; done
  )
  note "$dir/SHA256SUMS:"
  cat "$dir/SHA256SUMS"
}

# The signature as deploy/proxmox/kept-install.sh reads it: the bundle's messageSignature, a
# base64 DER ECDSA signature over the file's SHA-256, checked with openssl against cosign.pub.
openssl_verify() { # <file> <bundle> <public key>
  local json sig tmp
  json=$(tr -d ' \t\r\n' <"$2")
  json=${json#*\"messageSignature\":}
  json=${json#*\"signature\":\"}
  sig=${json%%\"*}
  [[ $sig =~ ^[A-Za-z0-9+/=]+$ ]] || die "no signature in $2"
  tmp=$(mktemp "${TMPDIR:-/tmp}/kept-sig.XXXXXX")
  printf '%s' "$sig" | openssl base64 -d -A >"$tmp"
  openssl dgst -sha256 -verify "$3" -signature "$tmp" "$1" >/dev/null || {
    rm -f "$tmp"
    die "openssl does not verify $1 with $3"
  }
  rm -f "$tmp"
}

sign() {
  local dir=$1 cosign key flags=() vflags=()
  [[ -s $dir/SHA256SUMS ]] || die "$dir/SHA256SUMS is missing: run sums first"
  # shellcheck source=scripts/tools.sh
  source "$repo/scripts/tools.sh"
  cosign=$(tool_path cosign) || die "cosign not found: bash scripts/tools.sh fetch cosign"
  key=${KEPT_COSIGN_KEY:-}
  [[ -n $key && -f $key ]] || die "KEPT_COSIGN_KEY must name the cosign private key file"
  [[ -n ${COSIGN_PASSWORD+set} ]] || die "COSIGN_PASSWORD must be set"
  local pub=${KEPT_COSIGN_PUB:-$repo/cosign.pub}
  if [[ ${KEPT_RELEASE_TLOG:-} != 1 ]]; then
    "$cosign" signing-config create --out "$dir/.no-tlog.json" >/dev/null
    flags+=(--signing-config "$dir/.no-tlog.json")
    vflags+=(--insecure-ignore-tlog)
  fi
  "$cosign" sign-blob --yes --key "$key" ${flags[@]+"${flags[@]}"} \
    --bundle "$dir/SHA256SUMS.sigstore.json" "$dir/SHA256SUMS" >"$dir/.sign.log" 2>&1 || {
    tail -n 20 "$dir/.sign.log" >&2
    die "cosign sign-blob failed"
  }
  "$cosign" verify-blob --key "$pub" ${vflags[@]+"${vflags[@]}"} \
    --bundle "$dir/SHA256SUMS.sigstore.json" "$dir/SHA256SUMS" >"$dir/.verify.log" 2>&1 || {
    cat "$dir/.verify.log" >&2
    die "cosign verify-blob failed"
  }
  openssl_verify "$dir/SHA256SUMS" "$dir/SHA256SUMS.sigstore.json" "$pub"
  rm -f "$dir/.no-tlog.json" "$dir/.sign.log" "$dir/.verify.log"
  note "SHA256SUMS signed; verified by cosign and by openssl as the installer does"
}

cmd=${1:-}
shift || true
case "$cmd" in
  build) [[ $# -eq 3 ]] || die "usage: tarball.sh build <version> <amd64|arm64> <out-dir>"; build "$@" ;;
  sums) [[ $# -eq 1 ]] || die "usage: tarball.sh sums <dir>"; sums "$@" ;;
  sign) [[ $# -eq 1 ]] || die "usage: tarball.sh sign <dir>"; sign "$@" ;;
  *) die "usage: tarball.sh build|sums|sign …" ;;
esac
