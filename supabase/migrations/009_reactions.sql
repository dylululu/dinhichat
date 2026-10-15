-- Thả cảm xúc: mỗi người tối đa 1 cảm xúc trên 1 tin, chỉ thả vào tin của người khác.
create table if not exists public.reactions (
  message_id bigint not null references public.messages(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.reactions enable row level security;

-- Mọi người đăng nhập đều đọc được toàn bộ cảm xúc.
create policy "reactions_select"
  on public.reactions
  for select
  to authenticated
  using (true);

-- Chỉ tự thả; và chỉ vào tin của NGƯỜI KHÁC (không thả vào tin mình).
create policy "reactions_insert"
  on public.reactions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = reactions.message_id
        and m.sender_id <> auth.uid()
    )
  );

-- Đổi cảm xúc = update, chỉ sửa cảm xúc của chính mình.
create policy "reactions_update"
  on public.reactions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Bỏ cảm xúc = delete chỉ của chính mình.
create policy "reactions_delete"
  on public.reactions
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Realtime: gửi cả INSERT/UPDATE/DELETE; replica identity full để DELETE có message_id.
alter publication supabase_realtime add table public.reactions;

alter table public.reactions replica identity full;
