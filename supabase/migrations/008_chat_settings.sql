CREATE TABLE IF NOT EXISTS public.chat_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cover_path text,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.chat_settings(id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read chat settings" ON public.chat_settings;
CREATE POLICY "Authenticated users can read chat settings"
ON public.chat_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can update chat settings" ON public.chat_settings;
CREATE POLICY "Authenticated users can update chat settings"
ON public.chat_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, UPDATE ON public.chat_settings TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_settings;
  END IF;
END;
$$;
