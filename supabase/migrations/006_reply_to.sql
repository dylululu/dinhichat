-- Trả lời một tin nhắn cụ thể
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS reply_to bigint
REFERENCES public.messages(id) ON DELETE SET NULL;

-- reply_to cũng bất biến sau khi tạo tin nhắn.
CREATE OR REPLACE FUNCTION public.restrict_message_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.id <> OLD.id
     OR NEW.sender_id <> OLD.sender_id
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.image_path IS DISTINCT FROM OLD.image_path
     OR NEW.remind_mode IS DISTINCT FROM OLD.remind_mode
     OR NEW.reply_to IS DISTINCT FROM OLD.reply_to THEN
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
