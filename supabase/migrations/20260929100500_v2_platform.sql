-- PWANova V2 — plans, entitlements, sponsorship, newsletter, settings, audit trail, moderator tools.
-- Additive only. No payment provider is connected: a plan is activated by an admin.

-- ---------------------------------------------------------------- settings / feature flags
create table public.site_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.]{1,60}$'),
  value jsonb not null,
  is_public boolean not null default false,
  description text check (char_length(description) <= 300),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
create policy site_settings_read on public.site_settings for select using (is_public or public.is_admin());
create policy site_settings_manage on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.site_settings (key, value, is_public, description) values
  ('features', '{"launches": true, "requests": true, "compare": true, "newsletter": true, "sponsorship": false}', true, 'Feature switches for V2 surfaces.'),
  ('monetization', '{"enforced": false}', true, 'While not enforced, maker tools are open to every verified owner. Paid plans never change organic ranking.'),
  ('verification', '{"daily_budget": 10, "recheck_days": 30}', false, 'How many scheduled verification runs the daily job may start.'),
  ('popular', '{"min_engaged_apps": 5, "min_events": 50}', false, 'Thresholds before "Popular in Germany" is shown at all.'),
  ('operator', '{"legal_name": null, "street": null, "postal_code": null, "city": null, "country": null, "email": null, "phone": null, "represented_by": null, "register": null, "vat_id": null, "responsible_for_content": null}', true, 'Operator details for the legal notice. Must be filled in by the owner.');

