-- 020_word_filter.sql: Bộ lọc lời lẽ (nhắc bình tĩnh khi nhắn từ thô lỗ / chửi thề)

CREATE TABLE IF NOT EXISTS public.word_filter (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  mode text NOT NULL DEFAULT 'confirm' CHECK (mode IN ('warn','confirm','block')),
  words text[] NOT NULL DEFAULT '{}',
  reminder_title text DEFAULT 'Bình tĩnh nào 💗',
  reminder_text text DEFAULT 'Lời nói có thể làm người mình thương tổn thương. Hít thở sâu rồi nhắn lại nhẹ nhàng hơn nhé.',
  updated_by uuid,
  updated_at timestamptz DEFAULT now()
);

-- Từ mặc định (chữ thường, giữ nguyên dấu)
INSERT INTO public.word_filter (id, words) VALUES (1, ARRAY[
  'mày','tao','m','t','mầy','tụi mày','bọn mày','thằng','con nhỏ',
  'đm','dm','đmm','dmm','vcl','vl','vkl','clgt','cc','cặc','lồn','đụ','địt','đéo','đ*t',
  'ngu','óc chó','mất dạy','khốn nạn','đồ điên','câm mồm','cút','biến đi','im đi'
]) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.word_filter ENABLE ROW LEVEL SECURITY;

-- Đọc: mọi user đăng nhập
DROP POLICY IF EXISTS "Authenticated users can read word filter" ON public.word_filter;
CREATE POLICY "Authenticated users can read word filter"
ON public.word_filter FOR SELECT TO authenticated USING (true);

-- Ghi: CHỈ user admin (RLS ở database, không phải ẩn nút ở giao diện)
DROP POLICY IF EXISTS "admin update" ON public.word_filter;
CREATE POLICY "admin update"
ON public.word_filter FOR UPDATE TO authenticated
USING (auth.uid() = 'b8ef50d7-73a6-4f2c-a977-c777392d27be'::uuid)
WITH CHECK (auth.uid() = 'b8ef50d7-73a6-4f2c-a977-c777392d27be'::uuid);

-- Không có policy INSERT / DELETE (authenticated không chèn/xóa được)

GRANT SELECT, UPDATE ON public.word_filter TO authenticated;
REVOKE INSERT, DELETE, TRUNCATE ON public.word_filter FROM authenticated, anon;

-- Trigger BEFORE UPDATE: chặn đổi cột id
CREATE OR REPLACE FUNCTION public.word_filter_block_id() RETURNS trigger AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'word_filter.id khong duoc doi';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_word_filter_block_id ON public.word_filter;
CREATE TRIGGER trg_word_filter_block_id
BEFORE UPDATE ON public.word_filter
FOR EACH ROW EXECUTE FUNCTION public.word_filter_block_id();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.word_filter;
