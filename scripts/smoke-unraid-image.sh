#!/usr/bin/env bash
# Smoke test for the Unraid image (`--target unraid`, ghcr.io/keptinventory/kept-unraid).
#
#   bash scripts/smoke-unraid-image.sh <image>        e.g. kept-unraid:dev
#
# Runs the image as Unraid does (no --init, so the start script is PID 1; /data owned 99:100, as
# Unraid's appdata usually is; settings as environment variables) and asserts:
#   1. the image declares /data as its volume, a healthcheck, and its version label;
#   2. without KEPT_PUBLIC_URL it stops at once, says so, and makes no database;
#   3. first start: /healthz and /readyz answer 200, Docker calls it healthy; the log has exactly one
#      `KEPT SETUP CODE` line, `Kept is at …` and `database created`; Kept's keys are made in
#      /data/config/secrets.json;
#   4. /data is root's and only traversable, Kept's folders are 10001's, the database postgres's;
#      Postgres listens on 127.0.0.1 only, runs as `postgres` without the container's secrets;
#      Kept runs as 10001 without the owner login or the Home Assistant app's settings;
#   5. a stop takes under 10 s, writes /data/backup/kept.pgdump and Postgres logs a clean shutdown;
#      `kept admin recovery-kit` from `docker exec` (Unraid's Console) prints the kit;
#   6. a second start on the same /data: no new database, no new setup code, the same keys, and the
#      account made before signs in;
#   7. restore: with /data/postgres gone and a dump in /data/backup, the start restores it and the
#      same account signs in.
# BOOT_TIMEOUT (seconds, default 180) bounds each wait. Everything it creates is removed on exit.
set -euo pipefail

image=${1:?usage: smoke-unraid-image.sh <image>}
export DOCKER_CONFIG=${DOCKER_CONFIG:-/tmp/kept-docker-config}
BOOT_TIMEOUT=${BOOT_TIMEOUT:-180}

run_id="kept-unraid-smoke-$(date +%s)-$$"
app=$run_id
vol=$run_id-data
address=http://tower.local:8080
# A mail URL with a password in it: Postgres's processes must not inherit it.
smtp=smtp://smoke:smoke-not-a-password@mail.example.com:587

