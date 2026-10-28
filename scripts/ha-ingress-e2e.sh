#!/usr/bin/env bash
# Kept under Home Assistant's ingress, end to end (D273; the app spec's §15.3 "CI" column).
#
#   bash scripts/ha-ingress-e2e.sh <kept-ha image>     e.g. kept-ha:dev
#
# Starts, on a network laid out like Home Assistant's own (172.30.32.0/23, gateway 172.30.32.1 where
# Core sits), two Kept apps from the image (`fresh`, and `demo` with the households data) and a
# Caddy at the Supervisor's address, 172.30.32.2, that does what Core and the Supervisor do
# (apps/web/e2e-ha/Caddyfile). Playwright then drives Kept through it from the host
# (apps/web/playwright.ha.config.ts): setup without the code for a Home Assistant administrator,
# with it for anyone else, the main screens, cookies on the prefix, no service worker, CSRF. Nothing
# reaches Kept but through the proxy. Everything it creates is removed on exit.
#
# BOOT_TIMEOUT (seconds, default 180) bounds the waits. Needs Playwright's Chromium
# (`pnpm --filter @kept/web exec playwright install chromium`).
set -euo pipefail

image=${1:?usage: ha-ingress-e2e.sh <kept-ha image>}
repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
export DOCKER_CONFIG=${DOCKER_CONFIG:-/tmp/kept-docker-config}
BOOT_TIMEOUT=${BOOT_TIMEOUT:-180}
# compose.yaml's Caddy, pinned by digest.
CADDY_IMAGE=caddy:2.11.4-alpine@sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b

run_id="kept-ha-e2e-$$"
net=$run_id
proxy=$run_id-proxy
fresh=$run_id-fresh
demo=$run_id-demo

cleanup() {
  local rc=$?
  if ((rc != 0)); then
    for c in "$fresh" "$demo" "$proxy"; do
      docker inspect "$c" >/dev/null 2>&1 || continue
      echo "--- $c (last 30) ---" >&2
      docker logs --tail 30 "$c" >&2 2>&1 || true
    done
  fi
  docker rm -f "$fresh" "$demo" "$proxy" >/dev/null 2>&1 || true
  docker volume rm "$fresh" "$demo" >/dev/null 2>&1 || true
  docker network rm "$net" >/dev/null 2>&1 || true
  if ((rc == 0)); then echo "ha-ingress-e2e: PASS ($image)"; else echo "ha-ingress-e2e: FAIL ($image)" >&2; fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM
fail() {
  echo "ha-ingress-e2e: $*" >&2
  exit 1
}

docker image inspect "$image" >/dev/null 2>&1 || fail "no local image '$image'"
# Ingress tokens as the Supervisor makes them: 43 URL-safe characters (the spike's T14).
token() { node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64url"))'; }
fresh_token=$(token)
demo_token=$(token)

docker network create --subnet 172.30.32.0/23 --gateway 172.30.32.1 "$net" >/dev/null

start_kept() { # <name> <alias> <ip> [env…]
  local name=$1 alias=$2 ip=$3
  shift 3
  docker volume create "$name" >/dev/null
  docker run --rm -v "$name:/data" --entrypoint sh "$image" -c \
    "printf '%s\n' '{\"public_url\":\"http://$alias.test:8080\",\"log_level\":\"info\",\"ssl\":false,\"certfile\":\"fullchain.pem\",\"keyfile\":\"privkey.pem\"}' >/data/options.json"
  docker run -d --name "$name" --init --network "$net" --network-alias "$alias" --ip "$ip" \
    -v "$name:/data" "$@" "$image" >/dev/null
}
start_kept "$fresh" kept-fresh 172.30.33.10
start_kept "$demo" kept-demo 172.30.33.11 -e KEPT_HA_DEMO=households

docker run -d --name "$proxy" --network "$net" --ip 172.30.32.2 -p 127.0.0.1::80 \
  -e KEPT_HA_FRESH_TOKEN="$fresh_token" -e KEPT_HA_DEMO_TOKEN="$demo_token" \
  -v "$repo/apps/web/e2e-ha/Caddyfile:/etc/caddy/Caddyfile:ro" "$CADDY_IMAGE" >/dev/null
port=$(docker port "$proxy" 80/tcp | sed -n '1s/.*://p')
[[ -n $port ]] || fail "the proxy published no port"
# localhost, not 127.0.0.1: a host name, as Home Assistant's address is.
base="http://localhost:$port"

ready() { # <token> <container>
  local deadline=$((SECONDS + BOOT_TIMEOUT)) code=000
  while ((SECONDS < deadline)); do
    [[ $(docker inspect -f '{{.State.Running}}' "$2") == true ]] || fail "$2 exited"
    code=$(curl -s -o /dev/null -m 2 -w '%{http_code}' "$base/api/hassio_ingress/$1/readyz" || true)
    [[ $code == 200 ]] && return 0
    sleep 1
  done
  fail "$2: /readyz through the proxy answered $code after ${BOOT_TIMEOUT}s"
}
ready "$fresh_token" "$fresh"
ready "$demo_token" "$demo"
deadline=$((SECONDS + BOOT_TIMEOUT))
until docker logs "$demo" 2>&1 | grep -q 'TEST ONLY: demo data loaded'; do
  ((SECONDS < deadline)) || fail "the demo data didn't load in ${BOOT_TIMEOUT}s"
  sleep 2
done
echo "two apps behind the ingress mimic at $base"

cd "$repo/apps/web"
KEPT_HA_E2E_URL=$base KEPT_HA_FRESH_TOKEN=$fresh_token KEPT_HA_DEMO_TOKEN=$demo_token \
  pnpm exec playwright test -c playwright.ha.config.ts
