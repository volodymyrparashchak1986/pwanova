-- PWANova V2 — buyer requests ("Request a tool"). Additive only.
--
-- Privacy model:
--   buyer_requests            requirements only. Public rows are readable by everybody.
--   buyer_request_contacts    who is asking and how to reach them. Readable by the buyer alone.
--   buyer_request_responses   a vendor says "we are interested". The vendor never sees who asked.
--   buyer_contact_consents    the buyer's explicit, dated decision to share contact details with ONE vendor.
-- A paid plan never unlocks contact data. Only a consent row does, and it can be revoked.

create table public.buyer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  public_id text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  title text not null check (char_length(title) between 8 and 140),
  problem text not null check (char_length(problem) between 20 and 3000),
  locale text not null default 'en' check (locale ~ '^[a-z]{2}$'),
  team_size text check (team_size in ('1', '2-10', '11-50', '51-200', '201-1000', '1000+')),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  languages text[] not null default '{}',
  budget_max_cents int check (budget_max_cents >= 0),
  budget_currency text not null default 'EUR' check (budget_currency ~ '^[A-Z]{3}$'),
  budget_per_user boolean not null default false,
  budget_interval text check (budget_interval in ('month', 'year', 'one_time')),
  category_slugs text[] not null default '{}',
  use_case_slugs text[] not null default '{}',
  required_facts text[] not null default '{}',          -- fact_attributes keys that must be "yes"
  required_integrations text[] not null default '{}',
  required_platforms text[] not null default '{}',
  must_have text[] not null default '{}',
  nice_to_have text[] not null default '{}',
  timeframe text check (timeframe in ('asap', '1-3-months', '3-6-months', 'exploring')),
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  status text not null default 'open' check (status in ('open', 'matched', 'closed', 'hidden')),
  moderation_note text check (char_length(moderation_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(languages) <= 10 and cardinality(category_slugs) <= 5 and cardinality(use_case_slugs) <= 8
         and cardinality(required_facts) <= 12 and cardinality(required_integrations) <= 12 and cardinality(required_platforms) <= 8
         and cardinality(must_have) <= 12 and cardinality(nice_to_have) <= 12)
);
create index buyer_requests_status_idx on public.buyer_requests (status, visibility, created_at desc);
create index buyer_requests_user_idx on public.buyer_requests (user_id, created_at desc);
create trigger buyer_requests_updated_at before update on public.buyer_requests
  for each row execute function public.set_updated_at();

