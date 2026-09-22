-- Beta hardening. Additive migration: no existing migration files are modified, no data is deleted.
-- Fixes two real bugs found in a security/data-integrity audit (see docs/beta-audit.md, rows P0-1 and P0-2):
--   1. protect_app() allowed an app's own (non-admin) owner to flip status from 'pending'/'suspended'
--      straight to 'published' on UPDATE, i.e. self-approve a submission that was awaiting moderation.
--   2. verifyClaim had no atomicity: two concurrent successful verifications of the same app could both
--      write developer_id/ownership_status, and a second verification could silently steal a listing
--      that already had a verified owner. Fixed with a single conditional UPDATE (public.claim_app_ownership),
--      which Postgres serializes at the row level, so only the first caller can ever win.
-- Also adds: claim token expiry, a locked moderation_note field, an admin audit log, a 'rejected' app
-- status, a DB-level ban on self ratings/reviews (defence in depth; the server actions already block this),
-- automatic re-verification requirements on domain/URL changes, and a raw-event retention helper.

-- ---------------------------------------------------------------- apps: moderation_note + rejected status
alter table public.apps add column moderation_note text check (char_length(moderation_note) <= 500);

-- The original inline `check (status in (...))` on the `status` column was never given an explicit
-- name, so Postgres auto-named it `apps_status_check` (its standard `<table>_<column>_check`
-- convention for a single column-level check). Reusing that exact name below both replaces it and
-- documents that this is the same logical constraint, widened by one value.
alter table public.apps drop constraint if exists apps_status_check;
alter table public.apps add constraint apps_status_check
  check (status in ('pending', 'published', 'hidden', 'suspended', 'rejected'));

-- ---------------------------------------------------------------- app_claims: expiry
alter table public.app_claims add column expires_at timestamptz not null default now() + interval '3 days';
comment on column public.app_claims.expires_at is
  'A claim token proves control of the domain only while fresh. verifyOwnership() in the app refuses expired tokens; restarting the claim issues a new one.';

-- ---------------------------------------------------------------- protect_app: fix self-approve, lock url + moderation_note, force safe rejected defaults
create or replace function public.protect_app() returns trigger
language plpgsql as $$
begin
  if public.is_admin() or public.is_service_role() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.ownership_status := 'claim_pending';
    new.verification_status := 'unverified';
    new.is_featured := false;
    new.featured_at := null;
    new.is_demo := false;
    new.is_pwa := false;          -- set by server-side analysis only
    new.is_installable := false;
    new.health_status := 'unknown';
    new.moderation_note := null;
    if new.status not in ('pending', 'published') then new.status := 'published'; end if;
  else
    new.developer_id := old.developer_id;
    new.domain := old.domain;     -- URL/domain changes go through admin/service so re-verification can be enforced (see apps_reverify_domain below)
    new.url := old.url;
    new.ownership_status := old.ownership_status;
    new.verification_status := old.verification_status;
    new.is_featured := old.is_featured;
    new.featured_at := old.featured_at;
    new.is_demo := old.is_demo;
    new.is_pwa := old.is_pwa;
    new.is_installable := old.is_installable;
    new.health_status := old.health_status;
    new.health_checked_at := old.health_checked_at;
    new.moderation_note := old.moderation_note;
    -- Fix: an owner may only ever toggle between published and hidden, and only starting from one of
    -- those two states. A pending, rejected or suspended app can never be self-published.
    if old.status in ('published', 'hidden') and new.status in ('published', 'hidden') then
      -- allowed
    else
      new.status := old.status;
    end if;
  end if;
  return new;
end $$;

-- Re-verification is required whenever an app's domain or URL actually changes (currently only
-- reachable by an admin or the service role, since protect_app locks both columns for owners; this
-- also covers any future owner-facing "change URL" feature, which should update through here).
create or replace function public.reverify_on_domain_change() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and (new.domain is distinct from old.domain or new.url is distinct from old.url) then
    if new.ownership_status = 'verified_owner' then new.ownership_status := 'claim_pending'; end if;
    new.verification_status := 'unverified';
  end if;
  return new;
end $$;
create trigger apps_reverify_domain before update on public.apps
  for each row execute function public.reverify_on_domain_change();

-- ---------------------------------------------------------------- self rating/review ban (defence in depth)
-- The server actions already reject this; this trigger makes it true even for direct API/SQL access,
-- which is what a security review must assume a hostile client can attempt.
create or replace function public.block_self_rating() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from public.apps where id = new.app_id and developer_id = new.user_id) then
    raise exception 'Developers cannot rate or review their own app' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger ratings_no_self before insert or update on public.ratings
  for each row execute function public.block_self_rating();
create trigger reviews_no_self before insert on public.reviews
  for each row execute function public.block_self_rating();

-- ---------------------------------------------------------------- atomic ownership assignment
-- Single conditional UPDATE: Postgres locks the row for its duration, so under concurrent calls only
-- the first one can match `ownership_status <> 'verified_owner'` and win. This also means a normal
-- Claim App verification can never silently replace an existing verified owner.
create or replace function public.claim_app_ownership(p_app_id uuid, p_user_id uuid, p_claim_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  won boolean := false;
begin
  update public.apps set developer_id = p_user_id, ownership_status = 'verified_owner'
    where id = p_app_id and ownership_status <> 'verified_owner';
  if found then
    won := true;
    update public.app_claims set status = 'verified', verified_at = now(), last_error = null where id = p_claim_id;
    update public.app_claims set status = 'expired' where app_id = p_app_id and id <> p_claim_id and status <> 'verified';
  end if;
  return won;
end $$;
revoke all on function public.claim_app_ownership(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_app_ownership(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------- admin audit log
create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null check (target_type in ('app', 'review', 'report', 'profile')),
  target_id uuid,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);
create index admin_actions_created_idx on public.admin_actions (created_at desc);
alter table public.admin_actions enable row level security;
-- Read/insert only; no update or delete policy exists, so the log is append-only even for admins via the API.
create policy admin_actions_admin_read on public.admin_actions for select using (public.is_admin());
create policy admin_actions_admin_insert on public.admin_actions for insert to authenticated
  with check (admin_id = auth.uid() and public.is_admin());

-- ---------------------------------------------------------------- claims: allow claiming/verifying your own app at any status
-- Was: only apps already public could receive a claim insert. That silently blocked the "verify
-- ownership while awaiting moderation" flow whenever SUBMIT_REQUIRES_APPROVAL=true, because a
-- freshly submitted app starts as `pending`, not `published`. A claim on your OWN app (any status)
-- is always allowed; claiming an app you don't yet own still requires it to be publicly listed
-- (the "is this your app?" discovery flow).
drop policy if exists claims_insert_own on public.app_claims;
create policy claims_insert_own on public.app_claims for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      exists (select 1 from public.apps a where a.id = app_id and a.developer_id = auth.uid())
      or public.app_is_public(app_id)
    )
  );

-- ---------------------------------------------------------------- raw event retention
-- Not scheduled automatically (no pg_cron dependency added). Call periodically from a trusted
-- server context (service role) -- e.g. the existing /api/cron/health route now also calls this.
create or replace function public.purge_old_events(p_days int default 180) returns bigint
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  delete from public.app_events where created_at < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_old_events(int) from public, anon, authenticated;
grant execute on function public.purge_old_events(int) to service_role;
