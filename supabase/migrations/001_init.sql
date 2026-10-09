-- 001_init.sql: DiNhiChat initial schema

-- Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  push_subscription jsonb
);

-- Messages table
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender_id uuid references public.profiles(id) not null default auth.uid(),
  content text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.messages enable row level security;

-- Policies for profiles
create policy "Authenticated users can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Policies for messages
create policy "Authenticated users can read messages"
  on public.messages for select
  to authenticated
  using (true);

create policy "Users can insert own messages"
  on public.messages for insert
  to authenticated
  with check (auth.uid() = sender_id);

-- Trigger on auth.users insert -> create profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enable realtime for messages
alter publication supabase_realtime add table public.messages;

-- Trigger insert on messages calling notify function via pg_net
create extension if not exists pg_net;

create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://tqzmqobxzlxgfiyujlyj.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('record', row_to_json(new)),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  return new;
end;
$$;

create or replace trigger on_message_insert_notify
  after insert on public.messages
  for each row execute function public.notify_on_message();

