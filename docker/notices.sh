#!/bin/sh
# The image's THIRD-PARTY-NOTICES.txt (D151), run by the Dockerfile's `notices` and `ha-notices`
# stages over their own OS (each stage's dpkg list) and the same pruned node_modules, fonts and
# map models (the `notices-inputs` stage). Standard licence texts for packages that ship none:
# Debian's common-licenses, and MIT and ISC from SPDX's license-list-data v3.29.0
# (docker/licence-texts/, which Debian doesn't hold).
#
#   sh notices.sh <version> <arch>
set -eu
dpkg-query -W -f '${Package}\t${Version}\n' >/notices/dpkg.tsv
node /notices/bin/third-party-notices.mjs \
  --store /notices/node_modules/.pnpm \
  --texts /notices/texts --texts /usr/share/common-licenses \
  --dpkg /notices/dpkg.tsv --dpkg-docs /usr/share/doc \
  --node-licence /notices/node-LICENSE \
  --node-version "$(node -p process.versions.node)" \
  --restic-licence /usr/share/doc/restic/LICENSE \
  --restic-version "$(restic version | cut -d' ' -f2)" \
  --extra "IBM Plex Sans (the inventory report's font)|OFL-1.1|/notices/fonts/IBMPlexSans-OFL.txt" \
  --extra "IBM Plex Sans Arabic (the inventory report's font)|OFL-1.1|/notices/fonts/IBMPlexSansArabic-OFL.txt" \
  --extra "IBM Plex Mono (the inventory report's font)|OFL-1.1|/notices/fonts/IBMPlexMono-OFL.txt" \
  --extra "Poly Haven models (the location map's furniture, plants and AC units)|CC0-1.0|/notices/map-models-NOTICE.txt" \
  --version "$1" --arch "$2" \
  --out /THIRD-PARTY-NOTICES.txt
