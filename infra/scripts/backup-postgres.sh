#!/usr/bin/env bash
# Local/dev Postgres logical backup. Requires DB_ADMIN_URL or PG* env vars.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${BACKUP_DIR:-$ROOT/tmp/backups}"
mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/aijh-$STAMP.dump"

if [[ -z "${DB_ADMIN_URL:-}" ]]; then
  echo "DB_ADMIN_URL is required (owner connection string)." >&2
  exit 1
fi

echo "Writing backup to $OUT_FILE"
pg_dump --format=custom --file="$OUT_FILE" "$DB_ADMIN_URL"
echo "Backup complete: $OUT_FILE"
echo "Restore with: infra/scripts/restore-postgres.sh $OUT_FILE"
