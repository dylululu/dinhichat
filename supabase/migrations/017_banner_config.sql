-- 017_banner_config.sql: mở rộng cấu hình banner (gỡ hardcode dịp lễ)

ALTER TABLE public.chat_settings
  ADD COLUMN IF NOT EXISTS banner_title text,
  ADD COLUMN IF NOT EXISTS banner_header_title text,
  ADD COLUMN IF NOT EXISTS banner_toast text,
  ADD COLUMN IF NOT EXISTS banner_emojis text,
  ADD COLUMN IF NOT EXISTS banner_color1 text,
  ADD COLUMN IF NOT EXISTS banner_color2 text,
  ADD COLUMN IF NOT EXISTS banner_end_date text,
  ADD COLUMN IF NOT EXISTS banner_fireworks boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS banner_falling boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS banner_marquee_speed int DEFAULT 14,
  ADD COLUMN IF NOT EXISTS banner_recipient text;

ALTER TABLE public.chat_settings DROP CONSTRAINT IF EXISTS chat_settings_banner_title_len;
ALTER TABLE public.chat_settings ADD CONSTRAINT chat_settings_banner_title_len
  CHECK (banner_title IS NULL OR char_length(banner_title) <= 60);

ALTER TABLE public.chat_settings DROP CONSTRAINT IF EXISTS chat_settings_banner_header_title_len;
ALTER TABLE public.chat_settings ADD CONSTRAINT chat_settings_banner_header_title_len
  CHECK (banner_header_title IS NULL OR char_length(banner_header_title) <= 40);

ALTER TABLE public.chat_settings DROP CONSTRAINT IF EXISTS chat_settings_banner_toast_len;
ALTER TABLE public.chat_settings ADD CONSTRAINT chat_settings_banner_toast_len
  CHECK (banner_toast IS NULL OR char_length(banner_toast) <= 80);

ALTER TABLE public.chat_settings DROP CONSTRAINT IF EXISTS chat_settings_banner_emojis_len;
ALTER TABLE public.chat_settings ADD CONSTRAINT chat_settings_banner_emojis_len
  CHECK (banner_emojis IS NULL OR char_length(banner_emojis) <= 60);

ALTER TABLE public.chat_settings DROP CONSTRAINT IF EXISTS chat_settings_banner_recipient_len;
ALTER TABLE public.chat_settings ADD CONSTRAINT chat_settings_banner_recipient_len
  CHECK (banner_recipient IS NULL OR char_length(banner_recipient) <= 30);

ALTER TABLE public.chat_settings DROP CONSTRAINT IF EXISTS chat_settings_banner_color1_fmt;
ALTER TABLE public.chat_settings ADD CONSTRAINT chat_settings_banner_color1_fmt
  CHECK (banner_color1 IS NULL OR banner_color1 ~ '^#[0-9a-fA-F]{6}$');

ALTER TABLE public.chat_settings DROP CONSTRAINT IF EXISTS chat_settings_banner_color2_fmt;
ALTER TABLE public.chat_settings ADD CONSTRAINT chat_settings_banner_color2_fmt
  CHECK (banner_color2 IS NULL OR banner_color2 ~ '^#[0-9a-fA-F]{6}$');

ALTER TABLE public.chat_settings DROP CONSTRAINT IF EXISTS chat_settings_banner_end_date_fmt;
ALTER TABLE public.chat_settings ADD CONSTRAINT chat_settings_banner_end_date_fmt
  CHECK (banner_end_date IS NULL OR banner_end_date ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');

ALTER TABLE public.chat_settings DROP CONSTRAINT IF EXISTS chat_settings_banner_speed_rng;
ALTER TABLE public.chat_settings ADD CONSTRAINT chat_settings_banner_speed_rng
  CHECK (banner_marquee_speed IS NULL OR banner_marquee_speed BETWEEN 6 AND 40);

-- RLS + realtime: giữ nguyên policy cũ (select/update authenticated, id=1) + publication từ 008.
