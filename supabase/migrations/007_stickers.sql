-- Sticker library and sticker messages
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS is_sticker boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.stickers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  path text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read stickers" ON public.stickers;
CREATE POLICY "Authenticated users can read stickers"
ON public.stickers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owners can add stickers" ON public.stickers;
CREATE POLICY "Owners can add stickers"
ON public.stickers FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can delete stickers" ON public.stickers;
CREATE POLICY "Owners can delete stickers"
ON public.stickers FOR DELETE TO authenticated
USING (owner_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.stickers TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.stickers_id_seq TO authenticated;

-- Keep sticker metadata immutable along with the other message content.
CREATE OR REPLACE FUNCTION public.restrict_message_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.id <> OLD.id
     OR NEW.sender_id <> OLD.sender_id
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.image_path IS DISTINCT FROM OLD.image_path
     OR NEW.remind_mode IS DISTINCT FROM OLD.remind_mode
     OR NEW.reply_to IS DISTINCT FROM OLD.reply_to
     OR NEW.is_sticker IS DISTINCT FROM OLD.is_sticker THEN
    RAISE EXCEPTION 'Message content cannot be changed';
  END IF;

  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (NEW.remind_count IS DISTINCT FROM OLD.remind_count
       OR NEW.next_remind_at IS DISTINCT FROM OLD.next_remind_at
       OR NEW.remind_done IS DISTINCT FROM OLD.remind_done) THEN
    RAISE EXCEPTION 'Only read_at can be updated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
