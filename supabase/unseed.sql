-- Removes ALL demo data created by seed.sql. Idempotent. Run this before going live with real users.
begin;
delete from public.apps where is_demo;                                   -- cascades ratings, reviews, favorites, events, checks, sources, screenshots
delete from public.partners where referral_code like 'demo-%';
delete from auth.users where email like '%@demo.pwanova.invalid';        -- cascades demo profiles
commit;
