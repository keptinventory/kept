#!/usr/bin/env bash
# The Compose install, end to end, from compose.yaml alone (no clone), on a built Kept image.
#
#   bash scripts/smoke-compose.sh <image>        e.g. kept:dev, kept:ci
#
# Each scenario runs in its own temporary folder and Compose project, with fresh volumes:
#   1. fresh: only compose.yaml in the folder; `docker compose run --rm init --url …` writes
#      .env (no password in it) and prints a setup code; `up -d` reaches /readyz 200; setup is
#      needed, a wrong code is refused and the printed one makes the first admin. The serving
#      container holds no owner login and sees no owner password file; its three password files
#      are 0600 and uid 10001; the database container holds no Kept password.
#   2. again: a second `up -d` keeps every password file byte for byte; the admin signs in.
#   3. .env written again: `init` over the existing .env keeps it working; deleting .env and
#      running `init` again does too. The admin signs in after each.
#   4. an .env with the five passwords of an install made before 1.13.0, on fresh volumes: they
#      are used as given, no password file is written, /readyz 200.
#   5. an install made with the clone (before 1.13.0): the database initialised by
#      docker/initdb-prod with five passwords, migrate and Kept run as that compose.yaml ran them,
#      the first admin made; then this compose.yaml with the same .env and volumes: the admin
#      signs in; then .env made again by `init` without the passwords: still signs in.
# Everything it creates (containers, networks, volumes, folders) is removed on exit, pass or fail.
#
# BOOT_TIMEOUT (seconds, default 180) bounds each wait for /readyz. OLD_IMAGE (default: the image
# under test) is what scenario 5's first half runs, e.g. ghcr.io/keptinventory/kept:1.12.5.
# Docker: DOCKER_CONFIG defaults to /tmp/kept-docker-config, as in scripts/ci-local.sh.
set -euo pipefail

image=${1:?usage: smoke-compose.sh <image>}
repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
export DOCKER_CONFIG=${DOCKER_CONFIG:-/tmp/kept-docker-config}
export KEPT_IMAGE=$image
OLD_IMAGE=${OLD_IMAGE:-$image}
BOOT_TIMEOUT=${BOOT_TIMEOUT:-180}
# Same pinned image as compose.yaml.
PG_IMAGE=pgvector/pgvector:0.8.6-pg18-bookworm@sha256:2ba9ca5f2e7daa0f0e7723cba1ee9167bab54efd3640516a44ac1a928dd67e7a

run_id="kept-csmoke-$(date +%s)-$$"
# Under the repository's .tmp/ (git-ignored): Docker Desktop shares it, and so does Linux.
work="$repo/.tmp/$run_id"
projects=()
extra_containers=()
extra_networks=()

compose() { docker compose -p "$project" "$@"; }

