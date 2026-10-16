-- 012_search.sql: tìm kiếm tin nhắn không dấu (unaccent + pg_trgm)

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Wrapper immutable: bỏ dấu + chuyển đ/Đ thành d/D
create or replace function public.f_unaccent(text)
returns text
language sql immutable parallel safe
return translate(extensions.unaccent($1), 'đĐ', 'dD');

-- Chỉ mục GIN cho tìm kiếm chuỗi con không dấu
set local search_path = public, extensions;
create index if not exists messages_content_trgm
  on public.messages using gin (public.f_unaccent(lower(content)) gin_trgm_ops)
  where content is not null;

create or replace function public.search_messages(q text, lim int default 30, before timestamptz default null)
returns table (
  id bigint, sender_id uuid, content text,
  image_path text, is_sticker boolean, created_at timestamptz
)
language sql stable security invoker set search_path = public
as $$
  select m.id, m.sender_id, m.content, m.image_path, m.is_sticker, m.created_at
  from public.messages m
  where m.content is not null
    and $1 is not null and btrim($1) <> ''
    and public.f_unaccent(lower(m.content)) like
        '%' || public.f_unaccent(lower(
          replace(replace(replace(btrim($1), '\', '\\'), '%', '\%'), '_', '\_')
        )) || '%' escape '\'
    and ($3 is null or m.created_at < $3)
  order by m.created_at desc
  limit least(greatest($2, 1), 50);
$$;

grant execute on function public.f_unaccent(text) to authenticated;
grant execute on function public.search_messages(text, int, timestamptz) to authenticated;
