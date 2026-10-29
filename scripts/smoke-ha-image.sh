#!/usr/bin/env bash
# Smoke test for the Home Assistant app's image (D272; the app spec's §13.1).
#
#   bash scripts/smoke-ha-image.sh <image>        e.g. kept-ha:dev
#   bash scripts/smoke-image.sh <image> --ha      the same
#
# Runs the image as the Supervisor does (Docker's init, a private /data with an options.json, no
# extra privileges), with no Supervisor to ask, and asserts:
#   1. the image declares no VOLUME and carries io.hass.version, io.hass.type=app, io.hass.arch;
#   2. first start: /readyz answers 200; the log has exactly one `KEPT SETUP CODE` line and the
#      `Kept is at …` line; GET /api/v1/setup says it is the Home Assistant app;
#   3. Postgres listens on 127.0.0.1 only, runs as `postgres`; Kept runs as 10001 and holds no
#      SUPERVISOR_TOKEN;
#   4. the third-party notices name the Postgres server and pgvector;
#   5. backup_pre writes /data/backup/kept.pgdump (owned by postgres), and it stays; Kept's user
#      can't read the owner login's password;
#   6. a stop writes a fresh dump, takes under 10 s and Postgres logs a clean shutdown; a second
#      start makes no new
#      database and prints no new setup code;
#   7. restore: with /data/postgres gone, /data owned by root (as a restore leaves it) and a dump in
#      /data/backup, the start restores it; a restore left unfinished (its marker) is done again;
#      /data/backup, the start restores it: the instance set up before is still set up.
# BOOT_TIMEOUT (seconds, default 180) bounds each wait. Everything it creates is removed on exit.
set -euo pipefail

image=${1:?usage: smoke-ha-image.sh <image>}
export DOCKER_CONFIG=${DOCKER_CONFIG:-/tmp/kept-docker-config}
BOOT_TIMEOUT=${BOOT_TIMEOUT:-180}

run_id="kept-ha-smoke-$(date +%s)-$$"
app=$run_id
vol=$run_id-data

