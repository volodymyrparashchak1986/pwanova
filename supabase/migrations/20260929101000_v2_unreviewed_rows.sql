-- PWANova V2: what somebody typed without having proven ownership is not public, whichever client asks.
--
-- Anybody can submit a listing for a product they do not own, and describe its company, prices,
-- subprocessors or languages. Pages and the catalogue view already leave such rows out until the
-- submitter has proven ownership or a moderator has looked at them. These policies make the
-- database do the same, so the rule does not depend on the page that reads.
--
-- The author of a row, the people who manage the listing and moderators still see everything.
--
-- Additive only: read policies are narrowed, no row is changed, nothing is dropped.

-- A company is public once somebody accountable stands behind it: PWANova observed or reviewed it, or
-- the verified owner of a public listing stated it. The same rule as in the view catalog_apps.
create or replace function public.company_is_public(p_company_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.companies c
    where c.id = p_company_id
      and (c.source_type in ('pwanova_observed', 'admin_reviewed')
           or (c.source_type = 'vendor_stated' and exists (
                 select 1 from public.apps a
                 where a.company_id = c.id and a.developer_id = c.created_by and a.ownership_status = 'verified_owner'
                   and a.status = 'published' and a.duplicate_of is null))));
$$;
revoke all on function public.company_is_public(uuid) from public;
grant execute on function public.company_is_public(uuid) to anon, authenticated, service_role;

alter policy companies_read on public.companies
  using (public.company_is_public(id) or created_by = auth.uid() or public.manages_company(id) or public.is_moderator());

alter policy pricing_plans_read on public.pricing_plans
  using ((public.app_is_public(app_id) and source_type <> 'user_submitted') or public.manages_app(app_id) or public.is_moderator());

alter policy app_data_locations_read on public.app_data_locations
  using ((public.app_is_public(app_id) and source_type <> 'user_submitted') or public.manages_app(app_id) or public.is_moderator());

alter policy app_subprocessors_read on public.app_subprocessors
  using ((public.app_is_public(app_id) and source_type <> 'user_submitted') or public.manages_app(app_id) or public.is_moderator());

alter policy app_ai_providers_read on public.app_ai_providers
  using ((public.app_is_public(app_id) and source_type <> 'user_submitted') or public.manages_app(app_id) or public.is_moderator());

alter policy app_integrations_read on public.app_integrations
  using ((public.app_is_public(app_id) and source_type <> 'user_submitted') or public.manages_app(app_id) or public.is_moderator());

alter policy app_languages_read on public.app_languages
  using ((public.app_is_public(app_id) and source_type <> 'user_submitted') or public.manages_app(app_id) or public.is_moderator());

alter policy app_platforms_read on public.app_platforms
  using ((public.app_is_public(app_id) and source_type <> 'user_submitted') or public.manages_app(app_id) or public.is_moderator());
