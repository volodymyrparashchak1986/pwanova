#!/usr/bin/env bash
# Applies the migrations of this repository that the target database does not have yet: one
# transaction per file, each recorded in supabase_migrations.schema_migrations. That is what
# `supabase db push` does, with one difference: versions in the history that have no file in this
# repository are left alone.
#
# Why this exists. The Supabase project is shared with another application, and both applications
# record their migrations in the same history table. `supabase db push` and `supabase migration up`
# refuse to run while the history holds a version without a local file. The two ways out that the
# CLI offers are to mark the foreign version as reverted, or to add a placeholder file for it. The
# first falsifies the history of the other application, the second puts a file into this repository
# that says nothing about what ran. This script needs neither.
#
# Usage
#   scripts/apply-migrations.sh --local [--dry-run]
#   PGHOST=… PGPORT=… PGUSER=… PGPASSWORD=… PGDATABASE=postgres \
#     ALLOW_PRODUCTION_TARGET=<project_ref> scripts/apply-migrations.sh [--dry-run]
#
# A target that is not the local stack is refused unless ALLOW_PRODUCTION_TARGET names the project
# that PGHOST or PGUSER belongs to. That variable is set for one approved run, never exported.
# The password is read from the environment and is never printed or passed as an argument.
#
# Requires Docker and the running local stack (`supabase start`): psql is taken from its database
# container, so nothing has to be installed.

set -euo pipefail

cd "$(dirname "$0")/.."
MIGRATIONS_DIR="supabase/migrations"
PROJECT_ID="$(sed -n 's/^project_id *= *"\(.*\)"/\1/p' supabase/config.toml | head -1)"
CONTAINER="supabase_db_${PROJECT_ID}"

LOCAL=0; DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --local) LOCAL=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '2,27p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

docker inspect "$CONTAINER" >/dev/null 2>&1 || { echo "The local stack is not running (container $CONTAINER). Run: supabase start" >&2; exit 2; }

if [ "$LOCAL" -eq 1 ]; then
  TARGET="the local database"
  run_psql() { docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q "$@"; }
else
  : "${PGHOST:?Set PGHOST, PGPORT, PGUSER, PGPASSWORD and PGDATABASE, or use --local}"
  : "${PGUSER:?PGUSER is missing}"
  : "${PGPASSWORD:?PGPASSWORD is missing}"
  export PGPORT="${PGPORT:-5432}" PGDATABASE="${PGDATABASE:-postgres}" PGSSLMODE="${PGSSLMODE:-require}"
  case "$PGHOST" in
    localhost|127.0.0.1|::1|host.docker.internal) echo "For the local stack use --local." >&2; exit 2 ;;
  esac
  REF="${ALLOW_PRODUCTION_TARGET:-}"
  if [ -z "$REF" ] || { [[ "$PGHOST" != *"$REF"* ]] && [[ "$PGUSER" != *"$REF"* ]]; }; then
    echo "Refusing to write to $PGHOST." >&2
    echo "For one approved run, set ALLOW_PRODUCTION_TARGET to the ref of the project this host or user belongs to." >&2
    exit 3
  fi
  TARGET="CLOUD project $REF ($PGHOST)"
  # the connection is described by variables in the environment of psql, never by arguments
  run_psql() { docker exec -i -e PGHOST -e PGPORT -e PGUSER -e PGPASSWORD -e PGDATABASE -e PGSSLMODE "$CONTAINER" psql -v ON_ERROR_STOP=1 -X -q "$@"; }
fi

local_files=()
while IFS= read -r f; do local_files+=("$f"); done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_*.sql' | LC_ALL=C sort)
[ "${#local_files[@]}" -gt 0 ] || { echo "No migration files in $MIGRATIONS_DIR." >&2; exit 2; }

applied="$(run_psql -At -c "select version from supabase_migrations.schema_migrations order by version")" \
  || { echo "Could not read the migration history of $TARGET." >&2; exit 1; }
[ -n "$applied" ] || { echo "The migration history of $TARGET is empty. This script continues an existing history; it does not start one." >&2; exit 1; }

is_applied() { printf '%s\n' "$applied" | grep -qx "$1"; }
version_of() { basename "$1" | cut -c1-14; }
name_of() { basename "$1" .sql | cut -c16-; }

known=""; pending=(); newest_own=""
for f in "${local_files[@]}"; do
  v="$(version_of "$f")"; known="$known$v"$'\n'
  if is_applied "$v"; then newest_own="$v"; else pending+=("$f"); fi
done
foreign="$(printf '%s\n' "$applied" | grep -vxF -f <(printf '%s' "$known") || true)"

echo "Target: $TARGET"
echo "Applied versions of this repository: $(printf '%s\n' "$applied" | grep -cxF -f <(printf '%s' "$known") || true)"
if [ -n "$foreign" ]; then
  echo "Versions in the history that are not from this repository (left alone):"
  printf '  %s\n' $foreign
fi

if [ "${#pending[@]}" -eq 0 ]; then echo "Nothing to apply."; exit 0; fi

echo "To apply, in this order:"
for f in "${pending[@]}"; do
  v="$(version_of "$f")"
  echo "  $v  $(name_of "$f")"
  if [ -n "$newest_own" ] && [[ "$v" < "$newest_own" ]]; then
    echo "Version $v is older than $newest_own, which is applied already. Migrations are applied in order; resolve this by hand." >&2
    exit 1
  fi
done

if [ "$DRY_RUN" -eq 1 ]; then echo "Dry run: nothing was applied."; exit 0; fi

for f in "${pending[@]}"; do
  v="$(version_of "$f")"; n="$(name_of "$f")"
  tag="pwn_$(printf '%s' "$v" | tr -cd '0-9')_body"
  if grep -qF -- "\$$tag\$" "$f"; then echo "The file $f contains the marker \$$tag\$; choose another marker." >&2; exit 1; fi
  echo "Applying $v $n ..."
  {
    printf 'begin;\n'
    cat "$f"
    printf '\ninsert into supabase_migrations.schema_migrations (version, name, statements) values (%s, %s, array[$%s$' "'$v'" "'$n'" "$tag"
    cat "$f"
    printf '$%s$]);\ncommit;\n' "$tag"
  } | run_psql -f - >/dev/null \
    || { echo "Migration $v failed and was rolled back. Earlier migrations of this run stay applied." >&2; exit 1; }
done

echo "Applied ${#pending[@]} migration(s). History now:"
run_psql -At -c "select version || '  ' || coalesce(name, '') from supabase_migrations.schema_migrations order by version" | sed 's/^/  /'
