#!/usr/bin/env bash
set -euo pipefail

container="${CASPA_POSTGRES_CONTAINER:-mn-postgres}"
root="${CASPA_BACKUP_ROOT:-/var/backups/caspa}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="$root/$stamp"
mkdir -p "$destination"

db_user="$(docker exec "$container" sh -lc 'printf %s "$POSTGRES_USER"')"
docker exec "$container" pg_dump -U "$db_user" -Fc caspa > "$destination/caspa.dump"
tar -C /root/Caspa -czf "$destination/artefacts.tgz" data
sha256sum "$destination/caspa.dump" "$destination/artefacts.tgz" > "$destination/SHA256SUMS"

verify_db="caspa_restore_verify"
docker exec "$container" dropdb -U "$db_user" --if-exists "$verify_db"
docker exec "$container" createdb -U "$db_user" "$verify_db"
docker exec -i "$container" pg_restore -U "$db_user" -d "$verify_db" --no-owner --no-privileges < "$destination/caspa.dump"
docker exec "$container" psql -U "$db_user" -d "$verify_db" -v ON_ERROR_STOP=1 -tAc \
  "SELECT count(*) FROM caspa_projects; SELECT count(*) FROM caspa_project_revisions;" > "$destination/restore-counts.txt"
docker exec "$container" dropdb -U "$db_user" "$verify_db"
date -u +%FT%TZ > "$destination/RESTORE_VERIFIED"

echo "Caspa backup and restore verification completed: $destination"
