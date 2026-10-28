---
title: Contributing
description: "How to contribute to Kept: prerequisites, setup, tests, the CI gate, rules, commits, the CLA, and pull requests."
---

This page is the docs-site version of the root
[CONTRIBUTING.md](https://github.com/keptinventory/kept/blob/main/CONTRIBUTING.md). It covers
what you need to send a pull request.

## Prerequisites

- **Node 24** (`.nvmrc`; `package.json` allows `>=24 <25`).
- **pnpm 11**, the exact version pinned in `package.json`'s `packageManager` (`pnpm@11.23.0`):
  `corepack enable` picks it up.
- **Docker** with Compose v2, for the development database and Mailpit.
- For end-to-end tests: Google Chrome, or Playwright's Chromium
  (`pnpm --filter @kept/web exec playwright install chromium`).

## Set up

```sh
git clone https://github.com/keptinventory/kept.git && cd kept
pnpm install
git config core.hooksPath .githooks
docker compose -f compose.dev.yaml up -d --wait
cp .env.example .env
set -a; . ./.env; set +a
pnpm --filter @kept/server kept migrate
```

`compose.dev.yaml` starts Postgres 18 with pgvector on **localhost:5452** and Mailpit on 8025.
`docker compose -f compose.dev.yaml --profile s3 up -d --wait` adds RustFS on 9452 for the S3
storage driver.

Seed the development database:

```sh
pnpm --filter @kept/server kept admin seed --scenario households
```

Sign in as `ibrahim@kept.test` (the instance admin), `alfred@kept.test` (Arabic) or another
member of the cast. Every password is `kept-seed-password`.

## Run it

```sh
pnpm --filter @kept/web build
KEPT_PUBLIC_URL=http://localhost:8080 pnpm --filter @kept/server dev
```

Open `http://localhost:8080`. Rebuild the web app to see a change. For quick work on screens
without a server, `pnpm --filter @kept/web dev` runs Vite with the in-memory demo API:
`http://localhost:5173/?demo=owner`.

## The monorepo

| Path | What |
|---|---|
| `apps/server` | Fastify 5, Drizzle, Postgres 18: HTTP API, `/mcp`, worker jobs, `kept` CLI, migrations, schema |
| `apps/web` | React 19, Vite, TanStack Router/Query, React Aria, Lingui, Tailwind v4 |
| `apps/docs` | The documentation site (Starlight) |
| `packages/shared` | Types, schemas and constants shared by server and web |
| `packages/mcp` | Tool contracts for the assistant and MCP |
| `charts/kept` | Helm chart |
| `docker/` | Image healthcheck, Postgres init scripts, Caddyfile |
| `scripts/` | CI gate, repository checks, release scripts |
| `docs/` | Runbooks, release records, images |

## Tests

```sh
pnpm test
pnpm exec vitest run --project @kept/server apps/server/src/things
pnpm exec vitest run --project @kept/web
```

Tests use their own databases, never the development one. Tests pin `TZ=Africa/Cairo`. AI calls
in tests go to the mock provider.

End-to-end tests:

```sh
pnpm --filter '@kept/server...' build && pnpm --filter @kept/web build
pnpm --filter @kept/web e2e
```

## The gate

Every pull request runs the whole gate on GitHub Actions. Run locally before pushing:

```sh
bash scripts/ci-local.sh --fast
```

| Check | What it runs |
|---|---|
| `fast` | lint, catalogues, typecheck, unit tests, mock evaluations, licence allowlist |
| `db` | server tests on Postgres with pgvector and RustFS, migration drift, production boot |
| `e2e` | Playwright against the built server |
| `images-amd64`, `images-arm64` | image built natively on each architecture |
| `helm` | chart lint, render, schema check |
| `attribution` | no AI attribution in commits or description |
| `build` (`docs.yml`) | the docs site, with link check |

## Rules the codebase enforces

- **Logical CSS only** (`margin-inline-start`, `ps-`, `text-start`), so Arabic lays out right to
  left.
- **React Aria controls.** Never a native `<select>` or OS picker, never `window.confirm`,
  `alert` or `prompt`.
- **Phones.** Every screen works at 375 px wide and at 1280, and nothing is cut short with "…"
  on a phone.
- **Five catalogues.** Every user-facing string goes through Lingui into `en`, `ar`, `fr`, `de`
  and `it`. Arabic follows house style: written natively, every plural form, Eastern Arabic
  digits where the reader chose them.
- **Row-level security on every table.** A new table needs its RLS policies, its scope, and
  fixture rows in the leak test.
- **Every write is audited.** Each non-GET route needs a test asserting its audit row.
- **Migrations are additive.** Add columns and tables; dropping or renaming takes two releases.
  Enumerations are `text` with a `CHECK`, never Postgres enums.
- **Secrets never leave through a side door**: not in argv, a log line, an audit diff, job data,
  an error message or a metric label.
- **No telemetry, ever**, and no outbound request an admin didn't turn on.
- **Dependencies** pass the licence allowlist (no GPL, AGPL, SSPL or BUSL), at exact versions.
- **No AI attribution** in commits or pull requests.
- **The sample cast.** Fixtures, tests, screenshots and docs use: Ibrahim, Alfred, Bruce, Louis,
  Talia, Peter, Murdock. Don't invent others.

## Commits

Conventional Commits: `feat(scope): …`, `fix(scope): …`, `docs: …`, `test: …`, `build: …`,
`ci: …`, `perf: …`, `i18n(web): …`, `chore: …`. Keep the subject to about 72 characters.

No AI attribution anywhere: no `Co-Authored-By` trailers, no "Generated with…" lines. The
commit-msg hook rejects them.

## Sign the CLA once

Sign the [Contributor License Agreement](https://github.com/keptinventory/kept/blob/main/CLA.md)
once, on your first pull request: a bot asks you to reply with a comment. Kept is AGPL; the CLA
also lets the maintainer offer Kept under other terms. You keep the copyright in your work.

## Branches and pull requests

`main` is protected: nobody pushes to it directly.

1. Fork, or branch in the repository if you have access.
2. Commit; run `bash scripts/ci-local.sh --fast` and the tests you touched.
3. Open a pull request against `main`. The title is a Conventional Commit subject.
4. The required checks must pass and every review thread must be resolved.

**Review.** The maintainer reviews every pull request. Expect questions about data safety first
(RLS, the audit, secrets, migrations), then behaviour on a phone and in Arabic, then the code.
Keep a pull request to one change.

## Recipes

### A migration

Change the schema in `apps/server/src/db/schema/`, then generate the migration:

```sh
cd apps/server && pnpm exec drizzle-kit generate --name=<what_it_adds>
```

For functions, triggers, roles or RLS policies, use `--custom`. A new table also needs RLS
policies and leak-test fixtures.

### A route

Add it to the feature's `routes.ts` in `apps/server/src/<feature>/`, with a schema. A route that
writes leaves an audit row; write the test that asserts it.

### A screen

A TanStack Router file route in `apps/web/src/routes/_app/`. Check it at 375 and 1280, light
and dark, and in Arabic. Lists get search, filter, grouping and pagination, kept in the URL.

### A string

Write it with Lingui, then `pnpm --filter @kept/web i18n:extract` and fill in `msgstr` in
`apps/web/src/locales/{ar,fr,de,it}/messages.po`.

### An MCP tool

Add the contract to `packages/mcp/src/tools.ts`, its handler under
`apps/server/src/tools/handlers/`, and register it in `apps/server/src/tools/registry.ts`.

## Security issues

Never in a public issue. See [SECURITY.md](https://github.com/keptinventory/kept/blob/main/SECURITY.md).

## Conduct

Everyone taking part follows the
[Code of Conduct](https://github.com/keptinventory/kept/blob/main/CODE_OF_CONDUCT.md).

## Related

- [Local setup](/developers/local-setup/) for getting started.
- [Architecture](/developers/architecture/) for the system design.
- [Testing](/developers/testing/) for test patterns.
