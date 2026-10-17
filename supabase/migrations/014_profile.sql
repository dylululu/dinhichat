-- 014_profile.sql: trang hồ sơ 2 tài khoản (thông tin cá nhân)
alter table public.profiles
  add column if not exists nickname text,
  add column if not exists birthday date,
  add column if not exists height_cm numeric(4,1),
  add column if not exists weight_kg numeric(4,1),
  add column if not exists shoe_size numeric(3,1),
  add column if not exists clothes_size text,
  add column if not exists blood_type text,
  add column if not exists fav_color text,
  add column if not exists fav_food text,
  add column if not exists hobbies text,
  add column if not exists likes text,
  add column if not exists dislikes text,
  add column if not exists allergies text,
  add column if not exists note text,
  add column if not exists avatar_path text,
  add column if not exists profile_updated_at timestamptz;

-- Ràng buộc độ dài (cột text dài tối đa 500 ký tự)
alter table public.profiles drop constraint if exists profiles_hobbies_len;
alter table public.profiles add constraint profiles_hobbies_len check (hobbies is null or char_length(hobbies) <= 500);
alter table public.profiles drop constraint if exists profiles_likes_len;
alter table public.profiles add constraint profiles_likes_len check (likes is null or char_length(likes) <= 500);
alter table public.profiles drop constraint if exists profiles_dislikes_len;
alter table public.profiles add constraint profiles_dislikes_len check (dislikes is null or char_length(dislikes) <= 500);
alter table public.profiles drop constraint if exists profiles_allergies_len;
alter table public.profiles add constraint profiles_allergies_len check (allergies is null or char_length(allergies) <= 500);
alter table public.profiles drop constraint if exists profiles_note_len;
alter table public.profiles add constraint profiles_note_len check (note is null or char_length(note) <= 500);

-- Các cột text ngắn tối đa 60 ký tự
alter table public.profiles drop constraint if exists profiles_nickname_len;
alter table public.profiles add constraint profiles_nickname_len check (nickname is null or char_length(nickname) <= 60);
alter table public.profiles drop constraint if exists profiles_clothes_size_len;
alter table public.profiles add constraint profiles_clothes_size_len check (clothes_size is null or char_length(clothes_size) <= 60);
alter table public.profiles drop constraint if exists profiles_blood_type_len;
alter table public.profiles add constraint profiles_blood_type_len check (blood_type is null or char_length(blood_type) <= 60);
alter table public.profiles drop constraint if exists profiles_fav_color_len;
alter table public.profiles add constraint profiles_fav_color_len check (fav_color is null or char_length(fav_color) <= 60);
alter table public.profiles drop constraint if exists profiles_fav_food_len;
alter table public.profiles add constraint profiles_fav_food_len check (fav_food is null or char_length(fav_food) <= 60);

-- Khoảng số (nullable)
alter table public.profiles drop constraint if exists profiles_height_range;
alter table public.profiles add constraint profiles_height_range check (height_cm is null or (height_cm >= 50 and height_cm <= 250));
alter table public.profiles drop constraint if exists profiles_weight_range;
alter table public.profiles add constraint profiles_weight_range check (weight_kg is null or (weight_kg >= 20 and weight_kg <= 300));
alter table public.profiles drop constraint if exists profiles_shoe_range;
alter table public.profiles add constraint profiles_shoe_range check (shoe_size is null or (shoe_size >= 20 and shoe_size <= 55));

-- RLS: giữ nguyên 2 policy cũ (authenticated đọc tất cả; chỉ update hồ sơ của chính mình).
-- Không thêm trigger chặn cột push_subscription/last_push_* (chỉ service role mới ghi được nhờ policy).

-- Realtime: thêm profiles vào publication supabase_realtime (nếu chưa có)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
