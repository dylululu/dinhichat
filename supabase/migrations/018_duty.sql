-- 018_duty.sql: Lịch trực điều dưỡng (chu kỳ ca 4 ngày + ngày điều chỉnh)

CREATE TABLE IF NOT EXISTS public.duty_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  anchor_date date NOT NULL DEFAULT '2026-11-02',
  anchor_index int NOT NULL DEFAULT 2 CHECK (anchor_index BETWEEN 1 AND 4),
  pattern text NOT NULL DEFAULT 'HC,HC,TRUC,NGHI',
  owner_name text,
  hc_time text DEFAULT '07:00-16:30',
  truc_time text DEFAULT '07:00-07:00 (24h)',
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.duty_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.duty_overrides (
  day date PRIMARY KEY,
  shift text NOT NULL CHECK (shift IN ('HC','TRUC','NGHI','PHEP','TRUC_BU','KHAC')),
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.duty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read duty settings" ON public.duty_settings;
CREATE POLICY "Authenticated users can read duty settings"
ON public.duty_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can update duty settings" ON public.duty_settings;
CREATE POLICY "Authenticated users can update duty settings"
ON public.duty_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read duty overrides" ON public.duty_overrides;
CREATE POLICY "Authenticated users can read duty overrides"
ON public.duty_overrides FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert duty overrides" ON public.duty_overrides;
CREATE POLICY "Authenticated users can insert duty overrides"
ON public.duty_overrides FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update duty overrides" ON public.duty_overrides;
CREATE POLICY "Authenticated users can update duty overrides"
ON public.duty_overrides FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete duty overrides" ON public.duty_overrides;
CREATE POLICY "Authenticated users can delete duty overrides"
ON public.duty_overrides FOR DELETE TO authenticated USING (true);

GRANT SELECT, UPDATE ON public.duty_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_overrides TO authenticated;

-- Realtime: thêm 2 bảng vào publication supabase_realtime (nếu chưa có)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'duty_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.duty_settings;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'duty_overrides'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.duty_overrides;
  END IF;
END;
$$;
