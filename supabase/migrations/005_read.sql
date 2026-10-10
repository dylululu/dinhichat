-- 005_read.sql: Thêm cột read_at và chính sách đã xem

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Policy update cho người nhận
DROP POLICY IF EXISTS "Recipient can update read_at on messages" ON public.messages;
CREATE POLICY "Recipient can update read_at on messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (sender_id <> auth.uid())
WITH CHECK (sender_id <> auth.uid());

-- Trigger BEFORE UPDATE: chỉ cho phép cập nhật read_at
CREATE OR REPLACE FUNCTION public.restrict_message_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.id <> OLD.id
     OR NEW.sender_id <> OLD.sender_id
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.image_path IS DISTINCT FROM OLD.image_path
     OR NEW.remind_mode IS DISTINCT FROM OLD.remind_mode
     OR NEW.remind_count IS DISTINCT FROM OLD.remind_count
     OR NEW.next_remind_at IS DISTINCT FROM OLD.next_remind_at
     OR NEW.remind_done IS DISTINCT FROM OLD.remind_done THEN
    RAISE EXCEPTION 'Only read_at can be updated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_restrict_message_update ON public.messages;
CREATE TRIGGER trg_restrict_message_update
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.restrict_message_update();

ALTER TABLE public.messages REPLICA IDENTITY FULL;
