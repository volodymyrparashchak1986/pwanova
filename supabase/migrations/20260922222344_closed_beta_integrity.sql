alter table public.partners add column is_demo boolean not null default false;
alter table public.apps add column moderation_hidden boolean not null default false;
update public.apps set moderation_hidden=true where status in ('hidden','suspended','rejected');
alter table public.apps add column ownership_verified_at timestamptz;
alter table public.apps add column ownership_method text;
-- Closed-beta integrity. Additive; existing rows and migrations are preserved.
create or replace function public.protect_app() returns trigger
language plpgsql as $$
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
  else
    new.developer_id := old.developer_id;
    new.domain := old.domain;     -- URL/domain changes go through admin/service so re-verification can be enforced (see apps_reverify_domain below)
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
    -- Fix: an owner may only ever toggle between published and hidden, and only starting from one of
    -- those two states. A pending, rejected or suspended app can never be self-published.
    if not old.moderation_hidden and old.status in ('published', 'hidden') and new.status in ('published', 'hidden') then
      -- allowed
    else
      new.status := old.status;
    end if;
  end if;
  return new;
end $$;


create or replace function public.reverify_on_domain_change() returns trigger
language plpgsql set search_path = public as $$
begin
 if new.url is distinct from old.url or new.domain is distinct from old.domain then
   new.ownership_status := 'claim_pending'; new.ownership_verified_at := null; new.ownership_method := null; new.verification_status := 'unverified';
   new.status := 'pending'; new.is_pwa := false; new.is_installable := false;
   new.health_status := 'unknown'; new.health_checked_at := null;
   delete from public.app_checks where app_id = old.id;
   update public.app_claims set status = 'expired' where app_id = old.id;
 end if;
 return new;
end $$;

