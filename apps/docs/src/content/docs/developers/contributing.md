---
title: Contributing
description: "How a change reaches Kept: ask first, set up, check, open a pull request, sign the CLA once. The rules themselves live in CONTRIBUTING.md."
---

[CONTRIBUTING.md](https://github.com/keptinventory/kept/blob/main/CONTRIBUTING.md) is the single
source for the rules, the gate and the recipes. This page is the path through it, and where each
part goes deeper.

## The path

1. **Ask first, for anything larger than a fix.** Questions and ideas go to
   [Discussions](https://github.com/keptinventory/kept/discussions); a bug to
   [an issue](https://github.com/keptinventory/kept/issues/new/choose). Kept is maintainer-led, so
   the work should fit its design before you write it.
2. **Set up a development copy.** [Local setup](/developers/local-setup/): the database, the mail
   catcher, seed data and the mock AI provider.
3. **Make the change**, following the rules CONTRIBUTING.md lists; each one has a check that fails.
4. **Run the fast gate and your tests**: `bash scripts/ci-local.sh --fast`, plus the tests for what
   you touched ([Testing](/developers/testing/)). GitHub Actions runs the whole gate on the pull
   request.
5. **Open a pull request against `main`.** Its title is a Conventional Commit subject, such as
   `fix(web): …` or `docs: …`: pull requests are squash-merged and the title becomes the commit.
6. **Sign the CLA once**, on your first pull request: a bot asks you to reply with a comment, and
   that covers every later one. [The CLA](/maintainers/cla/)

Security problems never go in a public issue:
[SECURITY.md](https://github.com/keptinventory/kept/blob/main/SECURITY.md).

## Where each part goes deeper

| For | Read |
|---|---|
| How the pieces fit | [Architecture](/developers/architecture/), [the monorepo](/developers/monorepo/) |
| A feature end to end | [Build a feature end to end](/developers/feature-walkthrough/) |
| Tables and policies | [Data model](/developers/data-model/), [row-level security](/developers/rls/), [migrations](/developers/migrations/) |
| Routes | [API conventions](/developers/api/), [authentication](/developers/auth/) |
| Screens and strings | [UI kit](/developers/ui-kit/), [languages and right-to-left](/developers/i18n-rtl/) |
| Offline | [Offline and sync](/developers/offline-sync/) |
| AI and MCP | [AI providers](/developers/ai-providers/), [MCP server](/developers/mcp/) |
| The security rules for code | [Security for developers](/developers/security/) |

Everyone taking part follows the
[Code of Conduct](https://github.com/keptinventory/kept/blob/main/CODE_OF_CONDUCT.md).
