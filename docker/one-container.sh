# shellcheck shell=bash
# Kept and Postgres 18 in one container, everything that lasts under /data: what the Home Assistant
# app's start (docker/ha/kept-ha-start, D272) and the Unraid image's start
# (docker/unraid/kept-unraid-start) share. Each sources this file, as root, and calls the
# steps in order:
#
#   own_data          /data's folders re-owned on every start: a restored backup (Home Assistant's,
#                     or an Unraid appdata backup) may come back owned by someone else;
#   make_database     no database yet: restore from /data/backup/kept.pgdump when a backup brought
#                     one, else a new cluster (initdb). A restore is one transaction under a marker
#                     (.restore-pending): a start that finds the marker wipes the half-made
#                     database and restores again;
#   start_postgres    Postgres as `postgres`, on 127.0.0.1 and a socket only root and postgres can
#                     reach;
#   bootstrap_logins  `kept bootstrap` as root (the four logins, their passwords into files under
#                     /data);
#   restore_dump      a restore's pg_restore;
#   export_kept_env   Kept's database logins over 127.0.0.1, its port;
#   run_migrate       `kept migrate` as Kept's user with the owner login, from a copy removed before
#                     Kept starts (the serving process never holds the owner login, as in Compose,
#                     where only migrate mounts /owner);
#   start_kept        Kept as uid 10001;
#   wait_for_exit     until either process exits, or the container is stopped. On TERM: Kept
#                     first, then a dump for the next backup (docker/ha/kept-ha-backup), then
#                     `pg_ctl stop -m fast` (a signal through runuser never reached Postgres in the
#                     spike, T6); if either process exits, the other is stopped and the script
#                     exits non-zero, so whatever runs the container restarts it.
#
# The caller sets PG_ENV_UNSET first: the `env -u NAME` arguments that keep its secrets out of
# Postgres's processes, which have no use for them.
#
# Postgres's settings are for a small machine (the Home Assistant app spec's §5.2).

DATA=/data
PGBIN=/usr/lib/postgresql/18/bin
PGDATA=$DATA/postgres
SOCKET=/run/postgresql
DUMP=$DATA/backup/kept.pgdump
RESTORE_MARK=$DATA/.restore-pending
KEPT_USER=kept
# The dump the stop writes, and Home Assistant's backup_pre.
BACKUP=/usr/local/bin/kept-ha-backup

log() { printf 'app: %s\n' "$*"; }
as_postgres() { env "${PG_ENV_UNSET[@]}" setpriv --reuid=postgres --regid=postgres --init-groups -- "$@"; }
as_kept() { setpriv --reuid="$KEPT_USER" --regid="$KEPT_USER" --init-groups -- "$@"; }
psql_su() { "$PGBIN/psql" -h "$SOCKET" -U postgres -v ON_ERROR_STOP=1 -qAt "$@"; }

# /data itself is root's and only traversable, so postgres and Kept each reach their own folder and
# nothing else; the owner login's password is root's alone.
own_data() {
  chown root:root "$DATA"
  chmod 0711 "$DATA"
  install -d -m 0700 "$DATA/kept" "$DATA/config" "$DATA/owner" "$DATA/backup" "$PGDATA"
  chown -R "$KEPT_USER:$KEPT_USER" "$DATA/kept" "$DATA/config"
  chown -R root:root "$DATA/owner"
  chmod -R go-rwx "$DATA/owner"
  chown -R postgres:postgres "$DATA/backup"
  [[ $(stat -c %U "$PGDATA") == postgres ]] || chown -R postgres:postgres "$PGDATA"
  chmod 0700 "$PGDATA"
  # The socket's folder: Postgres writes its socket there; only root (the bootstrap and the backup)
  # and postgres connect through it. Kept itself connects over 127.0.0.1 with its own logins.
  install -d -m 0700 -o postgres -g postgres "$SOCKET"
}

# Sets restore (a dump to restore) and fresh (this start made the database).
make_database() {
  restore=
  fresh=
  if [[ -e $RESTORE_MARK ]]; then
    # A restore that didn't finish left a half-made database: start it again from the dump.
    [[ -s $DUMP ]] || { log "a restore didn't finish and its dump is gone: restore the backup again"; exit 1; }
    log "the last restore didn't finish: restoring again"
    find "$PGDATA" -mindepth 1 -delete
  fi
  if [[ ! -s $PGDATA/PG_VERSION ]]; then
    if [[ -s $DUMP ]]; then
      restore=1
      touch "$RESTORE_MARK"
      log "no database, but a backup brought one: restoring it"
    fi
    # What an interrupted first start left behind.
    find "$PGDATA" -mindepth 1 -delete
    as_postgres "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth-local=peer --auth-host=scram-sha-256 \
      -E UTF8 --locale=C.UTF-8 -c huge_pages=off >/dev/null
    fresh=1
    log "database created"
  fi
  # Root reaches the superuser over the socket only, through this ident map; nothing else can.
  if ! grep -q '^local all postgres peer map=boot' "$PGDATA/pg_hba.conf"; then
    sed -i '1i local all postgres peer map=boot' "$PGDATA/pg_hba.conf"
    printf 'boot root postgres\nboot postgres postgres\n' >>"$PGDATA/pg_ident.conf"
  fi
}

