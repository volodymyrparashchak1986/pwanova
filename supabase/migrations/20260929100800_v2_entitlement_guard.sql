-- PWANova V2: a paid capability is enforced by the database, not by the page that offers it.
--
-- Responding to buyer requests is part of Vendor Pro. While monetisation is not enforced
-- (site_settings.monetization.enforced = false, the state of the beta) every verified owner may respond.
-- Once it is enforced, a response needs an active entitlement for the listing, whatever client sends it.
--
-- Additive only.

create or replace function public.require_response_entitlement() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.is_service_role() or public.is_moderator() then return new; end if;
  if not public.feature_enabled('buyer_requests.respond', new.app_id) then
    raise exception 'Responding to buyer requests needs an active plan for this listing' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger buyer_request_responses_entitlement before insert on public.buyer_request_responses
  for each row execute function public.require_response_entitlement();
