---
title: The CLA
description: Why Kept asks contributors to sign a Contributor License Agreement once, how signing works, and how the cla workflow records it.
---

Kept takes contributions under its
[Contributor License Agreement](https://github.com/keptinventory/kept/blob/main/CLA.md) (CLA),
adapted from the Apache individual CLA. A contributor signs it once, on their first pull request,
and it covers every later contribution. Commits need no sign-off.

## Why a CLA

Kept is AGPL-3.0. The CLA also lets the maintainer offer Kept under other terms, for example a
hosted version. Self-hosting stays free and open source.

Contributors keep the copyright in their work and grant the maintainer a licence to it.

## Signing

On a contributor's first pull request, a bot asks them to sign by replying with this comment:

```text
I have read the CLA Document and I hereby sign the CLA
```

A comment of `recheck` runs the check again.

## The check

The [`cla` workflow](https://github.com/keptinventory/kept/blob/main/.github/workflows/cla.yml)
runs StepSecurity's fork of CLA Assistant Lite, pinned by commit SHA. Signatures are committed to
the `cla-signatures` branch, which is never merged into `main`. The workflow runs under
`pull_request_target`, so it must never check out or run the pull request's code. Like every
workflow, it is inert while the repository is private.

## Related

- [CONTRIBUTING.md](https://github.com/keptinventory/kept/blob/main/CONTRIBUTING.md) is the
  contributor's version of this page.
- The other check on a pull request's commits is the attribution check (D173): no AI co-author
  trailers or "Generated with" lines in commits or the description. See [triage](/maintainers/triage/#checks-that-run-on-a-pull-request).
