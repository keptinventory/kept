---
title: Decision labels
description: What the D, V, L, Q and T labels in code and commits mean, the principles behind Kept's choices, and how to propose changing a decided behaviour.
---

Code, comments and commits cite short labels such as `D187`, `Q14` or `L30`. They name the choice
a line of code follows, so related code can be found by searching for the label.

## The labels

| Prefix | What it names |
|---|---|
| `D<n>` | a **decision**: what was decided, for a reason |
| `V<n>` | an **assumption**: something inferred rather than verified, checked later |
| `L<n>` | a **lesson** carried from earlier self-hosted apps |
| `Q<n>` | a question raised inside one build step, answered there |
| `T<n>` | a task in a build step |

A `Q` or `T` number is only unique within its step: "step 8 T17" is step 8's.

The notes behind the labels stay with the maintainer; this repository keeps the code, the user
and developer docs, the runbooks and the release records. Where a reason matters to a reader, the
comment next to the code says it in plain words.

## The principles

- **Self-hosted.** Kept runs on your own server or homelab.
- **Nothing leaves it unless you turn it on.** No telemetry; the update check is off by default;
  the AI provider is yours to choose.
- **A feature enters scope only by an explicit decision.**

## Changing a decided behaviour

Open an issue that names the behaviour and, if a comment cites one, its label. A change is
recorded as a new decision that refines or supersedes the old one, never by rewriting it, so both
stay findable.
