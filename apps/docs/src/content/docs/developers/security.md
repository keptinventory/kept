---
title: Security for developers
description: "The security rules a change to Kept has to keep, what checks each one, and where to read more."
---

The rules a change has to keep, each with what checks it and where it goes deeper. What Kept
protects, and how, is in [the security model](/admin/security-model/); the rules as a contributor
reads them are in
[CONTRIBUTING.md](https://github.com/keptinventory/kept/blob/main/CONTRIBUTING.md#rules-the-codebase-enforces).

## The rules

| Rule | Checked by | More |
|---|---|---|
| Every table has row-level security: its policies, its scope, and fixture rows in the leak test | `apps/server/test/leak.test.ts`, which finds every table and fails until all three exist | [Row-level security](/developers/rls/#the-leak-test) |
| Every write leaves an audit row, and each non-GET route has a test that asserts it | `apps/server/test/route-catalogue.test.ts` (a `// catalogue: <METHOD> <url>` mark above the test, or a reasoned allowlist entry) | [The audit entry](/developers/feature-walkthrough/#5-the-audit-entry) |
| Secret values are sealed with `KEPT_SECRET_KEY`, through `apps/server/src/crypto/envelope.ts` | review | [Keys and encryption](/admin/security-model/#keys-and-encryption) |
| A secret never leaves through a side door: argv, a log line, an audit diff, job data, an error message or a metric label | review | CONTRIBUTING.md |
| A job handler takes *what* to work on from its data, never *whether* it may: it checks that in the database | review (the rule is written in `apps/server/src/jobs/boss.ts`) | |
| No assistant or MCP tool trashes, deletes, merges, transfers ownership, reveals a secret, uploads a file or runs SQL | `packages/mcp/src/tools.test.ts` | [MCP server](/developers/mcp/) |
| Every outbound request goes through the address guard, `apps/server/src/net/ssrf.ts` | review | [Outbound requests](/admin/security-model/#outbound-requests-ssrf) |
| No telemetry, and no outbound request an admin didn't turn on | review | [What leaves the server](/admin/security-model/#what-leaves-the-server) |
| Dependencies on the licence allowlist (no GPL, AGPL, SSPL or BUSL) | `scripts/check-licences.mjs` | |
| Dependencies at exact versions | review | |
| Nothing machine-local or private in tracked files: home or temp paths, real tailnet names, private addresses | `scripts/check-no-local-paths.mjs`, in `pnpm lint` | CONTRIBUTING.md |
| No AI attribution in commits or pull requests | `.githooks/commit-msg`, ci-local's `attribution` step and the `attribution` job | CONTRIBUTING.md |

In examples, use an RFC 5737 address such as `192.0.2.10`, or a placeholder such as
`<machine>.<tailnet>.ts.net`.

## Reporting a vulnerability

Never in a public issue, discussion or pull request. Report it through GitHub's private
vulnerability reporting: the repository's **Security** tab, then **Report a vulnerability**.
[SECURITY.md](https://github.com/keptinventory/kept/blob/main/SECURITY.md) says which versions get
fixes and how fast; [Handling a security report](/maintainers/security/) is the maintainer's side.