-- ---------------------------------------------------------------- plans and entitlements
create table public.plans (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  audience text not null check (audience in ('maker', 'vendor', 'sponsor')),
  name jsonb not null check (name ? 'en'),
  summary jsonb not null default '{}'::jsonb,
  features jsonb not null default '[]'::jsonb,            -- [{"en": "...", "de": "..."}]
  price_cents int not null default 0 check (price_cents >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  billing_interval text not null check (billing_interval in ('free', 'one_time', 'month', 'issue')),
  price_is_approximate boolean not null default true,
  entitlements text[] not null default '{}',
  is_public boolean not null default true,
  is_available boolean not null default false,            -- false = announced, cannot be ordered yet
  sort_order int not null default 100,
  updated_at timestamptz not null default now()
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  app_id uuid references public.apps (id) on delete cascade,
  plan_slug text not null references public.plans (slug),
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by uuid references public.profiles (id) on delete set null,
  note text check (char_length(note) <= 300),
  billing_reference text check (char_length(billing_reference) <= 120),
  created_at timestamptz not null default now()
);
create index entitlements_user_idx on public.entitlements (user_id, status);

create or replace function public.has_entitlement(p_key text, p_app_id uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.entitlements e join public.plans p on p.slug = e.plan_slug
    where e.user_id = auth.uid() and e.status = 'active' and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
      and p_key = any (p.entitlements) and (e.app_id is null or p_app_id is null or e.app_id = p_app_id));
$$;

-- During the beta nothing is paywalled: a feature is on unless monetisation is enforced and the plan is missing.
create or replace function public.feature_enabled(p_key text, p_app_id uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select not coalesce((select (value ->> 'enforced')::boolean from public.site_settings where key = 'monetization'), false)
         or public.has_entitlement(p_key, p_app_id);
$$;

alter table public.plans enable row level security;
alter table public.entitlements enable row level security;
create policy plans_read on public.plans for select using (is_public or public.is_admin());
create policy plans_manage on public.plans for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy entitlements_read on public.entitlements for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.entitlements from anon, authenticated;   -- through grant_entitlement() only

insert into public.plans (slug, audience, name, summary, features, price_cents, billing_interval, entitlements, is_available, sort_order) values
  ('basic', 'maker', '{"en":"Basic","de":"Basic"}',
   '{"en":"A permanent, searchable product profile.","de":"Ein dauerhaftes, auffindbares Produktprofil."}',
   '[{"en":"Listing with categories and search","de":"Eintrag mit Kategorien und Suche"},{"en":"Automatic technical checks","de":"Automatische technische Prüfungen"},{"en":"Reviews and developer replies","de":"Bewertungen und Antworten als Entwickler"},{"en":"Inclusion in comparisons","de":"Aufnahme in Vergleiche"}]',
   0, 'free', '{}', true, 10),
  ('verified', 'maker', '{"en":"Verified","de":"Verified"}',
   '{"en":"Priority review of your evidence. Not a legal certification.","de":"Bevorzugte Prüfung Ihrer Nachweise. Keine rechtliche Zertifizierung."}',
   '[{"en":"Priority verification workflow","de":"Bevorzugter Prüfablauf"},{"en":"Manually reviewed evidence profile","de":"Manuell geprüftes Nachweisprofil"},{"en":"One verification refresh","de":"Eine Aktualisierung der Prüfung"}]',
   4900, 'one_time', '{verification.priority}', false, 20),
  ('launch-pro', 'maker', '{"en":"Launch Pro","de":"Launch Pro"}',
   '{"en":"Verification plus an extended, clearly labelled launch.","de":"Prüfung plus ein verlängerter, klar gekennzeichneter Launch."}',
   '[{"en":"Everything in Verified","de":"Alles aus Verified"},{"en":"Extended launch window","de":"Verlängertes Launch-Fenster"},{"en":"Launch analytics","de":"Launch-Auswertung"}]',
   9900, 'one_time', '{verification.priority,launch.extended,launch.analytics}', false, 30),
  ('maker-pro', 'maker', '{"en":"Maker Pro","de":"Maker Pro"}',
   '{"en":"Deeper analytics and richer profile tools.","de":"Tiefere Auswertungen und erweiterte Profilwerkzeuge."}',
   '[{"en":"Advanced analytics","de":"Erweiterte Auswertungen"},{"en":"Changelog with follower notifications","de":"Änderungsprotokoll mit Benachrichtigung der Follower"},{"en":"Enhanced developer profile","de":"Erweitertes Entwicklerprofil"}]',
   2900, 'month', '{analytics.advanced,updates.notify,profile.enhanced}', false, 40),
  ('vendor-pro', 'vendor', '{"en":"Vendor Pro","de":"Vendor Pro"}',
   '{"en":"Respond to matching buyer requests. Contact details are shared only with the buyer''s consent.","de":"Auf passende Anfragen antworten. Kontaktdaten werden nur mit Zustimmung der anfragenden Person geteilt."}',
   '[{"en":"Qualified buyer-request opportunities","de":"Qualifizierte Anfragen von Interessenten"},{"en":"Vendor response tools","de":"Werkzeuge für Antworten"},{"en":"Lead workflow","de":"Lead-Ablauf"}]',
   14900, 'month', '{buyer_requests.respond}', false, 50),
  ('category-sponsor', 'sponsor', '{"en":"Category Sponsor","de":"Kategorie-Sponsor"}',
   '{"en":"A labelled placement on one category page. It never changes the organic order.","de":"Eine gekennzeichnete Platzierung auf einer Kategorieseite. Die organische Reihenfolge ändert sich dadurch nie."}',
   '[{"en":"Placement labelled Sponsored","de":"Platzierung mit der Kennzeichnung Anzeige"},{"en":"One category, one month","de":"Eine Kategorie, ein Monat"}]',
   19900, 'month', '{sponsor.category}', false, 60),
  ('newsletter-sponsor', 'sponsor', '{"en":"Newsletter Sponsor","de":"Newsletter-Sponsor"}',
   '{"en":"Available once the newsletter has an audience worth paying for.","de":"Verfügbar, sobald der Newsletter eine relevante Leserschaft hat."}',
   '[{"en":"One labelled placement per issue","de":"Eine gekennzeichnete Platzierung pro Ausgabe"}]',
   29900, 'issue', '{sponsor.newsletter}', false, 70);

-- ---------------------------------------------------------------- sponsorship (separate from organic ranking)
create table public.sponsor_campaigns (
  id uuid primary key default gen_random_uuid(),
  sponsor_name text not null check (char_length(sponsor_name) between 1 and 120),
  app_id uuid references public.apps (id) on delete set null,
  placement text not null check (placement in ('home', 'category', 'discover', 'launches', 'newsletter')),
  category_id uuid references public.categories (id) on delete set null,
  locale text check (locale ~ '^[a-z]{2}$'),
  headline jsonb not null default '{}'::jsonb,
  target_url text check (char_length(target_url) <= 500),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'ended')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create trigger sponsor_campaigns_updated_at before update on public.sponsor_campaigns
  for each row execute function public.set_updated_at();
alter table public.sponsor_campaigns enable row level security;
create policy sponsor_campaigns_read on public.sponsor_campaigns for select using (
  (status = 'active' and now() between starts_at and ends_at) or public.is_admin());
create policy sponsor_campaigns_manage on public.sponsor_campaigns for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- newsletter (no sender connected yet)
create table public.newsletter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  user_id uuid references public.profiles (id) on delete set null,
  locale text not null default 'en' check (locale ~ '^[a-z]{2}$'),
  consent_at timestamptz not null default now(),
  consent_source text not null check (char_length(consent_source) <= 80),
  consent_text text not null check (char_length(consent_text) <= 500),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  unsubscribe_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
create unique index newsletter_email_idx on public.newsletter_subscriptions (lower(email));
alter table public.newsletter_subscriptions enable row level security;
create policy newsletter_read_own on public.newsletter_subscriptions for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.newsletter_subscriptions from anon, authenticated;   -- written by the server only

-- ---------------------------------------------------------------- audit trail
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role text,
  action text not null check (char_length(action) <= 60),
  target_type text not null check (char_length(target_type) <= 40),
  target_id uuid,
  app_id uuid references public.apps (id) on delete set null,
  previous jsonb,
  next jsonb,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);
create index audit_logs_time_idx on public.audit_logs (created_at desc);
create index audit_logs_app_idx on public.audit_logs (app_id, created_at desc);
alter table public.audit_logs enable row level security;
create policy audit_logs_read on public.audit_logs for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.audit_logs from anon, authenticated;   -- append-only, written by the functions below

create or replace function public.write_audit(p_action text, p_target_type text, p_target_id uuid, p_app_id uuid, p_previous jsonb, p_next jsonb, p_reason text) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, app_id, previous, next, reason)
  values (auth.uid(), (select role from public.profiles where id = auth.uid()), p_action, p_target_type, p_target_id, p_app_id, p_previous, p_next, left(p_reason, 500));
