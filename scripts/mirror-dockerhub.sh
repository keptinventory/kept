#!/usr/bin/env bash
# Copy one published release from GHCR to Docker Hub: the same index (so the same digest), its
# floating tags X.Y and X when GHCR has them on that digest, and a signature made with the release
# key on the Docker Hub copy. Nothing is rebuilt. Run by .github/workflows/dockerhub.yml after a
# release, or by hand for a release that is already out.
#
#   bash scripts/mirror-dockerhub.sh <X.Y.Z[-pre]>
#
# Both registries must be logged in (docker login). The signature: KEPT_COSIGN_KEY names the key
# file and COSIGN_PASSWORD is its password (both as in scripts/release.sh); KEPT_RELEASE_TLOG=1
# signs into the public transparency log, as releases of the public repository do.
# KEPT_MIRROR_UNSIGNED=1 copies without signing (a release that went out unsigned).
# For a dry run against a local registry: KEPT_MIRROR_DST, KEPT_MIRROR_PUB (the throwaway public
# key) and KEPT_MIRROR_HTTP=1.
#
# `cosign copy` is not used: it is deprecated and does not carry the signature format cosign 3
# writes, so the copy is signed again with the same key instead.
set -euo pipefail

version=${1:-}
[[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] ||
  { echo "usage: mirror-dockerhub.sh <X.Y.Z[-pre]> (got '${version}')" >&2; exit 2; }
src=${KEPT_MIRROR_SRC:-ghcr.io/keptinventory/kept}
dst=${KEPT_MIRROR_DST:-docker.io/keptinventory/kept}
pub=${KEPT_MIRROR_PUB:-cosign.pub}
unsigned=${KEPT_MIRROR_UNSIGNED:-}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# The index's digest, read from the plain output (older buildx ignores --format).
digest_of() { docker buildx imagetools inspect "$1" 2>/dev/null | awk '/^Digest:/ { print $2; exit }' || true; }

cosign=
if [[ $unsigned != 1 ]]; then
  cosign=${COSIGN:-$(bash scripts/tools.sh path cosign)}
  [[ -n ${KEPT_COSIGN_KEY:-} && -f ${KEPT_COSIGN_KEY:-} ]] ||
    { echo "mirror: KEPT_COSIGN_KEY must name the cosign key file (or KEPT_MIRROR_UNSIGNED=1)" >&2; exit 1; }
  [[ -f $pub ]] || { echo "mirror: no public key at $pub" >&2; exit 1; }
fi
http=()
[[ ${KEPT_MIRROR_HTTP:-} == 1 ]] && http=(--allow-http-registry)

digest=$(digest_of "$src:$version")
[[ $digest == sha256:* ]] || { echo "mirror: $src:$version not found" >&2; exit 1; }
echo "mirror: $src:$version is $digest"

# X.Y and X follow the release only where GHCR already moved them (release.sh tags them for the
# newest final release of a line); a prerelease never moves them.
tags=("$version")
if [[ $version != *-* ]]; then
  minor=${version%.*} major=${version%%.*}
  for t in "$minor" "$major"; do
    [[ $(digest_of "$src:$t") == "$digest" ]] && tags+=("$t")
  done
fi

args=()
for t in "${tags[@]}"; do args+=(-t "$dst:$t"); done
docker buildx imagetools create "${args[@]}" "$src@$digest" >"$work/copy.log" 2>&1 ||
  { cat "$work/copy.log" >&2; echo "mirror: copying to $dst failed" >&2; exit 1; }

verify=()
if [[ $unsigned != 1 ]]; then
  sign=()
  if [[ ${KEPT_RELEASE_TLOG:-} != 1 ]]; then
    "$cosign" signing-config create --out "$work/no-tlog.json" >/dev/null
    sign+=(--signing-config "$work/no-tlog.json")
    verify+=(--insecure-ignore-tlog)
  fi
  # COSIGN_PASSWORD comes from the environment; cosign never prints it.
  "$cosign" sign --yes --recursive --key "$KEPT_COSIGN_KEY" ${sign[@]+"${sign[@]}"} \
    ${http[@]+"${http[@]}"} "$dst@$digest" >"$work/sign.log" 2>&1 ||
    { tail -n 20 "$work/sign.log" >&2; echo "mirror: signing $dst@$digest failed" >&2; exit 1; }
fi

for t in "${tags[@]}"; do
  got=$(digest_of "$dst:$t")
  [[ $got == "$digest" ]] || { echo "mirror: $dst:$t is '$got', not $digest" >&2; exit 1; }
  if [[ $unsigned != 1 ]]; then
    "$cosign" verify --key "$pub" ${verify[@]+"${verify[@]}"} ${http[@]+"${http[@]}"} "$dst:$t" \
      >/dev/null 2>"$work/verify.log" ||
      { cat "$work/verify.log" >&2; echo "mirror: the signature on $dst:$t does not verify" >&2; exit 1; }
    echo "mirror: $dst:$t → $digest, signature verified"
  else
    echo "mirror: $dst:$t → $digest (unsigned)"
  fi
done
