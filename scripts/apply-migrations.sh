#!/usr/bin/env bash
# Applies the migrations of this repository that the target database does not have yet, and records
# each in supabase_migrations.schema_migrations. That is what `supabase db push` does, with one
# difference: versions in the history that have no file in this repository are left alone.
#
# Why this exists. The Supabase project is shared with another application, and both applications
# record their migrations in the same history table. `supabase db push` and `supabase migration up`
# refuse to run while the history holds a version without a local file. The two ways out that the
# CLI offers are to mark the foreign version as reverted, or to add a placeholder file for it. The
# first falsifies the history of the other application, the second puts a file into this repository
# that says nothing about what ran. This script needs neither.
#
# How a migration is applied. Each file is sent as ONE statement: a block that checks the history
# (not recorded yet, and the previous migration of this repository is recorded), runs the file and
# writes its history row. One statement is one transaction, so a migration is applied completely
# and recorded, or not at all, whichever client sends it.
#
# Usage
#   scripts/apply-migrations.sh --local [--via-cli] [--dry-run]
#       the local stack; --via-cli sends the statements with `supabase db query` instead of psql
#   scripts/apply-migrations.sh --emit <directory> [--from <version>]
#       writes one SQL file per migration and connects to nothing; each file is then sent with
#       `supabase db query --project-ref <ref> -f <file>`, one approved command per migration
#   PGHOST=… PGPORT=… PGUSER=… PGPASSWORD=… PGDATABASE=postgres \
#     ALLOW_PRODUCTION_TARGET=<project_ref> scripts/apply-migrations.sh [--dry-run]
#       a cloud database with its credentials (use the session pooler: IPv4, keeps a session)
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

LOCAL=0; DRY_RUN=0; VIA_CLI=0; EMIT_DIR=""; FROM=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --local) LOCAL=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --via-cli) VIA_CLI=1 ;;
    --emit) EMIT_DIR="${2:?--emit needs a directory}"; shift ;;
    --from) FROM="${2:?--from needs a version}"; shift ;;
    -h|--help) sed -n '2,37p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

local_files=()
while IFS= read -r f; do local_files+=("$f"); done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_*.sql' | LC_ALL=C sort)
[ "${#local_files[@]}" -gt 0 ] || { echo "No migration files in $MIGRATIONS_DIR." >&2; exit 2; }

version_of() { basename "$1" | cut -c1-14; }
name_of() { basename "$1" .sql | cut -c16-; }

# The migration of this repository that comes before the given file; empty for the first one.
previous_of() {
  local prev="" f
  for f in "${local_files[@]}"; do
    [ "$f" = "$1" ] && { printf '%s' "$prev"; return; }
    prev="$(version_of "$f")"
  done
}

# One statement that applies one migration and records it, or changes nothing.
statement_for() {
  local f="$1" v n prev body apply
  v="$(version_of "$f")"; n="$(name_of "$f")"; prev="$(previous_of "$f")"
  body="pwn_body_$v"; apply="pwn_apply_$v"
  if grep -qF -e "\$$body\$" -e "\$$apply\$" "$f"; then echo "The file $f contains a marker this script uses (\$$body\$ or \$$apply\$)." >&2; return 1; fi
  printf 'do $%s$\ndeclare\n  body text := $%s$\n' "$apply" "$body"
  cat "$f"
  printf '\n$%s$;\nbegin\n' "$body"
  printf "  if exists (select 1 from supabase_migrations.schema_migrations where version = '%s') then\n" "$v"
  printf "    raise exception 'Migration %s is recorded already. Nothing was changed.';\n  end if;\n" "$v"
  if [ -n "$prev" ]; then
    printf "  if not exists (select 1 from supabase_migrations.schema_migrations where version = '%s') then\n" "$prev"
    printf "    raise exception 'Migration %s has to be applied before %s. Nothing was changed.';\n  end if;\n" "$prev" "$v"
  fi
  printf '  execute body;\n'
  printf "  insert into supabase_migrations.schema_migrations (version, name, statements) values ('%s', '%s', array[body]);\n" "$v" "$n"
  printf 'end\n$%s$;\n' "$apply"
}

