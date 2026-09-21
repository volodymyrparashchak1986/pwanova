-- PWANova core schema.
-- Run order: 20260101000000_schema.sql -> ..._rls.sql -> ..._views.sql -> ..._storage.sql
-- Booleans in app_checks are nullable on purpose: NULL means "not checked / unknown".
-- No extensions are required (gen_random_uuid() is built into Postgres 13+).

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_-]{3,32}$'),
  display_name text check (char_length(display_name) <= 80),
  avatar_url text,
  bio text check (char_length(bio) <= 500),
  website text check (char_length(website) <= 300),
  role text not null default 'user' check (role in ('user', 'developer', 'admin', 'partner')),
  is_verified boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- partners
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  website text,
  logo_url text,
  referral_code text not null unique,
  status text not null default 'active' check (status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- apps
create table public.apps (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  tagline text check (char_length(tagline) <= 120),
  description text check (char_length(description) <= 4000),
  url text not null check (url ~* '^https?://'),
  domain text not null unique,
  icon_url text,
  category text not null default 'other' check (category in (
    'ai','productivity','business','finance','fitness','health','education',
    'developer-tools','social','entertainment','utilities','lifestyle','travel','food','games','other')),
  status text not null default 'published' check (status in ('pending', 'published', 'hidden', 'suspended')),
  ownership_status text not null default 'unclaimed' check (ownership_status in ('unclaimed', 'claim_pending', 'verified_owner')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'failed')),
  is_pwa boolean not null default false,
  is_installable boolean not null default false,
  hosting_provider text not null default 'other' check (hosting_provider in (
    'vercel','cloudflare','netlify','firebase','railway','render','custom-domain','other')),
  build_tool text not null default 'other' check (build_tool in (
    'v0','claude-code','codex','cursor','lovable','bolt','replit','windsurf','manual','other')),
  health_status text not null default 'unknown' check (health_status in ('online', 'degraded', 'offline', 'unknown')),
  health_checked_at timestamptz,
  is_featured boolean not null default false,
  featured_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index apps_status_idx on public.apps (status);
create index apps_developer_idx on public.apps (developer_id);
create index apps_category_idx on public.apps (category);
create trigger apps_updated_at before update on public.apps
  for each row execute function public.set_updated_at();

create table public.app_screenshots (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0
);
create index app_screenshots_app_idx on public.app_screenshots (app_id, sort_order);

-- ---------------------------------------------------------------- ratings & reviews
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_id, user_id)
);
create index ratings_app_idx on public.ratings (app_id);
create trigger ratings_updated_at before update on public.ratings
  for each row execute function public.set_updated_at();

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text check (char_length(title) <= 100),
  body text not null check (char_length(body) between 1 and 3000),
  helpful_count int not null default 0,
  -- future trust signals; never set by clients (see protect trigger)
  verified_user boolean not null default false,
  verified_usage boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_id, user_id)
);
create index reviews_app_idx on public.reviews (app_id, created_at desc);
create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

create table public.review_helpful (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);

create table public.developer_responses (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews (id) on delete cascade,
  developer_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger developer_responses_updated_at before update on public.developer_responses
  for each row execute function public.set_updated_at();

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (app_id, user_id)
);
create index favorites_user_idx on public.favorites (user_id, created_at desc);

-- ---------------------------------------------------------------- partners / sources / referrals
create table public.app_sources (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  partner_id uuid references public.partners (id) on delete set null,
  source_name text not null,
  source_url text,
  -- 'launched_on' => "Launched on X", 'discovered_via' => "Discovered via X"
  source_type text not null default 'launched_on' check (source_type in ('launched_on', 'discovered_via')),
  created_at timestamptz not null default now()
);
create index app_sources_app_idx on public.app_sources (app_id, created_at);

create table public.partner_referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  developer_id uuid not null references public.profiles (id) on delete cascade,
  app_id uuid references public.apps (id) on delete set null,
  created_at timestamptz not null default now()
);
-- Future revenue share hook: PWANova Pro subscriptions can be attributed through this table.

-- ---------------------------------------------------------------- events
create table public.app_events (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  event_type text not null check (event_type in (
    'view','open_app','install_click','install_instruction_view','favorite','share','review','rating')),
  -- traffic source bucket: pwanova_search, homepage, product_hunt, partner, google, direct, social, other
  source text not null default 'direct',
  partner_id uuid references public.partners (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index app_events_app_time_idx on public.app_events (app_id, created_at desc);
create index app_events_type_time_idx on public.app_events (event_type, created_at desc);

-- ---------------------------------------------------------------- quality checks (latest per app)
create table public.app_checks (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null unique references public.apps (id) on delete cascade,
  reachable boolean,
  https_ok boolean,
  responsive boolean,
  mobile_optimized boolean,
  manifest_ok boolean,
  service_worker_ok boolean,
  installable boolean,
  offline_support boolean,
  push_support boolean,
  security_ok boolean,
  status_code int,
  response_ms int,
  details jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- ownership claims
create table public.app_claims (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null default replace(gen_random_uuid()::text, '-', ''),  -- 122 random bits, no extension needed
  method text check (method in ('meta_tag', 'well_known', 'dns_txt')),
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed', 'expired')),
  last_error text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  unique (app_id, user_id)
);

-- ---------------------------------------------------------------- moderation
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  app_id uuid references public.apps (id) on delete cascade,
  review_id uuid references public.reviews (id) on delete cascade,
  reason text not null check (reason in ('spam', 'malicious', 'impersonation', 'inappropriate', 'broken', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  check (app_id is not null or review_id is not null)
);
create index reports_status_idx on public.reports (status, created_at desc);

-- ---------------------------------------------------------------- rate limits (server only)
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- ================================================================ triggers
-- New auth user -> profile
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'user_name', new.raw_user_meta_data ->> 'preferred_username',
             split_part(coalesce(new.email, 'user'), '@', 1)), '[^a-zA-Z0-9_-]', '', 'g'));
  if char_length(base) < 3 then base := 'user' || base; end if;
  base := left(base, 24);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;
  insert into public.profiles (id, username, display_name, avatar_url)
  values (new.id, candidate,
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', base),
          new.raw_user_meta_data ->> 'avatar_url');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_service_role() returns boolean
language sql stable as $$
  select coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '') = 'service_role'
         or current_user in ('postgres', 'supabase_admin');
