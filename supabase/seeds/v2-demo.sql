-- PWANova V2: sample trust data for LOCAL DEVELOPMENT ONLY.
--
-- Loaded by `supabase db reset --local` after seed.sql (see supabase/config.toml). It only ever touches
-- listings that are already marked is_demo = true: fabricated products on .example domains that are
-- excluded from every public list, from search, from the sitemap and from structured data.
-- It is never applied to production: production is migrated with `supabase db push`, which does not seed.

do $$
declare
  a record;
  v_company uuid;
  v_n int := 0;
  v_results jsonb;
  v_owner uuid;
  companies jsonb := '{
    "novalabs":     {"slug": "demo-nova-labs",   "name": "Nova Labs GmbH (demo)",  "country": "DE", "city": "Berlin"},
    "kite-studio":  {"slug": "demo-kite-studio", "name": "Kite Studio B.V. (demo)", "country": "NL", "city": "Utrecht"},
    "marina-dev":   {"slug": "demo-marina-dev",  "name": "Marina Dev S.L. (demo)",  "country": "ES", "city": "Valencia"},
    "driftworks":   {"slug": "demo-driftworks",  "name": "Driftworks Inc. (demo)",  "country": "US", "city": "Austin"},
    "pixelforge":   {"slug": "demo-pixelforge",  "name": "PixelForge AG (demo)",    "country": "CH", "city": "Zürich"}
  }'::jsonb;
  c jsonb;
