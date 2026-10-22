#!/usr/bin/env bash
# Database tasks for deploys. See DEPLOYMENT.md.
#
#   deploy/db.sh schema                regenerate php-backend/database/schema.sql from the local DB
#   deploy/db.sh status  local|prod    list migrations and whether each is applied
#   deploy/db.sh migrate local|prod    apply pending php-backend/database/migrations/*.sql (prod: backs up first)
#   deploy/db.sh backup                dump the Hostinger DB to $BACKUP_DIR
#   deploy/db.sh dump-local            dump the local DB (schema + data) to $BACKUP_DIR
#   deploy/db.sh replace DUMP.sql      back up, then replace ALL Hostinger tables with DUMP.sql
#
# Hostinger connection settings come from deploy/.env (see deploy/.env.example).
# The password is asked for, or taken from HOSTINGER_DB_PASSWORD.
# The local MySQL container is used as the client, so no mysql install is needed.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(dirname "$HERE")
[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set +a
CONTAINER=${LOCAL_MYSQL_CONTAINER:-skillforge-mysql}
BACKUP_DIR=${BACKUP_DIR:-$HOME/skillforge-backups}
MIGRATIONS=$ROOT/php-backend/database/migrations
STAMP=$(date +%Y%m%d-%H%M%S)

local_sql()  { docker exec -i "$CONTAINER" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 "$MYSQL_DATABASE" "$@"' sh "$@"; }
local_dump() { docker exec -i "$CONTAINER" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --default-character-set=utf8mb4 --single-transaction --skip-comments "$@" "$MYSQL_DATABASE"' sh "$@"; }

need_prod() {
  : "${HOSTINGER_DB_HOST:?set it in deploy/.env}" "${HOSTINGER_DB_NAME:?set it in deploy/.env}" "${HOSTINGER_DB_USER:?set it in deploy/.env}"
  if [ -z "${HOSTINGER_DB_PASSWORD:-}" ]; then read -rsp "Hostinger DB password: " HOSTINGER_DB_PASSWORD; echo; fi
}
prod_sql()  { docker exec -i -e MYSQL_PWD="$HOSTINGER_DB_PASSWORD" "$CONTAINER" mysql --connect-timeout=15 -h "$HOSTINGER_DB_HOST" -u "$HOSTINGER_DB_USER" --default-character-set=utf8mb4 "$HOSTINGER_DB_NAME" "$@"; }
prod_dump() { docker exec -i -e MYSQL_PWD="$HOSTINGER_DB_PASSWORD" "$CONTAINER" mysqldump --connect-timeout=15 -h "$HOSTINGER_DB_HOST" -u "$HOSTINGER_DB_USER" --default-character-set=utf8mb4 --single-transaction --no-tablespaces --column-statistics=0 --skip-comments "$HOSTINGER_DB_NAME"; }

target_sql() { if [ "$1" = prod ]; then shift; prod_sql "$@"; else shift; local_sql "$@"; fi; }

backup() {
  mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
  local f=$BACKUP_DIR/hostinger-$STAMP.sql
  (umask 077; prod_dump > "$f")
  echo "Backup of Hostinger DB: $f ($(wc -c < "$f") bytes)"
}

# Applied migrations are recorded in deploy_migrations(name, applied_at).
ensure_table() { target_sql "$1" -e "CREATE TABLE IF NOT EXISTS deploy_migrations (name VARCHAR(191) PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))"; }
pending() {
  local applied=""
  if [ "$(target_sql "$1" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='deploy_migrations'")" = 1 ]; then
    applied=$(target_sql "$1" -N -e "SELECT name FROM deploy_migrations")
  fi
  for f in "$MIGRATIONS"/*.sql; do
    [ -e "$f" ] || continue
    grep -qxF "$(basename "$f")" <<<"$applied" || echo "$f"
  done
}

cmd=${1:-}; shift || true
case $cmd in
  schema)
    local_dump --no-data --skip-add-drop-table --ignore-table="$(docker exec "$CONTAINER" sh -c 'echo $MYSQL_DATABASE').deploy_migrations" \
      | sed 's/ AUTO_INCREMENT=[0-9]*//' > "$ROOT/php-backend/database/schema.sql"
    echo "Wrote php-backend/database/schema.sql ($(grep -c 'CREATE TABLE' "$ROOT/php-backend/database/schema.sql") tables)"
    ;;
  status|migrate)
    t=${1:?local or prod}; [ "$t" = local ] || [ "$t" = prod ] || { echo "local or prod" >&2; exit 2; }
    [ "$t" = prod ] && need_prod
    todo=$(pending "$t")
    if [ "$cmd" = status ]; then
      for f in "$MIGRATIONS"/*.sql; do [ -e "$f" ] || continue; grep -qxF "$f" <<<"$todo" && s=PENDING || s=applied; echo "$s  $(basename "$f")"; done
      exit 0
    fi
    [ -n "$todo" ] || { echo "No pending migrations on $t."; exit 0; }
    echo "Pending on $t:"; sed 's#.*/#  #' <<<"$todo"
    [ "$t" = prod ] && backup
    ensure_table "$t"
    while read -r f; do
      echo "Applying $(basename "$f")…"
      target_sql "$t" < "$f"
      target_sql "$t" -e "INSERT INTO deploy_migrations (name) VALUES ('$(basename "$f")')"
    done <<<"$todo"
    echo "Done."
    ;;
  backup)
    need_prod; backup ;;
  dump-local)
    mkdir -p "$BACKUP_DIR"; f=$BACKUP_DIR/local-$STAMP.sql
    (umask 077; local_dump > "$f"); echo "Local dump: $f" ;;
  replace)
    dump=${1:?path to a full dump}; [ -f "$dump" ] || { echo "no such file: $dump" >&2; exit 1; }
    need_prod
    echo "This DROPS every table in $HOSTINGER_DB_NAME on $HOSTINGER_DB_HOST and loads $dump."
    echo "All production users, progress and content not in the dump are lost."
    read -rp "Type REPLACE to continue: " ok; [ "$ok" = REPLACE ] || { echo "Cancelled."; exit 1; }
    backup
    tables=$(prod_sql -N -e "SELECT GROUP_CONCAT(CONCAT('\`',table_name,'\`')) FROM information_schema.tables WHERE table_schema=DATABASE()")
    if [ -n "$tables" ] && [ "$tables" != NULL ]; then prod_sql -e "SET FOREIGN_KEY_CHECKS=0; DROP TABLE $tables; SET FOREIGN_KEY_CHECKS=1;"; fi
    prod_sql < "$dump"
    prod_sql -e "SELECT (SELECT COUNT(*) FROM subjects) subjects, (SELECT COUNT(*) FROM content_nodes) nodes, (SELECT COUNT(*) FROM tasks) tasks, (SELECT COUNT(*) FROM users) users"
    echo "Replaced. If ATTACHMENT_SECRET differs between local and Hostinger, images in content need re-signing (DEPLOYMENT.md)."
    ;;
  *) sed -n '2,13p' "$0"; exit 2 ;;
esac