# env and setpriv straight from this shell (not through as_postgres, which would run in a
# subshell), and both exec: so $! is Postgres itself. No huge pages: the memory is small, and an
# anonymous MAP_HUGETLB attempt is what AppArmor logged as a mapping named "/" in the Home Assistant
# app (homeassistant/kept/apparmor.txt). Sets pg_pid.
start_postgres() {
  env "${PG_ENV_UNSET[@]}" setpriv --reuid=postgres --regid=postgres --init-groups -- "$PGBIN/postgres" -D "$PGDATA" \
    -c huge_pages=off \
    -c listen_addresses=127.0.0.1 -c port=5432 -c unix_socket_directories="$SOCKET" \
    -c shared_buffers=64MB -c max_connections=50 -c work_mem=4MB -c maintenance_work_mem=64MB \
    -c effective_cache_size=256MB -c wal_level=minimal -c max_wal_senders=0 &
  pg_pid=$!
  for _ in $(seq 120); do
    "$PGBIN/pg_isready" -q -h "$SOCKET" -U postgres && break
    kill -0 "$pg_pid" 2>/dev/null || { log "Postgres did not start"; exit 1; }
    sleep 0.5
  done
  "$PGBIN/pg_isready" -q -h "$SOCKET" -U postgres || { log "Postgres did not answer in 60 s"; exit 1; }
  [[ $(psql_su -d postgres -c "SELECT 1 FROM pg_database WHERE datname = 'kept'") == 1 ]] ||
    psql_su -d postgres -c 'CREATE DATABASE kept' >/dev/null
  trap 'log "stopping"; stop_postgres; log "stopped"; exit 0' TERM INT
}

stop_postgres() {
  as_postgres "$PGBIN/pg_ctl" -D "$PGDATA" stop -m fast -w -t 50 >/dev/null 2>&1 ||
    kill -INT "$pg_pid" 2>/dev/null || true
  wait "$pg_pid" 2>/dev/null || true
}

# The four logins and the extensions, as the superuser (root, through the ident map).
bootstrap_logins() {
  env PGHOST="$SOCKET" PGUSER=postgres PGDATABASE=kept \
    KEPT_DB_OWNER_PASSWORD_FILE="$DATA/owner/kept_owner" \
    KEPT_DB_APP_PASSWORD_FILE="$DATA/config/database/kept_app" \
    KEPT_DB_AUTH_PASSWORD_FILE="$DATA/config/database/kept_auth" \
    KEPT_DB_SYSTEM_PASSWORD_FILE="$DATA/config/database/kept_system" \
    kept bootstrap
  chown -R "$KEPT_USER:$KEPT_USER" "$DATA/config"
  chmod -R go-rwx "$DATA/owner"
}

# A restore: one transaction, all of it or none.
restore_dump() {
  [[ -n $restore ]] || return 0
  as_postgres "$PGBIN/pg_restore" -h "$SOCKET" -U postgres -d kept --clean --if-exists \
    --single-transaction --exit-on-error "$DUMP"
  rm -f "$RESTORE_MARK"
  log "database restored from the backup"
}

# Kept's three runtime logins over 127.0.0.1 (passwords from their files) and its port.
export_kept_env() {
  export KEPT_DATABASE_URL=postgres://kept_app:@127.0.0.1:5432/kept
  export KEPT_AUTH_DATABASE_URL=postgres://kept_auth:@127.0.0.1:5432/kept
  export KEPT_SYSTEM_DATABASE_URL=postgres://kept_system:@127.0.0.1:5432/kept
  export KEPT_DB_APP_PASSWORD_FILE=$DATA/config/database/kept_app
  export KEPT_DB_AUTH_PASSWORD_FILE=$DATA/config/database/kept_auth
  export KEPT_DB_SYSTEM_PASSWORD_FILE=$DATA/config/database/kept_system
  export KEPT_PORT=8080
}

# The owner login for migrate alone: a copy Kept's user can read, removed before Kept starts.
run_migrate() {
  install -d -m 0700 -o "$KEPT_USER" -g "$KEPT_USER" /run/kept-owner
  install -m 0400 -o "$KEPT_USER" -g "$KEPT_USER" "$DATA/owner/kept_owner" /run/kept-owner/kept_owner
  as_kept env KEPT_OWNER_DATABASE_URL=postgres://kept_owner:@127.0.0.1:5432/kept \
    KEPT_DB_OWNER_PASSWORD_FILE=/run/kept-owner/kept_owner kept migrate
  rm -rf /run/kept-owner
}

# As Postgres above: $! is node itself, so TERM reaches it. Sets kept_pid.
start_kept() {
  setpriv --reuid="$KEPT_USER" --regid="$KEPT_USER" --init-groups -- node --import /app/apps/server/dist/observability/tracing.js /app/apps/server/dist/main.js &
  kept_pid=$!
  trap 'stop; exit 0' TERM INT
}

stop() {
  log "stopping"
  kill -TERM "$kept_pid" 2>/dev/null || true
  wait "$kept_pid" 2>/dev/null || true
  # The dump the next backup holds (a backup of a stopped container gets no fresh one), while
  # Postgres still answers; a failed one leaves the previous dump in place.
  if "$PGBIN/pg_isready" -q -h "$SOCKET" -U postgres; then
    "$BACKUP" || log "no fresh dump at stop; the last one stays"
  fi
  stop_postgres
  log "stopped"
}

wait_for_exit() {
  wait -n "$kept_pid" "$pg_pid" || true
  log "a process exited"
  stop
  exit 1
}
