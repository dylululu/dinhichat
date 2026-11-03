-- 019_duty_anchors.sql: "Đổi tua" — nhiều mốc theo thời gian (chu kỳ vẫn 4 ngày)

CREATE TABLE IF NOT EXISTS public.duty_anchors (
  start_date date PRIMARY KEY,
  shift_index int NOT NULL CHECK (shift_index BETWEEN 1 AND 4),
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);

-- Chuyển mốc cũ từ duty_settings nếu bảng trống (mặc định 2026-11-02 = HC2)
INSERT INTO public.duty_anchors (start_date, shift_index, note)
SELECT s.anchor_date, s.anchor_index, 'Mốc ban đầu'
FROM public.duty_settings s
WHERE s.id = 1
  AND NOT EXISTS (SELECT 1 FROM public.duty_anchors a);

ALTER TABLE public.duty_anchors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read duty anchors" ON public.duty_anchors;
CREATE POLICY "Authenticated users can read duty anchors"
ON public.duty_anchors FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert duty anchors" ON public.duty_anchors;
CREATE POLICY "Authenticated users can insert duty anchors"
ON public.duty_anchors FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update duty anchors" ON public.duty_anchors;
CREATE POLICY "Authenticated users can update duty anchors"
ON public.duty_anchors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete duty anchors" ON public.duty_anchors;
CREATE POLICY "Authenticated users can delete duty anchors"
ON public.duty_anchors FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_anchors TO authenticated;

-- Realtime: thêm duty_anchors vào publication supabase_realtime (nếu chưa có)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'duty_anchors'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.duty_anchors;
  END IF;
END;
$$;
