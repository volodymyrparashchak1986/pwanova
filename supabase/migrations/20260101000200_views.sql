-- Ranking, trending and the public app view.

-- Mirrors src/lib/ranking.ts. Weighted (Bayesian-like) rating + engagement + quality.
-- A single 5.0 rating cannot outrank an app with hundreds of strong ratings.
create or replace function public.ranking_score(
  avg_rating numeric, ratings_count int, reviews_count int, favorites_count int,
  opens_30d int, opens_7d int, quality_passed int
) returns numeric language sql immutable as $$
  select round((
    (((ratings_count::numeric / (ratings_count + 10)) * avg_rating + (10::numeric / (ratings_count + 10)) * 3.8) / 5) * 60
    + least(10, ln(1 + reviews_count) * 3)
    + least(8,  ln(1 + favorites_count) * 2)
    + least(10, ln(1 + opens_30d) * 1.6)
    + least(4,  ln(1 + opens_7d))
    + least(8,  quality_passed * 1.2)
  )::numeric, 3);
$$;

create or replace function public.trending_score(opens_7d int, favorites_7d int, reviews_7d int, ratings_7d int)
returns numeric language sql immutable as $$
  select (opens_7d * 1 + favorites_7d * 4 + reviews_7d * 5 + ratings_7d * 3)::numeric;
$$;

-- Runs with owner rights on purpose: aggregate event counts are public, raw events are not.
-- The view only ever exposes PUBLISHED apps.
create or replace view public.apps_public as
with base as (
  select
    a.*,
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
    from public.ratings where app_id = a.id) r on true
  left join lateral (
    select count(*)::int cnt, (count(*) filter (where created_at > now() - interval '7 days'))::int cnt_7d
    from public.reviews where app_id = a.id) rv on true
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
    where s.app_id = a.id order by s.created_at asc limit 1) s on true
  where a.status = 'published'
)
select
  b.*,
  public.ranking_score(b.rating, b.ratings_count, b.reviews_count, b.favorites_count, b.opens_30d, b.opens_7d, b.quality_passed) as ranking_score,
  public.trending_score(b.opens_7d, b.favorites_7d, b.reviews_7d, b.ratings_7d) as trending_score,
  lower(concat_ws(' ', b.name, b.tagline, b.description, b.category, b.build_tool, b.hosting_provider,
                  b.developer_name, b.developer_username, b.launch_source_name, b.domain)) as search_text
from base b;

grant select on public.apps_public to anon, authenticated;

-- Rating distribution for the app page.
create or replace function public.rating_breakdown(p_app_id uuid)
returns table (stars int, total bigint) language sql stable as $$
  select s.stars, count(r.id) from generate_series(1, 5) as s(stars)
  left join public.ratings r on r.app_id = p_app_id and r.rating = s.stars
  group by s.stars order by s.stars desc;
$$;

-- Developer analytics for the dashboard. security invoker: RLS limits events to owned apps.
create or replace function public.developer_dashboard(p_days int default 14)
returns jsonb language sql stable as $$
  with my_apps as (
    select id, name, slug from public.apps where developer_id = auth.uid()
  ),
  ev as (
    select e.* from public.app_events e join my_apps m on m.id = e.app_id
    where e.created_at > now() - make_interval(days => p_days)
  ),
  days as (select generate_series(current_date - (p_days - 1), current_date, interval '1 day')::date as d)
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'views', (select count(*) from ev where event_type = 'view'),
      'opens', (select count(*) from ev where event_type = 'open_app'),
      'installActions', (select count(*) from ev where event_type = 'install_click'),
      'favorites', (select count(*) from public.favorites f join my_apps m on m.id = f.app_id),
      'ratings', (select count(*) from public.ratings r join my_apps m on m.id = r.app_id),
      'reviews', (select count(*) from public.reviews r join my_apps m on m.id = r.app_id),
      'averageRating', coalesce((select round(avg(r.rating), 2) from public.ratings r join my_apps m on m.id = r.app_id), 0)
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