-- Claim tokens are issued by a bounded authenticated RPC, never client-chosen.
alter table public.app_claims add column bound_url text;
update public.app_claims c set bound_url = a.url from public.apps a where a.id = c.app_id;
alter table public.app_claims alter column bound_url set not null;
drop policy claims_insert_own on public.app_claims;
revoke insert, update, delete on public.app_claims from anon, authenticated;
create or replace function public.begin_app_claim(p_app_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare a public.apps; cid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into a from public.apps where id = p_app_id for update;
 if not found or (a.status <> 'published' and a.developer_id is distinct from auth.uid()) then raise exception 'App unavailable'; end if;
 if a.ownership_status = 'verified_owner' then raise exception 'Already owned'; end if;
 if not public.check_rate_limit('claim-db:' || auth.uid(), 10, 3600) then raise exception 'Rate limit'; end if;
 if a.ownership_status='unclaimed' then update public.apps set ownership_status='claim_pending' where id=a.id; end if;
 insert into public.app_claims(app_id,user_id,token,bound_url,expires_at)
 values(a.id,auth.uid(),replace(gen_random_uuid()::text || gen_random_uuid()::text,'-',''),a.url,now()+interval '3 days')
 on conflict(app_id,user_id) do update set token=excluded.token,bound_url=excluded.bound_url,
 expires_at=excluded.expires_at,status='pending',last_error=null,method=null,verified_at=null
 returning id into cid;
 return cid;
end $$;
revoke all on function public.begin_app_claim(uuid) from public, anon;
grant execute on function public.begin_app_claim(uuid) to authenticated;

-- Remove the unchecked legacy signature; compare exactly the token and URL fetched by the server.
drop function public.claim_app_ownership(uuid,uuid,uuid);
create function public.claim_app_ownership(p_app_id uuid,p_user_id uuid,p_claim_id uuid,p_token text,p_url text)
returns boolean language plpgsql security definer set search_path=public as $$
declare a public.apps; c public.app_claims;
begin
 select * into a from public.apps where id=p_app_id for update;
 if not found or a.ownership_status='verified_owner' or a.url is distinct from p_url then return false; end if;
 select * into c from public.app_claims where id=p_claim_id for update;
 if not found or c.app_id <> p_app_id or c.user_id <> p_user_id or c.status <> 'pending'
 or c.expires_at <= now() or c.token is distinct from p_token or c.bound_url is distinct from p_url then return false; end if;
 update public.apps set developer_id=p_user_id,ownership_status='verified_owner',ownership_method='well_known',ownership_verified_at=now() where id=p_app_id;
 update public.app_claims set status='verified',method='well_known',verified_at=now(),last_error=null where id=p_claim_id;
 update public.app_claims set status='expired' where app_id=p_app_id and id<>p_claim_id;
 return true;
end $$;
revoke all on function public.claim_app_ownership(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_app_ownership(uuid,uuid,uuid,text,text) to service_role;

-- Identity columns cannot be repointed on an authorized row.
create function public.lock_engagement_identity() returns trigger language plpgsql as $$
begin
 if tg_table_name='developer_responses' then
  if new.review_id<>old.review_id or new.developer_id<>old.developer_id then raise exception 'Response identity is immutable'; end if;
 else
  if new.app_id<>old.app_id or new.user_id<>old.user_id then raise exception 'Rating identity is immutable'; end if;
 end if;
 return new;
end $$;
create trigger responses_identity before update on public.developer_responses for each row execute function public.lock_engagement_identity();
create trigger ratings_identity before update on public.ratings for each row execute function public.lock_engagement_identity();

-- Ratings are canonical; reviews.rating is a compatibility projection kept transactionally consistent.
alter table public.reviews alter column rating drop not null;
create or replace function public.sync_review_rating() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.rating is not null then
  insert into public.ratings(app_id,user_id,rating) values(new.app_id,new.user_id,new.rating)
  on conflict(app_id,user_id) do update set rating=excluded.rating where ratings.rating is distinct from excluded.rating;
 end if;
 return new;
end $$;
create function public.project_rating_to_review() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' then
  update public.reviews set rating=null where app_id=old.app_id and user_id=old.user_id and rating is not null;
  return old;
 end if;
 update public.reviews set rating=new.rating where app_id=new.app_id and user_id=new.user_id and rating is distinct from new.rating;
 return new;
end $$;
create trigger ratings_project after insert or update of rating or delete on public.ratings
 for each row execute function public.project_rating_to_review();
-- Preserve canonical ratings and review text when repairing existing mismatches.
update public.reviews v set rating=r.rating from public.ratings r where v.app_id=r.app_id and v.user_id=r.user_id and v.rating is distinct from r.rating;

-- Moderation hides text, retaining evidence and the independent rating.
alter table public.reviews add column hidden_at timestamptz;
alter table public.reviews add column moderation_reason text check(char_length(moderation_reason)<=500);
create function public.protect_review_moderation() returns trigger language plpgsql as $$
begin
 if not public.is_admin() and not public.is_service_role() then
  if tg_op='INSERT' then new.hidden_at:=null; new.moderation_reason:=null;
  else new.hidden_at:=old.hidden_at; new.moderation_reason:=old.moderation_reason; end if;
 end if;
 return new;
end $$;
create trigger reviews_moderation_protect before insert or update on public.reviews for each row execute function public.protect_review_moderation();
drop policy reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using ((public.app_is_public(app_id) and hidden_at is null) or user_id=auth.uid() or public.is_admin());
create policy reviews_admin_update on public.reviews for update using(public.is_admin()) with check(public.is_admin());

-- A single transaction authorizes, mutates and logs every moderation decision.
create function public.moderate(p_kind text,p_id uuid,p_reason text default null) returns void
language plpgsql security definer set search_path=public as $$
declare target text;
begin
 if not public.is_admin() then raise exception 'Admin required'; end if;
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
end $$;
revoke all on function public.moderate(text,uuid,text) from public,anon;
grant execute on function public.moderate(text,uuid,text) to authenticated;

-- Canonical identity = exact origin + case-sensitive pathname (queries/fragments ignored).
-- www and hosting subdomains are distinct; several paths on one origin are supported.
create function public.canonical_app_url(value text) returns text language sql immutable strict as $$
 select regexp_replace(regexp_replace(lower(substring(value from '^https?://[^/?#]+')), '^(https://.*):443$', '\1'), '^(http://.*):80$', '\1') ||
 coalesce(nullif(regexp_replace(substring(value from '^https?://[^/?#]+([^?#]*)'), '/+$', ''), ''), '/');
$$;
alter table public.apps drop constraint apps_domain_key;
create index apps_domain_idx on public.apps(domain);
create unique index apps_canonical_identity on public.apps(public.canonical_app_url(url));

-- Explicit stable view projection: no accidental new private columns via a.*.
create or replace view public.apps_public as
with base as (
  select
    a.id, a.developer_id, a.name, a.slug, a.tagline, a.description, a.url, a.domain, a.icon_url, a.category, a.status, a.ownership_status, a.verification_status, a.is_pwa, a.is_installable, a.hosting_provider, a.build_tool, a.health_status, a.health_checked_at, a.is_featured, a.featured_at, a.is_demo, a.created_at, a.updated_at,
    p.username as developer_username,
    coalesce(p.display_name, p.username) as developer_name,
    p.avatar_url as developer_avatar,
    coalesce(p.is_verified, false) as developer_verified,
    coalesce(r.avg_rating, 0)::numeric(3,2) as rating,
    coalesce(r.cnt, 0) as ratings_count,
    coalesce(r.cnt_7d, 0) as ratings_7d,
    coalesce(rv.cnt, 0) as reviews_count,
    coalesce(rv.cnt_7d, 0) as reviews_7d,
    coalesce(f.cnt, 0) as favorites_count,
    coalesce(f.cnt_7d, 0) as favorites_7d,
    coalesce(e.opens_7d, 0) as opens_7d,
    coalesce(e.opens_30d, 0) as opens_30d,
    coalesce(e.install_actions, 0) as install_actions,
    c.reachable, c.https_ok, c.responsive, c.mobile_optimized, c.manifest_ok,
    c.service_worker_ok, c.installable as check_installable, c.offline_support, c.push_support,
    c.security_ok, c.last_checked_at,
    s.source_name as launch_source_name,
    s.source_type as launch_source_type,
    s.source_url as launch_source_url,
    s.partner_slug as launch_partner_slug,
    (
      coalesce(c.https_ok, false)::int + coalesce(c.responsive, false)::int + coalesce(c.mobile_optimized, false)::int +
      coalesce(c.manifest_ok, false)::int + coalesce(c.installable, false)::int + coalesce(c.service_worker_ok, false)::int
    ) as quality_passed
  from public.apps a
  left join public.profiles p on p.id = a.developer_id
  left join lateral (
    select avg(rating) avg_rating, count(*)::int cnt,
           (count(*) filter (where created_at > now() - interval '7 days'))::int cnt_7d
    from public.ratings where app_id = a.id and user_id is distinct from a.developer_id and (a.is_demo or not exists(select 1 from public.profiles dp where dp.id=user_id and dp.is_demo))) r on true
  left join lateral (
    select count(*)::int cnt, (count(*) filter (where created_at > now() - interval '7 days'))::int cnt_7d
    from public.reviews where app_id = a.id and user_id is distinct from a.developer_id and hidden_at is null and (a.is_demo or not is_demo)) rv on true
  left join lateral (
    select count(*)::int cnt, (count(*) filter (where created_at > now() - interval '7 days'))::int cnt_7d
    from public.favorites where app_id = a.id) f on true
  left join lateral (
    select
      (count(*) filter (where event_type = 'open_app' and created_at > now() - interval '7 days'))::int opens_7d,
      (count(*) filter (where event_type = 'open_app' and created_at > now() - interval '30 days'))::int opens_30d,
      (count(*) filter (where event_type = 'install_click'))::int install_actions
    from public.app_events where app_id = a.id and created_at > now() - interval '90 days') e on true
  left join public.app_checks c on c.app_id = a.id
  left join lateral (
    select s.source_name, s.source_type, s.source_url, pt.slug as partner_slug
    from public.app_sources s left join public.partners pt on pt.id = s.partner_id
    where s.app_id = a.id and s.source_type='launched_on' order by s.created_at asc limit 1) s on true
  where a.status = 'published'
)
select
  b.*,
  public.ranking_score(b.rating, b.ratings_count, b.reviews_count, b.favorites_count, 0, 0, b.quality_passed) as ranking_score,
  public.trending_score(b.opens_7d, b.favorites_7d, b.reviews_7d, b.ratings_7d) as trending_score,
  lower(concat_ws(' ', b.name, b.tagline, b.description, b.category, b.build_tool, b.hosting_provider,
                  b.developer_name, b.developer_username, b.launch_source_name, b.domain)) as search_text,
  (select details from public.app_checks where app_id=b.id) as check_details,
  (select ownership_verified_at from public.apps where id=b.id) as ownership_verified_at,
  (select ownership_method from public.apps where id=b.id) as ownership_method,
  public.canonical_app_url(b.url) as canonical_url
from base b;


create or replace function public.rating_breakdown(p_app_id uuid)
returns table(stars int,total bigint) language sql stable as $$
 select s.stars,count(r.id) from generate_series(1,5) s(stars)
 left join public.ratings r on r.app_id=p_app_id and r.rating=s.stars
 and not exists(select 1 from public.apps a where a.id=p_app_id and a.developer_id=r.user_id)
 and (exists(select 1 from public.apps a where a.id=p_app_id and a.is_demo)
 or not exists(select 1 from public.profiles p where p.id=r.user_id and p.is_demo))
 group by s.stars order by s.stars desc;
$$;
create or replace function public.developer_dashboard(p_days int default 30)
returns jsonb language sql stable as $$
  with my_apps as (
    select id, name, slug, developer_id from public.apps where developer_id = auth.uid() and not is_demo
  ),
  ev as (
    select e.* from public.app_events e join my_apps m on m.id = e.app_id
    where e.created_at > now() - make_interval(days => least(30,greatest(1,p_days)))
  ),
  days as (select generate_series(current_date - (least(30,greatest(1,p_days)) - 1), current_date, interval '1 day')::date as d)
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'views', (select count(*) from ev where event_type = 'view'),
      'opens', (select count(*) from ev where event_type = 'open_app'),
      'installActions', (select count(*) from ev where event_type = 'install_click'),
      'guidanceViews', (select count(*) from ev where event_type = 'install_instruction_view'),
      'favorites', (select count(*) from public.favorites f join my_apps m on m.id = f.app_id where f.created_at > now()-make_interval(days=>least(30,greatest(1,p_days)))),
      'ratings', (select count(*) from public.ratings r join my_apps m on m.id = r.app_id and r.user_id is distinct from m.developer_id where r.created_at > now()-make_interval(days=>least(30,greatest(1,p_days)))),
      'reviews', (select count(*) from public.reviews r join my_apps m on m.id = r.app_id and r.user_id is distinct from m.developer_id where r.hidden_at is null and r.created_at > now()-make_interval(days=>least(30,greatest(1,p_days)))),
      'averageRating', coalesce((select round(avg(r.rating), 2) from public.ratings r join my_apps m on m.id = r.app_id and r.user_id is distinct from m.developer_id), 0)
    ),
    'series', coalesce((select jsonb_agg(jsonb_build_object(
        'date', d.d,
        'views', (select count(*) from ev where event_type = 'view' and created_at::date = d.d),
        'opens', (select count(*) from ev where event_type = 'open_app' and created_at::date = d.d),
        'installActions', (select count(*) from ev where event_type = 'install_click' and created_at::date = d.d)
      ) order by d.d) from days d), '[]'::jsonb),
    'trafficSources', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'count', c) order by c desc)
        from (select source, count(*) c from ev where event_type = 'view' group by source) x), '[]'::jsonb),
    'launchSources', coalesce((select jsonb_agg(jsonb_build_object('source', source_name, 'count', c) order by c desc)
        from (select s.source_name, count(*) c from public.app_sources s join my_apps m on m.id = s.app_id group by s.source_name) x), '[]'::jsonb),
    'topApps', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'slug', slug, 'opens', opens, 'views', views) order by opens desc)
        from (select m.name, m.slug,
                (count(*) filter (where ev.event_type = 'open_app')) opens,
                (count(*) filter (where ev.event_type = 'view')) views
              from my_apps m left join ev on ev.app_id = m.id group by m.id, m.name, m.slug limit 10) x), '[]'::jsonb)
  );
