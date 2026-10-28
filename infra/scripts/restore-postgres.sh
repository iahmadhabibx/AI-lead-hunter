#!/usr/bin/env bash
# Restore a pg_dump custom-format backup. DESTRUCTIVE to the target database.
set -euo pipefail

DUMP_FILE="${1:-}"
if [[ -z "$DUMP_FILE" || ! -f "$DUMP_FILE" ]]; then
  echo "Usage: $0 <path-to-dump>" >&2
  exit 1
fi
if [[ -z "${DB_ADMIN_URL:-}" ]]; then
  echo "DB_ADMIN_URL is required (owner connection string)." >&2
  exit 1
fi
if [[ "${CONFIRM_RESTORE:-}" != "YES" ]]; then
  echo "Refusing to restore without CONFIRM_RESTORE=YES" >&2
  exit 1
fi

echo "Restoring $DUMP_FILE into DB_ADMIN_URL (destructive)"
pg_restore --clean --if-exists --no-owner --dbname="$DB_ADMIN_URL" "$DUMP_FILE"
echo "Restore complete. Re-run app migrations only if the dump predates schema changes."
