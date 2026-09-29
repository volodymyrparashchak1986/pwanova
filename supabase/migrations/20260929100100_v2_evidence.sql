-- PWANova V2 — evidence and verification. Additive only.
--
-- The model in one paragraph: `fact_attributes` is the registry of things PWANova can know about an
-- app. `app_evidence` is append-only history: every statement or observation is a row with its
-- source and date, and older rows are superseded, never edited or deleted. `app_facts` is the
-- current answer per app and attribute, with the VERIFIED value and the VENDOR statement kept in
-- separate columns so a maker's edit can never overwrite what PWANova checked.
-- "unknown" is a state of its own everywhere: it never means "no".

create table public.fact_attributes (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,60}$'),
  dimension text not null check (dimension in ('technical', 'company', 'data', 'ai', 'product')),
  value_type text not null check (value_type in ('boolean', 'url', 'text', 'country')),
  label jsonb not null check (label ? 'en'),                 -- neutral name, e.g. "Data processing agreement"
  positive_label jsonb not null default '{}'::jsonb,         -- e.g. "DPA available"
  negative_label jsonb not null default '{}'::jsonb,         -- e.g. "No DPA published"
  description jsonb not null default '{}'::jsonb,
  is_expected boolean not null default true,                 -- counts toward evidence completeness
  is_filterable boolean not null default false,
  is_card_signal boolean not null default false,             -- may appear as a trust signal on cards
  auto_checkable boolean not null default false,
  ttl_days int not null default 90 check (ttl_days between 1 and 1000),
  weight smallint not null default 1 check (weight between 0 and 10),
  sort_order int not null default 100
);

create table public.verification_runs (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  initiated_by uuid references public.profiles (id) on delete set null,
  run_type text not null check (run_type in ('automatic', 'scheduled', 'maker_requested', 'manual')),
  status text not null default 'completed' check (status in ('queued', 'running', 'completed', 'partial', 'failed')),
  checked_url text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result_summary jsonb not null default '{}'::jsonb,
  error_summary text check (char_length(error_summary) <= 500),
  created_at timestamptz not null default now()
);
create index verification_runs_app_idx on public.verification_runs (app_id, started_at desc);

create table public.app_evidence (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  attribute_key text not null references public.fact_attributes (key),
  value_state text not null check (value_state in ('yes', 'no', 'unknown')),
  value_text text check (char_length(value_text) <= 500),
  value_json jsonb not null default '{}'::jsonb,
  source_type text not null check (source_type in ('pwanova_observed', 'admin_reviewed', 'vendor_stated', 'user_submitted')),
  verification_method text not null check (verification_method in ('automatic', 'manual', 'vendor', 'community')),
  source_url text check (char_length(source_url) <= 500),
  source_title text check (char_length(source_title) <= 200),
  evidence_excerpt text check (char_length(evidence_excerpt) <= 1000),
  confidence smallint check (confidence between 0 and 100),
  status text not null default 'current' check (status in ('pending_review', 'current', 'superseded', 'rejected', 'retracted')),
  review_note text check (char_length(review_note) <= 500),
  collected_at timestamptz not null default now(),
  verified_at timestamptz,
  -- the same observation seen again: the row stays, only these two move
  last_confirmed_at timestamptz,
  confirmations int not null default 1 check (confirmations >= 1),
  verified_by uuid references public.profiles (id) on delete set null,
  submitted_by uuid references public.profiles (id) on delete set null,
  run_id uuid references public.verification_runs (id) on delete set null,
  superseded_by uuid references public.app_evidence (id) on delete set null,
  superseded_at timestamptz,
  created_at timestamptz not null default now()
);
create index app_evidence_app_attr_idx on public.app_evidence (app_id, attribute_key, collected_at desc);
create index app_evidence_review_idx on public.app_evidence (status, created_at desc) where status = 'pending_review';

create table public.verification_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.verification_runs (id) on delete cascade,
  app_id uuid not null references public.apps (id) on delete cascade,
  check_key text not null check (char_length(check_key) <= 60),
  attribute_key text references public.fact_attributes (key),
  -- found / not_found are observations; could_not_check is a technical failure and changes nothing
  outcome text not null check (outcome in ('found', 'not_found', 'could_not_check', 'skipped')),
  value_state text check (value_state in ('yes', 'no', 'unknown')),
  value_text text check (char_length(value_text) <= 500),
  source_url text check (char_length(source_url) <= 500),
  http_status int,
  detail jsonb not null default '{}'::jsonb,
  evidence_id uuid references public.app_evidence (id) on delete set null,
  checked_at timestamptz not null default now()
);
create index verification_results_run_idx on public.verification_results (run_id);
create index verification_results_app_idx on public.verification_results (app_id, checked_at desc);

create table public.app_facts (
  app_id uuid not null references public.apps (id) on delete cascade,
  attribute_key text not null references public.fact_attributes (key),
  verified_state text not null default 'unknown' check (verified_state in ('yes', 'no', 'unknown')),
  verified_value text,
  verified_source_type text check (verified_source_type in ('pwanova_observed', 'admin_reviewed')),
  verified_source_url text,
  verified_evidence_id uuid references public.app_evidence (id) on delete set null,
  verified_at timestamptz,
  vendor_state text not null default 'unknown' check (vendor_state in ('yes', 'no', 'unknown')),
  vendor_value text,
  vendor_source_url text,
  vendor_evidence_id uuid references public.app_evidence (id) on delete set null,
  vendor_stated_at timestamptz,
  -- what the catalogue filters on: the verified answer when there is one, otherwise the vendor's
  effective_state text generated always as (case when verified_state <> 'unknown' then verified_state else vendor_state end) stored,
  effective_source text generated always as (case when verified_state <> 'unknown' then 'verified' when vendor_state <> 'unknown' then 'vendor' else 'none' end) stored,
  last_attempt_at timestamptz,
  last_attempt_outcome text check (last_attempt_outcome in ('found', 'not_found', 'could_not_check', 'skipped')),
  updated_at timestamptz not null default now(),
  primary key (app_id, attribute_key)
);
create index app_facts_filter_idx on public.app_facts (attribute_key, effective_state, app_id);