create table public.buyer_request_contacts (
  request_id uuid primary key references public.buyer_requests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  contact_name text check (char_length(contact_name) <= 120),
  contact_email text check (char_length(contact_email) <= 254),
  company_name text check (char_length(company_name) <= 160),
  phone text check (char_length(phone) <= 40),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger buyer_request_contacts_updated_at before update on public.buyer_request_contacts
  for each row execute function public.set_updated_at();

create table public.buyer_request_matches (
  request_id uuid not null references public.buyer_requests (id) on delete cascade,
  app_id uuid not null references public.apps (id) on delete cascade,
  rank smallint not null check (rank between 1 and 10),
  score numeric(6, 3) not null,
  reasons jsonb not null default '{}'::jsonb,     -- which requirements matched, which are unverified, which are missing
  created_at timestamptz not null default now(),
  primary key (request_id, app_id)
);
create index buyer_request_matches_app_idx on public.buyer_request_matches (app_id, created_at desc);

create table public.buyer_request_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.buyer_requests (id) on delete cascade,
  app_id uuid not null references public.apps (id) on delete cascade,
  vendor_user_id uuid not null references public.profiles (id) on delete cascade,
  message text check (char_length(message) <= 2000),
  status text not null default 'interested' check (status in ('interested', 'withdrawn', 'declined', 'contact_shared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, app_id)
);
create index buyer_request_responses_vendor_idx on public.buyer_request_responses (vendor_user_id, created_at desc);
create trigger buyer_request_responses_updated_at before update on public.buyer_request_responses
  for each row execute function public.set_updated_at();

create table public.buyer_contact_consents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.buyer_requests (id) on delete cascade,
  response_id uuid not null unique references public.buyer_request_responses (id) on delete cascade,
  granted_by uuid not null references public.profiles (id) on delete cascade,
  shared_fields text[] not null check (shared_fields <@ array['contact_name', 'contact_email', 'company_name', 'phone', 'note']::text[] and cardinality(shared_fields) >= 1),
  consent_text text not null check (char_length(consent_text) <= 600),   -- the exact wording the buyer agreed to
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- ---------------------------------------------------------------- helpers
create or replace function public.owns_request(p_request_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.buyer_requests where id = p_request_id and user_id = auth.uid());
$$;

create or replace function public.request_is_public(p_request_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.buyer_requests where id = p_request_id and visibility = 'public' and status in ('open', 'matched'));
$$;

-- A vendor may see the requirements of a request (never the person) when one of their verified
-- listings was matched to it, or when the request is public.
create or replace function public.vendor_can_see_request(p_request_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.request_is_public(p_request_id) or exists (
    select 1 from public.buyer_request_matches m
    join public.apps a on a.id = m.app_id
    join public.buyer_requests r on r.id = m.request_id
    where m.request_id = p_request_id and a.developer_id = auth.uid() and a.ownership_status = 'verified_owner'
      and r.status in ('open', 'matched'));
$$;

create or replace function public.protect_buyer_request() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.is_service_role() or public.is_moderator() then return new; end if;
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.status := 'open';
    new.moderation_note := null;
  else
    new.user_id := old.user_id; new.public_id := old.public_id; new.moderation_note := old.moderation_note;
    if old.status = 'hidden' or new.status = 'hidden' then new.status := old.status; end if;
  end if;
  return new;
end $$;
create trigger buyer_requests_protect before insert or update on public.buyer_requests
  for each row execute function public.protect_buyer_request();
create trigger buyer_requests_z_limit before insert on public.buyer_requests
  for each row execute function public.enforce_hourly_limit('5', '1 day', 'user_id');

create or replace function public.protect_buyer_response() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.is_service_role() or public.is_moderator() then return new; end if;
  if tg_op = 'INSERT' then
    new.vendor_user_id := auth.uid();
    new.status := 'interested';
  else
    new.request_id := old.request_id; new.app_id := old.app_id; new.vendor_user_id := old.vendor_user_id;
    -- the vendor may withdraw; "declined" and "contact_shared" are the buyer's decisions
    if auth.uid() = old.vendor_user_id then
      if new.status not in (old.status, 'withdrawn', 'interested') or old.status in ('declined', 'contact_shared') then new.status := old.status; end if;
    else
      new.message := old.message;
      if new.status not in (old.status, 'declined') then new.status := old.status; end if;
    end if;
  end if;
  return new;
end $$;
create trigger buyer_request_responses_protect before insert or update on public.buyer_request_responses
  for each row execute function public.protect_buyer_response();
create trigger buyer_request_responses_z_limit before insert on public.buyer_request_responses
  for each row execute function public.enforce_hourly_limit('30', '1 day', 'vendor_user_id');

-- ---------------------------------------------------------------- consent
-- The buyer shares contact details with exactly one vendor response, and the wording is kept.
create or replace function public.share_contact(p_response_id uuid, p_fields text[], p_consent_text text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r public.buyer_request_responses;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into r from public.buyer_request_responses where id = p_response_id for update;
  if not found or not public.owns_request(r.request_id) then raise exception 'Not your request'; end if;
  if r.status not in ('interested', 'contact_shared') then raise exception 'This vendor is no longer interested'; end if;
  if not exists (select 1 from public.buyer_request_contacts c where c.request_id = r.request_id) then
    raise exception 'Add contact details to the request first';
  end if;
  insert into public.buyer_contact_consents (request_id, response_id, granted_by, shared_fields, consent_text)
  values (r.request_id, r.id, auth.uid(), p_fields, left(p_consent_text, 600))
  on conflict (response_id) do update set shared_fields = excluded.shared_fields, consent_text = excluded.consent_text,
    granted_at = now(), revoked_at = null
  returning id into v_id;
  update public.buyer_request_responses set status = 'contact_shared' where id = r.id;
  insert into public.notifications (user_id, kind, link, app_id, metadata)
  values (r.vendor_user_id, 'contact_shared', '/dashboard/requests', r.app_id, jsonb_build_object('request_id', r.request_id));
  return v_id;
end $$;
revoke all on function public.share_contact(uuid, text[], text) from public, anon;
grant execute on function public.share_contact(uuid, text[], text) to authenticated;

create or replace function public.revoke_contact(p_response_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.buyer_request_responses;
begin
  select * into r from public.buyer_request_responses where id = p_response_id for update;
  if not found or not public.owns_request(r.request_id) then raise exception 'Not your request'; end if;
  update public.buyer_contact_consents set revoked_at = now() where response_id = p_response_id and revoked_at is null;
  update public.buyer_request_responses set status = 'declined' where id = p_response_id;
end $$;
revoke all on function public.revoke_contact(uuid) from public, anon;
grant execute on function public.revoke_contact(uuid) to authenticated;

-- What a vendor gets after consent: only the fields the buyer chose, only while consent stands.
create or replace function public.shared_contact(p_response_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r public.buyer_request_responses;
  c public.buyer_request_contacts;
  k public.buyer_contact_consents;
begin
  select * into r from public.buyer_request_responses where id = p_response_id;
  if not found or r.vendor_user_id is distinct from auth.uid() then raise exception 'Not your response'; end if;
  select * into k from public.buyer_contact_consents where response_id = p_response_id and revoked_at is null;
  if not found then return null; end if;
  select * into c from public.buyer_request_contacts where request_id = r.request_id;
  if not found then return null; end if;
  return (select jsonb_object_agg(f.key, f.value) from jsonb_each(to_jsonb(c)) f where f.key = any (k.shared_fields))
         || jsonb_build_object('granted_at', k.granted_at);
end $$;
revoke all on function public.shared_contact(uuid) from public, anon;
grant execute on function public.shared_contact(uuid) to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.buyer_requests enable row level security;
alter table public.buyer_request_contacts enable row level security;
alter table public.buyer_request_matches enable row level security;
alter table public.buyer_request_responses enable row level security;
alter table public.buyer_contact_consents enable row level security;

create policy buyer_requests_read on public.buyer_requests for select using (
  user_id = auth.uid() or (visibility = 'public' and status in ('open', 'matched')) or public.vendor_can_see_request(id) or public.is_moderator());
create policy buyer_requests_insert on public.buyer_requests for insert to authenticated with check (user_id = auth.uid());
create policy buyer_requests_update on public.buyer_requests for update to authenticated
  using (user_id = auth.uid() or public.is_moderator()) with check (user_id = auth.uid() or public.is_moderator());
create policy buyer_requests_delete on public.buyer_requests for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- contact details: the buyer, and nobody else through the API (not even moderators)
create policy buyer_request_contacts_own on public.buyer_request_contacts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_request(request_id));
revoke all on public.buyer_request_contacts from anon;

create policy buyer_request_matches_read on public.buyer_request_matches for select to authenticated using (
  public.owns_request(request_id) or public.is_moderator()
  or exists (select 1 from public.apps a where a.id = app_id and a.developer_id = auth.uid() and a.ownership_status = 'verified_owner'));
revoke insert, update, delete on public.buyer_request_matches from anon, authenticated;   -- written by the matcher (service role)

create policy buyer_request_responses_read on public.buyer_request_responses for select to authenticated using (
  vendor_user_id = auth.uid() or public.owns_request(request_id) or public.is_moderator());
create policy buyer_request_responses_insert on public.buyer_request_responses for insert to authenticated with check (
  vendor_user_id = auth.uid() and public.owns_app(app_id) and public.vendor_can_see_request(request_id) and not public.owns_request(request_id));
create policy buyer_request_responses_update on public.buyer_request_responses for update to authenticated
  using (vendor_user_id = auth.uid() or public.owns_request(request_id)) with check (vendor_user_id = auth.uid() or public.owns_request(request_id));

create policy buyer_contact_consents_read on public.buyer_contact_consents for select to authenticated using (
  granted_by = auth.uid() or exists (select 1 from public.buyer_request_responses r where r.id = response_id and r.vendor_user_id = auth.uid()));
revoke insert, update, delete on public.buyer_contact_consents from anon, authenticated;  -- only through share_contact() / revoke_contact()
