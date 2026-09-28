-- PWANova V2 — foundation. Additive only: no existing column, row, id or slug is changed or dropped.
-- Adds: text-search extensions, moderator role, country helpers, categories (taxonomy), companies,
-- localized editorial content, and the structured product facts a maker controls.
--
-- Trust rule used by every table below that carries `source_type`:
--   pwanova_observed  PWANova fetched and checked it itself
--   admin_reviewed    a PWANova moderator checked the source by hand
--   vendor_stated     the verified owner of the listing says so
--   user_submitted    somebody else says so (including an owner who has not verified ownership yet)
-- Makers can only ever write the last two; the first two are written by the service role or a moderator.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------- roles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user', 'developer', 'admin', 'partner', 'moderator'));
alter table public.profiles add column locale text check (locale ~ '^[a-z]{2}$');

create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator'));
$$;

-- The account that submitted or owns the listing (ownership may still be unverified).
create or replace function public.manages_app(p_app_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.apps where id = p_app_id and developer_id = auth.uid());
$$;

-- ---------------------------------------------------------------- countries
-- Switzerland, Norway, the UK etc. are deliberately NOT EU: DACH is not the same thing as the EU.
create or replace function public.is_eu_country(code text) returns boolean
language sql immutable set search_path = public as $$
  select upper(coalesce(code, '')) in ('AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE');
$$;
create or replace function public.is_eea_country(code text) returns boolean
language sql immutable set search_path = public as $$
  select public.is_eu_country(code) or upper(coalesce(code, '')) in ('IS','LI','NO');
$$;

-- ---------------------------------------------------------------- taxonomy
-- Labels are jsonb keyed by locale ({"en": "...", "de": "..."}) so another language never needs a schema change.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  parent_id uuid references public.categories (id) on delete set null,
  name jsonb not null check (name ? 'en'),
  description jsonb not null default '{}'::jsonb,
  icon text check (char_length(icon) <= 40),
  legacy_keys text[] not null default '{}',          -- v1 apps.category values folded into this category
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);
create index categories_parent_idx on public.categories (parent_id);

