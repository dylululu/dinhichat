-- 002_images.sql: Add image support

-- Add image_path column to messages
alter table public.messages add column if not exists image_path text;

-- Remove NOT NULL from content, add check
alter table public.messages alter column content drop not null;
alter table public.messages add constraint messages_content_or_image_check
  check (content is not null or image_path is not null);

-- Create private bucket chat-images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

-- Policy: authenticated can select from chat-images
create policy "Auth select chat-images"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'chat-images');

-- Policy: authenticated can insert into chat-images
create policy "Auth insert chat-images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-images');
