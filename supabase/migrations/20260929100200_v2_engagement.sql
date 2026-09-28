-- PWANova V2 — follows, updates, notifications, comparisons, alternatives. Additive only.

-- ---------------------------------------------------------------- follows
create table public.follows (
  user_id uuid not null references public.profiles (id) on delete cascade,
  app_id uuid not null references public.apps (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, app_id)
);
create index follows_app_idx on public.follows (app_id, created_at desc);

create table public.category_follows (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, category_id)
);

-- ---------------------------------------------------------------- maker updates (changelog)
create table public.app_updates (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'feature' check (kind in ('feature', 'pricing', 'integration', 'launch', 'major', 'fix', 'other')),
  title text not null check (char_length(title) between 3 and 140),
  body text check (char_length(body) <= 5000),
  version text check (char_length(version) <= 40),
  link_url text check (char_length(link_url) <= 500),
  status text not null default 'published' check (status in ('draft', 'published', 'hidden')),
  moderation_note text check (char_length(moderation_note) <= 500),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index app_updates_app_idx on public.app_updates (app_id, published_at desc);
create trigger app_updates_updated_at before update on public.app_updates
  for each row execute function public.set_updated_at();

create or replace function public.protect_app_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.is_service_role() or public.is_moderator() then
    if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
    new.moderation_note := null;
    if new.status = 'hidden' then new.status := 'draft'; end if;
  else
    new.app_id := old.app_id; new.author_id := old.author_id; new.moderation_note := old.moderation_note;
    -- a maker cannot bring back what a moderator hid
    if old.status = 'hidden' or new.status = 'hidden' then new.status := old.status; end if;
  end if;
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
create trigger app_updates_protect before insert or update on public.app_updates
  for each row execute function public.protect_app_update();
create trigger app_updates_z_limit before insert on public.app_updates
  for each row execute function public.enforce_hourly_limit('10', '1 day', 'author_id');

-- ---------------------------------------------------------------- notifications (in-app only)
-- Text is rendered from `kind` + `metadata` in the reader's language; `title` carries maker-written text.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('app_update', 'launch', 'claim', 'evidence', 'request_match', 'request_response', 'contact_shared', 'moderation', 'system')),
  title text check (char_length(title) <= 200),
  link text check (char_length(link) <= 300 and link ~ '^/'),
  app_id uuid references public.apps (id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);

create or replace function public.protect_notification() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.is_service_role() then return new; end if;
  -- the reader can only mark it read or unread
  new.user_id := old.user_id; new.kind := old.kind; new.title := old.title; new.link := old.link;
  new.app_id := old.app_id; new.metadata := old.metadata; new.created_at := old.created_at;
  return new;
end $$;
create trigger notifications_protect before update on public.notifications
  for each row execute function public.protect_notification();

create or replace function public.notify_followers() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.apps;
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then return null; end if;
  select * into a from public.apps where id = new.app_id;
  if a.status <> 'published' then return null; end if;
  insert into public.notifications (user_id, kind, title, link, app_id, metadata)
  select f.user_id, 'app_update', new.title, '/apps/' || a.slug || '#updates', a.id,
         jsonb_build_object('app_name', a.name, 'update_kind', new.kind, 'update_id', new.id)
  from public.follows f where f.app_id = new.app_id and f.user_id is distinct from new.author_id
  limit 5000;
  return null;
end $$;
create trigger app_updates_notify after insert or update of status on public.app_updates
  for each row execute function public.notify_followers();

-- ---------------------------------------------------------------- saved comparisons
-- A public comparison page needs no row: it is derived from the app slugs in the URL.
create table public.comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text check (char_length(title) <= 120),
  slug_key text not null check (slug_key ~ '^[a-z0-9-]+(-vs-[a-z0-9-]+){0,3}$' and char_length(slug_key) <= 340),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug_key)
);
create trigger comparisons_updated_at before update on public.comparisons
  for each row execute function public.set_updated_at();
