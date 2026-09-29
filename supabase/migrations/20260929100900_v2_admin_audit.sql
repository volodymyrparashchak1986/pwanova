-- PWANova V2: settings and sponsor campaigns are changed directly by admins (row level security allows
-- it to nobody else). These two triggers make sure such a change leaves the same trace as every other
-- admin decision: who, when, the previous and the new value.
--
-- Additive only.

create or replace function public.audit_admin_tables() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_prev jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_next jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
begin
  if tg_table_name = 'site_settings' then
    -- operator details are personal data of the operator: the log records that they changed, not what they are
    if coalesce(new.key, old.key) = 'operator' then v_prev := '{"redacted": true}'::jsonb; v_next := '{"redacted": true}'::jsonb; end if;
    insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, previous, next, reason)
    values (auth.uid(), (select role from public.profiles where id = auth.uid()), 'settings.' || lower(tg_op), 'setting', null,
            v_prev, v_next, coalesce(new.key, old.key));
  else
    insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, app_id, previous, next)
    values (auth.uid(), (select role from public.profiles where id = auth.uid()), 'sponsor.' || lower(tg_op), 'sponsor',
            coalesce(new.id, old.id), coalesce(new.app_id, old.app_id), v_prev, v_next);
  end if;
  return null;
end $$;

create trigger site_settings_audit after insert or update or delete on public.site_settings
  for each row execute function public.audit_admin_tables();
create trigger sponsor_campaigns_audit after insert or update or delete on public.sponsor_campaigns
  for each row execute function public.audit_admin_tables();

-- A change of role (appointing or removing a moderator) is an admin decision like any other.
create or replace function public.audit_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, previous, next)
    values (auth.uid(), (select role from public.profiles where id = auth.uid()), 'profile.role', 'profile', new.id,
            jsonb_build_object('role', old.role), jsonb_build_object('role', new.role));
  end if;
  return null;
end $$;
create trigger profiles_role_audit after update of role on public.profiles
  for each row execute function public.audit_role_change();
