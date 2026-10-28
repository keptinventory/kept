# shellcheck shell=bash
# Stage 3 of scripts/release.sh (sourced): build the platforms in $platforms from the commit and
# push BY DIGEST, with no tag, an SBOM and minimal provenance as BuildKit attestations
# inside the index. One run builds both (the laptop); the workflow builds one per
# runner (--arch) and release_merge joins the two digests into one index (--publish).
# Sets index_digest and amd64_digest and/or arm64_digest.

# Exactly the commit: no uncommitted or ignored file reaches the build context (or the chart).
release_export_src() {
  local src=$work/src
  rm -rf "$src"
  mkdir -p "$src"
  git archive --format=tar "$commit" | tar -x -C "$src"
}

release_build() {
  say "3. build ${platforms//,/ + } of ${commit:0:12}, push by digest to $registry"
  docker buildx version >/dev/null 2>&1 || die "docker buildx is not available in DOCKER_CONFIG=${DOCKER_CONFIG:-~/.docker}"
  release_export_src
  local src=$work/src

  # A docker-container builder: the default `docker` driver can't push a multi-platform index by
  # digest. A dry run's builder shares the host network and treats the local registry as HTTP.
  if ! docker buildx inspect "$builder" >/dev/null 2>&1; then
    local create=(docker buildx create --name "$builder" --driver docker-container
      --driver-opt "image=$BUILDKIT_IMAGE")
    if [[ -n $http_registry ]]; then
      printf '[registry."%s"]\n  http = true\n  insecure = true\n' "${registry%%/*}" >"$work/buildkitd.toml"
      create+=(--driver-opt network=host --config "$work/buildkitd.toml")
    fi
    "${create[@]}" >/dev/null
    [[ -n $dry ]] && cleanup_cmds+=("docker buildx rm --force '$builder'")
  fi
  docker buildx inspect --bootstrap "$builder" >/dev/null

  local meta=$work/build-metadata.json log=$work/build.log attempt rc cache=()
  # The workflow's layer cache (a registry cache per architecture); the laptop keeps its builder's
  # own cache instead.
  [[ -n ${KEPT_RELEASE_CACHE_FROM:-} ]] && cache+=(--cache-from "$KEPT_RELEASE_CACHE_FROM")
  [[ -n ${KEPT_RELEASE_CACHE_TO:-} ]] && cache+=(--cache-to "$KEPT_RELEASE_CACHE_TO")
  # In CI each attempt is capped (KEPT_RELEASE_BUILD_TIMEOUT, default 15m; the job allows 40): a push
  # to GHCR once hung for 987 s and then failed (v1.7.0), and the re-run took 1.6 min.
  local tmo=()
  [[ -n ${CI:-} ]] && command -v timeout >/dev/null && tmo=(timeout --kill-after=30s "${KEPT_RELEASE_BUILD_TIMEOUT:-15m}")
  for attempt in 1 2; do
    rc=0
    ${tmo[@]+"${tmo[@]}"} docker buildx build --builder "$builder" --platform "$platforms" \
      --build-arg "VERSION=$version" --build-arg "REVISION=$commit" --build-arg "SOURCE=$source_url" \
      --sbom=true --provenance=mode=min --metadata-file "$meta" ${cache[@]+"${cache[@]}"} \
      --output "type=image,name=$registry,push-by-digest=true,name-canonical=true,push=true" \
      "$src" >"$log" 2>&1 || rc=$?
    ((rc == 0)) && break
    tail -n 25 "$log" >&2
    # Under emulation (the laptop's amd64 half) registry fetches time out under load (R2).
    if ((attempt == 1)) && grep -Eq 'ERR_PNPM_BROKEN_METADATA_JSON|ETIMEDOUT|ECONNRESET|i/o timeout|aborted due to timeout' "$log"; then
      warn "the build hit a network timeout; retrying once"
      continue
    fi
    # The registry refused or dropped the upload, or the attempt ran out of time: the layer cache
    # makes a second attempt cheap.
    if ((attempt == 1)) && { ((rc == 124 || rc == 137)) || grep -Eq 'failed to push|unexpected status from (PUT|POST|PATCH|HEAD) request' "$log"; }; then
      warn "the push failed or timed out (exit $rc); retrying once"
      continue
    fi
    die "the build failed (log: $log)"
  done

  index_digest=$(node -e 'const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); process.stdout.write(m["containerimage.digest"] ?? "")' "$meta")
  [[ $index_digest =~ ^sha256:[0-9a-f]{64}$ ]] || die "no index digest in $meta"

  # The per-platform manifests inside the index (attestation manifests are `unknown/unknown`).
  local raw p arch
  raw=$(docker buildx imagetools inspect --builder "$builder" --raw "$registry@$index_digest")
  note "index $index_digest"
  for p in ${platforms//,/ }; do
    arch=${p#linux/}
    printf -v "${arch}_digest" '%s' "$(platform_digest "$raw" "$arch")"
    p=${arch}_digest
    [[ -n ${!p} ]] || die "the index has no $p manifest"
    note "linux/$arch ${!p}"
  done
  if [[ -n $http_registry ]]; then
    local tags
    tags=$(curl -s "http://${registry%%/*}/v2/${registry#*/}/tags/list" || true)
    [[ $tags != *'"tags":["'* ]] || die "the registry already holds tags before signing: $tags"
    note "no tag exists yet (pushed by digest)"
  fi
}

# --publish: one index from the two per-architecture indexes the workflow's build jobs pushed and
# smoked (KEPT_RELEASE_<ARCH>_INDEX), pushed BY DIGEST with no tag, its platform manifests exactly
# the ones smoked (KEPT_RELEASE_<ARCH>_MANIFEST). imagetools copies each source's manifests and
# attestations (the SBOMs) as they are, so no digest changes. It can push only to a reference, so
# the reference is the new index's own digest, read from a --dry-run (which prints the index
# bytes and a newline). Sets index_digest, amd64_digest, arm64_digest.
release_merge() {
  say "3. join the two architectures into one index, push by digest to $registry"
  local arch var srcs=() raw got
  for arch in amd64 arm64; do
    var=KEPT_RELEASE_$(upper "$arch")_INDEX
    [[ ${!var:-} =~ ^sha256:[0-9a-f]{64}$ ]] || die "$var must be the $arch build job's index digest, not '${!var:-}'"
    srcs+=("$registry@${!var}")
  done
  docker buildx imagetools create --dry-run "${srcs[@]}" >"$work/index.json" 2>"$work/merge.log" || {
    cat "$work/merge.log" >&2
    die "imagetools create --dry-run failed"
  }
  index_digest=$(manifest_digest "$work/index.json" strip-newline)
  raw=$(<"$work/index.json")
  for arch in amd64 arm64; do
    var=KEPT_RELEASE_$(upper "$arch")_MANIFEST
    got=$(platform_digest "$raw" "$arch")
    [[ -n $got && $got == "${!var:-}" ]] || die "the joined index has linux/$arch '$got', but the build job smoked '${!var:-}'"
    printf -v "${arch}_digest" '%s' "$got"
  done
  docker buildx imagetools create -t "$registry@$index_digest" "${srcs[@]}" >"$work/merge.log" 2>&1 || {
    cat "$work/merge.log" >&2
    die "imagetools create failed"
  }
  docker buildx imagetools inspect --raw "$registry@$index_digest" >"$work/index-pushed.json"
  got=$(manifest_digest "$work/index-pushed.json")
  [[ $got == "$index_digest" ]] || die "the registry holds $got for $index_digest"
  note "index $index_digest"
  note "linux/amd64 $amd64_digest (smoked natively)"
  note "linux/arm64 $arm64_digest (smoked natively)"
}

upper() { tr '[:lower:]' '[:upper:]' <<<"$1"; }

manifest_digest() { # <file> [strip-newline]: sha256 of the file's bytes, less one trailing newline
  node -e '
    let b = require("fs").readFileSync(process.argv[1]);
    if (process.argv[2] && b[b.length - 1] === 10) b = b.subarray(0, -1);
    process.stdout.write("sha256:" + require("crypto").createHash("sha256").update(b).digest("hex"));
  ' "$1" ${2:+"$2"}
}

platform_digest() { # <index json> <arch>
  node -e '
    const idx = JSON.parse(process.argv[1]);
    const m = (idx.manifests ?? []).find((x) => x.platform?.os === "linux" && x.platform?.architecture === process.argv[2]);
    process.stdout.write(m?.digest ?? "");
  ' "$1" "$2"
}

# ---------------------------------------------------------------------------------------------
# The Home Assistant app's image (D272): the same commit and Dockerfile, `--target ha`, pushed BY
# DIGEST to $ha_registry (ghcr.io/keptinventory/kept-ha) beside the main image. Its layers below the
# app (build, prod-deps) come from the same builder cache, so it costs the Postgres server's layer
# and one more push. Sets ha_index_digest and ha_amd64_digest and/or ha_arm64_digest.
release_build_ha() {
  say "3b. build the Home Assistant app's image (${platforms//,/ + }), push by digest to $ha_registry"
  local src=$work/src meta=$work/build-ha-metadata.json log=$work/build-ha.log attempt rc cache=()
  [[ -n ${KEPT_RELEASE_CACHE_FROM:-} ]] && cache+=(--cache-from "$KEPT_RELEASE_CACHE_FROM")
  local tmo=()
  [[ -n ${CI:-} ]] && command -v timeout >/dev/null && tmo=(timeout --kill-after=30s "${KEPT_RELEASE_BUILD_TIMEOUT:-15m}")
  for attempt in 1 2; do
    rc=0
    ${tmo[@]+"${tmo[@]}"} docker buildx build --builder "$builder" --platform "$platforms" --target ha \
      --build-arg "VERSION=$version" --build-arg "REVISION=$commit" --build-arg "SOURCE=$source_url" \
      --sbom=true --provenance=mode=min --metadata-file "$meta" ${cache[@]+"${cache[@]}"} \
      --output "type=image,name=$ha_registry,push-by-digest=true,name-canonical=true,push=true" \
      "$src" >"$log" 2>&1 || rc=$?
    ((rc == 0)) && break
    tail -n 25 "$log" >&2
    if ((attempt == 1)) && { ((rc == 124 || rc == 137)) || grep -Eq 'ETIMEDOUT|ECONNRESET|i/o timeout|failed to push|unexpected status from (PUT|POST|PATCH|HEAD) request' "$log"; }; then
      warn "the Home Assistant image's build or push failed (exit $rc); retrying once"
      continue
    fi
    die "the Home Assistant image's build failed (log: $log)"
  done
  ha_index_digest=$(node -e 'const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); process.stdout.write(m["containerimage.digest"] ?? "")' "$meta")
  [[ $ha_index_digest =~ ^sha256:[0-9a-f]{64}$ ]] || die "no index digest in $meta"
  local raw p arch
  raw=$(docker buildx imagetools inspect --builder "$builder" --raw "$ha_registry@$ha_index_digest")
  note "index $ha_index_digest"
  for p in ${platforms//,/ }; do
    arch=${p#linux/}
    printf -v "ha_${arch}_digest" '%s' "$(platform_digest "$raw" "$arch")"
    p=ha_${arch}_digest
    [[ -n ${!p} ]] || die "the Home Assistant index has no $p manifest"
    note "linux/$arch ${!p}"
  done
}

# --publish: the Home Assistant image's two smoked digests (KEPT_RELEASE_HA_<ARCH>_INDEX and
# _MANIFEST) joined into one index by digest, as release_merge does for the main image.
release_merge_ha() {
  say "3b. join the Home Assistant app's two architectures, push by digest to $ha_registry"
  local arch var srcs=() raw got
  for arch in amd64 arm64; do
    var=KEPT_RELEASE_HA_$(upper "$arch")_INDEX
    [[ ${!var:-} =~ ^sha256:[0-9a-f]{64}$ ]] || die "$var must be the $arch build job's Home Assistant index digest, not '${!var:-}'"
    srcs+=("$ha_registry@${!var}")
  done
  docker buildx imagetools create --dry-run "${srcs[@]}" >"$work/ha-index.json" 2>"$work/ha-merge.log" || {
    cat "$work/ha-merge.log" >&2
    die "imagetools create --dry-run failed (Home Assistant image)"
  }
  ha_index_digest=$(manifest_digest "$work/ha-index.json" strip-newline)
  raw=$(<"$work/ha-index.json")
  for arch in amd64 arm64; do
    var=KEPT_RELEASE_HA_$(upper "$arch")_MANIFEST
    got=$(platform_digest "$raw" "$arch")
    [[ -n $got && $got == "${!var:-}" ]] || die "the joined Home Assistant index has linux/$arch '$got', but the build job smoked '${!var:-}'"
    printf -v "ha_${arch}_digest" '%s' "$got"
  done
  docker buildx imagetools create -t "$ha_registry@$ha_index_digest" "${srcs[@]}" >"$work/ha-merge.log" 2>&1 || {
    cat "$work/ha-merge.log" >&2
    die "imagetools create failed (Home Assistant image)"
  }
  docker buildx imagetools inspect --raw "$ha_registry@$ha_index_digest" >"$work/ha-index-pushed.json"
  got=$(manifest_digest "$work/ha-index-pushed.json")
  [[ $got == "$ha_index_digest" ]] || die "the registry holds $got for $ha_index_digest"
  note "index $ha_index_digest (linux/amd64 $ha_amd64_digest, linux/arm64 $ha_arm64_digest)"
}

# A Home Assistant image an earlier run of this version published (release.sh stage 1): its digests,
# read from the registry, for the record. Nothing is built, signed or tagged again.
release_ha_published() {
  say "3b. $ha_registry:$version is already published: reading its digests"
  local raw
  docker buildx imagetools inspect --raw "$ha_registry:$version" >"$work/ha-index-published.json"
  ha_index_digest=$(manifest_digest "$work/ha-index-published.json")
  raw=$(<"$work/ha-index-published.json")
  ha_amd64_digest=$(platform_digest "$raw" amd64)
  ha_arm64_digest=$(platform_digest "$raw" arm64)
  note "index $ha_index_digest (linux/amd64 $ha_amd64_digest, linux/arm64 $ha_arm64_digest)"
}