begin
  for a in
    select x.id, x.slug, x.url, x.ownership_status, x.developer_id, p.username
    from public.apps x left join public.profiles p on p.id = x.developer_id
    where x.is_demo order by x.slug
  loop
    v_n := v_n + 1;
    v_owner := a.developer_id;
    c := companies -> a.username;

    -- company: stated by the (demo) owner; oak-and-ember deliberately has none, to show "not verified"
    if c is not null then
      insert into public.companies (slug, name, country_code, city, website, source_type, created_by)
      values (c ->> 'slug', c ->> 'name', c ->> 'country', c ->> 'city', a.url, 'vendor_stated', v_owner)
      on conflict (slug) do update set name = excluded.name
      returning id into v_company;
    else
      v_company := null;
    end if;

    update public.apps set
      company_id = v_company,
      pricing_model = (array['freemium', 'subscription', 'free', 'open_source', 'one_time', 'unknown'])[1 + v_n % 6],
      has_free_plan = case v_n % 6 when 0 then true when 2 then true when 3 then true when 5 then null else false end,
      has_free_trial = case when v_n % 3 = 0 then true when v_n % 3 = 1 then null else false end,
      starting_price_cents = case v_n % 6 when 0 then 900 when 1 then 1900 when 4 then 4900 else null end,
      price_currency = case when v_n % 6 in (0, 1, 4) then 'EUR' else null end,
      content_locale = 'en'
    where id = a.id;

    if v_n % 2 = 0 then
      insert into public.app_translations (app_id, locale, tagline, description, source, updated_by)
      values (a.id, 'de', 'Beispieleintrag: ' || a.slug, 'Dies ist ein erfundener Beispieleintrag für die lokale Entwicklung. Die Website existiert nicht, und alle Angaben dienen nur dazu, die Oberfläche mit Daten zu füllen.', 'maker', v_owner)
      on conflict do nothing;
    end if;

    insert into public.app_languages (app_id, language_code, source_type, created_by) values (a.id, 'en', 'vendor_stated', v_owner) on conflict do nothing;
    if v_n % 2 = 0 then insert into public.app_languages (app_id, language_code, source_type, created_by) values (a.id, 'de', 'vendor_stated', v_owner) on conflict do nothing; end if;
    if v_n % 3 = 0 then insert into public.app_platforms (app_id, platform, source_type, created_by) values (a.id, 'ios', 'vendor_stated', v_owner), (a.id, 'android', 'vendor_stated', v_owner) on conflict do nothing; end if;

    insert into public.app_integrations (app_id, integration_id, source_type, created_by)
    select a.id, i.id, 'vendor_stated', v_owner from public.integration_catalog i where i.is_active order by i.slug offset (v_n % 5) limit 3
    on conflict do nothing;

    insert into public.app_use_cases (app_id, use_case_id)
    select a.id, u.id from public.use_cases u join public.apps x on x.id = a.id where u.category_id = x.primary_category_id order by u.slug limit 2
    on conflict do nothing;

    -- what an automatic run would have found. A third of the listings has no run at all: "unverified".
    if v_n % 3 <> 2 then
      v_results := jsonb_build_array(
        jsonb_build_object('check_key', 'website_reachable', 'attribute_key', 'website_reachable', 'outcome', 'found', 'value_state', 'yes', 'source_url', a.url, 'source_title', 'Start page', 'http_status', 200),
        jsonb_build_object('check_key', 'https', 'attribute_key', 'https', 'outcome', 'found', 'value_state', 'yes', 'source_url', a.url, 'source_title', 'Start page', 'http_status', 200),
        jsonb_build_object('check_key', 'privacy_policy', 'attribute_key', 'privacy_policy', 'outcome', 'found', 'value_state', 'yes', 'value_text', a.url || '/privacy', 'source_url', a.url || '/privacy', 'source_title', 'Privacy policy', 'excerpt', 'This privacy policy explains which personal data we process.', 'http_status', 200),
        jsonb_build_object('check_key', 'legal_notice', 'attribute_key', 'legal_notice', 'outcome', case when v_n % 4 = 0 then 'not_found' else 'found' end, 'value_state', case when v_n % 4 = 0 then null else 'yes' end, 'value_text', a.url || '/imprint', 'source_url', a.url || '/imprint', 'source_title', 'Legal notice', 'http_status', 200),
        jsonb_build_object('check_key', 'pricing_page', 'attribute_key', 'pricing_page', 'outcome', 'found', 'value_state', 'yes', 'value_text', a.url || '/pricing', 'source_url', a.url || '/pricing', 'source_title', 'Pricing', 'http_status', 200),
        jsonb_build_object('check_key', 'security_txt', 'attribute_key', 'security_txt', 'outcome', 'not_found', 'value_state', 'no', 'source_url', a.url || '/.well-known/security.txt', 'http_status', 404),
        jsonb_build_object('check_key', 'dpa_available', 'attribute_key', 'dpa_available', 'outcome', case when v_n % 5 = 0 then 'found' else 'not_found' end, 'value_state', case when v_n % 5 = 0 then 'yes' else null end, 'value_text', a.url || '/dpa', 'source_url', a.url || '/dpa', 'source_title', 'Data processing agreement', 'http_status', 200),
        jsonb_build_object('check_key', 'subprocessors_published', 'attribute_key', 'subprocessors_published', 'outcome', 'could_not_check', 'source_url', a.url || '/subprocessors', 'http_status', 503),
        jsonb_build_object('check_key', 'api_docs', 'attribute_key', 'api_docs', 'outcome', case when v_n % 2 = 0 then 'found' else 'not_found' end, 'value_state', case when v_n % 2 = 0 then 'yes' else null end, 'value_text', a.url || '/docs/api', 'source_url', a.url || '/docs/api', 'source_title', 'API reference', 'http_status', 200),
        jsonb_build_object('check_key', 'api_available', 'attribute_key', 'api_available', 'outcome', case when v_n % 2 = 0 then 'found' else 'not_found' end, 'value_state', case when v_n % 2 = 0 then 'yes' else null end, 'source_url', a.url || '/docs/api', 'source_title', 'API reference', 'http_status', 200)
      );
      perform public.record_verification_run(a.id, a.url, 'scheduled', null, v_results, null);
    end if;

    -- statements of verified (demo) owners: shown as "stated by the vendor", never as verified
    if a.ownership_status = 'verified_owner' then
      insert into public.app_evidence (app_id, attribute_key, value_state, value_text, source_type, verification_method, source_url, source_title, status, submitted_by)
      select a.id, s.key, s.state, s.value, 'vendor_stated', 'vendor', s.url, null, 'current', v_owner
      from (values
        ('eu_hosting_available', case when v_n % 4 = 1 then 'no' else 'yes' end, null, a.url || '/security'),
        ('no_training_on_customer_data', 'yes', null, a.url || '/ai'),
        ('ai_used', case when v_n % 2 = 0 then 'yes' else 'no' end, null, a.url || '/ai'),
        ('dpa_available', 'yes', a.url || '/dpa', a.url || '/dpa'),
        ('open_source', case when v_n % 6 = 3 then 'yes' else 'no' end, null, null),
        ('free_plan', case when v_n % 6 in (0, 2, 3) then 'yes' else 'no' end, null, a.url || '/pricing')
      ) as s(key, state, value, url)
      where v_n % 5 <> 4 or s.key in ('eu_hosting_available', 'ai_used');

      insert into public.pricing_plans (app_id, name, billing_interval, price_cents, currency, per_user, description, sort_order, source_type, source_url, created_by) values
        (a.id, 'Starter', 'free', 0, 'EUR', false, 'For one person.', 1, 'vendor_stated', a.url || '/pricing', v_owner),
        (a.id, 'Team', 'month', 900 + 1000 * (v_n % 3), 'EUR', true, 'Shared workspaces and roles.', 2, 'vendor_stated', a.url || '/pricing', v_owner),
        (a.id, 'Business', 'custom', null, null, false, 'Single sign-on and a data processing agreement.', 3, 'vendor_stated', a.url || '/pricing', v_owner);

      insert into public.app_data_locations (app_id, region, country_code, description, is_default, source_type, source_url, created_by)
      values (a.id, case when v_n % 4 = 1 then 'us' else 'eu' end, case when v_n % 4 = 1 then 'US' else 'DE' end, 'Primary database', true, 'vendor_stated', a.url || '/security', v_owner);
      insert into public.app_subprocessors (app_id, name, purpose, country_code, source_type, source_url, created_by)
      values (a.id, 'Example Cloud (demo)', 'Hosting', 'DE', 'vendor_stated', a.url || '/subprocessors', v_owner);
      if v_n % 2 = 0 then
        insert into public.app_ai_providers (app_id, provider, model_name, purpose, source_type, source_url, created_by)
        values (a.id, 'Example AI (demo)', null, 'Summaries', 'vendor_stated', a.url || '/ai', v_owner);
      end if;
      insert into public.app_alternatives (app_id, alternative_to_slug, alternative_to_name, source_type, created_by)
      values (a.id, case when v_n % 2 = 0 then 'example-suite' else 'sample-cloud' end, case when v_n % 2 = 0 then 'Example Suite' else 'Sample Cloud' end, 'vendor_stated', v_owner)
      on conflict do nothing;
      insert into public.app_updates (app_id, author_id, kind, title, body, version, status, published_at)
      values (a.id, v_owner, 'feature', 'Shared workspaces', 'Invite colleagues and work on the same data.', '2.' || v_n, 'published', now() - make_interval(days => v_n));
    end if;
  end loop;

  -- one reviewed answer, to show "reviewed by PWANova" next to a vendor statement that says something else
  insert into public.app_evidence (app_id, attribute_key, value_state, source_type, verification_method, source_url, source_title, evidence_excerpt, status, verified_at, review_note)
  select id, 'eu_hosting_available', 'yes', 'admin_reviewed', 'manual', url || '/security', 'Security overview', 'Customer data is stored in data centres in Frankfurt.', 'current', now() - interval '3 days', 'Demo: read by a moderator.'
  from public.apps where is_demo and slug = 'budgetly';

  -- two launches in their window and one earlier launch
  insert into public.launches (app_id, slug, headline, description, headline_de, launch_date, status, submitted_by, window_start, window_end, approved_at)
  select id, slug || '-demo-launch', name || ' 2.0: shared workspaces', 'A fabricated launch for local development.', name || ' 2.0: gemeinsame Arbeitsbereiche',
         (now() - make_interval(days => n * 5))::date, 'approved', developer_id, now() - make_interval(days => n * 5), now() - make_interval(days => n * 5) + interval '30 days', now() - make_interval(days => n * 5)
  from (select x.*, (row_number() over (order by x.slug))::int as n from public.apps x where x.is_demo and x.ownership_status = 'verified_owner' and x.slug in ('metro-fit', 'focusflow', 'invoicelite')) s
  on conflict (slug) do nothing;
  update public.launches set window_start = now() - interval '50 days', window_end = now() - interval '20 days' where slug = 'invoicelite-demo-launch';

  perform public.refresh_app_facts(id), public.refresh_app_trust(id), public.refresh_app_search(id) from public.apps where is_demo;
end $$;
