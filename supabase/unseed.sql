-- Removes ALL demo data created by seed.sql. Idempotent. Run this before going live with real users.
begin;
delete from public.apps where is_demo;                                   -- cascades ratings, reviews, favorites, events, checks, sources, screenshots
delete from public.partners where referral_code like 'demo-%';
do $$ begin                                                             -- V2 sample companies (local seed only); skipped on a v1 schema
  if to_regclass('public.companies') is not null then delete from public.companies where slug like 'demo-%'; end if;
end $$;
delete from auth.users where email like '%@demo.pwanova.invalid';        -- cascades demo profiles
commit;
