-- PWANova V2: what a maker entered before proving ownership becomes a vendor statement once they prove it.
--
-- Until ownership is verified, everything a submitter enters is "user submitted": evidence waits for
-- review and structured details stay out of the public profile. That is deliberate: anybody can submit
-- a listing for a product they do not own. The moment control of the domain is demonstrated, the same
-- person is the vendor, and their earlier entries are their statements. History is append-only, so
-- evidence is copied as a new "vendor stated" row and the waiting row is marked as replaced.
--
-- Additive only. No existing row is deleted and no verified result is changed.

create or replace function public.promote_owner_statements() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ownership_status <> 'verified_owner' or old.ownership_status = 'verified_owner' or new.developer_id is null then
    return null;
  end if;

  update public.app_platforms set source_type = 'vendor_stated' where app_id = new.id and source_type = 'user_submitted' and created_by = new.developer_id;
  update public.app_languages set source_type = 'vendor_stated' where app_id = new.id and source_type = 'user_submitted' and created_by = new.developer_id;
  update public.app_integrations set source_type = 'vendor_stated' where app_id = new.id and source_type = 'user_submitted' and created_by = new.developer_id;
  update public.pricing_plans set source_type = 'vendor_stated' where app_id = new.id and source_type = 'user_submitted' and created_by = new.developer_id;
  update public.app_data_locations set source_type = 'vendor_stated' where app_id = new.id and source_type = 'user_submitted' and created_by = new.developer_id;
  update public.app_subprocessors set source_type = 'vendor_stated' where app_id = new.id and source_type = 'user_submitted' and created_by = new.developer_id;
  update public.app_ai_providers set source_type = 'vendor_stated' where app_id = new.id and source_type = 'user_submitted' and created_by = new.developer_id;
  update public.app_alternatives set source_type = 'vendor_stated' where app_id = new.id and source_type = 'user_submitted' and created_by = new.developer_id;

  -- Ownership must never fail because a statement could not be carried over.
  begin
    insert into public.app_evidence (app_id, attribute_key, value_state, value_text, value_json, source_type, verification_method,
                                     source_url, source_title, evidence_excerpt, status, submitted_by)
    select e.app_id, e.attribute_key, e.value_state, e.value_text, e.value_json, 'vendor_stated', 'vendor',
           e.source_url, e.source_title, e.evidence_excerpt, 'current', e.submitted_by
    from public.app_evidence e
    where e.app_id = new.id and e.submitted_by = new.developer_id and e.source_type = 'user_submitted' and e.status = 'pending_review'
    order by e.collected_at;

    update public.app_evidence set status = 'superseded', superseded_at = now(), review_note = 'Restated by the verified owner.'
    where app_id = new.id and submitted_by = new.developer_id and source_type = 'user_submitted' and status = 'pending_review';

    -- the company they described: re-evaluated by company_evidence(), now as the vendor's statement
    update public.companies set name = name where id = new.company_id and created_by = new.developer_id;
  exception when others then
    raise warning 'promote_owner_statements(%): %', new.id, sqlerrm;
  end;

  perform public.refresh_app_facts(new.id);
  perform public.refresh_app_trust(new.id);
  perform public.refresh_app_search(new.id);
  return null;
end $$;

create trigger apps_promote_owner_statements after update of ownership_status on public.apps
  for each row execute function public.promote_owner_statements();
