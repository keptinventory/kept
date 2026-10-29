---
title: Releasing
description: How a Kept release is cut - CI on main as the gate, a pushed tag, the release workflow, what gets published, the laptop fallback and the dry run.
---

A release is a pushed tag. The gate runs on the maintainer's machine first; the tag starts
[`.github/workflows/release.yml`](https://github.com/keptinventory/kept/blob/main/.github/workflows/release.yml),
which runs `scripts/release.sh --ci` on a GitHub-hosted runner and creates the GitHub release.
The full procedure, with every command and a table of what to do when a stage fails, is the
[release runbook](https://github.com/keptinventory/kept/blob/main/docs/runbooks/release.md). This
page is the map.

:::note[Releases so far]
`v1.0.0` is the first release, signed. Every final release must be signed: see
[signing](/maintainers/signing/).
:::

## Versions and tags

- **Git tags** are `vX.Y.Z`, or `vX.Y.Z-<prerelease>` such as `v1.0.0-rc.1`: semver without build
  metadata, checked exactly by `scripts/release/version.mjs`. The version must be newer than every
  other `v*` tag, and a pushed tag is never moved.
- **Image tags** drop the `v`: always `X.Y.Z`, plus `X.Y` and `X` only when this is the newest final
  release of that line, so a patch to an old line never moves a newer line's tags. A prerelease
  gets its exact tag only. There is never a `latest`.
- **The chart's version is the release's version.** `scripts/release/chart.sh` packages the chart with
  `--version X.Y.Z --app-version X.Y.Z`; the committed `charts/kept/Chart.yaml` stays `0.0.0-dev`
  (`scripts/check-helm.sh` fails if it is edited by hand). Each published chart pins one image
  digest, and the release still refuses a chart version the registry already holds.
- **Commits** follow Conventional Commits; the [changelog](/maintainers/changelog/) is built from
  them.

## What a release publishes

In this order, stopping at the first failure (D87, D186, D187):

1. a **multi-arch image** (linux/amd64 and linux/arm64) built from `git archive` of the tagged
   commit, with an SPDX SBOM and minimal provenance in its index, pushed **by digest, with no tag**;
2. each architecture **pulled by digest and smoked** with `scripts/smoke-image.sh` (arm64
   natively, amd64 under emulation), and `/version` checked to report this version and commit;
3. the index digest and every manifest under it **signed with cosign**, then verified;
4. the **tags**, all pointing at that one signed digest, each verified;
5. the **Helm chart** as an OCI artifact beside the image, its image pinned by the signed digest,
   signed too;
6. the **release record** `docs/releases/X.Y.Z.md`: digests, tags, the chart and the verify
   commands;
7. the **GitHub release** `vX.Y.Z`, with `THIRD-PARTY-NOTICES.txt` and `X.Y.Z.md` attached,
   marked a prerelease for `X.Y.Z-…`. Its page (`scripts/release/compose-notes.mjs`) is the
   section's Highlights; What's changed, with documentation and internal work folded away;
   Upgrade (the image on both registries, Compose, the chart, and whether the database changes);
   Contributors; the full changelog link; and the release record, folded;
8. the **Docker Hub copy** (`dockerhub.yml`, `scripts/mirror-dockerhub.sh`): the same index copied
   by digest to `docker.io/keptinventory/kept` with the same tags, and signed there with the same
   key; from 1.14.3 the Home Assistant app's image goes to `docker.io/keptinventory/kept-ha` the same
   way. It needs the `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets; a release already out is
   copied with **Run workflow** on `dockerhub` and its version.
9. the **Discord announcement** (`discord.yml`): the Highlights (else What's changed, unfolded parts only) posted to
   #releases through the `DISCORD_RELEASES_WEBHOOK` secret, pinging Release pings for a final
   release; **Run workflow** on `discord` with a tag posts one again.

Nothing is tagged until both architectures passed and the signature verified, so a failed run
leaves only untagged digests behind. The default registry is `ghcr.io/keptinventory/kept` (the
chart under `ghcr.io/keptinventory/charts/kept`); the runbook records that this path was inferred
from the Dockerfile and is to be confirmed (its step W2).

## Cutting one

The short version of the runbook's "Each release":

1. Write 2–4 highlights (bullets led by a bold sentence, with their pull request or issue) in an
   ignored file under `.tmp/`, then the changelog section, and commit it alone through the
   release pull request. `gh` signed in adds the closed issues, who reported them and the
   Contributors line; without it they are left out with a warning:

   ```sh
   node scripts/changelog.mjs --version X.Y.Z --from vPREVIOUS --highlights .tmp/highlights-X.Y.Z.md --write CHANGELOG.md
   git commit -m "chore(release): X.Y.Z" -- CHANGELOG.md
   ```

   No highlights file, no Highlights section: nothing is written for you. Running it again
   replaces the version's section.

   **What's new in Kept** shows each highlight as a slide. A line `![icon](file)` right under a
   bullet gives it a picture (`.webp`) or a short clip (`.mp4`); `icon` names the app's area
   (`places`, `labels`, `import`, `paperwork`, `vehicles`, `help`, `map`, …), shown when the
   media can't be. The changelog keeps it as a comment, so GitHub, the release page and Discord
   show no broken image. Before the changelog step, make the media from the demo build with a
   recipe, `scripts/whats-new/X.Y.Z.json` (its format and an example:
   `scripts/whats-new/README.md`), then remove the previous release's folder and recipe, so the
   tree holds one release's media (a shallow clone gets the whole tree; history keeps the rest):

   ```sh
   node scripts/record-whats-new.mjs --version X.Y.Z
   node scripts/whats-new-keep.mjs --version X.Y.Z
   git add -A apps/web/public/whats-new scripts/whats-new
   ```

   Commit these with the changelog section, in the release pull request. `changelog.mjs` stops
   when a highlight names a file that isn't in `apps/web/public/whats-new/X.Y.Z/` with its
   `media.json` entry, and so does the release image's build. Clips stay under 400 KB, posters under 60 KB, pictures under
   120 KB; they are fetched when the card opens, never precached. A highlight without media shows
   its area's icon.

2. Wait for the `ci` workflow to pass on that commit on main. It is the gate (D222): every
   step of `scripts/ci-local.sh` except perf, as required jobs. The release workflow's preflight
   refuses a tag whose commit hasn't passed it.

3. Push the tag. The tag push starts the workflow:

   ```sh
   git tag -a vX.Y.Z -m "Kept X.Y.Z" && git push origin vX.Y.Z
   ```

4. When the run is green, download the release record into `docs/releases/` and commit it.
5. Verify from outside, as a user would ([verifying a release](/admin/verify-release/)).

## What the workflow does

`release.yml` runs **only** on a pushed tag in Kept's version format, or by hand
(`workflow_dispatch`) for an existing tag after a failed run. Never on a branch push or a pull
request, so Actions minutes go to releases only. It is one job, `release`, on the arm64 runner
(`ubuntu-24.04-arm`) with a 90-minute timeout, and one release runs at a time.

- **Preflight**, before any build: the tag is a release version; signing is either fully set up or
  fully absent (half is refused); an unsigned `1.0.0` or later is refused; the GitHub release
  doesn't exist yet; the tagged commit has a successful `ci` run on main.
- **`scripts/release.sh --ci`**: the stages above. It also refuses a tagged commit that isn't on
  `origin/main` and a version or chart version the registry already holds.
- **The GitHub release**, after checking the notes for AI attribution (D173).
- **Cleanup**, always: the key file and the registry logins are removed.

The layer cache is Actions' cache, scoped by ref: it helps a re-run of the same tag, not the next
release. The gate is `ci.yml`, run on every pull request and on main; the release only checks
that it passed for the tagged commit.

## The laptop fallback

When Actions can't run, `bash scripts/release.sh X.Y.Z` does the same stages from the laptop, with
the cosign key file (`KEPT_COSIGN_KEY`, `COSIGN_PASSWORD`), a GHCR login and `gh` as the
repository owner (the runbook's M1–M3). It never commits, tags or pushes: at the end it prints
those steps for you. It needs the pinned tools (`bash scripts/tools.sh fetch`) and 15 GB free.
Don't push a tag from a laptop release while `release.yml` is in the tagged commit unless you mean
the workflow to run as well; it stops at "already published" in its first minutes.

## The dry run

Rehearse the whole pipeline locally, with nothing published outside the machine:

```sh
bash scripts/release.sh 0.1.0 --dry-run
# or as ci-local's opt-in step:
KEPT_RELEASE_DRY_RUN=1 bash scripts/ci-local.sh --from release-dry-run
```

It builds HEAD from `git archive`, pushes to a throwaway `registry:3.1.2` container on a spare port,
smokes both architectures, signs with a throwaway key pair, tags, publishes and signs the chart,
and must end with a verified signature and no container left behind. ci-local's
`release-dry-run` step skips (loudly) unless `KEPT_RELEASE_DRY_RUN=1` is set.

## Related

- [Signing](/maintainers/signing/): the key, what is signed, and why it isn't keyless yet.
- [The changelog](/maintainers/changelog/).
- [Runbooks and scripts](/maintainers/runbooks/): every ci-local step.