cleanup() {
  local rc=$?
  if ((rc != 0)) && [[ -n ${project:-} && -d ${dir:-} ]]; then
    echo "--- $project: logs (last 30 per service) ---" >&2
    (cd "$dir" && compose logs --no-color --tail 30 2>&1 | sed 's/^/  /' >&2) || true
  fi
  for c in "${extra_containers[@]}"; do docker rm -f "$c" >/dev/null 2>&1 || true; done
  for p in "${projects[@]}"; do
    (cd "$work/$p" 2>/dev/null && docker compose -p "$p" --profile init down -v --remove-orphans >/dev/null 2>&1) || true
    docker volume ls -q --filter "name=^${p}_" | xargs -r docker volume rm >/dev/null 2>&1 || true
  done
  for n in "${extra_networks[@]}"; do docker network rm "$n" >/dev/null 2>&1 || true; done
  rm -rf "$work"
  if ((rc == 0)); then echo "smoke-compose: PASS ($image)"; else echo "smoke-compose: FAIL ($image)" >&2; fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

fail() {
  echo "smoke-compose: $*" >&2
  exit 1
}
step() { printf '\n==> %s\n' "$*"; }

docker image inspect "$image" >/dev/null 2>&1 || fail "no local image '$image' (build it with --load)"
[[ $OLD_IMAGE == "$image" ]] || docker image inspect "$OLD_IMAGE" >/dev/null 2>&1 ||
  docker pull -q "$OLD_IMAGE" >/dev/null || fail "OLD_IMAGE '$OLD_IMAGE' is not available"

free_port() { node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
pw() { od -An -N24 -tx1 /dev/urandom | tr -d ' \n'; }
EMAIL=first-admin@example.com
PASSWORD="smoke $(pw)"

# A fresh folder holding only compose.yaml, a project name and a port. Sets dir, project, port, base.
new_install() {
  project="$run_id-$1"
  projects+=("$project")
  dir="$work/$project"
  mkdir -p "$dir"
  cp "$repo/compose.yaml" "$dir/compose.yaml"
  port=$(free_port)
  base="http://localhost:$port"
}

wait_ready() {
  local deadline=$((SECONDS + BOOT_TIMEOUT)) code=000
  while ((SECONDS < deadline)); do
    code=$(curl -s -o /dev/null -m 2 -w '%{http_code}' "$base/readyz" || true)
    if [[ $code == 200 ]]; then
      echo "/readyz 200 on $base"
      return 0
    fi
    sleep 1
  done
  fail "/readyz did not return 200 within ${BOOT_TIMEOUT}s (last: $code)"
}

# POST JSON as the browser would (the same-site check wants the public origin); prints the status.
post() {
  curl -s -o "$work/last-body" -m 20 -w '%{http_code}' -X POST "$base$1" \
    -H "Origin: $base" -H 'Content-Type: application/json' --data "$2"
}

setup_with() {
  post /api/v1/setup "{\"code\":\"$1\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"displayName\":\"Ibrahim\"}"
}

sign_in() {
  local code
  code=$(post /api/v1/auth/sign-in/email "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
  [[ $code == 200 ]] || fail "sign-in as the first admin: $code $(head -c 300 "$work/last-body")"
  echo "the first admin signs in"
}

# `kept init` the way a person runs it, without a terminal; prints its output.
init_env() {
  (cd "$dir" && compose run --rm -T init --url "$base" </dev/null) || fail "docker compose run --rm init failed"
}

code_of() { sed -n 's/^KEPT SETUP CODE: \([0-9A-Z]\{3\}-[0-9A-Z]\{3\}\)$/\1/p' <<<"$1" | tail -n 1; }

up() { (cd "$dir" && compose up -d --quiet-pull 2>&1 | tail -n 3) || fail "docker compose up -d failed"; }

# The passwords files' digests, as the serving container and migrate's volume see them.
file_digests() {
  (cd "$dir" && compose exec -T kept sh -c 'sha256sum /config/database/kept_*')
  docker run --rm -v "${project}_kept-owner:/owner:ro" --entrypoint sha256sum "$image" /owner/kept_owner
}

bootstrap_log() { (cd "$dir" && compose logs --no-color --no-log-prefix bootstrap 2>&1); }

# ---------------------------------------------------------------------------------------------
step "1. fresh install from compose.yaml alone"
new_install fresh
[[ $(ls -A "$dir") == compose.yaml ]] || fail "the folder holds more than compose.yaml"
out=$(init_env)
echo "$out" | sed 's/^/  init: /'
code=$(code_of "$out")
[[ -n $code ]] || fail "init printed no setup code"
[[ -f $dir/.env ]] || fail "init wrote no .env"
grep -q "^KEPT_PUBLIC_URL=$base\$" "$dir/.env" || fail ".env lacks KEPT_PUBLIC_URL=$base"
grep -q "^KEPT_HTTP_PORT=$port\$" "$dir/.env" || fail ".env lacks KEPT_HTTP_PORT=$port"
grep -q "^KEPT_SETUP_CODE=$code\$" "$dir/.env" || fail ".env lacks the printed setup code"
if grep -q PASSWORD "$dir/.env"; then fail ".env holds a password line"; fi
env_mode=$(stat -c '%a' "$dir/.env" 2>/dev/null || stat -f '%Lp' "$dir/.env")
[[ $env_mode == 600 ]] || fail ".env mode is $env_mode, expected 600"
echo ".env: address, port and setup code; no password; mode 600"

up
wait_ready
logs=$(bootstrap_log)
[[ $(grep -c 'password generated into' <<<"$logs") == 4 ]] || { echo "$logs" >&2; fail "bootstrap did not generate four passwords"; }
if grep -qE '[0-9a-f]{64}' <<<"$logs"; then fail "the bootstrap log holds something shaped like a password"; fi
echo "bootstrap generated the four passwords and printed none"

setup=$(curl -fsS "$base/api/v1/setup")
[[ $setup == *'"needed":true'* ]] || fail "GET /api/v1/setup: '$setup', expected needed"
wrong=$([[ $code == 000-000 ]] && echo 111-111 || echo 000-000)
status=$(setup_with "$wrong")
[[ $status == 400 ]] || fail "a wrong setup code answered $status, expected 400"
status=$(setup_with "$code")
[[ $status == 201 ]] || fail "the printed setup code answered $status: $(head -c 300 "$work/last-body")"
echo "setup needed; a wrong code refused; the printed code made the first admin"
sign_in

# The serving container: no owner login, no owner password, its own files private.
kept_env=$(cd "$dir" && compose exec -T kept env)
if grep -q '^KEPT_OWNER_DATABASE_URL=' <<<"$kept_env"; then fail "kept holds KEPT_OWNER_DATABASE_URL"; fi
owner_seen=$(cd "$dir" && compose exec -T kept sh -c 'ls -A /owner')
[[ -z $owner_seen ]] || fail "kept sees files in /owner: $owner_seen"
modes=$(cd "$dir" && compose exec -T kept sh -c 'stat -c "%a %u %n" /config/database /config/database/kept_*')
echo "$modes" | sed 's/^/  /'
[[ $(grep -c '^600 10001 /config/database/kept_' <<<"$modes") == 3 ]] || fail "the three password files are not 600 and uid 10001"
grep -q '^700 10001 /config/database$' <<<"$modes" || fail "/config/database is not 700 and uid 10001"
if (cd "$dir" && compose exec -T kept test -e /config/database/kept_owner); then fail "the owner's password is in kept-config"; fi
db_env=$(cd "$dir" && compose exec -T db env)
if grep -qE '^KEPT_DB_|^POSTGRES_PASSWORD=.' <<<"$db_env"; then fail "the database container holds a password in its environment"; fi
echo "kept holds no owner login; the database container holds no password"
digests=$(file_digests)

step "2. up again: nothing changes"
up
wait_ready
logs=$(bootstrap_log)
[[ $(grep -c 'password kept in' <<<"$logs") -ge 4 ]] || { echo "$logs" >&2; fail "the second bootstrap did not keep the four passwords"; }
[[ $(file_digests) == "$digests" ]] || fail "a password file changed on the second start"
sign_in

step "3. .env written again"
out=$(init_env)
[[ $(code_of "$out") == "$code" ]] || fail "init over an existing .env did not keep its setup code"
up
wait_ready
sign_in
rm "$dir/.env"
out=$(init_env)
[[ -n $(code_of "$out") ]] || fail "init printed no setup code"
up
wait_ready
sign_in
[[ $(file_digests) == "$digests" ]] || fail "a password file changed when .env was made again"
(cd "$dir" && compose down -v >/dev/null 2>&1)

# ---------------------------------------------------------------------------------------------
step "4. an .env with five passwords, as installs before 1.13.0 have it"
new_install oldenv
cat >"$dir/.env" <<EOF
KEPT_DB_SUPERUSER_PASSWORD=$(pw)
KEPT_DB_OWNER_PASSWORD=$(pw)
KEPT_DB_APP_PASSWORD=$(pw)
KEPT_DB_AUTH_PASSWORD=$(pw)
KEPT_DB_SYSTEM_PASSWORD=$(pw)
KEPT_PUBLIC_URL=$base
KEPT_HTTP_PORT=$port
EOF
up
wait_ready
logs=$(bootstrap_log)
[[ $(grep -c 'password from KEPT_DB_' <<<"$logs") == 4 ]] || { echo "$logs" >&2; fail "the bootstrap did not take the four passwords from .env"; }
left=$(cd "$dir" && compose exec -T kept sh -c 'ls -A /config/database 2>/dev/null || true')
[[ -z $left ]] || fail "password files were written beside .env passwords: $left"
echo "the five passwords used as given; no file written"
(cd "$dir" && compose down -v >/dev/null 2>&1)

# ---------------------------------------------------------------------------------------------
step "5. an install made with the clone, before 1.13.0, upgraded to this compose.yaml"
new_install clone
super_pw=$(pw) owner_pw=$(pw) app_pw=$(pw) auth_pw=$(pw) system_pw=$(pw)
cat >"$dir/.env" <<EOF
KEPT_DB_SUPERUSER_PASSWORD=$super_pw
KEPT_DB_OWNER_PASSWORD=$owner_pw
KEPT_DB_APP_PASSWORD=$app_pw
KEPT_DB_AUTH_PASSWORD=$auth_pw
KEPT_DB_SYSTEM_PASSWORD=$system_pw
KEPT_PUBLIC_URL=$base
KEPT_HTTP_PORT=$port
EOF
# The services as that compose.yaml ran them: the same volumes (Compose's names for this
# project), the database initialised by docker/initdb-prod, the URLs holding the passwords.
net="$project-old"
extra_networks+=("$net")
docker network create "$net" >/dev/null
for v in kept-db kept-data kept-config; do docker volume create "${project}_$v" >/dev/null; done
old_db="$project-old-db" old_app="$project-old-app"
extra_containers+=("$old_db" "$old_app")
docker run -d --name "$old_db" --network "$net" --network-alias db \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD="$super_pw" -e POSTGRES_DB=kept -e TZ=UTC \
  -e KEPT_DB_OWNER_PASSWORD="$owner_pw" -e KEPT_DB_APP_PASSWORD="$app_pw" \
  -e KEPT_DB_AUTH_PASSWORD="$auth_pw" -e KEPT_DB_SYSTEM_PASSWORD="$system_pw" \
  -v "${project}_kept-db:/var/lib/postgresql" \
  -v "$repo/docker/initdb-prod:/docker-entrypoint-initdb.d:ro" \
  "$PG_IMAGE" >/dev/null
deadline=$((SECONDS + BOOT_TIMEOUT))
until docker exec "$old_db" pg_isready -h 127.0.0.1 -U postgres -d kept >/dev/null 2>&1; do
  ((SECONDS < deadline)) || fail "the old database did not start"
  sleep 1
done
hardening=(--read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true)
docker run --rm --network "$net" "${hardening[@]}" --entrypoint kept \
  -v "${project}_kept-data:/data" -v "${project}_kept-config:/config:ro" \
  -e KEPT_OWNER_DATABASE_URL="postgres://kept_owner:$owner_pw@db:5432/kept" \
  "$OLD_IMAGE" migrate >/dev/null 2>&1 || fail "the old-style migrate failed"
docker run -d --name "$old_app" --network "$net" "${hardening[@]}" \
  -v "${project}_kept-data:/data" -v "${project}_kept-config:/config" \
  -e KEPT_DATABASE_URL="postgres://kept_app:$app_pw@db:5432/kept" \
  -e KEPT_AUTH_DATABASE_URL="postgres://kept_auth:$auth_pw@db:5432/kept" \
  -e KEPT_SYSTEM_DATABASE_URL="postgres://kept_system:$system_pw@db:5432/kept" \
  -e KEPT_PUBLIC_URL="$base" -e KEPT_SETUP_CODE=KPT-2X9 \
  -p "$port:8080" "$OLD_IMAGE" >/dev/null
wait_ready
status=$(setup_with KPT-2X9)
[[ $status == 201 ]] || fail "setup on the old-style install answered $status"
sign_in
docker rm -f "$old_app" "$old_db" >/dev/null
echo "old-style install made and set up; its containers removed, its volumes kept"

up
wait_ready
setup=$(curl -fsS "$base/api/v1/setup")
[[ $setup == *'"needed":false'* ]] || fail "after the upgrade GET /api/v1/setup says '$setup'"
sign_in
echo "upgraded with the same .env: set up, and the admin signs in"
rm "$dir/.env"
out=$(init_env)
up
wait_ready
logs=$(bootstrap_log)
grep -q 'kept_owner: password generated into' <<<"$logs" || fail "the bootstrap did not take over the passwords"
sign_in
echo ".env made again without the passwords: generated, set in Postgres, the admin still signs in"