cleanup() {
  local rc=$?
  if ((rc != 0)) && docker inspect "$app" >/dev/null 2>&1; then
    echo "--- app logs (last 60) ---" >&2
    docker logs --tail 60 "$app" >&2 2>&1 || true
  fi
  docker rm -f "$app" >/dev/null 2>&1 || true
  docker volume rm "$vol" >/dev/null 2>&1 || true
  if ((rc == 0)); then echo "smoke-ha: PASS ($image)"; else echo "smoke-ha: FAIL ($image)" >&2; fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

fail() {
  echo "smoke-ha: $*" >&2
  exit 1
}
step() { printf '\n==> %s\n' "$*"; }
# A one-off container on the app's data (the image's own tools, as root).
on_data() { docker run --rm -v "$vol:/data" --entrypoint "$1" "$image" "${@:2}"; }

docker image inspect "$image" >/dev/null 2>&1 || fail "no local image '$image' (build it with --target ha --load)"

step "the image"
volumes=$(docker image inspect -f '{{json .Config.Volumes}}' "$image")
[[ $volumes == null || $volumes == '{}' ]] || fail "the image declares volumes: $volumes"
labels=$(docker image inspect -f '{{index .Config.Labels "io.hass.type"}} {{index .Config.Labels "io.hass.arch"}} {{index .Config.Labels "io.hass.version"}}' "$image")
read -r hass_type hass_arch hass_version <<<"$labels"
[[ $hass_type == app ]] || fail "io.hass.type is '$hass_type'"
[[ $hass_arch == aarch64 || $hass_arch == amd64 ]] || fail "io.hass.arch is '$hass_arch'"
[[ -n $hass_version ]] || fail "no io.hass.version"
echo "no volumes; io.hass.type=$hass_type io.hass.arch=$hass_arch io.hass.version=$hass_version"

step "the third-party notices"
notices=$(docker run --rm --entrypoint cat "$image" /app/THIRD-PARTY-NOTICES.txt)
grep -qE '^ +postgresql-18 ' <<<"$notices" || fail "the notices don't list postgresql-18"
grep -qE '^ +postgresql-18-pgvector ' <<<"$notices" || fail "the notices don't list pgvector"
echo "lists postgresql-18 and postgresql-18-pgvector"

docker volume create "$vol" >/dev/null
on_data sh -c 'printf "%s\n" "{\"log_level\":\"info\",\"ssl\":false,\"certfile\":\"fullchain.pem\",\"keyfile\":\"privkey.pem\"}" >/data/options.json'

start() {
  # As the Supervisor runs an app: Docker's init, no capabilities added. SUPERVISOR_TOKEN is set
  # (to a value no Supervisor knows) so the check below proves Kept doesn't inherit it.
  docker run -d --name "$app" --init -v "$vol:/data" -e SUPERVISOR_TOKEN=smoke-not-a-token \
    -e KEPT_HA_TRUST_GROUPS=1 \
    -p 127.0.0.1::8080 "$image" >/dev/null
  port=$(docker port "$app" 8080/tcp | sed -n '1s/.*://p')
  [[ -n $port ]] || fail "no published port"
  base="http://127.0.0.1:$port"
  local t0=$SECONDS deadline=$((SECONDS + BOOT_TIMEOUT)) code=000
  while ((SECONDS < deadline)); do
    [[ $(docker inspect -f '{{.State.Running}}' "$app") == true ]] || fail "the app exited before /readyz answered"
    code=$(curl -s -o /dev/null -m 2 -w '%{http_code}' "$base/readyz" || true)
    if [[ $code == 200 ]]; then
      echo "/readyz 200 on $base after $((SECONDS - t0)) s"
      return 0
    fi
    sleep 0.5
  done
  fail "/readyz did not return 200 within ${BOOT_TIMEOUT}s (last: $code)"
}

stop() {
  local t0=$SECONDS
  docker stop -t 30 "$app" >/dev/null
  local took=$((SECONDS - t0))
  logs=$(docker logs "$app" 2>&1)
  docker rm "$app" >/dev/null
  # Kept stops, a dump for the next backup is written, Postgres stops.
  ((took < 10)) || fail "the stop took ${took}s (Postgres or Kept didn't stop on TERM)"
  grep -q '^app: database dumped for the backup' <<<"$logs" || fail "the stop wrote no dump"
  grep -q 'database system is shut down' <<<"$logs" || fail "Postgres did not log a clean shutdown"
  grep -q '^app: stopped$' <<<"$logs" || fail "the start script did not finish its stop"
  echo "stopped in ${took}s, Postgres shut down cleanly"
}

step "first start"
start
logs=$(docker logs "$app" 2>&1)
code_lines=$(grep -cE '^KEPT SETUP CODE: [0-9A-HJKMNP-TV-Z]{3}-[0-9A-HJKMNP-TV-Z]{3}$' <<<"$logs" || true)
[[ $code_lines == 1 ]] || fail "first start printed $code_lines setup code lines, expected 1"
code=$(grep -oE '^KEPT SETUP CODE: [0-9A-HJKMNP-TV-Z]{3}-[0-9A-HJKMNP-TV-Z]{3}$' <<<"$logs" | sed 's/.*: //')
grep -qF "app: Kept is at http://homeassistant.local:8080 (change it in Configuration" <<<"$logs" ||
  fail "no 'Kept is at …' line"
grep -q '^app: database created$' <<<"$logs" || fail "no 'database created' line"
setup=$(curl -fsS "$base/api/v1/setup")
[[ $setup == '{"needed":true,"homeAssistant":{"codeNeeded":true}}' ]] ||
  fail "GET /api/v1/setup: '$setup'"
echo "setup code printed once, the address line, $setup"

step "processes, listeners, the Supervisor token"
facts=$(docker exec "$app" node -e '
  const fs = require("node:fs");
  const out = { procs: [], listen: [] };
  for (const pid of fs.readdirSync("/proc").filter((p) => /^\d+$/.test(p))) {
    try {
      const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean);
      const uid = /^Uid:\s+(\d+)/m.exec(fs.readFileSync(`/proc/${pid}/status`, "utf8"))[1];
      // The whole command line: under emulation (amd64 on an arm64 host) an emulator comes first
      // and repeats the program path, so the first few words are not the program arguments.
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
node -e '
  const f = JSON.parse(process.argv[1]);
  const fail = (m) => { console.error(m); process.exit(1); };
  const pg = f.procs.find((p) => /\/postgres -D/.test(p.cmd));
  if (!pg) fail("no postgres process");
  const kept = f.procs.find((p) => /dist\/main\.js|tracing\.js/.test(p.cmd));
  if (!kept) fail("no kept process");
  if (kept.uid !== "10001") fail(`kept runs as uid ${kept.uid}`);
  // Kept must be the very process the start script signals (no shell in between).
  const parent = f.procs.find((p) => p.pid === kept.pid);
  if (!parent) fail("no kept process");
  // 5432 = 0x1538; 127.0.0.1 = 0100007F in /proc/net/tcp.
  const pgListen = f.listen.filter((l) => l.endsWith(":1538"));
  if (pgListen.length === 0) fail("Postgres listens on no TCP port 5432");
  if (pgListen.some((l) => l !== "0100007F:1538")) fail(`Postgres listens on ${pgListen.join(", ")}`);
  console.log(`postgres uid ${pg.uid}, kept uid ${kept.uid} without SUPERVISOR_TOKEN, Postgres on 127.0.0.1:5432 only`);
' "$facts" || fail "process or listener check failed"
# Kept's own environment: it changed its uid, so /proc/<pid>/environ needs root with ptrace's
# capability (--privileged on this one exec).
kept_pid=$(docker exec "$app" node -e '
  const fs = require("node:fs");
  const pid = fs.readdirSync("/proc").find((p) => {
    try {
      return (
        /^\d+$/.test(p) &&
        p !== String(process.pid) &&
        fs.readFileSync(`/proc/${p}/cmdline`, "utf8").includes("dist/main.js")
      );
    } catch {
      return false;
    }
  });
  process.stdout.write(pid ?? "");
')
[[ -n $kept_pid ]] || fail "no kept process"
docker exec --privileged "$app" sh -c "tr '\0' '\n' </proc/$kept_pid/environ" >/tmp/kept-ha-smoke-env.$$ || fail "can't read Kept's environment"
if grep -q '^SUPERVISOR_TOKEN=' /tmp/kept-ha-smoke-env.$$; then rm -f /tmp/kept-ha-smoke-env.$$; fail "the kept process holds SUPERVISOR_TOKEN"; fi
grep -q '^KEPT_HA=1$' /tmp/kept-ha-smoke-env.$$ || { rm -f /tmp/kept-ha-smoke-env.$$; fail "the kept process has no KEPT_HA=1"; }
grep -q '^KEPT_TRUSTED_PROXIES=172.30.32.2$' /tmp/kept-ha-smoke-env.$$ || { rm -f /tmp/kept-ha-smoke-env.$$; fail "Kept trusts more than the Supervisor"; }
# No Supervisor here to say its version: setup without the code stays off, even though the
# container was started with KEPT_HA_TRUST_GROUPS=1 (see start()).
grep -q '^KEPT_HA_TRUST_GROUPS=0$' /tmp/kept-ha-smoke-env.$$ || { rm -f /tmp/kept-ha-smoke-env.$$; fail "KEPT_HA_TRUST_GROUPS isn't 0 without a Supervisor"; }
rm -f /tmp/kept-ha-smoke-env.$$
# Kept is the start script's own child, and the start script is the init's (PID 1): TERM goes
# init → script → Kept and Postgres, with no subshell in between to swallow it.
chain=$(docker exec "$app" node -e '
  const ppid = (p) => /^PPid:\s+(\d+)/m.exec(require("node:fs").readFileSync(`/proc/${p}/status`, "utf8"))[1];
  const script = ppid(process.argv[1]);
  process.stdout.write(`${ppid(script)}`);
' "$kept_pid")
[[ $chain == 1 ]] || fail "Kept's parent is not the start script run by the init (its parent's parent is $chain)"
echo "Kept (pid $kept_pid) holds no SUPERVISOR_TOKEN, has KEPT_HA=1"
pg_user=$(docker exec "$app" sh -c 'stat -c %U /data/postgres')
[[ $pg_user == postgres ]] || fail "/data/postgres is owned by $pg_user"

step "set up the instance (the code from the log), so a restore has something to keep"
# Setup must come from Kept's own page (1.14.2): the Origin is Kept's address, as for sign-in below.
status=$(curl -s -o /dev/null -w '%{http_code}' -H 'content-type: application/json' \
  -H 'origin: http://homeassistant.local:8080' \
  -d "{\"code\":\"$code\",\"email\":\"smoke@example.com\",\"password\":\"correct horse battery\",\"displayName\":\"Smoke\"}" \
  "$base/api/v1/setup")
[[ $status == 201 ]] || fail "setup answered $status"
[[ $(curl -fsS "$base/api/v1/setup") == '{"needed":false,"homeAssistant":{"codeNeeded":true}}' ]] ||
  fail "setup is still needed after POST"
echo "set up"

step "backup_pre, and the owner login out of Kept's reach"
docker exec "$app" /usr/local/bin/kept-ha-backup
docker exec "$app" test -s /data/backup/kept.pgdump || fail "no dump after backup_pre"
dump_owner=$(docker exec "$app" stat -c %U /data/backup/kept.pgdump)
[[ $dump_owner == postgres ]] || fail "the dump is owned by $dump_owner"
docker exec "$app" sh -c 'cp /data/backup/kept.pgdump /data/kept.pgdump.keep'
if docker exec --user 10001 "$app" cat /data/owner/kept_owner >/dev/null 2>&1; then
  fail "Kept's user can read the owner login's password"
fi
docker exec "$app" test ! -e /run/kept-owner || fail "migrate's copy of the owner password is still there"
echo "dumped (the dump stays); the owner login is root's alone"

step "stop, and a second start on the same /data"
stop
start
logs=$(docker logs "$app" 2>&1)
if grep -q 'KEPT SETUP CODE' <<<"$logs"; then fail "the second start printed a setup code"; fi
if grep -q '^app: database created$' <<<"$logs"; then fail "the second start made a new database"; fi
[[ $(curl -fsS "$base/api/v1/setup") == '{"needed":false,"homeAssistant":{"codeNeeded":true}}' ]] ||
  fail "the second start lost the setup"
echo "same database, no new code"
stop

step "restore: no database, a dump, everything owned by root"
on_data sh -c 'rm -rf /data/postgres && mv /data/kept.pgdump.keep /data/backup/kept.pgdump && chown -R root:root /data'
start
logs=$(docker logs "$app" 2>&1)
grep -q '^app: no database, but a backup brought one: restoring it$' <<<"$logs" || fail "no restore line"
grep -q '^app: database restored from the backup$' <<<"$logs" || fail "the restore didn't finish"
[[ $(curl -fsS "$base/api/v1/setup") == '{"needed":false,"homeAssistant":{"codeNeeded":true}}' ]] ||
  fail "the restored instance is not set up"
if grep -q 'KEPT SETUP CODE' <<<"$logs"; then fail "the restored instance printed a setup code"; fi
# Better Auth checks the Origin against Kept's address (KEPT_PUBLIC_URL, derived here).
status=$(curl -s -o /dev/null -w '%{http_code}' -H 'content-type: application/json' \
  -H 'origin: http://homeassistant.local:8080' \
  -d '{"email":"smoke@example.com","password":"correct horse battery"}' "$base/api/v1/auth/sign-in/email")
[[ $status == 200 ]] || fail "sign-in after the restore answered $status"
echo "restored: set up, and the same password signs in"
stop

step "a restore that didn't finish is done again"
on_data sh -c 'touch /data/.restore-pending'
start
logs=$(docker logs "$app" 2>&1)
grep -q "^app: the last restore didn't finish: restoring again$" <<<"$logs" || fail "no retry line"
grep -q '^app: database restored from the backup$' <<<"$logs" || fail "the retried restore didn't finish"
on_data test ! -e /data/.restore-pending || fail "the marker is still there"
[[ $(curl -fsS "$base/api/v1/setup") == '{"needed":false,"homeAssistant":{"codeNeeded":true}}' ]] ||
  fail "the restored-again instance is not set up"
echo "restored again from the dump"
stop
