-- storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('cake-references','cake-references', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('product-images','product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- product-images: staff write, public read (already public bucket)
create policy "product_images_read" on storage.objects for select
  using (bucket_id = 'product-images');
create policy "product_images_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and is_staff());
create policy "product_images_update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and is_staff()) with check (bucket_id = 'product-images' and is_staff());
create policy "product_images_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and is_superadmin());

-- cake-references: writes only via service role (server route); public read
create policy "cake_refs_read" on storage.objects for select
  using (bucket_id = 'cake-references');
-- no authenticated/anon insert policies → only service role can write