cleanup() {
  local rc=$?
  if ((rc != 0)) && docker inspect "$app" >/dev/null 2>&1; then
    echo "--- app logs (last 60) ---" >&2
    docker logs --tail 60 "$app" >&2 2>&1 || true
  fi
  docker rm -f "$app" >/dev/null 2>&1 || true
  docker volume rm "$vol" >/dev/null 2>&1 || true
  if ((rc == 0)); then echo "smoke-unraid: PASS ($image)"; else echo "smoke-unraid: FAIL ($image)" >&2; fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

fail() {
  echo "smoke-unraid: $*" >&2
  exit 1
}
step() { printf '\n==> %s\n' "$*"; }
# The volume is mounted with nocopy everywhere, as Unraid's bind mount is: otherwise Docker copies
# the image's /data, ownership included, into the volume while it is empty.
# A one-off container on the data (the image's own tools, as root).
on_data() { docker run --rm -v "$vol:/data:nocopy" --entrypoint "$1" "$image" "${@:2}"; }

docker image inspect "$image" >/dev/null 2>&1 || fail "no local image '$image' (build it with --target unraid --load)"

step "the image"
volumes=$(docker image inspect -f '{{json .Config.Volumes}}' "$image")
[[ $volumes == '{"/data":{}}' ]] || fail "the image declares volumes $volumes, expected /data alone"
health=$(docker image inspect -f '{{json .Config.Healthcheck.Test}}' "$image")
[[ $health == *healthcheck.mjs* ]] || fail "no healthcheck: $health"
version=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.version"}}' "$image")
[[ -n $version ]] || fail "no org.opencontainers.image.version"
echo "volume /data, a healthcheck, version $version"

docker volume create "$vol" >/dev/null
# Unraid's appdata: nobody:users.
on_data chown 99:100 /data
[[ $(on_data stat -c '%u:%g' /data) == 99:100 ]] || fail "couldn't make /data 99:100"

step "no address: a clear stop, no database"
rc=0
out=$(docker run --rm -v "$vol:/data:nocopy" "$image" 2>&1) || rc=$?
((rc != 0)) || fail "it started without KEPT_PUBLIC_URL"
grep -q '^app: KEPT_PUBLIC_URL is required' <<<"$out" || fail "no line about KEPT_PUBLIC_URL: $out"
on_data test ! -e /data/postgres || fail "it made a database without an address"
echo "exit $rc: $(head -n 1 <<<"$out")"

start() {
  # As Unraid's template runs it: no --init, the settings as variables, empty ones included.
  docker run -d --name "$app" -v "$vol:/data:nocopy" \
    -e KEPT_PUBLIC_URL="$address" -e KEPT_SMTP_URL="$smtp" -e KEPT_OIDC_ISSUER= -e TZ=UTC \
    -p 127.0.0.1::8080 "$image" >/dev/null
  port=$(docker port "$app" 8080/tcp | sed -n '1s/.*://p')
  [[ -n $port ]] || fail "no published port"
  base="http://127.0.0.1:$port"
  local t0=$SECONDS deadline=$((SECONDS + BOOT_TIMEOUT)) code=000
  while ((SECONDS < deadline)); do
    [[ $(docker inspect -f '{{.State.Running}}' "$app") == true ]] || fail "the container exited before /healthz answered"
    code=$(curl -s -o /dev/null -m 2 -w '%{http_code}' "$base/healthz" || true)
    if [[ $code == 200 ]]; then
      echo "/healthz 200 on $base after $((SECONDS - t0)) s"
      [[ $(curl -s -o /dev/null -m 5 -w '%{http_code}' "$base/readyz") == 200 ]] || fail "/readyz isn't 200"
      return 0
    fi
    sleep 0.5
  done
  fail "/healthz did not return 200 within ${BOOT_TIMEOUT}s (last: $code)"
}

stop() {
  local t0=$SECONDS
  docker stop -t 30 "$app" >/dev/null
  local took=$((SECONDS - t0))
  logs=$(docker logs "$app" 2>&1)
  docker rm "$app" >/dev/null
  ((took < 10)) || fail "the stop took ${took}s (Postgres or Kept didn't stop on TERM)"
  grep -q '^app: database dumped for the backup' <<<"$logs" || fail "the stop wrote no dump"
  grep -q 'database system is shut down' <<<"$logs" || fail "Postgres did not log a clean shutdown"
  grep -q '^app: stopped$' <<<"$logs" || fail "the start script did not finish its stop"
  on_data test -s /data/backup/kept.pgdump || fail "no /data/backup/kept.pgdump after the stop"
  echo "stopped in ${took}s, dump written, Postgres shut down cleanly"
}

sign_in() {
  local status
  # Better Auth checks the Origin against Kept's address.
  status=$(curl -s -o /dev/null -w '%{http_code}' -H 'content-type: application/json' \
    -H "origin: $address" \
    -d '{"email":"smoke@example.com","password":"correct horse battery"}' "$base/api/v1/auth/sign-in/email")
  [[ $status == 200 ]] || fail "sign-in answered $status"
}

step "first start"
start
logs=$(docker logs "$app" 2>&1)
code_lines=$(grep -cE '^KEPT SETUP CODE: [0-9A-HJKMNP-TV-Z]{3}-[0-9A-HJKMNP-TV-Z]{3}$' <<<"$logs" || true)
[[ $code_lines == 1 ]] || fail "first start printed $code_lines setup code lines, expected 1"
code=$(grep -oE '^KEPT SETUP CODE: [0-9A-HJKMNP-TV-Z]{3}-[0-9A-HJKMNP-TV-Z]{3}$' <<<"$logs" | sed 's/.*: //')
grep -qxF "app: Kept is at $address" <<<"$logs" || fail "no 'Kept is at …' line"
grep -q '^app: database created$' <<<"$logs" || fail "no 'database created' line"
[[ $(curl -fsS "$base/api/v1/setup") == '{"needed":true}' ]] || fail "GET /api/v1/setup: $(curl -fsS "$base/api/v1/setup")"
keys=$(docker exec "$app" sha256sum /data/config/secrets.json | cut -d' ' -f1)
[[ -n $keys ]] || fail "no keys in /data/config/secrets.json"
echo "setup code printed once, the address line, keys made"

step "Docker's healthcheck"
deadline=$((SECONDS + 90))
until [[ $(docker inspect -f '{{.State.Health.Status}}' "$app") == healthy ]]; do
  ((SECONDS < deadline)) || fail "not healthy after 90 s: $(docker inspect -f '{{json .State.Health}}' "$app")"
  sleep 2
done
echo "healthy"

step "ownership, processes, listeners"
own=$(docker exec "$app" stat -c '%n %U %a' /data /data/kept /data/config /data/postgres /data/owner /data/config/secrets.json)
echo "$own"
grep -qx '/data root 711' <<<"$own" || fail "/data is not root's 0711"
grep -qx '/data/kept kept 700' <<<"$own" || fail "/data/kept is not Kept's"
grep -qx '/data/config kept 700' <<<"$own" || fail "/data/config is not Kept's"
grep -qx '/data/postgres postgres 700' <<<"$own" || fail "/data/postgres is not postgres's"
grep -qx '/data/owner root 700' <<<"$own" || fail "/data/owner is not root's"
grep -qE '^/data/config/secrets.json kept 6[04]0$' <<<"$own" || fail "the keys file is not Kept's alone"
if docker exec --user 10001 "$app" cat /data/owner/kept_owner >/dev/null 2>&1; then
  fail "Kept's user can read the owner login's password"
fi
docker exec "$app" test ! -e /run/kept-owner || fail "migrate's copy of the owner password is still there"
facts=$(docker exec "$app" node -e '
  const fs = require("node:fs");
  const out = { procs: [], listen: [] };
  for (const pid of fs.readdirSync("/proc").filter((p) => /^\d+$/.test(p))) {
    try {
      const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean);
      const uid = /^Uid:\s+(\d+)/m.exec(fs.readFileSync(`/proc/${pid}/status`, "utf8"))[1];
      out.procs.push({ pid, uid, cmd: cmd.join(" ") });
    } catch {}
  }
  for (const f of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    for (const line of fs.readFileSync(f, "utf8").split("\n").slice(1)) {
      const c = line.trim().split(/\s+/);
      if (c[3] === "0A") out.listen.push(c[1]);
    }
  }
  process.stdout.write(JSON.stringify(out));
')
pids=$(node -e '
  const f = JSON.parse(process.argv[1]);
  const fail = (m) => { console.error(m); process.exit(1); };
  const pg = f.procs.find((p) => /\/postgres -D/.test(p.cmd));
  if (!pg) fail("no postgres process");
  const kept = f.procs.find((p) => /dist\/main\.js/.test(p.cmd));
  if (!kept) fail("no kept process");
  if (kept.uid !== "10001") fail(`kept runs as uid ${kept.uid}`);
  const one = f.procs.find((p) => p.pid === "1");
  if (!one || !/kept-unraid-start/.test(one.cmd)) fail(`PID 1 is not the start script: ${one?.cmd}`);
  // 5432 = 0x1538; 127.0.0.1 = 0100007F in /proc/net/tcp.
  const pgListen = f.listen.filter((l) => l.endsWith(":1538"));
  if (pgListen.length === 0) fail("Postgres listens on no TCP port 5432");
  if (pgListen.some((l) => l !== "0100007F:1538")) fail(`Postgres listens on ${pgListen.join(", ")}`);
  process.stdout.write(`${pg.pid} ${pg.uid} ${kept.pid}`);
' "$facts") || fail "process or listener check failed"
read -r pg_pid pg_uid kept_pid <<<"$pids"
[[ $(docker exec "$app" id -u postgres) == "$pg_uid" ]] || fail "Postgres runs as uid $pg_uid, not postgres"
# Other processes' environments: they changed their uid, so /proc/<pid>/environ needs root with
# ptrace's capability (--privileged on these execs).
pg_env=$(docker exec --privileged "$app" sh -c "tr '\0' '\n' </proc/$pg_pid/environ")
kept_env=$(docker exec --privileged "$app" sh -c "tr '\0' '\n' </proc/$kept_pid/environ")
if grep -q 'smoke-not-a-password' <<<"$pg_env"; then fail "Postgres holds the mail password"; fi
if grep -q '^KEPT_' <<<"$pg_env"; then fail "Postgres holds Kept's settings: $(grep '^KEPT_' <<<"$pg_env" | cut -d= -f1 | tr '\n' ' ')"; fi
grep -qxF "KEPT_SMTP_URL=$smtp" <<<"$kept_env" || fail "Kept didn't get its mail URL"
if grep -qE '^KEPT_(HA|HA_TRUST_GROUPS|OWNER_DATABASE_URL|DB_OWNER_PASSWORD_FILE)=' <<<"$kept_env"; then
  fail "Kept holds the owner login or a Home Assistant setting"
fi
grep -qx 'KEPT_CONFIG_DIR=/data/config' <<<"$kept_env" || fail "Kept's keys aren't in /data/config"
echo "PID 1 is the start script; Postgres (uid $pg_uid) on 127.0.0.1:5432 only, without the container's settings; Kept as 10001 without the owner login"

step "set up the instance (the code from the log)"
status=$(curl -s -o /dev/null -w '%{http_code}' -H 'content-type: application/json' \
  -H "origin: $address" \
  -d "{\"code\":\"$code\",\"email\":\"smoke@example.com\",\"password\":\"correct horse battery\",\"displayName\":\"Smoke\"}" \
  "$base/api/v1/setup")
[[ $status == 201 ]] || fail "setup answered $status"
[[ $(curl -fsS "$base/api/v1/setup") == '{"needed":false}' ]] || fail "setup is still needed after POST"
sign_in
echo "set up, and the account signs in"

step "the recovery kit, from the container's console (docker exec, as Unraid's Console runs it)"
kit=$(docker exec "$app" kept admin recovery-kit 2>/dev/null) || fail "kept admin recovery-kit failed"
[[ $(head -n 1 <<<"$kit") == 'KEPT RECOVERY KIT' ]] || fail "the recovery kit doesn't start with KEPT RECOVERY KIT"
echo "KEPT RECOVERY KIT printed; memory in use: $(docker stats --no-stream --format '{{.MemUsage}}' "$app")"

step "stop"
stop

step "a second start on the same /data"
start
logs=$(docker logs "$app" 2>&1)
if grep -q 'KEPT SETUP CODE' <<<"$logs"; then fail "the second start printed a setup code"; fi
if grep -q '^app: database created$' <<<"$logs"; then fail "the second start made a new database"; fi
[[ $(curl -fsS "$base/api/v1/setup") == '{"needed":false}' ]] || fail "the second start lost the setup"
[[ $(docker exec "$app" sha256sum /data/config/secrets.json | cut -d' ' -f1) == "$keys" ]] ||
  fail "the keys changed across a restart"
sign_in
echo "same database, same keys, the account signs in"
stop

step "restore: no database, the dump from the last stop"
on_data sh -c 'rm -rf /data/postgres && chown 99:100 /data'
start
logs=$(docker logs "$app" 2>&1)
grep -q '^app: no database, but a backup brought one: restoring it$' <<<"$logs" || fail "no restore line"
grep -q '^app: database restored from the backup$' <<<"$logs" || fail "the restore didn't finish"
[[ $(curl -fsS "$base/api/v1/setup") == '{"needed":false}' ]] || fail "the restored instance is not set up"
if grep -q 'KEPT SETUP CODE' <<<"$logs"; then fail "the restored instance printed a setup code"; fi
sign_in
echo "restored: set up, and the same account signs in"
stop