# ------------------------------------------------------------------ write the statements, connect to nothing
if [ -n "$EMIT_DIR" ]; then
  mkdir -p "$EMIT_DIR"
  count=0
  for f in "${local_files[@]}"; do
    v="$(version_of "$f")"
    if [ -n "$FROM" ] && [[ "$v" < "$FROM" ]]; then continue; fi
    out="$EMIT_DIR/$(basename "$f")"
    statement_for "$f" > "$out"
    echo "$out"
    count=$(( count + 1 ))
  done
  echo "Wrote $count file(s). Nothing was applied." >&2
  exit 0
fi

# ------------------------------------------------------------------ choose the target and the client
if [ "$LOCAL" -eq 1 ]; then
  TARGET="the local database"
  if [ "$VIA_CLI" -eq 1 ]; then
    CLIENT="supabase db query"
    history() { supabase db query --local --output-format json "select version from supabase_migrations.schema_migrations order by version" 2>/dev/null | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>{const j=JSON.parse(s.slice(s.indexOf("{")));console.log(j.rows.map((r)=>r.version).join("\n"))})'; }
    send() { supabase db query --local -f "$1" >/dev/null; }
  else
    docker inspect "$CONTAINER" >/dev/null 2>&1 || { echo "The local stack is not running (container $CONTAINER). Run: supabase start" >&2; exit 2; }
    CLIENT="psql"
    history() { docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q -At -c "select version from supabase_migrations.schema_migrations order by version"; }
    send() { docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q -f - < "$1" >/dev/null; }
  fi
else
  [ "$VIA_CLI" -eq 0 ] || { echo "For a cloud project use --emit and send each file with an approved 'supabase db query' command." >&2; exit 2; }
  : "${PGHOST:?Set PGHOST, PGPORT, PGUSER, PGPASSWORD and PGDATABASE, or use --local or --emit}"
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
  docker inspect "$CONTAINER" >/dev/null 2>&1 || { echo "The local stack is not running (container $CONTAINER); its psql is used. Run: supabase start" >&2; exit 2; }
  TARGET="CLOUD project $REF ($PGHOST)"
  CLIENT="psql"
  # the connection is described by variables in the environment of psql, never by arguments
  pg() { docker exec -i -e PGHOST -e PGPORT -e PGUSER -e PGPASSWORD -e PGDATABASE -e PGSSLMODE "$CONTAINER" psql -v ON_ERROR_STOP=1 -X -q "$@"; }
  history() { pg -At -c "select version from supabase_migrations.schema_migrations order by version"; }
  send() { pg -f - < "$1" >/dev/null; }
fi

applied="$(history)" || { echo "Could not read the migration history of $TARGET." >&2; exit 1; }
[ -n "$applied" ] || { echo "The migration history of $TARGET is empty. This script continues an existing history; it does not start one." >&2; exit 1; }
is_applied() { printf '%s\n' "$applied" | grep -qxF "$1"; }

known=""; pending=(); newest_own=""
for f in "${local_files[@]}"; do
  v="$(version_of "$f")"; known="$known$v"$'\n'
  if is_applied "$v"; then newest_own="$v"; else pending+=("$f"); fi
done
foreign="$(printf '%s\n' "$applied" | grep -vxF -f <(printf '%s' "$known") || true)"

echo "Target: $TARGET (client: $CLIENT)"
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

work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
for f in "${pending[@]}"; do
  v="$(version_of "$f")"
  echo "Applying $v $(name_of "$f") ..."
  statement_for "$f" > "$work/statement.sql"
  send "$work/statement.sql" || { echo "Migration $v failed and changed nothing. Earlier migrations of this run stay applied." >&2; exit 1; }
done

echo "Applied ${#pending[@]} migration(s). History now:"
history | sed 's/^/  /'
