---
title: Security
description: "Security practices for Kept developers: secrets, RLS, audit rows, dependencies, and the checks that enforce them."
---

This page is the developer's guide to Kept's security rules. The operator's summary is in
[the security model](/admin/security-model/); row-level security goes deeper in
[RLS](/developers/rls/) and authentication in [auth](/developers/auth/).

## Secrets

Secrets never leave through a side door: not in argv, a log line, an audit diff, job data, an
error message or a metric label.

- **`KEPT_SECRET_KEY`** seals every secret value: secret fields on things, AI keys, notification
  channel settings, webhook secrets, email-in mailbox passwords, Paperless-ngx API tokens, the
  web push private key, the backup password. AES-256-GCM with a per-row data key, each ciphertext
  bound to its table, row and field, so one can't be swapped for another.
- **`KEPT_AUTH_SECRET`** signs sessions and tokens. It is separate so either can be rotated alone.
- **Generated on first boot** when both are unset, into the config volume (never the data volume).
  Set them yourself with `kept admin gen-key`.
- **Never log a secret.** Not in an error message, a metric label, an audit diff or job data.
  Secret fields stay hidden until someone allowed to reveal one does, and each reveal is logged.

## Row-level security

Every table has RLS policies. A new table needs:

1. Its RLS policies (a custom migration).
2. Its scope (which person can see which rows).
3. Fixture rows in the leak test (`apps/server/test/leak.test.ts` and its `leak-*.ts` fixtures).

The leak test finds every table from the catalogue and fails until all three exist. When no person
is set, the policies return nothing, so a code path that forgets the scope fails closed.

Kept connects to Postgres with four logins:

| Login | Used by | What it may do |
|---|---|---|
| `kept_owner` | `kept migrate`, `kept admin`, the nightly backup | owns the schema; never used to serve a request |
| `kept_app` | every web request | reads and writes app tables, always under RLS |
| `kept_auth` | sign-in (Better Auth) | its own `auth` schema only |
| `kept_system` | background jobs that span households | explicit system policies only |

## Audit rows

Every write is audited. Each non-GET route needs a test that asserts its audit row, marked
`// catalogue: <METHOD> <url>` directly above the `it(` case, or a reasoned entry on the allowlist
in `apps/server/test/route-catalogue.test.ts`.

A write tool's change is audited as the person it acts for. No tool trashes, deletes, merges,
transfers ownership, reveals a secret, uploads a file or runs SQL;
`packages/mcp/src/tools.test.ts` checks the names.

## Secrets through side doors

Secrets never appear in an audit diff, a log line, job data, an error message or a metric label.

## Dependencies

Dependencies pass the licence allowlist (`scripts/check-licences.mjs`: no GPL, AGPL, SSPL or
BUSL), at exact versions. Read the package's own types and docs rather than guessing an API.

## No telemetry

No telemetry, ever, and no outbound request an admin didn't turn on. The update check is off until
an admin turns it on.

## Path and term checks

Nothing machine-local or private in tracked files: no home or temp directory paths, real tailnet
host names, or private (RFC 1918) and shared (RFC 6598) addresses outside tests and the files
listed in `scripts/check-no-local-paths.mjs`. Use an RFC 5737 address (`192.0.2.10`) or a
placeholder (`<machine>.<tailnet>.ts.net`) in an example. `pnpm lint` runs it.

Private terms (your own host names, an internal domain) go in `.private-terms` at the repository
root, one per line. `KEPT_PRIVATE_TERMS` (comma-separated) adds more for one run.

## No AI attribution

No AI attribution in commits or pull requests: no `Co-Authored-By` trailers, no "Generated with…"
lines. The commit-msg hook (`.githooks/commit-msg`), ci-local's `attribution` step and the
`attribution` job on pull requests reject such commits.

## Reporting a vulnerability

Never in a public issue. Report through GitHub's private vulnerability reporting: on the
repository's page, open the **Security** tab and choose **Report a vulnerability**. Include what
you found, the version, how to reproduce it, and what an attacker could do with it.

## Related

- [Row-level security](/developers/rls/) for the RLS deep dive.
- [Auth](/developers/auth/) for authentication.
- [Architecture](/developers/architecture/) for the system design.
- [Security model](/admin/security-model/) for the operator's summary.
