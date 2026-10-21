-- 015_banner.sql: banner sửa được nội dung (dùng chung cả hai máy)

ALTER TABLE public.chat_settings
  ADD COLUMN IF NOT EXISTS banner_text text,
  ADD COLUMN IF NOT EXISTS banner_card_text text,
  ADD COLUMN IF NOT EXISTS banner_fill_text text,
  ADD COLUMN IF NOT EXISTS banner_date text DEFAULT '10-20',
  ADD COLUMN IF NOT EXISTS banner_enabled boolean NOT NULL DEFAULT true;

-- Check độ dài nội dung
ALTER TABLE public.chat_settings DROP CONSTRAINT IF EXISTS chat_settings_banner_text_len;
ALTER TABLE public.chat_settings ADD CONSTRAINT chat_settings_banner_text_len
  CHECK (banner_text IS NULL OR char_length(banner_text) <= 200);

ALTER TABLE public.chat_settings DROP CONSTRAINT IF EXISTS chat_settings_banner_card_text_len;
ALTER TABLE public.chat_settings ADD CONSTRAINT chat_settings_banner_card_text_len
  CHECK (banner_card_text IS NULL OR char_length(banner_card_text) <= 500);

ALTER TABLE public.chat_settings DROP CONSTRAINT IF EXISTS chat_settings_banner_fill_text_len;
ALTER TABLE public.chat_settings ADD CONSTRAINT chat_settings_banner_fill_text_len
  CHECK (banner_fill_text IS NULL OR char_length(banner_fill_text) <= 200);

-- Ngày hiển thị: 'MM-DD' hợp lệ
ALTER TABLE public.chat_settings DROP CONSTRAINT IF EXISTS chat_settings_banner_date_fmt;
ALTER TABLE public.chat_settings ADD CONSTRAINT chat_settings_banner_date_fmt
  CHECK (banner_date IS NULL OR banner_date ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');

-- RLS: giữ policy cũ (select/update authenticated, id=1) — không đổi.
-- Realtime chat_settings đã bật từ 008.
