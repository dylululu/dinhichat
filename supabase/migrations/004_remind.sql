-- 004_remind.sql: add reminder features to messages

-- Add columns
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS remind_mode text NOT NULL DEFAULT 'none' CHECK (remind_mode IN ('none','1','2','loop'));
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS remind_count int NOT NULL DEFAULT 0;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS next_remind_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS remind_done boolean NOT NULL DEFAULT false;

-- Trigger to set next_remind_at on insert when mode is not none
CREATE OR REPLACE FUNCTION set_initial_remind() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.remind_mode <> 'none' THEN
    NEW.next_remind_at := NOW() + INTERVAL '30 seconds';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_initial_remind ON public.messages;
CREATE TRIGGER trg_set_initial_remind BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION set_initial_remind();

-- Index for pending reminders
CREATE INDEX IF NOT EXISTS idx_messages_next_remind ON public.messages (next_remind_at)
WHERE remind_done = false AND next_remind_at IS NOT NULL;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