$$;
revoke all on function public.write_audit(text, text, uuid, uuid, jsonb, jsonb, text) from public, anon, authenticated;

alter table public.admin_actions drop constraint if exists admin_actions_target_type_check;
alter table public.admin_actions add constraint admin_actions_target_type_check
  check (target_type in ('app', 'review', 'report', 'profile', 'evidence', 'claim', 'launch', 'request', 'update', 'sponsor', 'plan', 'category', 'company'));

-- ---------------------------------------------------------------- reports: more things can be reported
alter table public.reports
  add column evidence_id uuid references public.app_evidence (id) on delete cascade,
  add column launch_id uuid references public.launches (id) on delete cascade,
  add column request_id uuid references public.buyer_requests (id) on delete cascade;
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check check (reason in (
  'spam', 'malicious', 'impersonation', 'inappropriate', 'broken', 'other',
  'incorrect_information', 'outdated_evidence', 'fake_review'));
alter table public.reports drop constraint if exists reports_check;
alter table public.reports add constraint reports_target_check
  check (num_nonnulls(app_id, review_id, evidence_id, launch_id, request_id) >= 1);
drop policy if exists reports_read_own on public.reports;
create policy reports_read_own on public.reports for select to authenticated using (user_id = auth.uid() or public.is_moderator());
drop policy if exists reports_admin_update on public.reports;
create policy reports_admin_update on public.reports for update using (public.is_moderator()) with check (public.is_moderator());

