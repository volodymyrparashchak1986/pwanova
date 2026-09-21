-- Row Level Security. Service role bypasses RLS and is only used server-side
-- (event ingestion, ownership verification, quality checks, rate limits).

create or replace function public.app_is_public(p_app_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.apps where id = p_app_id and status = 'published');
$$;

create or replace function public.owns_app(p_app_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.apps
    where id = p_app_id and developer_id = auth.uid() and ownership_status = 'verified_owner');
$$;

alter table public.profiles enable row level security;
alter table public.partners enable row level security;
alter table public.apps enable row level security;
alter table public.app_screenshots enable row level security;
alter table public.ratings enable row level security;
alter table public.reviews enable row level security;
alter table public.review_helpful enable row level security;
alter table public.developer_responses enable row level security;
alter table public.favorites enable row level security;
alter table public.app_sources enable row level security;
alter table public.partner_referrals enable row level security;
alter table public.app_events enable row level security;
alter table public.app_checks enable row level security;
alter table public.app_claims enable row level security;
alter table public.reports enable row level security;
alter table public.rate_limits enable row level security;  -- no policies: service role only

-- profiles ---------------------------------------------------------------
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_update on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- partners: public read of active partners; admin manages ----------------
create policy partners_read on public.partners for select using (status = 'active' or public.is_admin());
create policy partners_admin_all on public.partners for all
  using (public.is_admin()) with check (public.is_admin());

-- apps -------------------------------------------------------------------
create policy apps_read on public.apps for select
  using (status = 'published' or developer_id = auth.uid() or public.is_admin());
create policy apps_insert_own on public.apps for insert to authenticated
  with check (developer_id = auth.uid());
create policy apps_update_own on public.apps for update to authenticated
  using (developer_id = auth.uid()) with check (developer_id = auth.uid());
create policy apps_admin_all on public.apps for all
  using (public.is_admin()) with check (public.is_admin());

create policy screenshots_read on public.app_screenshots for select using (public.app_is_public(app_id) or public.owns_app(app_id) or public.is_admin());
create policy screenshots_owner_write on public.app_screenshots for all to authenticated
  using (exists (select 1 from public.apps a where a.id = app_id and a.developer_id = auth.uid()))
  with check (exists (select 1 from public.apps a where a.id = app_id and a.developer_id = auth.uid()));

create policy sources_read on public.app_sources for select using (public.app_is_public(app_id) or public.is_admin());
create policy sources_owner_insert on public.app_sources for insert to authenticated
  with check (partner_id is null and exists (select 1 from public.apps a where a.id = app_id and a.developer_id = auth.uid()));
create policy sources_admin_all on public.app_sources for all using (public.is_admin()) with check (public.is_admin());

create policy checks_read on public.app_checks for select using (public.app_is_public(app_id) or public.is_admin());
-- app_checks writes: service role / admin only
create policy checks_admin_write on public.app_checks for all using (public.is_admin()) with check (public.is_admin());

-- ratings ----------------------------------------------------------------
create policy ratings_read on public.ratings for select using (public.app_is_public(app_id));
create policy ratings_insert_own on public.ratings for insert to authenticated
  with check (user_id = auth.uid() and public.app_is_public(app_id));
create policy ratings_update_own on public.ratings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ratings_delete_own on public.ratings for delete to authenticated using (user_id = auth.uid());

-- reviews ----------------------------------------------------------------
create policy reviews_read on public.reviews for select using (public.app_is_public(app_id) or public.is_admin());
create policy reviews_insert_own on public.reviews for insert to authenticated
  with check (user_id = auth.uid() and public.app_is_public(app_id));
create policy reviews_update_own on public.reviews for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reviews_delete_own on public.reviews for delete to authenticated using (user_id = auth.uid());
create policy reviews_admin_delete on public.reviews for delete using (public.is_admin());

create policy helpful_read_own on public.review_helpful for select to authenticated using (user_id = auth.uid());
create policy helpful_insert_own on public.review_helpful for insert to authenticated with check (user_id = auth.uid());
create policy helpful_delete_own on public.review_helpful for delete to authenticated using (user_id = auth.uid());

-- developer responses: only the verified owner of the reviewed app ------
create policy responses_read on public.developer_responses for select
  using (exists (select 1 from public.reviews r where r.id = review_id and public.app_is_public(r.app_id)));
create policy responses_insert_owner on public.developer_responses for insert to authenticated
  with check (developer_id = auth.uid()
    and exists (select 1 from public.reviews r where r.id = review_id and public.owns_app(r.app_id)));
create policy responses_update_owner on public.developer_responses for update to authenticated
  using (developer_id = auth.uid()
    and exists (select 1 from public.reviews r where r.id = review_id and public.owns_app(r.app_id)))
  with check (developer_id = auth.uid());
create policy responses_delete_owner on public.developer_responses for delete to authenticated
  using (developer_id = auth.uid());
create policy responses_admin_delete on public.developer_responses for delete using (public.is_admin());

-- favorites --------------------------------------------------------------
create policy favorites_read_own on public.favorites for select to authenticated using (user_id = auth.uid());
create policy favorites_insert_own on public.favorites for insert to authenticated
  with check (user_id = auth.uid() and public.app_is_public(app_id));
create policy favorites_delete_own on public.favorites for delete to authenticated using (user_id = auth.uid());

-- events: written by the server (service role). Developers read their own.
create policy events_read_owner on public.app_events for select to authenticated
  using (exists (select 1 from public.apps a where a.id = app_id and a.developer_id = auth.uid()) or public.is_admin());

-- claims: users see and create their own; verification happens server-side
create policy claims_read_own on public.app_claims for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy claims_insert_own on public.app_claims for insert to authenticated
  with check (user_id = auth.uid() and public.app_is_public(app_id));

-- reports ----------------------------------------------------------------
create policy reports_insert_own on public.reports for insert to authenticated with check (user_id = auth.uid());
create policy reports_read_own on public.reports for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy reports_admin_update on public.reports for update using (public.is_admin()) with check (public.is_admin());

-- partner referrals: a developer may record their own attribution; admins read all
create policy referrals_insert_own on public.partner_referrals for insert to authenticated with check (developer_id = auth.uid());
create policy referrals_read on public.partner_referrals for select to authenticated using (developer_id = auth.uid() or public.is_admin());
