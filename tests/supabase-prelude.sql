-- Minimal stand-in for the Supabase-managed pieces our migrations rely on (roles, auth, storage).
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant anon, authenticated, service_role to postgres;

create schema auth;
create schema storage;
create table auth.users (
  id uuid primary key, instance_id uuid, aud varchar, role varchar, email varchar, encrypted_password varchar,
  confirmation_token varchar, recovery_token varchar, email_change_token_new varchar, email_change varchar,
  email_change_token_current varchar, phone_change text, phone_change_token varchar, reauthentication_token varchar,
  email_change_confirm_status smallint default 0,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;

create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;

grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
