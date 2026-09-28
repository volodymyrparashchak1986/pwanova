-- PWANova V2 — search and catalogue. Additive only.
-- PostgreSQL full-text search + trigram similarity. No external search service.
--
-- Weights: A name, aliases · B tagline, use cases · C description, categories, integrations ·
--          D domain, company, host, confirmed capabilities.
-- Organic order uses relevance, evidence, freshness, profile completeness and real engagement.
-- Nothing paid is part of it; sponsored placements are separate rows in separate surfaces.

create or replace function public.refresh_app_search(p_app_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  a public.apps;
  v_aliases text; v_use_cases text; v_categories text; v_integrations text;
  v_de_tagline text; v_de_description text; v_company text; v_capabilities text;
begin
  select * into a from public.apps where id = p_app_id;
  if not found then return; end if;
  v_aliases := array_to_string(a.aliases, ' ');
  select string_agg(concat_ws(' ', u.name ->> 'en', u.name ->> 'de'), ' ') into v_use_cases
    from public.app_use_cases au join public.use_cases u on u.id = au.use_case_id where au.app_id = p_app_id;
  select string_agg(concat_ws(' ', c.name ->> 'en', c.name ->> 'de'), ' ') into v_categories
    from public.app_categories ac join public.categories c on c.id = ac.category_id where ac.app_id = p_app_id;
  select string_agg(i.name, ' ') into v_integrations
    from public.app_integrations ai join public.integration_catalog i on i.id = ai.integration_id where ai.app_id = p_app_id;
  select t.tagline, t.description into v_de_tagline, v_de_description
    from public.app_translations t where t.app_id = p_app_id and t.locale = 'de';
  select c.name into v_company from public.companies c where c.id = a.company_id;
  select string_agg(concat_ws(' ', fa.positive_label ->> 'en', fa.positive_label ->> 'de'), ' ') into v_capabilities
    from public.app_facts f join public.fact_attributes fa on fa.key = f.attribute_key
    where f.app_id = p_app_id and f.effective_state = 'yes' and fa.value_type = 'boolean';

  update public.apps set
    search_vector =
      setweight(to_tsvector('simple', unaccent(concat_ws(' ', a.name, v_aliases))), 'A')
      || setweight(to_tsvector('english', unaccent(concat_ws(' ', a.tagline, v_use_cases))), 'B')
      || setweight(to_tsvector('german', unaccent(coalesce(v_de_tagline, ''))), 'B')
      || setweight(to_tsvector('english', unaccent(concat_ws(' ', a.description, v_categories, v_integrations))), 'C')
      || setweight(to_tsvector('german', unaccent(coalesce(v_de_description, ''))), 'C')
      || setweight(to_tsvector('simple', unaccent(concat_ws(' ', a.domain, v_company, a.hosting_provider, v_capabilities))), 'D'),
    search_text = lower(unaccent(concat_ws(' ', a.name, v_aliases, a.tagline, v_use_cases, v_categories)))
  where id = p_app_id;
end $$;
revoke all on function public.refresh_app_search(uuid) from public, anon, authenticated;
grant execute on function public.refresh_app_search(uuid) to service_role;

create or replace function public.app_search_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'apps' then
    perform public.refresh_app_search(new.id);
  elsif tg_op = 'DELETE' then
    perform public.refresh_app_search(old.app_id);
  else
    perform public.refresh_app_search(new.app_id);
  end if;
  return null;
end $$;

create trigger apps_search after insert or update of name, tagline, description, aliases, company_id, domain on public.apps
  for each row execute function public.app_search_trigger();
create trigger app_translations_search after insert or update or delete on public.app_translations
  for each row execute function public.app_search_trigger();
create trigger app_categories_search after insert or update or delete on public.app_categories
  for each row execute function public.app_search_trigger();
create trigger app_use_cases_search after insert or delete on public.app_use_cases
  for each row execute function public.app_search_trigger();
create trigger app_integrations_search after insert or delete on public.app_integrations
  for each row execute function public.app_search_trigger();
create trigger app_facts_search after insert or update of verified_state, vendor_state on public.app_facts
  for each row execute function public.app_search_trigger();

create index apps_search_vector_idx on public.apps using gin (search_vector);
create index apps_search_text_trgm_idx on public.apps using gin (search_text extensions.gin_trgm_ops);

-- ---------------------------------------------------------------- catalogue view
-- One row per published, non-duplicate listing with everything a card, a filter or a comparison needs.
-- It runs with the owner's rights on purpose (like apps_public): the aggregates read tables that RLS
-- hides, and the projection below is explicit so no private column can slip in.
create or replace view public.catalog_apps as
select
  ap.id, ap.slug, ap.name, ap.tagline, ap.description, ap.url, ap.domain, ap.icon_url, ap.category, ap.status,
  ap.developer_id, ap.developer_username, ap.developer_name, ap.developer_avatar,
  ap.ownership_status, ap.ownership_verified_at, ap.ownership_method,
  ap.is_pwa, ap.hosting_provider, ap.build_tool, ap.health_status, ap.health_checked_at,
  ap.is_featured, ap.featured_at, ap.is_demo, ap.created_at, ap.updated_at,
  ap.rating, ap.ratings_count, ap.reviews_count, ap.favorites_count, ap.opens_7d, ap.opens_30d, ap.install_actions,
  (select count(*)::int from public.follows fo where fo.app_id = a.id) as followers_count,
  (select count(*)::int from public.app_updates up where up.app_id = a.id and up.status = 'published') as updates_count,
  ap.ranking_score, ap.trending_score, ap.launch_source_name, ap.launch_source_type, ap.launch_source_url,
  a.content_locale, a.aliases,
  tr.tagline as tagline_de, tr.description as description_de,
  pc.id as category_id, pc.slug as category_slug, pc.name as category_name,
  co.id as company_id, co.slug as company_slug, co.name as company_name, co.country_code as company_country,
  case when co.country_code is null then null else public.is_eu_country(co.country_code) end as company_in_eu,
  co.source_type as company_source_type,
  a.pricing_model, a.has_free_plan, a.has_free_trial, a.starting_price_cents, a.price_currency,
  a.verification_state, a.evidence_score, a.evidence_checked_at, a.profile_completeness,
  coalesce(f.facts, '{}'::jsonb) as facts,
  coalesce(f.facts_yes, '{}'::text[]) as facts_yes,
  coalesce(f.facts_verified_yes, '{}'::text[]) as facts_verified_yes,
  coalesce(l.languages, '{}'::text[]) as languages,
  coalesce(p.platforms, '{}'::text[]) as platforms,
  coalesce(i.integrations, '{}'::text[]) as integrations,
  coalesce(u.use_cases, '{}'::text[]) as use_cases,
  coalesce(c.category_slugs, '{}'::text[]) as category_slugs,
  a.search_vector, a.search_text as search_norm,
  -- organic order: evidence 30%, engagement 25%, profile 20%, rating 15%, freshness 10%
  (0.30 * a.evidence_score / 100.0
   + 0.25 * least(1.0, ln(1 + ap.opens_30d + 3 * ap.favorites_count + 5 * ap.reviews_count) / ln(501.0))
   + 0.20 * a.profile_completeness / 100.0
   + 0.15 * case when ap.ratings_count > 0 then least(1.0, ap.ranking_score / 5.0) else 0 end
   + 0.10 * case when a.evidence_checked_at is null then 0
                 else greatest(0, 1 - extract(epoch from (now() - a.evidence_checked_at)) / (180 * 86400.0)) end
  )::real as organic_score
from public.apps_public ap
join public.apps a on a.id = ap.id
left join public.categories pc on pc.id = a.primary_category_id
left join public.companies co on co.id = a.company_id
left join public.app_translations tr on tr.app_id = a.id and tr.locale = 'de'
left join lateral (
  select jsonb_object_agg(x.attribute_key, jsonb_build_object(
           'state', x.effective_state, 'source', x.effective_source, 'value', coalesce(x.verified_value, x.vendor_value),
           'checked_at', x.verified_at, 'stated_at', x.vendor_stated_at)) as facts,
         array_agg(x.attribute_key) filter (where x.effective_state = 'yes') as facts_yes,
         array_agg(x.attribute_key) filter (where x.verified_state = 'yes') as facts_verified_yes
  from public.app_facts x where x.app_id = a.id and x.effective_source <> 'none') f on true
left join lateral (select array_agg(x.language_code order by x.language_code) as languages
                   from public.app_languages x where x.app_id = a.id and x.source_type <> 'user_submitted') l on true
left join lateral (select array_agg(x.platform order by x.platform) as platforms
                   from public.app_platforms x where x.app_id = a.id and x.source_type <> 'user_submitted') p on true
left join lateral (select array_agg(ic.slug order by ic.slug) as integrations
                   from public.app_integrations x join public.integration_catalog ic on ic.id = x.integration_id
                   where x.app_id = a.id and x.source_type <> 'user_submitted') i on true
left join lateral (select array_agg(uc.slug order by uc.slug) as use_cases
                   from public.app_use_cases x join public.use_cases uc on uc.id = x.use_case_id where x.app_id = a.id) u on true
left join lateral (select array_agg(cc.slug order by x.is_primary desc, cc.slug) as category_slugs
                   from public.app_categories x join public.categories cc on cc.id = x.category_id where x.app_id = a.id) c on true
where a.duplicate_of is null;
grant select on public.catalog_apps to anon, authenticated, service_role;

-- ---------------------------------------------------------------- search
-- Returns ranked ids; the caller loads the rows from catalog_apps. Facets combine with AND,
-- values inside one facet with OR, except trust facts: every selected fact must be "yes".
create or replace function public.search_catalog(
  p_query text default null, p_filters jsonb default '{}'::jsonb, p_sort text default 'relevance',
  p_limit int default 24, p_offset int default 0
) returns table (app_id uuid, score real, total bigint)
language sql stable set search_path = public, extensions as $$
  with input as (
    select nullif(trim(left(coalesce(p_query, ''), 120)), '') as raw,
           coalesce(p_filters, '{}'::jsonb) as f
  ), q as (
    select i.raw, i.f, lower(unaccent(i.raw)) as norm,
           case when i.raw is null then null else
             websearch_to_tsquery('simple', unaccent(i.raw))
             || websearch_to_tsquery('english', unaccent(i.raw))
             || websearch_to_tsquery('german', unaccent(i.raw)) end as tsq
    from input i
  ), matched as (
    select c.id,
      case when q.raw is null then 0 else
        2.0 * ts_rank_cd(c.search_vector, q.tsq, 32)
        + word_similarity(q.norm, coalesce(c.search_norm, ''))
        + case when lower(c.name) = q.norm then 2 when lower(c.name) like q.norm || '%' then 1 else 0 end
      end as relevance,
      c.organic_score, c.ranking_score, c.trending_score, c.created_at, c.evidence_checked_at, c.name
    from public.catalog_apps c cross join q
    where (coalesce((q.f ->> 'demo')::boolean, false) or not c.is_demo)
      and (q.raw is null
           or c.search_vector @@ q.tsq
           or word_similarity(q.norm, coalesce(c.search_norm, '')) > 0.45
           or similarity(lower(c.name), q.norm) > 0.3)
      and (not q.f ? 'categories' or c.category_slugs && array(select jsonb_array_elements_text(q.f -> 'categories')))
      and (not q.f ? 'use_cases' or c.use_cases && array(select jsonb_array_elements_text(q.f -> 'use_cases')))
      and (not q.f ? 'integrations' or c.integrations && array(select jsonb_array_elements_text(q.f -> 'integrations')))
      and (not q.f ? 'languages' or c.languages && array(select jsonb_array_elements_text(q.f -> 'languages')))
      and (not q.f ? 'platforms' or c.platforms && array(select jsonb_array_elements_text(q.f -> 'platforms')))
      and (not q.f ? 'pricing_models' or c.pricing_model = any (array(select jsonb_array_elements_text(q.f -> 'pricing_models'))))
      and (not q.f ? 'countries' or c.company_country = any (array(select jsonb_array_elements_text(q.f -> 'countries'))))
      and (not q.f ? 'hosts' or c.hosting_provider = any (array(select jsonb_array_elements_text(q.f -> 'hosts'))))
      and (not q.f ? 'facts' or (case when coalesce((q.f ->> 'verified_only')::boolean, false) then c.facts_verified_yes else c.facts_yes end)
                                  @> array(select jsonb_array_elements_text(q.f -> 'facts')))
      and (not coalesce((q.f ->> 'eu_company')::boolean, false) or c.company_in_eu is true)
      and (not coalesce((q.f ->> 'free_plan')::boolean, false) or c.has_free_plan is true)
      and (not coalesce((q.f ->> 'free_trial')::boolean, false) or c.has_free_trial is true)
      and (not coalesce((q.f ->> 'owner_verified')::boolean, false) or c.ownership_status = 'verified_owner')
      and (not q.f ? 'min_rating' or (c.ratings_count > 0 and c.rating >= (q.f ->> 'min_rating')::numeric))
      and (not q.f ? 'verification' or c.verification_state = any (array(select jsonb_array_elements_text(q.f -> 'verification'))))
      and (not q.f ? 'checked_within_days' or c.evidence_checked_at > now() - make_interval(days => least(3650, greatest(1, (q.f ->> 'checked_within_days')::int))))
      and (not q.f ? 'developer_id' or c.developer_id = (q.f ->> 'developer_id')::uuid)
  )
  select m.id,
         (m.relevance + case when p_sort = 'relevance' then 0.5 * m.organic_score else 0 end)::real as score,
         count(*) over () as total
  from matched m
  order by
    case when p_sort = 'new' then extract(epoch from m.created_at) end desc nulls last,
    case when p_sort = 'recently_verified' then extract(epoch from m.evidence_checked_at) end desc nulls last,
    case when p_sort = 'rating' then m.ranking_score end desc nulls last,
    case when p_sort = 'trending' then m.trending_score end desc nulls last,
    case when p_sort = 'name' then lower(m.name) end asc nulls last,
    (m.relevance + 0.5 * m.organic_score) desc,
    m.id
  limit least(100, greatest(1, coalesce(p_limit, 24))) offset greatest(0, coalesce(p_offset, 0));
$$;
revoke all on function public.search_catalog(text, jsonb, text, int, int) from public;
grant execute on function public.search_catalog(text, jsonb, text, int, int) to anon, authenticated, service_role;

-- refresh_app_trust() also refreshes the search document, because confirmed capabilities are searchable
create or replace function public.refresh_app_trust(p_app_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_score smallint := public.compute_evidence_score(p_app_id);
  v_profile smallint := public.compute_profile_completeness(p_app_id);
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
    evidence_score = v_score, evidence_checked_at = v_checked, verification_state = v_state, profile_completeness = v_profile
  where id = p_app_id
    and (evidence_score, evidence_checked_at, verification_state, profile_completeness) is distinct from (v_score, v_checked, v_state, v_profile);
end $$;

-- ---------------------------------------------------------------- backfill
do $$
declare r record;
begin
  for r in select id from public.apps loop
    perform public.refresh_app_facts(r.id);
    perform public.refresh_app_trust(r.id);
    perform public.refresh_app_search(r.id);
  end loop;
end $$;
