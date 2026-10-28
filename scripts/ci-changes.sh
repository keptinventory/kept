#!/usr/bin/env bash
# Which of ci.yml's jobs a change needs (the `changes` job). Reads changed paths, one per line, on
# stdin and prints three GitHub outputs:
#
#   unit=true|false    the unit tests (fast's `unit` and `eval` steps): false only when every path
#                      is prose: docs/ or a Markdown file at the root (CHANGELOG.md, README.md, …)
#   heavy=true|false   db, e2e, the images and helm: false when every path is prose or the docs
#                      site (apps/docs/, which none of them builds or runs; docs.yml builds it)
#   docs=true|false    true when the docs site is all that changed (with prose or not): fast then
#                      runs only the docs site's own tests, since no other test reads apps/docs/
#
# Anything else, an empty list included, needs everything. `fast`'s lint, catalogues and
# typecheck run whatever this says. A release PR (CHANGELOG.md, README.md) and a release record
# (docs/releases/) need neither.
#
#   git diff --name-only "$BASE...$HEAD" | bash scripts/ci-changes.sh >>"$GITHUB_OUTPUT"
set -euo pipefail

unit=false
heavy=false
site=false
n=0
while IFS= read -r path || [[ -n $path ]]; do
  [[ -n $path ]] || continue
  n=$((n + 1))
  if [[ $path == docs/* || ($path == *.md && $path != */*) ]]; then
    : # prose: no test reads it (release.sh checks README.md at release time)
  elif [[ $path == apps/docs/* ]]; then
    unit=true site=true
  else
    unit=true heavy=true
  fi
done
if ((n == 0)); then
  unit=true heavy=true
fi
docs=false
[[ $site == true && $heavy == false ]] && docs=true
echo "unit=$unit"
echo "heavy=$heavy"
echo "docs=$docs"