-- ---------------------------------------------------------------- write rules
-- SECURITY INVOKER on purpose (see stamp_fact_source in the foundation migration).
create or replace function public.protect_evidence() returns trigger
language plpgsql set search_path = public as $$
declare trusted boolean := public.is_service_role() or public.is_moderator();
begin
  if tg_op = 'INSERT' then
    if not trusted then
      new.submitted_by := auth.uid();
      new.verified_at := null; new.verified_by := null; new.run_id := null;
      new.superseded_by := null; new.superseded_at := null; new.review_note := null;
      new.confidence := null; new.last_confirmed_at := null; new.confirmations := 1;
      new.collected_at := now();
      if public.owns_app(new.app_id) then
        new.source_type := 'vendor_stated'; new.verification_method := 'vendor'; new.status := 'current';
      else
        -- community reports are reviewed before anybody sees them
        new.source_type := 'user_submitted'; new.verification_method := 'community'; new.status := 'pending_review';
      end if;
    elsif new.source_type in ('pwanova_observed', 'admin_reviewed') and new.verified_at is null then
      new.verified_at := now();
      if new.source_type = 'admin_reviewed' and new.verified_by is null then new.verified_by := auth.uid(); end if;
    end if;
    return new;
  end if;

  -- UPDATE: evidence is history. What was said, by whom and from which source can never change.
  if new.app_id is distinct from old.app_id or new.attribute_key is distinct from old.attribute_key
     or new.value_state is distinct from old.value_state or new.value_text is distinct from old.value_text
     or new.value_json is distinct from old.value_json or new.source_type is distinct from old.source_type
     or new.verification_method is distinct from old.verification_method or new.source_url is distinct from old.source_url
     or new.source_title is distinct from old.source_title or new.evidence_excerpt is distinct from old.evidence_excerpt
     or new.collected_at is distinct from old.collected_at or new.submitted_by is distinct from old.submitted_by then
    raise exception 'Evidence is append-only: add a new row instead of editing history';
  end if;
  if not trusted then
    -- a maker may only retract their own statement
    if old.submitted_by is distinct from auth.uid() or old.source_type <> 'vendor_stated' or new.status not in (old.status, 'retracted') then
      raise exception 'Only a moderator can change the status of this evidence';
    end if;
    new.verified_at := old.verified_at; new.verified_by := old.verified_by; new.review_note := old.review_note;
    new.superseded_by := old.superseded_by; new.superseded_at := old.superseded_at; new.confidence := old.confidence;
    new.last_confirmed_at := old.last_confirmed_at; new.confirmations := old.confirmations;
  end if;
  return new;
end $$;
create trigger app_evidence_protect before insert or update on public.app_evidence
  for each row execute function public.protect_evidence();

