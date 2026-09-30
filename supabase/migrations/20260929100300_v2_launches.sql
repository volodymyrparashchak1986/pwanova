-- PWANova V2 — launches. Additive only.
-- A launch is a 30-day discovery window followed by a permanent record. There is no daily winner
-- and no raw vote count: the order comes from unique signed-in engagement, evidence and recency.

create table public.launches (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  submitted_by uuid references public.profiles (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,100}$'),
  headline text not null check (char_length(headline) between 5 and 120),
  description text check (char_length(description) <= 2000),
  headline_de text check (char_length(headline_de) <= 120),
  description_de text check (char_length(description_de) <= 2000),
  status text not null default 'pending' check (status in ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
  moderation_note text check (char_length(moderation_note) <= 500),
  launch_date date not null default current_date,
  window_start timestamptz,
  window_end timestamptz,
  is_sponsored boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (window_end is null or window_end > window_start)
);
create index launches_status_idx on public.launches (status, window_start desc);
create index launches_app_idx on public.launches (app_id, created_at desc);
create trigger launches_updated_at before update on public.launches
  for each row execute function public.set_updated_at();

create or replace function public.protect_launch() returns trigger
language plpgsql set search_path = public as $$
declare trusted boolean := public.is_service_role() or public.is_moderator();
begin
  if tg_op = 'INSERT' then
    if not trusted then
      new.submitted_by := auth.uid();
      new.status := case when new.status = 'draft' then 'draft' else 'pending' end;
      new.moderation_note := null; new.is_sponsored := false;
      new.approved_at := null; new.approved_by := null; new.window_start := null; new.window_end := null;
    end if;
    if exists (select 1 from public.launches l where l.app_id = new.app_id and l.status in ('pending', 'approved')
               and (l.window_end is null or l.window_end > now())) then
      raise exception 'This app already has a launch in progress';
    end if;
  elsif not trusted then
    new.app_id := old.app_id; new.submitted_by := old.submitted_by; new.slug := old.slug;
    new.moderation_note := old.moderation_note; new.is_sponsored := old.is_sponsored;
    new.approved_at := old.approved_at; new.approved_by := old.approved_by;
    new.window_start := old.window_start; new.window_end := old.window_end; new.launch_date := old.launch_date;
    -- a maker can submit a draft, or cancel; approval is a moderator decision
    if not ((old.status = 'draft' and new.status in ('draft', 'pending'))
         or (old.status in ('draft', 'pending', 'approved') and new.status = 'cancelled')
         or new.status = old.status) then
      new.status := old.status;
    end if;
  end if;
  if new.status = 'approved' and new.window_start is null then
    new.window_start := greatest(now(), new.launch_date::timestamptz);
    new.window_end := new.window_start + interval '30 days';
    new.approved_at := coalesce(new.approved_at, now());
  end if;
  return new;
end $$;
create trigger launches_protect before insert or update on public.launches
  for each row execute function public.protect_launch();
create trigger launches_z_limit before insert on public.launches
  for each row execute function public.enforce_hourly_limit('5', '1 day', 'submitted_by');

alter table public.launches enable row level security;
create policy launches_read on public.launches for select using (
  (status = 'approved' and public.app_is_public(app_id)) or submitted_by = auth.uid() or public.manages_app(app_id) or public.is_moderator());
create policy launches_insert on public.launches for insert to authenticated with check (public.owns_app(app_id) or public.is_moderator());
create policy launches_update on public.launches for update to authenticated
  using (public.owns_app(app_id) or public.is_moderator()) with check (public.owns_app(app_id) or public.is_moderator());
create policy launches_delete on public.launches for delete to authenticated using (public.is_admin());

-- The launch board. Counts are distinct signed-in people inside the window; anonymous traffic and
-- repeated actions by one account add nothing. Sponsored launches get no organic weight for being sponsored.
create or replace view public.launch_board as
select
  l.id, l.slug, l.app_id, l.headline, l.description, l.headline_de, l.description_de, l.status, l.launch_date,
  l.window_start, l.window_end, l.is_sponsored, l.created_at,
  (l.window_end > now()) as in_window,
  a.slug as app_slug, a.name as app_name, a.tagline as app_tagline, a.icon_url as app_icon_url,
  a.verification_state, a.evidence_score, a.profile_completeness, a.is_demo,
  p.username as maker_username, coalesce(p.display_name, p.username) as maker_name,
  coalesce(e.saves, 0) as saves, coalesce(e.follows, 0) as follows, coalesce(e.reviews, 0) as reviews, coalesce(e.visitors, 0) as visitors,
  (ln(1 + 3 * coalesce(e.saves, 0) + 2 * coalesce(e.follows, 0) + 5 * coalesce(e.reviews, 0) + coalesce(e.visitors, 0))
   + 1.5 * a.evidence_score / 100.0
   + 0.5 * a.profile_completeness / 100.0
   + greatest(0, 1 - extract(epoch from (now() - l.window_start)) / (30 * 86400.0))
  )::real as launch_score
from public.launches l
join public.apps a on a.id = l.app_id and a.status = 'published' and a.duplicate_of is null
left join public.profiles p on p.id = a.developer_id
left join lateral (
  select
    (select count(distinct f.user_id) from public.favorites f where f.app_id = l.app_id and f.created_at between l.window_start and l.window_end and f.user_id is distinct from a.developer_id) as saves,
    (select count(distinct f.user_id) from public.follows f where f.app_id = l.app_id and f.created_at between l.window_start and l.window_end and f.user_id is distinct from a.developer_id) as follows,
    (select count(distinct r.user_id) from public.reviews r where r.app_id = l.app_id and r.created_at between l.window_start and l.window_end
       and r.hidden_at is null and not r.is_demo and char_length(r.body) >= 80 and r.user_id is distinct from a.developer_id) as reviews,
    (select count(distinct v.user_id) from public.app_events v where v.app_id = l.app_id and v.created_at between l.window_start and l.window_end
       and v.user_id is not null and v.event_type in ('open_app', 'launch_view') and v.user_id is distinct from a.developer_id) as visitors
) e on true
where l.status = 'approved';
grant select on public.launch_board to anon, authenticated, service_role;