$$;

-- Scanner results are committed only for the URL that was actually observed.
create function public.record_app_checks(p_app_id uuid,p_url text,p_checks jsonb,p_details jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare a public.apps; c public.app_checks;
begin
 select * into a from public.apps where id=p_app_id for update;
 if not found or a.url is distinct from p_url then return false; end if;
 c := jsonb_populate_record(null::public.app_checks,p_checks);
 insert into public.app_checks(app_id,reachable,https_ok,manifest_ok,responsive,mobile_optimized,service_worker_ok,installable,offline_support,push_support,security_ok,status_code,response_ms,details,last_checked_at)
 values(a.id,c.reachable,c.https_ok,c.manifest_ok,null,null,null,null,null,null,null,c.status_code,c.response_ms,p_details,now())
 on conflict(app_id) do update set reachable=excluded.reachable,https_ok=excluded.https_ok,manifest_ok=excluded.manifest_ok,
 responsive=null,mobile_optimized=null,service_worker_ok=null,installable=null,offline_support=null,push_support=null,security_ok=null,
 status_code=excluded.status_code,response_ms=excluded.response_ms,details=excluded.details,last_checked_at=excluded.last_checked_at;
 update public.apps set is_pwa=coalesce(c.manifest_ok,false),is_installable=false,
 health_status=case when c.reachable then case when c.response_ms>3000 then 'degraded' else 'online' end else 'offline' end,
 health_checked_at=now() where id=a.id;
 return true;
end $$;
revoke all on function public.record_app_checks(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.record_app_checks(uuid,text,jsonb,jsonb) to service_role;

create function public.reassign_app_owner(p_app_id uuid,p_username text,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare uid uuid;
begin
 if not public.is_admin() then raise exception 'Admin required'; end if;
 if coalesce(length(trim(p_reason)),0)<3 or length(p_reason)>500 then raise exception 'Reason required'; end if;
 select id into uid from public.profiles where username=p_username;
 if uid is null then raise exception 'Unknown user'; end if;
 perform 1 from public.apps where id=p_app_id for update;
 if not found then raise exception 'Unknown app'; end if;
 update public.apps set developer_id=uid,ownership_status='claim_pending',ownership_method=null,ownership_verified_at=null,verification_status='unverified',status='pending' where id=p_app_id;
 update public.app_claims set status='expired' where app_id=p_app_id;
 insert into public.admin_actions(admin_id,action,target_type,target_id,reason) values(auth.uid(),'reassign_owner','app',p_app_id,p_reason);
end $$;
revoke all on function public.reassign_app_owner(uuid,text,text) from public,anon;
grant execute on function public.reassign_app_owner(uuid,text,text) to authenticated;

create function public.review_null_rating() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.rating is null then select rating into new.rating from public.ratings where app_id=new.app_id and user_id=new.user_id; end if;
 return new;
end $$;
create trigger reviews_rating_projection before insert or update of rating on public.reviews for each row execute function public.review_null_rating();

create function public.protect_report_status() returns trigger language plpgsql as $$
begin
 if not public.is_admin() and not public.is_service_role() then new.status:='open'; end if;
 return new;
end $$;
create trigger reports_protect before insert on public.reports for each row execute function public.protect_report_status();

-- Minimal partner measurement access: membership is assigned by an admin, never by a referral code.
create table public.partner_members (
 partner_id uuid references public.partners(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete cascade,
 primary key(partner_id,user_id)
);
alter table public.partner_members enable row level security;
create policy partner_members_read on public.partner_members for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy partner_members_admin on public.partner_members for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.partner_members to authenticated;
create function public.partner_metrics(p_days int default 30) returns table(partner text,referral_code text,page_views bigint,outbound_opens bigint,guidance_views bigint)
language sql stable security definer set search_path=public as $$
 select p.name,p.referral_code,count(e.id) filter(where e.event_type='view'),count(e.id) filter(where e.event_type='open_app'),count(e.id) filter(where e.event_type='install_instruction_view')
 from public.partner_members m join public.partners p on p.id=m.partner_id and p.status='active' and not p.is_demo
 left join public.app_events e on e.partner_id=p.id and e.created_at>now()-make_interval(days=>least(30,greatest(1,p_days)))
 where m.user_id=auth.uid() group by p.id;
$$;
revoke all on function public.partner_metrics(int) from public,anon;
grant execute on function public.partner_metrics(int) to authenticated;

-- Dashboard aggregates must include other users' saves of MY apps. Invoker rights
-- silently counted only the owner's own favorites. This definer RPC still scopes
-- every query to apps.developer_id = auth.uid(), never a caller-supplied owner ID.
alter function public.developer_dashboard(int) security definer;
alter function public.developer_dashboard(int) set search_path = public;
revoke all on function public.developer_dashboard(int) from public,anon;
grant execute on function public.developer_dashboard(int) to authenticated;

-- New/changed app URLs must be navigable HTTP(S) URLs without credentials or whitespace.
-- NOT VALID preserves legacy records for explicit review instead of deleting or rewriting them.
alter table public.apps add constraint apps_http_url check(length(url)<=2048 and url ~ '^https?://[^/@[:space:]]+(/[^[:space:]]*)?$') not valid;

-- Seed partners must never become real attribution partners just because their names match.
update public.partners set is_demo=true where referral_code like 'demo-%';
create function public.mark_demo_partner() returns trigger language plpgsql as $$
begin
 if new.referral_code like 'demo-%' then new.is_demo:=true; end if;
 return new;
end $$;
create trigger partners_demo before insert or update on public.partners for each row execute function public.mark_demo_partner();
drop policy partners_read on public.partners;
create policy partners_read on public.partners for select using((status='active' and not is_demo) or public.is_admin());

-- Serialize quota checks for a user's concurrent inserts.
create or replace function public.enforce_hourly_limit() returns trigger
language plpgsql security definer set search_path=public as $$
declare max_rows int:=tg_argv[0]::int; window_txt text:=tg_argv[1]; col text:=tg_argv[2]; current_rows int; actor uuid;
begin
 actor := (to_jsonb(new)->>col)::uuid;
 perform 1 from public.profiles where id=actor for update;
 execute format('select count(*) from public.%I where %I=$1 and created_at>now()-$2::interval',tg_table_name,col) into current_rows using actor,window_txt;
 if current_rows>=max_rows then raise exception 'Rate limit exceeded'; end if;
 return new;
end $$;

-- Prior scanners inferred browser capabilities from HTML. Preserve those historical
-- values as unverified evidence, but do not present them as checked capabilities.
update public.app_checks set details=details || jsonb_build_object('legacy_unverified_capabilities',jsonb_build_object(
 'responsive',responsive,'mobile_optimized',mobile_optimized,'service_worker_ok',service_worker_ok,
 'installable',installable,'offline_support',offline_support,'push_support',push_support,'security_ok',security_ok)),
 responsive=null,mobile_optimized=null,service_worker_ok=null,installable=null,offline_support=null,push_support=null,security_ok=null;
update public.apps set is_installable=false where not is_demo;

grant all on public.partner_members to service_role;