-- ---------------------------------------------------------------- current facts
create or replace function public.refresh_app_facts(p_app_id uuid, p_attribute_key text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_facts as f (app_id, attribute_key, verified_state, verified_value, verified_source_type, verified_source_url,
                                     verified_evidence_id, verified_at, vendor_state, vendor_value, vendor_source_url, vendor_evidence_id, vendor_stated_at, updated_at)
  select p_app_id, k.attribute_key,
         coalesce(v.value_state, 'unknown'), v.value_text, v.source_type, v.source_url, v.id, coalesce(v.last_confirmed_at, v.verified_at),
         coalesce(s.value_state, 'unknown'), s.value_text, s.source_url, s.id, s.collected_at, now()
  from (select distinct attribute_key from public.app_evidence
        where app_id = p_app_id and (p_attribute_key is null or attribute_key = p_attribute_key)) k
  left join lateral (
    select e.* from public.app_evidence e
    where e.app_id = p_app_id and e.attribute_key = k.attribute_key and e.status = 'current'
      and e.source_type in ('pwanova_observed', 'admin_reviewed') and e.value_state <> 'unknown'
    order by (e.source_type = 'admin_reviewed') desc, coalesce(e.last_confirmed_at, e.collected_at) desc limit 1) v on true
  left join lateral (
    select e.* from public.app_evidence e
    where e.app_id = p_app_id and e.attribute_key = k.attribute_key and e.status = 'current'
      and e.source_type = 'vendor_stated' and e.value_state <> 'unknown'
    order by e.collected_at desc limit 1) s on true
  on conflict (app_id, attribute_key) do update set
    verified_state = excluded.verified_state, verified_value = excluded.verified_value,
    verified_source_type = excluded.verified_source_type, verified_source_url = excluded.verified_source_url,
    verified_evidence_id = excluded.verified_evidence_id, verified_at = excluded.verified_at,
    vendor_state = excluded.vendor_state, vendor_value = excluded.vendor_value,
    vendor_source_url = excluded.vendor_source_url, vendor_evidence_id = excluded.vendor_evidence_id,
    vendor_stated_at = excluded.vendor_stated_at, updated_at = now();

  if p_attribute_key is null or p_attribute_key = 'company_country' then
    insert into public.app_facts as f (app_id, attribute_key, verified_state, verified_value, verified_source_type, verified_source_url,
                                       verified_evidence_id, verified_at, vendor_state, vendor_value, vendor_source_url, vendor_evidence_id, vendor_stated_at, updated_at)
    select c.app_id, 'eu_company',
           case when c.verified_state = 'yes' and c.verified_value is not null then case when public.is_eu_country(c.verified_value) then 'yes' else 'no' end else 'unknown' end,
           c.verified_value, c.verified_source_type, c.verified_source_url, c.verified_evidence_id, c.verified_at,
           case when c.vendor_state = 'yes' and c.vendor_value is not null then case when public.is_eu_country(c.vendor_value) then 'yes' else 'no' end else 'unknown' end,
           c.vendor_value, c.vendor_source_url, c.vendor_evidence_id, c.vendor_stated_at, now()
    from public.app_facts c where c.app_id = p_app_id and c.attribute_key = 'company_country'
    on conflict (app_id, attribute_key) do update set
      verified_state = excluded.verified_state, verified_value = excluded.verified_value,
      verified_source_type = excluded.verified_source_type, verified_source_url = excluded.verified_source_url,
      verified_evidence_id = excluded.verified_evidence_id, verified_at = excluded.verified_at,
      vendor_state = excluded.vendor_state, vendor_value = excluded.vendor_value,
      vendor_source_url = excluded.vendor_source_url, vendor_evidence_id = excluded.vendor_evidence_id,
      vendor_stated_at = excluded.vendor_stated_at, updated_at = now();
  end if;
end $$;
revoke all on function public.refresh_app_facts(uuid, text) from public, anon, authenticated;
grant execute on function public.refresh_app_facts(uuid, text) to service_role;

-- A new "current" row supersedes the previous current row of the same kind; then the fact is rebuilt.
create or replace function public.evidence_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'current' then
    update public.app_evidence e set status = 'superseded', superseded_by = new.id, superseded_at = now()
    where e.app_id = new.app_id and e.attribute_key = new.attribute_key and e.id <> new.id and e.status = 'current'
      and ((new.source_type = 'vendor_stated' and e.source_type = 'vendor_stated')
        or (new.source_type in ('pwanova_observed', 'admin_reviewed') and e.source_type = new.source_type));
  end if;
  perform public.refresh_app_facts(new.app_id, new.attribute_key);
  perform public.refresh_app_trust(new.app_id);
  return null;
end $$;

-- ---------------------------------------------------------------- trust profile
-- Evidence completeness: share of the expected attributes PWANova has an answer for.
-- A verified answer counts fully, a vendor statement half. It measures transparency, not compliance.
create or replace function public.compute_evidence_score(p_app_id uuid) returns smallint
language sql stable security definer set search_path = public as $$
  select coalesce(round(100.0 * sum(case f.effective_source when 'verified' then a.weight when 'vendor' then a.weight * 0.5 else 0 end)
                        / nullif(sum(a.weight), 0)), 0)::smallint
  from public.fact_attributes a
  left join public.app_facts f on f.attribute_key = a.key and f.app_id = p_app_id
  where a.is_expected;
$$;

create or replace function public.refresh_app_trust(p_app_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_score smallint := public.compute_evidence_score(p_app_id);
  v_checked timestamptz;
  v_verified int;
  v_expected int;
  v_core int;
  v_last_status text;
  v_state text;
begin
  select max(f.verified_at), count(*) filter (where f.verified_state <> 'unknown')
    into v_checked, v_verified
  from public.app_facts f join public.fact_attributes a on a.key = f.attribute_key
  where f.app_id = p_app_id and a.is_expected;
  select count(*) into v_expected from public.fact_attributes where is_expected;
  select count(*) into v_core from public.app_facts
  where app_id = p_app_id and verified_state = 'yes' and attribute_key in ('https', 'privacy_policy', 'legal_notice');
  select r.status into v_last_status from public.verification_runs r where r.app_id = p_app_id order by r.started_at desc limit 1;

  v_state := case
    when v_last_status in ('queued', 'running') then 'pending'
    when coalesce(v_verified, 0) = 0 and v_last_status = 'failed' then 'verification_failed'
    when coalesce(v_verified, 0) = 0 then 'unverified'
    when v_checked < now() - interval '180 days' then 'stale'
    when v_core = 3 and v_verified * 2 >= v_expected then 'evidence_verified'
    else 'partially_verified'
  end;

  update public.apps set
    evidence_score = v_score,
    evidence_checked_at = v_checked,
    verification_state = v_state,
    profile_completeness = public.compute_profile_completeness(p_app_id)
  where id = p_app_id
    and (evidence_score, evidence_checked_at, verification_state, profile_completeness)
        is distinct from (v_score, v_checked, v_state, public.compute_profile_completeness(p_app_id));
end $$;
revoke all on function public.refresh_app_trust(uuid) from public, anon, authenticated;
grant execute on function public.refresh_app_trust(uuid) to service_role;

-- Profile completeness: what the maker can fill in. It is about the listing, not about compliance.
create or replace function public.app_profile_report(p_app_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with a as (select * from public.apps where id = p_app_id),
  items(key, weight, done) as (
    select 'tagline', 8, exists (select 1 from a where char_length(coalesce(tagline, '')) >= 10)
    union all select 'description', 12, exists (select 1 from a where char_length(coalesce(description, '')) >= 120)
    union all select 'icon', 8, exists (select 1 from a where icon_url is not null)
    union all select 'screenshots', 8, exists (select 1 from public.app_screenshots s where s.app_id = p_app_id)
    union all select 'category', 6, exists (select 1 from a where primary_category_id is not null)
    union all select 'use_cases', 6, exists (select 1 from public.app_use_cases u where u.app_id = p_app_id)
    union all select 'company', 8, exists (select 1 from a join public.companies c on c.id = a.company_id where c.country_code is not null)
    union all select 'pricing', 8, exists (select 1 from a where pricing_model <> 'unknown')
    union all select 'languages', 6, exists (select 1 from public.app_languages l where l.app_id = p_app_id)
    union all select 'translation_de', 6, exists (select 1 from a where content_locale = 'de')
                                        or exists (select 1 from public.app_translations t where t.app_id = p_app_id and t.locale = 'de' and char_length(coalesce(t.description, '')) >= 60)
    union all select 'privacy_policy', 6, exists (select 1 from public.app_facts f where f.app_id = p_app_id and f.attribute_key = 'privacy_policy' and f.effective_state = 'yes')
    union all select 'legal_notice', 6, exists (select 1 from public.app_facts f where f.app_id = p_app_id and f.attribute_key = 'legal_notice' and f.effective_state = 'yes')
    union all select 'dpa', 6, exists (select 1 from public.app_facts f where f.app_id = p_app_id and f.attribute_key = 'dpa_available' and f.effective_state <> 'unknown')
    union all select 'data_location', 6, exists (select 1 from public.app_facts f where f.app_id = p_app_id and f.attribute_key = 'eu_hosting_available' and f.effective_state <> 'unknown')
                                       or exists (select 1 from public.app_data_locations d where d.app_id = p_app_id)
    union all select 'ownership', 4, exists (select 1 from a where ownership_status = 'verified_owner')
  )
  select jsonb_build_object(
    'score', coalesce(round(100.0 * sum(weight) filter (where done) / nullif(sum(weight), 0)), 0)::int,
    'done', coalesce(jsonb_agg(key) filter (where done), '[]'::jsonb),
    'missing', coalesce(jsonb_agg(key) filter (where not done), '[]'::jsonb))
  from items;
$$;
create or replace function public.compute_profile_completeness(p_app_id uuid) returns smallint
language sql stable security definer set search_path = public as $$
  select ((public.app_profile_report(p_app_id)) ->> 'score')::smallint;
$$;
revoke all on function public.app_profile_report(uuid) from public, anon, authenticated;

-- What a maker sees in the dashboard: only for listings they manage.
create or replace function public.my_app_profile_report(p_app_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.manages_app(p_app_id) or public.is_moderator()) then
    raise exception 'Not your listing';
  end if;
  return public.app_profile_report(p_app_id);
end $$;
revoke all on function public.my_app_profile_report(uuid) from public, anon;
grant execute on function public.my_app_profile_report(uuid) to authenticated;
revoke all on function public.compute_profile_completeness(uuid) from public, anon, authenticated;
revoke all on function public.compute_evidence_score(uuid) from public, anon, authenticated;

create trigger app_evidence_after after insert or update of status, last_confirmed_at on public.app_evidence
  for each row execute function public.evidence_after_write();

create or replace function public.app_profile_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'apps' then
    perform public.refresh_app_trust(new.id);
  elsif tg_op = 'DELETE' then
    perform public.refresh_app_trust(old.app_id);
  else
    perform public.refresh_app_trust(new.app_id);
  end if;
  return null;
end $$;
create trigger apps_profile after insert or update of tagline, description, icon_url, primary_category_id, company_id, pricing_model, content_locale, ownership_status on public.apps
  for each row execute function public.app_profile_trigger();
create trigger app_screenshots_profile after insert or delete on public.app_screenshots for each row execute function public.app_profile_trigger();
create trigger app_use_cases_profile after insert or delete on public.app_use_cases for each row execute function public.app_profile_trigger();
create trigger app_languages_profile after insert or delete on public.app_languages for each row execute function public.app_profile_trigger();
create trigger app_translations_profile after insert or update or delete on public.app_translations for each row execute function public.app_profile_trigger();
create trigger app_data_locations_profile after insert or delete on public.app_data_locations for each row execute function public.app_profile_trigger();
-- named to run after app_evidence_protect, which stamps submitted_by
create trigger app_evidence_z_limit before insert on public.app_evidence
  for each row execute function public.enforce_hourly_limit('40', '1 hour', 'submitted_by');

-- A company described on a listing is a statement about that listing: it becomes evidence with the
-- company's own source type, so "vendor stated" and "verified" stay distinguishable on the app too.
create or replace function public.company_evidence() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c public.companies;
  v_app uuid;
  v_method text;
  v_src text;
begin
  if tg_table_name = 'companies' then
    c := new;
  else
    if new.company_id is null then return null; end if;
    select * into c from public.companies where id = new.company_id;
  end if;
  for v_app in select a.id from public.apps a where a.company_id = c.id and (tg_table_name = 'companies' or a.id = new.id) loop
    -- "vendor stated" needs a verified owner; the same words from anybody else are a user submission
    v_src := case when c.source_type = 'vendor_stated' and not exists (
                    select 1 from public.apps o where o.id = v_app and o.ownership_status = 'verified_owner' and o.developer_id = c.created_by)
                  then 'user_submitted' else c.source_type end;
    v_method := case v_src when 'pwanova_observed' then 'automatic' when 'admin_reviewed' then 'manual' when 'vendor_stated' then 'vendor' else 'community' end;
    if c.name is not null and not exists (
      select 1 from public.app_evidence e where e.app_id = v_app and e.attribute_key = 'company_identified' and e.status = 'current'
        and e.source_type = v_src and e.value_text is not distinct from c.name) then
      insert into public.app_evidence (app_id, attribute_key, value_state, value_text, source_type, verification_method, source_url, source_title, status, submitted_by, verified_at)
      values (v_app, 'company_identified', 'yes', c.name, v_src, v_method, coalesce(c.source_url, c.legal_url), 'Company record',
              case when v_src = 'user_submitted' then 'pending_review' else 'current' end, c.created_by, c.verified_at);
    end if;
    if c.country_code is not null and not exists (
      select 1 from public.app_evidence e where e.app_id = v_app and e.attribute_key = 'company_country' and e.status = 'current'
        and e.source_type = v_src and e.value_text is not distinct from c.country_code) then
      insert into public.app_evidence (app_id, attribute_key, value_state, value_text, source_type, verification_method, source_url, source_title, status, submitted_by, verified_at)
      values (v_app, 'company_country', 'yes', c.country_code, v_src, v_method, coalesce(c.source_url, c.legal_url), 'Company record',
              case when v_src = 'user_submitted' then 'pending_review' else 'current' end, c.created_by, c.verified_at);
    end if;
  end loop;
  return null;
end $$;
create trigger companies_evidence after insert or update of name, country_code, source_type on public.companies
  for each row execute function public.company_evidence();
create trigger apps_company_evidence after insert or update of company_id on public.apps
  for each row execute function public.company_evidence();

-- ---------------------------------------------------------------- observations
-- An automatic observation either confirms what PWANova already saw (same answer, same source:
-- the existing row gets a new confirmation date) or appends a new row that supersedes the old one.
create or replace function public.observe_fact(
  p_app_id uuid, p_key text, p_state text, p_value text, p_source_url text, p_source_title text,
  p_excerpt text default null, p_run_id uuid default null, p_detail jsonb default '{}'::jsonb, p_confidence smallint default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_state not in ('yes', 'no') then return null; end if;
  select e.id into v_id from public.app_evidence e
  where e.app_id = p_app_id and e.attribute_key = p_key and e.status = 'current' and e.source_type = 'pwanova_observed'
    and e.value_state = p_state and e.value_text is not distinct from left(p_value, 500)
    and e.source_url is not distinct from left(p_source_url, 500)
  order by e.collected_at desc limit 1;
  if v_id is not null then
    update public.app_evidence set last_confirmed_at = now(), confirmations = confirmations + 1, run_id = coalesce(p_run_id, run_id)
    where id = v_id;
    return v_id;
  end if;
  insert into public.app_evidence (app_id, attribute_key, value_state, value_text, value_json, source_type, verification_method,
                                   source_url, source_title, evidence_excerpt, confidence, status, run_id, verified_at)
  values (p_app_id, p_key, p_state, left(p_value, 500), coalesce(p_detail, '{}'::jsonb), 'pwanova_observed', 'automatic',
          left(p_source_url, 500), left(p_source_title, 200), left(p_excerpt, 1000), p_confidence, 'current', p_run_id, now())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.observe_fact(uuid, text, text, text, text, text, text, uuid, jsonb, smallint) from public, anon, authenticated;
grant execute on function public.observe_fact(uuid, text, text, text, text, text, text, uuid, jsonb, smallint) to service_role;

-- v1's health check keeps running every day. Its three observations feed the same evidence history.
create or replace function public.checks_to_evidence() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_url text;
begin
  select url into v_url from public.apps where id = new.app_id;
  if new.reachable is not null then
    perform public.observe_fact(new.app_id, 'website_reachable', case when new.reachable then 'yes' else 'no' end, null, v_url, 'Start page');
  end if;
  if new.https_ok is not null then
    perform public.observe_fact(new.app_id, 'https', case when new.https_ok then 'yes' else 'no' end, null, v_url, 'Start page');
  end if;
  if new.manifest_ok is not null then
    perform public.observe_fact(new.app_id, 'pwa_manifest', case when new.manifest_ok then 'yes' else 'no' end, null,
      coalesce(nullif(new.details -> 'evidence' ->> 'manifest', 'No manifest link detected'), v_url), 'Start page');
  end if;
  return null;
end $$;
create trigger app_checks_evidence after insert or update on public.app_checks
  for each row execute function public.checks_to_evidence();

-- "pwa" as a platform follows what PWANova observed, never what somebody typed.
create or replace function public.sync_pwa_platform() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_pwa then
    insert into public.app_platforms (app_id, platform, source_type, verified_at) values (new.id, 'pwa', 'pwanova_observed', now())
    on conflict (app_id, platform) do update set source_type = 'pwanova_observed', verified_at = now();
  else
    delete from public.app_platforms where app_id = new.id and platform = 'pwa' and source_type = 'pwanova_observed';
  end if;
  return null;
end $$;
create trigger apps_pwa_platform after insert or update of is_pwa on public.apps
  for each row execute function public.sync_pwa_platform();

-- ---------------------------------------------------------------- recording a verification run
-- One transaction: the run, its per-check results, the evidence rows and the rebuilt facts.
-- A check that could not be performed writes a result row only, so it can never turn an earlier
-- "yes" into "no": the previous evidence and its date stay exactly as they were.
create or replace function public.record_verification_run(
  p_app_id uuid, p_url text, p_run_type text, p_initiated_by uuid, p_results jsonb, p_error text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a public.apps;
  v_run uuid;
  v_evidence uuid;
  r jsonb;
  v_found int := 0; v_not_found int := 0; v_failed int := 0;
  v_attr text;
begin
  select * into a from public.apps where id = p_app_id for update;
  if not found then raise exception 'Unknown app'; end if;
  if a.url is distinct from p_url then raise exception 'The app URL changed while it was being checked'; end if;

  insert into public.verification_runs (app_id, initiated_by, run_type, status, checked_url, error_summary)
  values (p_app_id, p_initiated_by, p_run_type, 'running', p_url, left(p_error, 500)) returning id into v_run;

  for r in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) loop
    v_evidence := null;
    v_attr := r ->> 'attribute_key';
    if v_attr is not null and not exists (select 1 from public.fact_attributes where key = v_attr) then v_attr := null; end if;

    if r ->> 'outcome' = 'found' then v_found := v_found + 1;
    elsif r ->> 'outcome' = 'not_found' then v_not_found := v_not_found + 1;
    elsif r ->> 'outcome' = 'could_not_check' then v_failed := v_failed + 1; end if;

    -- only a real observation with a definite answer becomes evidence
    if v_attr is not null and r ->> 'outcome' in ('found', 'not_found') and r ->> 'value_state' in ('yes', 'no') then
      v_evidence := public.observe_fact(p_app_id, v_attr, r ->> 'value_state', r ->> 'value_text', r ->> 'source_url', r ->> 'source_title',
                                        r ->> 'excerpt', v_run, coalesce(r -> 'detail', '{}'::jsonb), nullif(r ->> 'confidence', '')::smallint);
    end if;

    insert into public.verification_results (run_id, app_id, check_key, attribute_key, outcome, value_state, value_text, source_url, http_status, detail, evidence_id)
    values (v_run, p_app_id, left(coalesce(r ->> 'check_key', v_attr, 'check'), 60), v_attr, r ->> 'outcome',
            nullif(r ->> 'value_state', ''), left(r ->> 'value_text', 500), left(r ->> 'source_url', 500),
            nullif(r ->> 'http_status', '')::int, coalesce(r -> 'detail', '{}'::jsonb), v_evidence);

    if v_attr is not null then
      insert into public.app_facts (app_id, attribute_key, last_attempt_at, last_attempt_outcome)
      values (p_app_id, v_attr, now(), r ->> 'outcome')
      on conflict (app_id, attribute_key) do update set last_attempt_at = now(), last_attempt_outcome = excluded.last_attempt_outcome;
    end if;
  end loop;

  update public.verification_runs set
    status = case when v_found + v_not_found = 0 then 'failed' when v_failed > 0 then 'partial' else 'completed' end,
    completed_at = now(),
    result_summary = jsonb_build_object('found', v_found, 'not_found', v_not_found, 'could_not_check', v_failed)
  where id = v_run;

  update public.apps set next_check_at = now() + interval '30 days' where id = p_app_id;
  perform public.refresh_app_trust(p_app_id);
  return v_run;
end $$;
revoke all on function public.record_verification_run(uuid, text, text, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.record_verification_run(uuid, text, text, uuid, jsonb, text) to service_role;

-- Moderator decision on a piece of evidence, with the previous and the new value in the audit trail.
-- (audit_logs is created in the platform migration; this function is defined there.)

-- ---------------------------------------------------------------- RLS
alter table public.fact_attributes enable row level security;
alter table public.app_evidence enable row level security;
alter table public.app_facts enable row level security;
alter table public.verification_runs enable row level security;
alter table public.verification_results enable row level security;

create policy fact_attributes_read on public.fact_attributes for select using (true);
create policy fact_attributes_manage on public.fact_attributes for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Public: what is current for a public app. History (superseded rows) is public too: it is the point.
create policy app_evidence_read on public.app_evidence for select using (
  (public.app_is_public(app_id) and status in ('current', 'superseded'))
  or submitted_by = auth.uid() or public.manages_app(app_id) or public.is_moderator());
create policy app_evidence_insert on public.app_evidence for insert to authenticated with check (
  public.is_moderator() or (submitted_by = auth.uid() and (public.app_is_public(app_id) or public.manages_app(app_id))));
create policy app_evidence_update on public.app_evidence for update to authenticated
  using (public.is_moderator() or (submitted_by = auth.uid() and source_type = 'vendor_stated'))
  with check (public.is_moderator() or submitted_by = auth.uid());
-- no delete policy: evidence is never deleted through the API

create policy app_facts_read on public.app_facts for select using (public.app_is_public(app_id) or public.manages_app(app_id) or public.is_moderator());
-- no write policies: rebuilt only by refresh_app_facts()

create policy verification_runs_read on public.verification_runs for select using (public.app_is_public(app_id) or public.manages_app(app_id) or public.is_moderator());
create policy verification_results_read on public.verification_results for select using (public.app_is_public(app_id) or public.manages_app(app_id) or public.is_moderator());
revoke insert, update, delete on public.app_facts, public.verification_runs, public.verification_results from anon, authenticated;
revoke delete on public.app_evidence from anon, authenticated;

-- ---------------------------------------------------------------- attribute registry
insert into public.fact_attributes (key, dimension, value_type, label, positive_label, negative_label, description, is_expected, is_filterable, is_card_signal, auto_checkable, ttl_days, weight, sort_order) values
  -- technical
  ('website_reachable', 'technical', 'boolean', '{"en":"Website reachable","de":"Website erreichbar"}', '{"en":"Website reachable","de":"Website erreichbar"}', '{"en":"Website not reachable","de":"Website nicht erreichbar"}', '{"en":"The listed URL answered the last check.","de":"Die eingetragene URL hat bei der letzten Prüfung geantwortet."}', false, false, false, true, 7, 0, 10),
  ('https', 'technical', 'boolean', '{"en":"HTTPS","de":"HTTPS"}', '{"en":"Served over HTTPS","de":"Über HTTPS ausgeliefert"}', '{"en":"Not served over HTTPS","de":"Nicht über HTTPS ausgeliefert"}', '{"en":"The site is delivered over an encrypted connection. This is not a security audit.","de":"Die Website wird verschlüsselt ausgeliefert. Das ist keine Sicherheitsprüfung."}', true, false, false, true, 30, 1, 20),
  ('pwa_manifest', 'technical', 'boolean', '{"en":"Web app manifest","de":"Web-App-Manifest"}', '{"en":"PWA manifest found","de":"PWA-Manifest gefunden"}', '{"en":"No manifest on the start page","de":"Kein Manifest auf der Startseite"}', '{"en":"A web app manifest is linked from the start page.","de":"Auf der Startseite ist ein Web-App-Manifest verlinkt."}', true, true, true, true, 30, 1, 30),
  ('offline_capable', 'technical', 'boolean', '{"en":"Offline use","de":"Offline-Nutzung"}', '{"en":"Works offline","de":"Offline nutzbar"}', '{"en":"No offline use","de":"Keine Offline-Nutzung"}', '{"en":"Needs a real browser to confirm, so it is reviewed by hand or stated by the vendor.","de":"Lässt sich nur im Browser bestätigen und wird daher manuell geprüft oder vom Anbieter angegeben."}', false, true, false, false, 180, 1, 40),
  ('api_available', 'technical', 'boolean', '{"en":"API","de":"API"}', '{"en":"API available","de":"API verfügbar"}', '{"en":"No public API","de":"Keine öffentliche API"}', '{"en":"A public API is documented.","de":"Eine öffentliche API ist dokumentiert."}', true, true, true, true, 90, 1, 50),
  ('mcp_available', 'technical', 'boolean', '{"en":"MCP","de":"MCP"}', '{"en":"MCP server available","de":"MCP-Server verfügbar"}', '{"en":"No MCP server","de":"Kein MCP-Server"}', '{"en":"A Model Context Protocol server is documented.","de":"Ein Model-Context-Protocol-Server ist dokumentiert."}', false, true, true, true, 90, 1, 60),
  ('open_source', 'technical', 'boolean', '{"en":"Open source","de":"Open Source"}', '{"en":"Open source","de":"Open Source"}', '{"en":"Not open source","de":"Nicht Open Source"}', '{"en":"The source code is published in a public repository.","de":"Der Quellcode ist in einem öffentlichen Repository veröffentlicht."}', true, true, true, false, 180, 1, 70),
  ('self_hosted', 'technical', 'boolean', '{"en":"Self-hosting","de":"Self-Hosting"}', '{"en":"Can be self-hosted","de":"Selbst hostbar"}', '{"en":"No self-hosting","de":"Kein Self-Hosting"}', '{"en":"The product can run on your own infrastructure.","de":"Das Produkt kann auf eigener Infrastruktur betrieben werden."}', false, true, true, false, 180, 1, 80),
  ('sso', 'technical', 'boolean', '{"en":"Single sign-on","de":"Single Sign-on"}', '{"en":"SSO available","de":"SSO verfügbar"}', '{"en":"No SSO","de":"Kein SSO"}', '{}', false, true, false, false, 180, 1, 90),
  ('security_txt', 'technical', 'boolean', '{"en":"security.txt","de":"security.txt"}', '{"en":"security.txt published","de":"security.txt veröffentlicht"}', '{"en":"No security.txt","de":"Keine security.txt"}', '{"en":"A security contact is published at /.well-known/security.txt.","de":"Unter /.well-known/security.txt ist ein Sicherheitskontakt veröffentlicht."}', false, false, false, true, 90, 1, 100),
  -- company
  ('company_identified', 'company', 'boolean', '{"en":"Company identified","de":"Unternehmen benannt"}', '{"en":"Company identified","de":"Unternehmen benannt"}', '{"en":"No company named","de":"Kein Unternehmen genannt"}', '{"en":"The operator names the company behind the product.","de":"Der Betreiber nennt das Unternehmen hinter dem Produkt."}', true, false, false, false, 365, 2, 200),
  ('company_country', 'company', 'country', '{"en":"Company country","de":"Sitz des Unternehmens"}', '{}', '{}', '{"en":"Country where the operating company is registered.","de":"Land, in dem das betreibende Unternehmen registriert ist."}', true, true, true, false, 365, 2, 210),
  ('eu_company', 'company', 'boolean', '{"en":"EU company","de":"EU-Unternehmen"}', '{"en":"EU company","de":"EU-Unternehmen"}', '{"en":"Company outside the EU","de":"Unternehmen außerhalb der EU"}', '{"en":"The operating company is registered in an EU member state. Switzerland, Norway and the UK are not EU members.","de":"Das betreibende Unternehmen ist in einem EU-Mitgliedstaat registriert. Die Schweiz, Norwegen und das Vereinigte Königreich sind keine EU-Mitglieder."}', false, true, true, false, 365, 0, 220),
  ('legal_notice', 'company', 'url', '{"en":"Legal notice","de":"Impressum"}', '{"en":"Legal notice found","de":"Impressum gefunden"}', '{"en":"No legal notice found","de":"Kein Impressum gefunden"}', '{"en":"A legal notice or imprint page is published.","de":"Eine Impressumsseite ist veröffentlicht."}', true, false, false, true, 90, 2, 230),
  ('contact_available', 'company', 'url', '{"en":"Contact","de":"Kontakt"}', '{"en":"Contact found","de":"Kontakt gefunden"}', '{"en":"No contact found","de":"Kein Kontakt gefunden"}', '{}', false, false, false, true, 90, 1, 240),
  -- data
  ('privacy_policy', 'data', 'url', '{"en":"Privacy policy","de":"Datenschutzerklärung"}', '{"en":"Privacy policy found","de":"Datenschutzerklärung gefunden"}', '{"en":"No privacy policy found","de":"Keine Datenschutzerklärung gefunden"}', '{"en":"A privacy policy is published. PWANova does not assess its content.","de":"Eine Datenschutzerklärung ist veröffentlicht. PWANova bewertet ihren Inhalt nicht."}', true, true, false, true, 90, 2, 300),
  ('terms_of_service', 'data', 'url', '{"en":"Terms","de":"Nutzungsbedingungen"}', '{"en":"Terms found","de":"Nutzungsbedingungen gefunden"}', '{"en":"No terms found","de":"Keine Nutzungsbedingungen gefunden"}', '{}', false, false, false, true, 90, 1, 310),
  ('dpa_available', 'data', 'url', '{"en":"Data processing agreement","de":"Auftragsverarbeitungsvertrag"}', '{"en":"DPA available","de":"AVV verfügbar"}', '{"en":"No DPA published","de":"Kein AVV veröffentlicht"}', '{"en":"A data processing agreement is published or offered.","de":"Ein Auftragsverarbeitungsvertrag ist veröffentlicht oder wird angeboten."}', true, true, true, true, 90, 2, 320),
  ('subprocessors_published', 'data', 'url', '{"en":"Subprocessors","de":"Unterauftragsverarbeiter"}', '{"en":"Subprocessors published","de":"Unterauftragsverarbeiter veröffentlicht"}', '{"en":"No subprocessor list","de":"Keine Liste der Unterauftragsverarbeiter"}', '{"en":"A list of subprocessors is published.","de":"Eine Liste der Unterauftragsverarbeiter ist veröffentlicht."}', true, true, false, true, 90, 2, 330),
  ('eu_hosting_available', 'data', 'boolean', '{"en":"EU hosting","de":"EU-Hosting"}', '{"en":"EU hosting available","de":"EU-Hosting verfügbar"}', '{"en":"No EU hosting option","de":"Keine EU-Hosting-Option"}', '{"en":"The vendor documents an option to store customer data in the EU.","de":"Der Anbieter dokumentiert eine Option, Kundendaten in der EU zu speichern."}', true, true, true, false, 180, 2, 340),
  ('retention_documented', 'data', 'boolean', '{"en":"Retention information","de":"Angaben zur Speicherdauer"}', '{"en":"Retention documented","de":"Speicherdauer dokumentiert"}', '{"en":"Retention not documented","de":"Speicherdauer nicht dokumentiert"}', '{}', false, false, false, false, 180, 1, 350),
  ('no_training_on_customer_data', 'data', 'boolean', '{"en":"Training on customer data","de":"Training mit Kundendaten"}', '{"en":"No training on customer data","de":"Kein Training mit Kundendaten"}', '{"en":"Customer data may be used for training","de":"Kundendaten können zum Training verwendet werden"}', '{"en":"According to the vendor documentation, customer data is not used to train models.","de":"Laut Dokumentation des Anbieters werden Kundendaten nicht zum Training von Modellen verwendet."}', false, true, true, false, 180, 2, 360),
  -- ai
  ('ai_used', 'ai', 'boolean', '{"en":"Uses AI","de":"Nutzt KI"}', '{"en":"Uses AI","de":"Nutzt KI"}', '{"en":"Does not use AI","de":"Nutzt keine KI"}', '{}', false, true, false, false, 180, 0, 400),
  ('ai_provider_disclosed', 'ai', 'boolean', '{"en":"AI provider disclosed","de":"KI-Anbieter offengelegt"}', '{"en":"AI provider disclosed","de":"KI-Anbieter offengelegt"}', '{"en":"AI provider not disclosed","de":"KI-Anbieter nicht offengelegt"}', '{}', false, false, false, false, 180, 1, 410),
  ('ai_transparency_info', 'ai', 'url', '{"en":"AI transparency information","de":"Informationen zur KI-Transparenz"}', '{"en":"AI transparency information found","de":"Informationen zur KI-Transparenz gefunden"}', '{"en":"No AI transparency information","de":"Keine Informationen zur KI-Transparenz"}', '{"en":"The vendor publishes how AI is used. This is not an assessment under the EU AI Act.","de":"Der Anbieter veröffentlicht, wie KI eingesetzt wird. Das ist keine Bewertung nach dem EU AI Act."}', false, false, false, true, 180, 1, 420),
  -- product
  ('pricing_page', 'product', 'url', '{"en":"Pricing page","de":"Preisseite"}', '{"en":"Pricing published","de":"Preise veröffentlicht"}', '{"en":"No public pricing","de":"Keine öffentlichen Preise"}', '{}', true, false, false, true, 60, 1, 500),
  ('free_plan', 'product', 'boolean', '{"en":"Free plan","de":"Kostenloser Tarif"}', '{"en":"Free plan","de":"Kostenloser Tarif"}', '{"en":"No free plan","de":"Kein kostenloser Tarif"}', '{}', false, true, true, false, 60, 0, 510),
  ('german_available', 'product', 'boolean', '{"en":"German available","de":"Auf Deutsch verfügbar"}', '{"en":"German available","de":"Auf Deutsch verfügbar"}', '{"en":"Not available in German","de":"Nicht auf Deutsch verfügbar"}', '{}', false, true, true, true, 180, 0, 520),
  ('source_repository', 'product', 'url', '{"en":"Source repository","de":"Quellcode-Repository"}', '{"en":"Repository linked","de":"Repository verlinkt"}', '{"en":"No repository linked","de":"Kein Repository verlinkt"}', '{}', false, false, false, true, 180, 0, 530),
  ('api_docs', 'product', 'url', '{"en":"API documentation","de":"API-Dokumentation"}', '{"en":"API documentation found","de":"API-Dokumentation gefunden"}', '{"en":"No API documentation found","de":"Keine API-Dokumentation gefunden"}', '{}', false, false, false, true, 90, 0, 540),
  ('changelog', 'product', 'url', '{"en":"Changelog","de":"Änderungsprotokoll"}', '{"en":"Changelog published","de":"Änderungsprotokoll veröffentlicht"}', '{"en":"No changelog found","de":"Kein Änderungsprotokoll gefunden"}', '{}', false, false, false, true, 90, 0, 550);

-- ---------------------------------------------------------------- backfill from what v1 already observed
-- v1 stored its own HTTPS / manifest observations in app_checks. They become first-class evidence
-- with their original check date. Anything v1 did not know stays unknown.
insert into public.app_evidence (app_id, attribute_key, value_state, source_type, verification_method, source_url, source_title, status, collected_at, verified_at)
select c.app_id, 'https', case when c.https_ok then 'yes' else 'no' end, 'pwanova_observed', 'automatic', a.url, 'Start page', 'current', c.last_checked_at, c.last_checked_at
from public.app_checks c join public.apps a on a.id = c.app_id where c.https_ok is not null;
insert into public.app_evidence (app_id, attribute_key, value_state, source_type, verification_method, source_url, source_title, status, collected_at, verified_at)
select c.app_id, 'pwa_manifest', case when c.manifest_ok then 'yes' else 'no' end, 'pwanova_observed', 'automatic',
       coalesce(nullif(c.details -> 'evidence' ->> 'manifest', 'No manifest link detected'), a.url), 'Start page', 'current', c.last_checked_at, c.last_checked_at
from public.app_checks c join public.apps a on a.id = c.app_id where c.manifest_ok is not null;
insert into public.app_evidence (app_id, attribute_key, value_state, source_type, verification_method, source_url, source_title, status, collected_at, verified_at)
select c.app_id, 'website_reachable', case when c.reachable then 'yes' else 'no' end, 'pwanova_observed', 'automatic', a.url, 'Start page', 'current', c.last_checked_at, c.last_checked_at
from public.app_checks c join public.apps a on a.id = c.app_id where c.reachable is not null;