create or replace function public.protect_report_status() returns trigger language plpgsql set search_path = public as $$
begin
 if not public.is_moderator() and not public.is_service_role() then new.status:='open'; end if;
 return new;
end $$;

-- ---------------------------------------------------------------- moderator tools (every change is audited)
create or replace function public.require_moderator() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'Moderator required'; end if;
end $$;
create or replace function public.require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admin required'; end if;
end $$;
create or replace function public.require_reason(p_reason text) returns void
language plpgsql immutable set search_path = public as $$
begin
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'A reason is required'; end if;
end $$;

-- A moderator states a fact after reading the source. The previous answer stays in the history.
create or replace function public.admin_set_fact(
  p_app_id uuid, p_key text, p_state text, p_value text, p_source_url text, p_source_title text, p_excerpt text, p_reason text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_prev jsonb;
  v_id uuid;
begin
  perform public.require_moderator();
  perform public.require_reason(p_reason);
  if p_state not in ('yes', 'no', 'unknown') then raise exception 'Unknown state'; end if;
  select to_jsonb(f) into v_prev from public.app_facts f where f.app_id = p_app_id and f.attribute_key = p_key;
  if p_state = 'unknown' then
    -- withdraw the verified answer: the vendor statement (if any) becomes the effective one again
    update public.app_evidence set status = 'retracted', review_note = left(p_reason, 500)
    where app_id = p_app_id and attribute_key = p_key and status = 'current' and source_type in ('pwanova_observed', 'admin_reviewed');
  else
    insert into public.app_evidence (app_id, attribute_key, value_state, value_text, source_type, verification_method,
                                     source_url, source_title, evidence_excerpt, status, verified_at, verified_by, review_note)
    values (p_app_id, p_key, p_state, left(p_value, 500), 'admin_reviewed', 'manual', left(p_source_url, 500), left(p_source_title, 200),
            left(p_excerpt, 1000), 'current', now(), auth.uid(), left(p_reason, 500))
    returning id into v_id;
  end if;
  perform public.write_audit('fact.set', 'evidence', v_id, p_app_id, v_prev,
    (select to_jsonb(f) from public.app_facts f where f.app_id = p_app_id and f.attribute_key = p_key), p_reason);
  return v_id;
end $$;

-- Decision on something a user submitted: approving means the moderator checked the source.
create or replace function public.review_evidence(p_evidence_id uuid, p_decision text, p_note text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  e public.app_evidence;
  v_new uuid;
begin
  perform public.require_moderator();
  perform public.require_reason(p_note);
  select * into e from public.app_evidence where id = p_evidence_id for update;
  if not found then raise exception 'Unknown evidence'; end if;
  if p_decision = 'approve' then
    if e.value_state = 'unknown' then raise exception 'Nothing to approve'; end if;
    insert into public.app_evidence (app_id, attribute_key, value_state, value_text, value_json, source_type, verification_method,
                                     source_url, source_title, evidence_excerpt, status, verified_at, verified_by, submitted_by, review_note)
    values (e.app_id, e.attribute_key, e.value_state, e.value_text, e.value_json, 'admin_reviewed', 'manual',
            e.source_url, e.source_title, e.evidence_excerpt, 'current', now(), auth.uid(), e.submitted_by, left(p_note, 500))
    returning id into v_new;
    if e.status = 'pending_review' then
      update public.app_evidence set status = 'superseded', superseded_by = v_new, superseded_at = now(), review_note = left(p_note, 500) where id = e.id;
    end if;
  elsif p_decision = 'reject' then
    update public.app_evidence set status = 'rejected', review_note = left(p_note, 500) where id = e.id;
  elsif p_decision = 'retract' then
    update public.app_evidence set status = 'retracted', review_note = left(p_note, 500) where id = e.id;
  else
    raise exception 'Unknown decision';
  end if;
  perform public.write_audit('evidence.' || p_decision, 'evidence', e.id, e.app_id, to_jsonb(e),
    (select to_jsonb(x) from public.app_evidence x where x.id = coalesce(v_new, e.id)), p_note);
  if e.submitted_by is not null and e.submitted_by is distinct from auth.uid() then
    insert into public.notifications (user_id, kind, link, app_id, metadata)
    select e.submitted_by, 'evidence', '/apps/' || a.slug || '#trust', a.id,
           jsonb_build_object('decision', p_decision, 'attribute', e.attribute_key, 'app_name', a.name)
    from public.apps a where a.id = e.app_id;
  end if;
  return coalesce(v_new, e.id);
end $$;

-- A maker or a moderator asks for a fresh check; the daily job picks it up.
create or replace function public.request_recheck(p_app_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.manages_app(p_app_id) or public.is_moderator()) then raise exception 'Not your listing'; end if;
  if not public.check_rate_limit('recheck:' || p_app_id, 3, 86400) then raise exception 'Rate limit'; end if;
  update public.apps set next_check_at = now() where id = p_app_id;
end $$;

-- Ratings normally can never move to another app. The one exception is an admin merging a duplicate.
create or replace function public.lock_engagement_identity() returns trigger language plpgsql set search_path = public as $$
begin
 if current_setting('pwanova.merging', true) = 'on' and public.is_admin() then return new; end if;
 if tg_table_name='developer_responses' then
  if new.review_id<>old.review_id or new.developer_id<>old.developer_id then raise exception 'Response identity is immutable'; end if;
 else
  if new.app_id<>old.app_id or new.user_id<>old.user_id then raise exception 'Rating identity is immutable'; end if;
 end if;
 return new;
end $$;

-- Duplicate listings: the duplicate leaves the catalogue and points at the listing that stays.
-- Saves and follows move over; reviews and ratings move only when the person has none on the target.
create or replace function public.merge_duplicate_app(p_duplicate_id uuid, p_target_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d public.apps; t public.apps;
  v_fav int; v_fol int; v_rat int; v_rev int;
begin
  perform public.require_admin();
  perform public.require_reason(p_reason);
  if p_duplicate_id = p_target_id then raise exception 'An app cannot be merged into itself'; end if;
  select * into d from public.apps where id = p_duplicate_id for update;
  select * into t from public.apps where id = p_target_id for update;
  if d.id is null or t.id is null then raise exception 'Unknown app'; end if;
  if t.duplicate_of is not null then raise exception 'The target is itself a duplicate'; end if;

  insert into public.favorites (app_id, user_id, created_at)
    select p_target_id, f.user_id, f.created_at from public.favorites f where f.app_id = p_duplicate_id
    on conflict (app_id, user_id) do nothing;
  get diagnostics v_fav = row_count;
  insert into public.follows (user_id, app_id, created_at)
    select f.user_id, p_target_id, f.created_at from public.follows f where f.app_id = p_duplicate_id
    on conflict (user_id, app_id) do nothing;
  get diagnostics v_fol = row_count;
  -- move each person's rating and review only where they have none on the target;
  -- the developer of the target is left out (self-ratings are not allowed there)
  perform set_config('pwanova.merging', 'on', true);   -- transaction-local; see lock_engagement_identity()
  update public.ratings r set app_id = p_target_id where r.app_id = p_duplicate_id
    and r.user_id is distinct from t.developer_id
    and not exists (select 1 from public.ratings x where x.app_id = p_target_id and x.user_id = r.user_id);
  get diagnostics v_rat = row_count;
  update public.reviews r set app_id = p_target_id where r.app_id = p_duplicate_id
    and r.user_id is distinct from t.developer_id
    and not exists (select 1 from public.reviews x where x.app_id = p_target_id and x.user_id = r.user_id);
  get diagnostics v_rev = row_count;

  perform set_config('pwanova.merging', 'off', true);

  update public.apps set duplicate_of = p_target_id, status = 'hidden', moderation_hidden = true,
    moderation_note = left('Duplicate of ' || t.slug || '. ' || p_reason, 500) where id = p_duplicate_id;
  perform public.write_audit('app.merge_duplicate', 'app', p_duplicate_id, p_target_id,
    jsonb_build_object('slug', d.slug, 'status', d.status), jsonb_build_object('duplicate_of', t.slug, 'moved', jsonb_build_object('favorites', v_fav, 'follows', v_fol, 'ratings', v_rat, 'reviews', v_rev)), p_reason);
  return jsonb_build_object('favorites', v_fav, 'follows', v_fol, 'ratings', v_rat, 'reviews', v_rev);
end $$;

-- Ownership can be taken away again when a claim turns out to be fraudulent.
create or replace function public.revoke_ownership(p_app_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.apps;
begin
  perform public.require_admin();
  perform public.require_reason(p_reason);
  select * into a from public.apps where id = p_app_id for update;
  if not found then raise exception 'Unknown app'; end if;
  update public.app_claims set status = 'revoked', last_error = left(p_reason, 500) where app_id = p_app_id and status in ('verified', 'pending');
  update public.apps set developer_id = null, ownership_status = 'unclaimed', ownership_verified_at = null, ownership_method = null,
    verification_status = 'unverified' where id = p_app_id;
  -- what the former owner stated is no longer a vendor statement
  update public.app_evidence set status = 'retracted', review_note = left('Ownership revoked. ' || p_reason, 500)
  where app_id = p_app_id and source_type = 'vendor_stated' and status = 'current';
  perform public.write_audit('claim.revoke', 'claim', null, p_app_id,
    jsonb_build_object('developer_id', a.developer_id, 'ownership_status', a.ownership_status), jsonb_build_object('ownership_status', 'unclaimed'), p_reason);
  if a.developer_id is not null then
    insert into public.notifications (user_id, kind, link, app_id, metadata)
    values (a.developer_id, 'claim', '/apps/' || a.slug, a.id, jsonb_build_object('decision', 'revoked', 'app_name', a.name));
  end if;
end $$;

create or replace function public.decide_launch(p_launch_id uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare l public.launches;
begin
  perform public.require_moderator();
  select * into l from public.launches where id = p_launch_id for update;
  if not found then raise exception 'Unknown launch'; end if;
  if p_decision = 'approve' then
    update public.launches set status = 'approved', approved_by = auth.uid(), moderation_note = left(p_note, 500) where id = p_launch_id;
  elsif p_decision = 'reject' then
    perform public.require_reason(p_note);
    update public.launches set status = 'rejected', moderation_note = left(p_note, 500) where id = p_launch_id;
  else
    raise exception 'Unknown decision';
  end if;
  perform public.write_audit('launch.' || p_decision, 'launch', p_launch_id, l.app_id, jsonb_build_object('status', l.status),
    (select jsonb_build_object('status', x.status, 'window_start', x.window_start, 'window_end', x.window_end) from public.launches x where x.id = p_launch_id), p_note);
  if l.submitted_by is not null then
    insert into public.notifications (user_id, kind, link, app_id, metadata)
    select l.submitted_by, 'launch', '/launches/' || l.slug, l.app_id, jsonb_build_object('decision', p_decision, 'app_name', a.name)
    from public.apps a where a.id = l.app_id;
  end if;
end $$;

create or replace function public.grant_entitlement(p_username text, p_plan text, p_app_id uuid, p_ends_at timestamptz, p_note text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_id uuid;
begin
  perform public.require_admin();
  select id into v_user from public.profiles where username = p_username;
  if v_user is null then raise exception 'Unknown user'; end if;
  insert into public.entitlements (user_id, app_id, plan_slug, ends_at, granted_by, note)
  values (v_user, p_app_id, p_plan, p_ends_at, auth.uid(), left(p_note, 300)) returning id into v_id;
  perform public.write_audit('entitlement.grant', 'plan', v_id, p_app_id, null,
    jsonb_build_object('user', p_username, 'plan', p_plan, 'ends_at', p_ends_at), p_note);
  return v_id;
end $$;
create or replace function public.revoke_entitlement(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare e public.entitlements;
begin
  perform public.require_admin();
  perform public.require_reason(p_reason);
  select * into e from public.entitlements where id = p_id for update;
  if not found then raise exception 'Unknown entitlement'; end if;
  update public.entitlements set status = 'revoked' where id = p_id;
  perform public.write_audit('entitlement.revoke', 'plan', p_id, e.app_id, to_jsonb(e), jsonb_build_object('status', 'revoked'), p_reason);
end $$;

create or replace function public.moderate_request(p_request_id uuid, p_decision text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.buyer_requests;
begin
  perform public.require_moderator();
  perform public.require_reason(p_note);
  select * into r from public.buyer_requests where id = p_request_id for update;
  if not found then raise exception 'Unknown request'; end if;
  if p_decision not in ('hide', 'restore', 'close') then raise exception 'Unknown decision'; end if;
  update public.buyer_requests set
    status = case p_decision when 'hide' then 'hidden' when 'close' then 'closed' else 'open' end,
    moderation_note = left(p_note, 500) where id = p_request_id;
  perform public.write_audit('request.' || p_decision, 'request', p_request_id, null, jsonb_build_object('status', r.status),
    jsonb_build_object('status', case p_decision when 'hide' then 'hidden' when 'close' then 'closed' else 'open' end), p_note);
end $$;

-- v1 moderate(): moderators may now handle reviews and reports; listing decisions stay with admins.
create or replace function public.moderate(p_kind text,p_id uuid,p_reason text default null) returns void
language plpgsql security definer set search_path=public as $$
declare target text;
begin
 if p_kind in ('remove_review','resolve_report','dismiss_report') then
  if not public.is_moderator() then raise exception 'Moderator required'; end if;
 elsif not public.is_admin() then raise exception 'Admin required'; end if;
 if char_length(p_reason)>500 then raise exception 'Reason too long'; end if;
 if p_kind in ('reject','hide','suspend','remove_review') and coalesce(length(trim(p_reason)),0)<3 then raise exception 'A moderation reason is required'; end if;
 if p_kind in ('approve','reject','hide','suspend','restore') then
  target:='app';
  update public.apps set status=case p_kind when 'approve' then 'published' when 'restore' then 'published' when 'reject' then 'rejected' when 'hide' then 'hidden' else 'suspended' end,moderation_note=p_reason,moderation_hidden=(p_kind in ('hide','reject','suspend')) where id=p_id;
 elsif p_kind in ('feature','unfeature') then
  target:='app'; update public.apps set is_featured=(p_kind='feature'),featured_at=case when p_kind='feature' then now() else null end where id=p_id;
 elsif p_kind='remove_review' then
  target:='review'; update public.reviews set hidden_at=now(),moderation_reason=p_reason where id=p_id;
 elsif p_kind in ('resolve_report','dismiss_report') then
  target:='report'; update public.reports set status=case p_kind when 'resolve_report' then 'resolved' else 'dismissed' end where id=p_id;
 else raise exception 'Unsupported moderation action'; end if;
 if not found then raise exception 'Target not found'; end if;
 insert into public.admin_actions(admin_id,action,target_type,target_id,reason) values(auth.uid(),p_kind,target,p_id,p_reason);
 perform public.write_audit('moderate.' || p_kind, target, p_id, case when target = 'app' then p_id else null end, null, null, p_reason);
end $$;

-- moderators must be able to write the v1 log row that moderate() inserts on their behalf
drop policy if exists admin_actions_admin_read on public.admin_actions;
create policy admin_actions_admin_read on public.admin_actions for select using (public.is_moderator());

do $$
declare f text;
begin
  foreach f in array array[
    'admin_set_fact(uuid, text, text, text, text, text, text, text)', 'review_evidence(uuid, text, text)', 'request_recheck(uuid)',
    'merge_duplicate_app(uuid, uuid, text)', 'revoke_ownership(uuid, text)', 'decide_launch(uuid, text, text)',
    'grant_entitlement(text, text, uuid, timestamptz, text)', 'revoke_entitlement(uuid, text)', 'moderate_request(uuid, text, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function public.require_moderator() from public, anon;
revoke all on function public.require_admin() from public, anon;
