---
title: The changelog
description: How CHANGELOG.md is generated from conventional commit subjects, what it leaves out, and how a release uses it.
---

[`CHANGELOG.md`](https://github.com/ibrahimroshdy/kept/blob/main/CHANGELOG.md) is written by
[`scripts/changelog.mjs`](https://github.com/ibrahimroshdy/kept/blob/main/scripts/changelog.mjs)
from the commits' subjects when a release is cut. Newest release first; one section per release.
D187 names release-please as the eventual tool once releases run from GitHub; until then this
script writes the file, and release-please would start from it.

## Commit messages it expects

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`, with the
scope optional and `!` before the colon for a breaking change.

```text
feat(backup): nightly restic snapshots with data digests
fix(web): the lock screen in Arabic
refactor(config)!: KEPT_BACKUP_KEEP is the daily count
```

How each commit is sorted:

| Commit | Goes under |
|---|---|
| `type!:`, or a `BREAKING CHANGE:` footer in the body, whatever the type | **Breaking changes** |
| `feat` | **Features** |
| `fix` | **Fixes** |
| `perf` | **Performance** |
| `i18n` | **Translations** |
| any other type, or a subject that isn't conventional | **Other**, with the whole subject |
| `docs` | **Documentation** |
| `feat`, `fix` or `perf` on an internal scope only (`e2e`, `test`, `ci`, `release`, `build`, `deps-dev`) | **Behind the scenes** |
| `test`, `chore`, `ci`, `build`, `style`, `refactor`, `spike`, `wip` | left out |

The hidden types change nothing a person running Kept sees. A breaking change is listed even on a
hidden type. Merge-commit subjects are read like any other.

Each entry is the subject, with the scope in bold and the short hash. When `gh` can ask GitHub
(read-only), a pull request's entry also names the issues it closed and who reported them (not
its own author, never a bot):

```text
- **backup:** nightly restic snapshots with data digests (#98, closes #90, reported by @louis) (fa0c96c)
```

A release with nothing user-facing gets "No user-facing changes."

Two more parts frame the groups:

- **Highlights**, first: `--highlights <file>`, 2–4 hand-written bullets. Without the file there
  is none.
- **Contributors**, last: one line of @handles, everyone who wrote a pull request in the release
  or reported an issue one closed, no bots, sorted. GitHub draws the release page's avatars from
  it. Left out, with a warning, when `gh` is missing or fails.

The GitHub release page is built from this section (`scripts/release/compose-notes.mjs`):
Documentation and Behind the scenes are folded away there.

## Running it

```sh
node scripts/changelog.mjs --version X.Y.Z [--from <ref>] [--to <ref>] [--date YYYY-MM-DD] \
  [--highlights <file>] [--repo <owner/name>] [--write CHANGELOG.md]
```

- `--from` is the previous release tag (`vX.Y.Z`); without it, every commit up to `--to` (default
  `HEAD`) is read, as for the first release.
- `--date` defaults to today (UTC).
- Without `--write` it prints the section. With it, the section goes in above the newest one, under
  the file's header (the file is made if missing). Run again for a version the file already has,
  it **replaces** that section (hand edits to it included).
- `--repo` is the GitHub repository asked about pull requests, `keptinventory/kept` by default.

## In a release

The [runbook](https://github.com/ibrahimroshdy/kept/blob/main/docs/runbooks/release.md) writes the
section before the gate and commits it on its own, so the release builds the commit that holds it:

```sh
node scripts/changelog.mjs --version X.Y.Z --from vPREVIOUS --highlights .tmp/highlights-X.Y.Z.md --write CHANGELOG.md
git commit -m "chore(release): X.Y.Z" -- CHANGELOG.md
```

The `chore` subject keeps that commit out of the next changelog. Read the section before
committing: each release's section is generated, then trimmed by hand.

`scripts/release.sh` (stage 2) then uses the committed section when `CHANGELOG.md` already has one
for this version, and generates it from the commits since the last `v*` tag when it doesn't.
Either way the section is checked for AI attribution (`scripts/check-attribution.sh`, D173) before
anything is built, and becomes the top of the GitHub release's notes.

## The test

[`scripts/changelog.test.mjs`](https://github.com/ibrahimroshdy/kept/blob/main/scripts/changelog.test.mjs)
checks the grouping and hiding, internal scopes behind the scenes, breaking changes on a hidden
type, unconventional subjects under Other, the highlights, the closed issues and the Contributors
line from a fake GitHub (no network), GitHub failing, the placement and replacement of a section,
the empty case, and a run over a fixture repository that writes the section since a tag, the same
on a second run. `scripts/release-notes.test.mjs` checks the release page and the Discord post. It is in the
`scripts` vitest project, so `pnpm test` and ci-local's `unit` and `test` steps run it; alone:

```sh
pnpm exec vitest run --project scripts scripts/changelog.test.mjs
```
