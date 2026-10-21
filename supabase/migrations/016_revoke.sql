-- 016_revoke.sql: thu hồi tin nhắn (revoked + xoá nội dung)

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS revoked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- Trigger 005 chặn đổi content → cho phép đổi khi chuyển sang revoked (sender thu hồi)
CREATE OR REPLACE FUNCTION public.restrict_message_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content
     AND NOT (NEW.revoked = true AND OLD.revoked = false) THEN
    RAISE EXCEPTION 'Message content cannot be changed';
  END IF;

  IF NEW.id <> OLD.id
     OR NEW.sender_id <> OLD.sender_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.image_path IS DISTINCT FROM OLD.image_path
     OR NEW.remind_mode IS DISTINCT FROM OLD.remind_mode THEN
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

-- Policy: người gửi được UPDATE tin của mình (đặt revoked + xoá nội dung)
DROP POLICY IF EXISTS "Sender can update own messages" ON public.messages;
CREATE POLICY "Sender can update own messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Tìm kiếm: loại tin đã thu hồi
CREATE OR REPLACE FUNCTION public.search_messages(q text, lim int default 30, before timestamptz default null)
RETURNS TABLE (
  id bigint, sender_id uuid, content text,
  image_path text, is_sticker boolean, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT m.id, m.sender_id, m.content, m.image_path, m.is_sticker, m.created_at
  FROM public.messages m
  WHERE m.content IS NOT NULL
    AND m.revoked = false
    AND $1 IS NOT NULL AND btrim($1) <> ''
    AND public.f_unaccent(lower(m.content)) LIKE
        '%' || public.f_unaccent(lower(
          replace(replace(replace(btrim($1), '\', '\\'), '%', '\%'), '_', '\_')
        )) || '%' ESCAPE '\'
    AND ($3 IS NULL OR m.created_at < $3)
  ORDER BY m.created_at DESC
  LIMIT least(greatest($2, 1), 50);
$$;

GRANT EXECUTE ON FUNCTION public.search_messages(text, int, timestamptz) TO authenticated;