$$;

-- Users cannot promote themselves or grant themselves the verified badge.
create or replace function public.protect_profile() returns trigger
language plpgsql as $$
begin
  if not (public.is_admin() or public.is_service_role()) then
    new.role := old.role;
    new.is_verified := old.is_verified;
    new.is_demo := old.is_demo;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile();

-- Developers cannot edit moderation / trust columns on their own apps.
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
    if new.status not in ('pending', 'published') then new.status := 'published'; end if;
  else
    new.developer_id := old.developer_id;
    new.domain := old.domain;
    new.ownership_status := old.ownership_status;
    new.verification_status := old.verification_status;
    new.is_featured := old.is_featured;
    new.featured_at := old.featured_at;
    new.is_demo := old.is_demo;
    new.is_pwa := old.is_pwa;
    new.is_installable := old.is_installable;
    new.health_status := old.health_status;
    new.health_checked_at := old.health_checked_at;
    -- owners may hide/unhide but never un-suspend
    if old.status = 'suspended' or new.status not in ('published', 'hidden') then new.status := old.status; end if;
  end if;
  return new;
end $$;
create trigger apps_protect before insert or update on public.apps
  for each row execute function public.protect_app();

-- Reviews: trust flags and counters are server-controlled.
create or replace function public.protect_review() returns trigger
language plpgsql as $$
begin
  if public.is_admin() or public.is_service_role() then return new; end if;
  if tg_op = 'INSERT' then
    new.verified_user := false; new.verified_usage := false; new.helpful_count := 0; new.is_demo := false;
  else
    new.verified_user := old.verified_user; new.verified_usage := old.verified_usage;
    new.helpful_count := old.helpful_count; new.is_demo := old.is_demo;
    new.app_id := old.app_id; new.user_id := old.user_id;
  end if;
  return new;
end $$;
create trigger reviews_protect before insert or update on public.reviews
  for each row execute function public.protect_review();

-- Keep the single rating per (app, user) in sync with a written review.
create or replace function public.sync_review_rating() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.ratings (app_id, user_id, rating)
  values (new.app_id, new.user_id, new.rating)
  on conflict (app_id, user_id) do update set rating = excluded.rating, updated_at = now();
  return new;
end $$;
create trigger reviews_sync_rating after insert or update of rating on public.reviews
  for each row execute function public.sync_review_rating();

create or replace function public.bump_helpful() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.reviews set helpful_count = helpful_count + 1 where id = new.review_id;
  else
    update public.reviews set helpful_count = greatest(helpful_count - 1, 0) where id = old.review_id;
  end if;
  return null;
end $$;
create trigger review_helpful_count after insert or delete on public.review_helpful
  for each row execute function public.bump_helpful();

-- Reviewers cannot mark their own review helpful.
create or replace function public.block_self_helpful() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from public.reviews where id = new.review_id and user_id = new.user_id) then
    raise exception 'You cannot vote on your own review' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger review_helpful_no_self before insert on public.review_helpful
  for each row execute function public.block_self_helpful();

-- Database-level throttles (defence in depth; the app also rate limits).
create or replace function public.enforce_hourly_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  max_rows int := tg_argv[0]::int;
  window_txt text := tg_argv[1];
  col text := tg_argv[2];
  current_rows int;
begin
  execute format('select count(*) from public.%I where %I = $1 and created_at > now() - $2::interval', tg_table_name, col)
    into current_rows using (to_jsonb(new) ->> col)::uuid, window_txt;
  if current_rows >= max_rows then
    raise exception 'Rate limit exceeded' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger reports_limit before insert on public.reports
  for each row execute function public.enforce_hourly_limit(10, '1 hour', 'user_id');
create trigger reviews_limit before insert on public.reviews
  for each row execute function public.enforce_hourly_limit(20, '1 hour', 'user_id');
create trigger apps_limit before insert on public.apps
  for each row when (new.developer_id is not null)
  execute function public.enforce_hourly_limit(5, '1 day', 'developer_id');

-- Rate limit counter used by the server (service role only).
create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  c int;
begin
  insert into public.rate_limits (key, window_start, count) values (p_key, w, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into c;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return c <= p_max;
end $$;
revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