create table public.app_categories (
  app_id uuid not null references public.apps (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (app_id, category_id)
);
create unique index app_categories_one_primary on public.app_categories (app_id) where is_primary;
create index app_categories_category_idx on public.app_categories (category_id);

create table public.use_cases (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name jsonb not null check (name ? 'en'),
  category_id uuid references public.categories (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.app_use_cases (
  app_id uuid not null references public.apps (id) on delete cascade,
  use_case_id uuid not null references public.use_cases (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (app_id, use_case_id)
);
create index app_use_cases_use_case_idx on public.app_use_cases (use_case_id);

-- ---------------------------------------------------------------- companies
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  name text not null check (char_length(name) between 1 and 120),
  legal_name text check (char_length(legal_name) <= 160),
  website text check (char_length(website) <= 300),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  city text check (char_length(city) <= 80),
  legal_url text check (char_length(legal_url) <= 500),
  contact_url text check (char_length(contact_url) <= 500),
  founded_year int check (founded_year between 1900 and 2100),
  source_type text not null default 'vendor_stated' check (source_type in ('pwanova_observed', 'admin_reviewed', 'vendor_stated', 'user_submitted')),
  source_url text check (char_length(source_url) <= 500),
  verified_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index companies_country_idx on public.companies (country_code);
create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- apps: V2 columns
-- Everything a maker controls is a plain column; everything PWANova computes is locked by protect_app().
alter table public.apps
  add column company_id uuid references public.companies (id) on delete set null,
  add column primary_category_id uuid references public.categories (id) on delete set null,
  add column aliases text[] not null default '{}',
  add column content_locale text not null default 'en' check (content_locale ~ '^[a-z]{2}$'),
  add column pricing_model text not null default 'unknown'
    check (pricing_model in ('unknown', 'free', 'freemium', 'subscription', 'one_time', 'usage_based', 'open_source', 'contact_sales')),
  add column has_free_plan boolean,                      -- NULL = not stated
  add column has_free_trial boolean,
  add column starting_price_cents int check (starting_price_cents >= 0),
  add column price_currency text check (price_currency ~ '^[A-Z]{3}$'),
  add column founded_year int check (founded_year between 1900 and 2100),
  -- computed by PWANova, never by the maker
  add column verification_state text not null default 'unverified'
    check (verification_state in ('unverified', 'pending', 'partially_verified', 'evidence_verified', 'stale', 'verification_failed')),
  add column evidence_score smallint not null default 0 check (evidence_score between 0 and 100),
  add column evidence_checked_at timestamptz,
  add column next_check_at timestamptz,
  add column profile_completeness smallint not null default 0 check (profile_completeness between 0 and 100),
  add column duplicate_of uuid references public.apps (id) on delete set null,
  add column search_vector tsvector,
  add column search_text text;
alter table public.apps add constraint apps_alias_count check (cardinality(aliases) <= 8);
create index apps_company_idx on public.apps (company_id);
create index apps_primary_category_idx on public.apps (primary_category_id);
create index apps_verification_idx on public.apps (verification_state, evidence_checked_at desc);
create index apps_next_check_idx on public.apps (next_check_at) where status = 'published';

create table public.app_translations (
  app_id uuid not null references public.apps (id) on delete cascade,
  locale text not null check (locale ~ '^[a-z]{2}$'),
  tagline text check (char_length(tagline) <= 120),
  description text check (char_length(description) <= 4000),
  source text not null default 'maker' check (source in ('maker', 'editorial')),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (app_id, locale)
);

-- protect_app(): same rules as before, plus the V2 computed columns.
create or replace function public.protect_app() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.is_admin() or public.is_service_role() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.ownership_status := 'claim_pending';
    new.ownership_verified_at := null; new.ownership_method := null;
    new.verification_status := 'unverified';
    new.is_featured := false;
    new.featured_at := null;
    new.is_demo := false;
    new.is_pwa := false;          -- set by server-side analysis only
    new.is_installable := false;
    new.health_status := 'unknown';
    new.moderation_note := null;
    new.moderation_hidden := false;
    new.health_checked_at := null;
    new.status := 'pending';
    new.verification_state := 'unverified';
    new.evidence_score := 0;
    new.evidence_checked_at := null;
    new.next_check_at := null;
    new.profile_completeness := 0;
    new.duplicate_of := null;
    new.search_vector := null;
    new.search_text := null;
  else
    new.developer_id := old.developer_id;
    new.domain := old.domain;     -- URL/domain changes go through admin/service so re-verification can be enforced
    new.url := old.url;
    new.ownership_status := old.ownership_status;
    new.ownership_verified_at := old.ownership_verified_at; new.ownership_method := old.ownership_method;
    new.verification_status := old.verification_status;
    new.is_featured := old.is_featured;
    new.featured_at := old.featured_at;
    new.is_demo := old.is_demo;
    new.is_pwa := old.is_pwa;
    new.is_installable := old.is_installable;
    new.health_status := old.health_status;
    new.health_checked_at := old.health_checked_at;
    new.moderation_note := old.moderation_note;
    new.moderation_hidden := old.moderation_hidden;
    new.verification_state := old.verification_state;
    new.evidence_score := old.evidence_score;
    new.evidence_checked_at := old.evidence_checked_at;
    new.next_check_at := old.next_check_at;
    new.profile_completeness := old.profile_completeness;
    new.duplicate_of := old.duplicate_of;
    new.search_vector := old.search_vector;
    new.search_text := old.search_text;
    if not old.moderation_hidden and old.status in ('published', 'hidden') and new.status in ('published', 'hidden') then
      -- allowed: an owner may only toggle between published and hidden
    else
      new.status := old.status;
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- maker-controlled structured facts
-- One trigger stamps the source for every table below. It is SECURITY INVOKER on purpose:
-- inside a definer function current_user would be the owner and every caller would look trusted.
create or replace function public.stamp_fact_source() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.is_service_role() or public.is_moderator() then
    if new.source_type in ('pwanova_observed', 'admin_reviewed') and new.verified_at is null then
      new.verified_at := now();
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.app_id := old.app_id;
    new.created_by := old.created_by;
  else
    new.created_by := auth.uid();
  end if;
  new.source_type := case when public.owns_app(new.app_id) then 'vendor_stated' else 'user_submitted' end;
  new.verified_at := null;
  return new;
end $$;

create table public.app_platforms (
  app_id uuid not null references public.apps (id) on delete cascade,
  platform text not null check (platform in ('web', 'pwa', 'ios', 'android', 'macos', 'windows', 'linux', 'browser_extension')),
  source_type text not null default 'vendor_stated' check (source_type in ('pwanova_observed', 'admin_reviewed', 'vendor_stated', 'user_submitted')),
  source_url text check (char_length(source_url) <= 500),
  verified_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (app_id, platform)
);

create table public.app_languages (
  app_id uuid not null references public.apps (id) on delete cascade,
  language_code text not null check (language_code ~ '^[a-z]{2}$'),
  source_type text not null default 'vendor_stated' check (source_type in ('pwanova_observed', 'admin_reviewed', 'vendor_stated', 'user_submitted')),
  source_url text check (char_length(source_url) <= 500),
  verified_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (app_id, language_code)
);
create index app_languages_code_idx on public.app_languages (language_code);

create table public.integration_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (char_length(name) <= 80),
  website text check (char_length(website) <= 300),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.app_integrations (
  app_id uuid not null references public.apps (id) on delete cascade,
  integration_id uuid not null references public.integration_catalog (id) on delete cascade,
  source_type text not null default 'vendor_stated' check (source_type in ('pwanova_observed', 'admin_reviewed', 'vendor_stated', 'user_submitted')),
  source_url text check (char_length(source_url) <= 500),
  verified_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (app_id, integration_id)
);
create index app_integrations_integration_idx on public.app_integrations (integration_id);

-- Exact prices are only ever what the maker states or what a moderator read on the vendor's pricing page.
create table public.pricing_plans (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  billing_interval text not null check (billing_interval in ('free', 'month', 'year', 'one_time', 'usage', 'custom')),
  price_cents int check (price_cents >= 0),
  currency text check (currency ~ '^[A-Z]{3}$'),
  per_user boolean not null default false,
  description text check (char_length(description) <= 300),
  sort_order int not null default 100,
  source_type text not null default 'vendor_stated' check (source_type in ('pwanova_observed', 'admin_reviewed', 'vendor_stated', 'user_submitted')),
  source_url text check (char_length(source_url) <= 500),
  verified_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pricing_plans_app_idx on public.pricing_plans (app_id, sort_order);
create trigger pricing_plans_updated_at before update on public.pricing_plans
  for each row execute function public.set_updated_at();

create table public.app_data_locations (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  region text not null check (region in ('eu', 'eea', 'de', 'ch', 'uk', 'us', 'global', 'other')),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  description text check (char_length(description) <= 300),
  is_default boolean not null default false,
  source_type text not null default 'vendor_stated' check (source_type in ('pwanova_observed', 'admin_reviewed', 'vendor_stated', 'user_submitted')),
  source_url text check (char_length(source_url) <= 500),
  verified_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index app_data_locations_app_idx on public.app_data_locations (app_id);

create table public.app_subprocessors (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  purpose text check (char_length(purpose) <= 200),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  source_type text not null default 'vendor_stated' check (source_type in ('pwanova_observed', 'admin_reviewed', 'vendor_stated', 'user_submitted')),
  source_url text check (char_length(source_url) <= 500),
  verified_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index app_subprocessors_app_idx on public.app_subprocessors (app_id);

-- Never guessed: a row exists only when the vendor documents the provider or a moderator found the source.
create table public.app_ai_providers (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  provider text not null check (char_length(provider) between 1 and 80),
  model_name text check (char_length(model_name) <= 120),
  purpose text check (char_length(purpose) <= 200),
  source_type text not null default 'vendor_stated' check (source_type in ('pwanova_observed', 'admin_reviewed', 'vendor_stated', 'user_submitted')),
  source_url text check (char_length(source_url) <= 500),
  verified_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index app_ai_providers_app_idx on public.app_ai_providers (app_id);

create trigger app_platforms_source before insert or update on public.app_platforms for each row execute function public.stamp_fact_source();
create trigger app_languages_source before insert or update on public.app_languages for each row execute function public.stamp_fact_source();
create trigger app_integrations_source before insert or update on public.app_integrations for each row execute function public.stamp_fact_source();
create trigger pricing_plans_source before insert or update on public.pricing_plans for each row execute function public.stamp_fact_source();
create trigger app_data_locations_source before insert or update on public.app_data_locations for each row execute function public.stamp_fact_source();
create trigger app_subprocessors_source before insert or update on public.app_subprocessors for each row execute function public.stamp_fact_source();
create trigger app_ai_providers_source before insert or update on public.app_ai_providers for each row execute function public.stamp_fact_source();

-- Companies: a maker may describe the company behind a listing they manage, never mark it verified.
create or replace function public.protect_company() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.is_service_role() or public.is_moderator() then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.slug := old.slug;
  else
    new.created_by := auth.uid();
  end if;
  new.source_type := 'vendor_stated';
  new.verified_at := null;
  return new;
end $$;
create trigger companies_protect before insert or update on public.companies
  for each row execute function public.protect_company();

create or replace function public.manages_company(p_company_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.companies c where c.id = p_company_id and c.created_by = auth.uid())
      or exists (select 1 from public.apps a where a.company_id = p_company_id and a.developer_id = auth.uid() and a.ownership_status = 'verified_owner');
$$;

-- ---------------------------------------------------------------- RLS
alter table public.categories enable row level security;
alter table public.app_categories enable row level security;
alter table public.use_cases enable row level security;
alter table public.app_use_cases enable row level security;
alter table public.companies enable row level security;
alter table public.app_translations enable row level security;
alter table public.app_platforms enable row level security;
alter table public.app_languages enable row level security;
alter table public.integration_catalog enable row level security;
alter table public.app_integrations enable row level security;
alter table public.pricing_plans enable row level security;
alter table public.app_data_locations enable row level security;
alter table public.app_subprocessors enable row level security;
alter table public.app_ai_providers enable row level security;

-- reference data: world-readable, moderator-managed
create policy categories_read on public.categories for select using (is_active or public.is_moderator());
create policy categories_manage on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy use_cases_read on public.use_cases for select using (is_active or public.is_moderator());
create policy use_cases_manage on public.use_cases for all to authenticated using (public.is_moderator()) with check (public.is_moderator());
create policy integration_catalog_read on public.integration_catalog for select using (is_active or public.is_moderator());
create policy integration_catalog_manage on public.integration_catalog for all to authenticated using (public.is_moderator()) with check (public.is_moderator());

create policy companies_read on public.companies for select using (true);
create policy companies_insert on public.companies for insert to authenticated with check (created_by = auth.uid() or public.is_moderator());
create policy companies_update on public.companies for update to authenticated
  using (public.manages_company(id) or public.is_moderator()) with check (public.manages_company(id) or public.is_moderator());
create policy companies_delete on public.companies for delete to authenticated using (public.is_admin());

-- app-scoped rows: readable with the listing, writable by whoever manages the listing
create policy app_categories_read on public.app_categories for select using (public.app_is_public(app_id) or public.manages_app(app_id) or public.is_moderator());
create policy app_categories_write on public.app_categories for all to authenticated
  using (public.manages_app(app_id) or public.is_moderator()) with check (public.manages_app(app_id) or public.is_moderator());
create policy app_use_cases_read on public.app_use_cases for select using (public.app_is_public(app_id) or public.manages_app(app_id) or public.is_moderator());
create policy app_use_cases_write on public.app_use_cases for all to authenticated
  using (public.manages_app(app_id) or public.is_moderator()) with check (public.manages_app(app_id) or public.is_moderator());
create policy app_translations_read on public.app_translations for select using (public.app_is_public(app_id) or public.manages_app(app_id) or public.is_moderator());
create policy app_translations_write on public.app_translations for all to authenticated
  using (public.manages_app(app_id) or public.is_moderator()) with check (public.manages_app(app_id) or public.is_moderator());

-- fact rows: a maker can change only rows that are still statements, never rows PWANova verified
do $$
declare t text;
begin
  foreach t in array array['app_platforms', 'app_languages', 'app_integrations', 'pricing_plans', 'app_data_locations', 'app_subprocessors', 'app_ai_providers'] loop
    execute format('create policy %I on public.%I for select using (public.app_is_public(app_id) or public.manages_app(app_id) or public.is_moderator())', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.manages_app(app_id) or public.is_moderator())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_moderator() or (public.manages_app(app_id) and source_type in (''vendor_stated'', ''user_submitted''))) with check (public.manages_app(app_id) or public.is_moderator())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_moderator() or (public.manages_app(app_id) and source_type in (''vendor_stated'', ''user_submitted'')))', t || '_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- reference data
insert into public.categories (slug, name, description, icon, legacy_keys, sort_order) values
  ('ai-assistants',        '{"en":"AI Assistants","de":"KI-Assistenten"}',              '{"en":"Assistants, copilots and agents.","de":"Assistenten, Copiloten und Agenten."}', 'bot', '{ai}', 10),
  ('productivity',         '{"en":"Productivity","de":"Produktivität"}',                '{"en":"Tools that help people get work done.","de":"Werkzeuge, mit denen Arbeit schneller erledigt ist."}', 'zap', '{productivity}', 20),
  ('developer-tools',      '{"en":"Developer Tools","de":"Entwickler-Tools"}',          '{"en":"Tools for building, testing and shipping software.","de":"Werkzeuge zum Entwickeln, Testen und Ausliefern von Software."}', 'code', '{developer-tools}', 30),
  ('sales',                '{"en":"Sales","de":"Vertrieb"}',                            '{"en":"Pipeline, outreach and deal tools.","de":"Pipeline, Ansprache und Abschlüsse."}', 'handshake', '{}', 40),
  ('marketing',            '{"en":"Marketing","de":"Marketing"}',                       '{"en":"Campaigns, content, links and attribution.","de":"Kampagnen, Inhalte, Links und Attribution."}', 'megaphone', '{}', 50),
  ('customer-support',     '{"en":"Customer Support","de":"Kundenservice"}',            '{"en":"Help desks, chat and feedback.","de":"Helpdesk, Chat und Feedback."}', 'life-buoy', '{}', 60),
  ('design',               '{"en":"Design","de":"Design"}',                             '{"en":"Visual design, mockups and 3D.","de":"Gestaltung, Mockups und 3D."}', 'palette', '{}', 70),
  ('collaboration',        '{"en":"Collaboration","de":"Zusammenarbeit"}',              '{"en":"Whiteboards, documents and shared workspaces.","de":"Whiteboards, Dokumente und gemeinsame Arbeitsbereiche."}', 'users', '{}', 80),
  ('automation',           '{"en":"Automation","de":"Automatisierung"}',                '{"en":"Workflows, agents and background jobs.","de":"Workflows, Agenten und Hintergrundaufgaben."}', 'workflow', '{}', 90),
  ('data-analytics',       '{"en":"Data & Analytics","de":"Daten & Analyse"}',          '{"en":"Analytics, dashboards and reporting.","de":"Analysen, Dashboards und Berichte."}', 'bar-chart-3', '{}', 100),
  ('finance',              '{"en":"Finance","de":"Finanzen"}',                          '{"en":"Invoicing, accounting and payments.","de":"Rechnungen, Buchhaltung und Zahlungen."}', 'wallet', '{finance}', 110),
  ('hr',                   '{"en":"HR","de":"Personal"}',                               '{"en":"Hiring, people and time tracking.","de":"Recruiting, Personal und Zeiterfassung."}', 'id-card', '{}', 120),
  ('security',             '{"en":"Security","de":"Sicherheit"}',                       '{"en":"Identity, secrets and monitoring.","de":"Identität, Geheimnisse und Überwachung."}', 'shield', '{}', 130),
  ('education',            '{"en":"Education","de":"Bildung"}',                         '{"en":"Learning and teaching tools.","de":"Werkzeuge zum Lernen und Lehren."}', 'graduation-cap', '{education}', 140),
  ('communication',        '{"en":"Communication","de":"Kommunikation"}',               '{"en":"Messaging, meetings and social clients.","de":"Nachrichten, Meetings und soziale Clients."}', 'message-circle', '{social}', 150),
  ('project-management',   '{"en":"Project Management","de":"Projektmanagement"}',      '{"en":"Planning, issues and roadmaps.","de":"Planung, Aufgaben und Roadmaps."}', 'kanban', '{}', 160),
  ('crm',                  '{"en":"CRM","de":"CRM"}',                                   '{"en":"Customer relationship management.","de":"Kundenbeziehungen verwalten."}', 'contact', '{}', 170),
  ('knowledge-management', '{"en":"Knowledge Management","de":"Wissensmanagement"}',    '{"en":"Notes, wikis and documentation.","de":"Notizen, Wikis und Dokumentation."}', 'book-open', '{}', 180),
  ('business-operations',  '{"en":"Business Operations","de":"Geschäftsabläufe"}',      '{"en":"Documents, forms and everyday operations.","de":"Dokumente, Formulare und tägliche Abläufe."}', 'briefcase', '{business}', 190),
  ('health-fitness',       '{"en":"Health & Fitness","de":"Gesundheit & Fitness"}',     '{"en":"Training, nutrition and wellbeing.","de":"Training, Ernährung und Wohlbefinden."}', 'heart-pulse', '{fitness,health}', 200),
  ('media-entertainment',  '{"en":"Media & Entertainment","de":"Medien & Unterhaltung"}', '{"en":"Music, video and games.","de":"Musik, Video und Spiele."}', 'music', '{entertainment,games}', 210),
  ('lifestyle',            '{"en":"Lifestyle","de":"Lifestyle"}',                       '{"en":"Food, travel and everyday life.","de":"Essen, Reisen und Alltag."}', 'sun', '{lifestyle,travel,food}', 220),
  ('utilities',            '{"en":"Utilities","de":"Dienstprogramme"}',                 '{"en":"Small tools that do one job well.","de":"Kleine Werkzeuge, die eine Aufgabe gut erledigen."}', 'wrench', '{utilities}', 230),
  ('other',                '{"en":"Other","de":"Sonstiges"}',                           '{}', 'grid-2x2', '{other}', 900);

insert into public.use_cases (slug, name, category_id)
select v.slug, v.name::jsonb, c.id from (values
  ('ai-chat',              '{"en":"AI chat","de":"KI-Chat"}', 'ai-assistants'),
  ('meeting-assistant',    '{"en":"Meeting assistant","de":"Meeting-Assistent"}', 'ai-assistants'),
  ('document-qa',          '{"en":"Ask questions about documents","de":"Fragen an Dokumente stellen"}', 'ai-assistants'),
  ('image-generation',     '{"en":"Image generation","de":"Bildgenerierung"}', 'design'),
  ('music-generation',     '{"en":"Music generation","de":"Musikgenerierung"}', 'media-entertainment'),
  ('whiteboarding',        '{"en":"Whiteboarding","de":"Whiteboard"}', 'collaboration'),
  ('note-taking',          '{"en":"Note taking","de":"Notizen"}', 'knowledge-management'),
  ('scheduling',           '{"en":"Scheduling","de":"Terminplanung"}', 'productivity'),
  ('time-tracking',        '{"en":"Time tracking","de":"Zeiterfassung"}', 'productivity'),
  ('invoicing',            '{"en":"Invoicing","de":"Rechnungsstellung"}', 'finance'),
  ('link-management',      '{"en":"Link management","de":"Link-Verwaltung"}', 'marketing'),
  ('web-analytics',        '{"en":"Web analytics","de":"Web-Analyse"}', 'data-analytics'),
  ('status-pages',         '{"en":"Status pages and uptime","de":"Statusseiten und Verfügbarkeit"}', 'developer-tools'),
  ('api-client',           '{"en":"API testing","de":"API-Tests"}', 'developer-tools'),
  ('code-screenshots',     '{"en":"Code screenshots","de":"Code-Screenshots"}', 'developer-tools'),
  ('background-jobs',      '{"en":"Background jobs and workflows","de":"Hintergrundjobs und Workflows"}', 'automation'),
  ('document-sharing',     '{"en":"Document sharing and data rooms","de":"Dokumentenfreigabe und Datenräume"}', 'business-operations'),
  ('forms-surveys',        '{"en":"Forms and surveys","de":"Formulare und Umfragen"}', 'business-operations'),
  ('issue-tracking',       '{"en":"Issue tracking","de":"Aufgabenverfolgung"}', 'project-management'),
  ('contact-management',   '{"en":"Contact management","de":"Kontaktverwaltung"}', 'crm'),
  ('screenshot-mockups',   '{"en":"Screenshots and mockups","de":"Screenshots und Mockups"}', 'design'),
  ('workout-tracking',     '{"en":"Workout tracking","de":"Trainingstagebuch"}', 'health-fitness'),
  ('nutrition-tracking',   '{"en":"Nutrition tracking","de":"Ernährungstagebuch"}', 'health-fitness'),
  ('focus-music',          '{"en":"Focus music","de":"Musik zum Konzentrieren"}', 'media-entertainment')
) as v(slug, name, category_slug) join public.categories c on c.slug = v.category_slug;

insert into public.integration_catalog (slug, name, website) values
  ('slack', 'Slack', 'https://slack.com'),
  ('microsoft-teams', 'Microsoft Teams', 'https://www.microsoft.com/microsoft-teams'),
  ('google-workspace', 'Google Workspace', 'https://workspace.google.com'),
  ('microsoft-365', 'Microsoft 365', 'https://www.microsoft.com/microsoft-365'),
  ('github', 'GitHub', 'https://github.com'),
  ('gitlab', 'GitLab', 'https://gitlab.com'),
  ('notion', 'Notion', 'https://www.notion.so'),
  ('salesforce', 'Salesforce', 'https://www.salesforce.com'),
  ('hubspot', 'HubSpot', 'https://www.hubspot.com'),
  ('zapier', 'Zapier', 'https://zapier.com'),
  ('make', 'Make', 'https://www.make.com'),
  ('n8n', 'n8n', 'https://n8n.io'),
  ('jira', 'Jira', 'https://www.atlassian.com/software/jira'),
  ('linear', 'Linear', 'https://linear.app'),
  ('stripe', 'Stripe', 'https://stripe.com'),
  ('zoom', 'Zoom', 'https://zoom.us'),
  ('google-calendar', 'Google Calendar', 'https://calendar.google.com'),
  ('outlook', 'Outlook', 'https://outlook.com'),
  ('discord', 'Discord', 'https://discord.com'),
  ('figma', 'Figma', 'https://www.figma.com'),
  ('google-drive', 'Google Drive', 'https://drive.google.com'),
  ('dropbox', 'Dropbox', 'https://www.dropbox.com'),
  ('datev', 'DATEV', 'https://www.datev.de'),
  ('lexoffice', 'Lexware Office', 'https://www.lexware.de');

-- ---------------------------------------------------------------- backfill existing listings
-- Every existing app keeps its v1 category value; it additionally gets the matching V2 category.
insert into public.app_categories (app_id, category_id, is_primary)
select a.id, c.id, true
from public.apps a join public.categories c on a.category = any (c.legacy_keys)
on conflict do nothing;
update public.apps a set primary_category_id = ac.category_id
from public.app_categories ac where ac.app_id = a.id and ac.is_primary and a.primary_category_id is null;

-- Known capabilities become platform rows with their real origin: PWANova observed the manifest itself.
insert into public.app_platforms (app_id, platform, source_type, verified_at)
select a.id, 'web', 'pwanova_observed', coalesce(a.health_checked_at, now()) from public.apps a
on conflict do nothing;
insert into public.app_platforms (app_id, platform, source_type, verified_at)
select a.id, 'pwa', 'pwanova_observed', coalesce(a.health_checked_at, now()) from public.apps a where a.is_pwa
on conflict do nothing;

-- ---------------------------------------------------------------- keep v1 writers working
-- The v1 submit flow only knows apps.category. New listings therefore get their V2 category and
-- the "web" platform automatically, and the primary category stays mirrored in app_categories.
create or replace function public.apps_v2_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_when = 'BEFORE' then
    if new.primary_category_id is null then
      select c.id into new.primary_category_id from public.categories c
      where new.category = any (c.legacy_keys) order by c.sort_order limit 1;
    end if;
    return new;
  end if;
  if new.primary_category_id is not null then
    update public.app_categories set is_primary = false
    where app_id = new.id and is_primary and category_id <> new.primary_category_id;
    insert into public.app_categories (app_id, category_id, is_primary) values (new.id, new.primary_category_id, true)
    on conflict (app_id, category_id) do update set is_primary = true;
  end if;
  if tg_op = 'INSERT' then
    insert into public.app_platforms (app_id, platform, source_type, verified_at)
    values (new.id, 'web', 'pwanova_observed', now()) on conflict do nothing;
  end if;
  return null;
end $$;
create trigger apps_v2_defaults_before before insert on public.apps
  for each row execute function public.apps_v2_defaults();
create trigger apps_v2_defaults_after after insert or update of primary_category_id on public.apps
  for each row execute function public.apps_v2_defaults();
