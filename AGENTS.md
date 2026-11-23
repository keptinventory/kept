# Kept contributor workflow

- Use [CONTRIBUTING.md](CONTRIBUTING.md) for project conventions and the [local setup guide](apps/docs/src/content/docs/developers/local-setup.md) for development services. Use Node 24 and the pnpm version pinned in `package.json`.
- Search the private `agent-skills` catalog before applying a reusable workflow. Pass this checkout's root as `repo_path` when searching.
- Use Biome for TypeScript and CSS. Keep changes scoped to the affected workspace packages, check changed source with `pnpm exec biome check`, and run focused Vitest files with `pnpm exec vitest run --project <project> <files>`. Run `pnpm typecheck` for type-affecting changes.
- Use the development Postgres from `compose.dev.yaml` for server tests. The test harness creates and drops its own databases. Use test fixtures for audits and smoke checks.
- Keep credentials, generated key material, and developer runtime data in ignored local paths. Put local audit notes in `docs/audits/`, which Git ignores.
- Follow the migration, row-level security, and audit-event rules in [CONTRIBUTING.md](CONTRIBUTING.md#rules-the-codebase-enforces) when changing writes or schema.
