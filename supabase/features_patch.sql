-- ==============================================================================
-- VOZDUXAN FEATURES PATCH — STAGE 1 (responds to messages, read receipts,
-- unread counters, pinned messages). Idempotent, run after security_patch.sql.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. SCHEMA: replies and pinned messages
-- ------------------------------------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS pinned_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to_id);

-- ------------------------------------------------------------------------------
-- 2. A reply must reference a message from the same chat.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_reply_target()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.reply_to_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = NEW.reply_to_id AND m.chat_id = NEW.chat_id
    ) THEN
      NEW.reply_to_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_reply_target() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_validate_reply_target ON public.messages;
CREATE TRIGGER tr_validate_reply_target
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.validate_reply_target();

-- ------------------------------------------------------------------------------
-- 3. READ RECEIPTS: one timestamp per member instead of a write per message.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_chat_read(p_chat_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.chat_members
     SET last_read_at = NOW()
   WHERE chat_id = p_chat_id
     AND user_id = auth.uid()
     AND last_read_at < NOW();
END;
$$;
REVOKE ALL ON FUNCTION public.mark_chat_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_chat_read(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. UNREAD COUNTERS in one round-trip (avoids N+1 on the chat list).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_unread_counts()
RETURNS TABLE (chat_id UUID, unread_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cm.chat_id, COUNT(m.id)
  FROM public.chat_members cm
  LEFT JOIN public.messages m
    ON m.chat_id = cm.chat_id
   AND m.created_at > cm.last_read_at
   AND m.sender_id <> cm.user_id
   AND COALESCE(m.is_system, FALSE) = FALSE
   AND m.expires_at > NOW()
  WHERE cm.user_id = auth.uid()
  GROUP BY cm.chat_id
$$;
REVOKE ALL ON FUNCTION public.get_unread_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_counts() TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. PINNED MESSAGES: any member of a direct chat, admins in groups.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_pinned_message(p_chat_id UUID, p_message_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_type TEXT;
  v_allowed BOOLEAN;
BEGIN
  SELECT type INTO v_type FROM public.chats WHERE id = p_chat_id;
  IF v_type IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chat not found');
  END IF;

  v_allowed :=
    (v_type = 'direct' AND public.is_chat_member(p_chat_id, auth.uid()))
    OR public.is_chat_admin(p_chat_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.chats c WHERE c.id = p_chat_id AND c.created_by = auth.uid());

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  IF p_message_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.messages m WHERE m.id = p_message_id AND m.chat_id = p_chat_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Message not found');
    END IF;
  END IF;

  UPDATE public.chats SET pinned_message_id = p_message_id WHERE id = p_chat_id;
  RETURN jsonb_build_object('success', true, 'pinned_message_id', p_message_id);
END;
$$;
REVOKE ALL ON FUNCTION public.set_pinned_message(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_pinned_message(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. TTL cleanup must also clear pins that point at expiring messages.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_pin_on_message_delete()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.chats SET pinned_message_id = NULL WHERE pinned_message_id = OLD.id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.clear_pin_on_message_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_clear_pin_on_message_delete ON public.messages;
CREATE TRIGGER tr_clear_pin_on_message_delete
  AFTER DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.clear_pin_on_message_delete();

COMMIT;

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
