-- Public bucket for app icons and screenshots. Users may only write inside their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('app-media', 'app-media', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "app-media public read" on storage.objects for select using (bucket_id = 'app-media');
create policy "app-media own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'app-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "app-media own folder update" on storage.objects for update to authenticated
  using (bucket_id = 'app-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "app-media own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'app-media' and (storage.foldername(name))[1] = auth.uid()::text);