create table public.comparison_apps (
  comparison_id uuid not null references public.comparisons (id) on delete cascade,
  app_id uuid not null references public.apps (id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  primary key (comparison_id, app_id),
  unique (comparison_id, position)
);

create or replace function public.owns_comparison(p_comparison_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.comparisons where id = p_comparison_id and user_id = auth.uid());
$$;

-- ---------------------------------------------------------------- alternatives
-- "Alternative to X" is a relationship, never a judgement: nothing here says one product is better.
create table public.app_alternatives (
  app_id uuid not null references public.apps (id) on delete cascade,
  alternative_to_slug text not null check (alternative_to_slug ~ '^[a-z0-9-]{2,80}$'),
  alternative_to_name text not null check (char_length(alternative_to_name) between 1 and 80),
  alternative_to_app_id uuid references public.apps (id) on delete set null,
  source_type text not null default 'vendor_stated' check (source_type in ('pwanova_observed', 'admin_reviewed', 'vendor_stated', 'user_submitted')),
  source_url text check (char_length(source_url) <= 500),
  verified_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (app_id, alternative_to_slug),
  check (alternative_to_app_id is distinct from app_id)
);
create index app_alternatives_target_idx on public.app_alternatives (alternative_to_slug);
create trigger app_alternatives_source before insert or update on public.app_alternatives
  for each row execute function public.stamp_fact_source();

-- ---------------------------------------------------------------- first-party aggregate events
alter table public.app_events drop constraint if exists app_events_event_type_check;
alter table public.app_events add constraint app_events_event_type_check check (event_type in (
  'view', 'open_app', 'install_click', 'install_instruction_view', 'favorite', 'share', 'review', 'rating',
  'compare_added', 'follow', 'launch_view'));

-- ---------------------------------------------------------------- reviews: explicit moderation state
alter table public.reviews add column status text not null default 'published'
  check (status in ('pending', 'published', 'hidden', 'rejected'));
update public.reviews set status = 'hidden' where hidden_at is not null;

-- status and hidden_at always agree; v1 code keeps working with hidden_at alone
create or replace function public.sync_review_status() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.hidden_at := case when new.status = 'published' then null else coalesce(new.hidden_at, now()) end;
  elsif new.hidden_at is not null and new.status = 'published' then
    new.status := 'hidden';
  elsif new.hidden_at is null and new.status <> 'published' then
    if tg_op = 'INSERT' then new.hidden_at := now(); else new.status := 'published'; end if;
  end if;
  return new;
end $$;

create or replace function public.protect_review_moderation() returns trigger language plpgsql set search_path = public as $$
begin
 if not public.is_admin() and not public.is_moderator() and not public.is_service_role() then
  if tg_op='INSERT' then new.hidden_at:=null; new.moderation_reason:=null; new.status:='published';
  else new.hidden_at:=old.hidden_at; new.moderation_reason:=old.moderation_reason; new.status:=old.status; end if;
 end if;
 return new;
end $$;
-- runs after reviews_moderation_protect (alphabetical order), so it sees the protected values
create trigger reviews_status_sync before insert or update on public.reviews
  for each row execute function public.sync_review_status();

drop policy reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (
  (public.app_is_public(app_id) and hidden_at is null and status = 'published') or user_id = auth.uid() or public.is_moderator());
create policy reviews_moderator_update on public.reviews for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

-- ---------------------------------------------------------------- claims: rejected / revoked
alter table public.app_claims drop constraint if exists app_claims_status_check;
alter table public.app_claims add constraint app_claims_status_check
  check (status in ('pending', 'verified', 'failed', 'expired', 'rejected', 'revoked'));

-- ---------------------------------------------------------------- RLS
alter table public.follows enable row level security;
alter table public.category_follows enable row level security;
alter table public.app_updates enable row level security;
alter table public.notifications enable row level security;
alter table public.comparisons enable row level security;
alter table public.comparison_apps enable row level security;
alter table public.app_alternatives enable row level security;

create policy follows_read_own on public.follows for select to authenticated using (user_id = auth.uid());
create policy follows_insert_own on public.follows for insert to authenticated with check (user_id = auth.uid() and public.app_is_public(app_id));
create policy follows_delete_own on public.follows for delete to authenticated using (user_id = auth.uid());
create policy category_follows_read_own on public.category_follows for select to authenticated using (user_id = auth.uid());
create policy category_follows_insert_own on public.category_follows for insert to authenticated with check (user_id = auth.uid());
create policy category_follows_delete_own on public.category_follows for delete to authenticated using (user_id = auth.uid());
create trigger follows_z_limit before insert on public.follows
  for each row execute function public.enforce_hourly_limit('120', '1 hour', 'user_id');

create policy app_updates_read on public.app_updates for select using (
  (status = 'published' and public.app_is_public(app_id)) or public.manages_app(app_id) or public.is_moderator());
create policy app_updates_insert on public.app_updates for insert to authenticated with check (public.owns_app(app_id) or public.is_moderator());
create policy app_updates_update on public.app_updates for update to authenticated
  using (public.owns_app(app_id) or public.is_moderator()) with check (public.owns_app(app_id) or public.is_moderator());
create policy app_updates_delete on public.app_updates for delete to authenticated using (public.owns_app(app_id) or public.is_moderator());

create policy notifications_read_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete_own on public.notifications for delete to authenticated using (user_id = auth.uid());
revoke insert on public.notifications from anon, authenticated;   -- written by triggers and the service role only

create policy comparisons_own on public.comparisons for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy comparison_apps_own on public.comparison_apps for all to authenticated
  using (public.owns_comparison(comparison_id)) with check (public.owns_comparison(comparison_id) and public.app_is_public(app_id));
create trigger comparisons_z_limit before insert on public.comparisons
  for each row execute function public.enforce_hourly_limit('60', '1 hour', 'user_id');

create policy app_alternatives_read on public.app_alternatives for select using (
  (public.app_is_public(app_id) and source_type <> 'user_submitted') or public.manages_app(app_id) or public.is_moderator());
create policy app_alternatives_insert on public.app_alternatives for insert to authenticated with check (public.manages_app(app_id) or public.is_moderator());
create policy app_alternatives_update on public.app_alternatives for update to authenticated
  using (public.is_moderator() or (public.manages_app(app_id) and source_type in ('vendor_stated', 'user_submitted')))
  with check (public.manages_app(app_id) or public.is_moderator());
create policy app_alternatives_delete on public.app_alternatives for delete to authenticated
  using (public.is_moderator() or (public.manages_app(app_id) and source_type in ('vendor_stated', 'user_submitted')));
