-- ==============================================================================
-- VOZDUXAN FEATURES PATCH — STAGE 2: message reactions
-- Idempotent. Run in Supabase SQL Editor after features_patch.sql.
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON public.message_reactions(message_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read reactions" ON public.message_reactions;
CREATE POLICY "Members read reactions"
ON public.message_reactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id AND public.is_chat_member(m.chat_id, auth.uid())
  )
);

GRANT SELECT ON public.message_reactions TO authenticated;

-- Toggling a reaction is a single call; membership and authorship are checked
-- against the message's chat rather than trusted from the client.
CREATE OR REPLACE FUNCTION public.toggle_reaction(p_message_id UUID, p_emoji TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_chat_id UUID;
  v_exists  BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR p_emoji IS NULL OR char_length(p_emoji) > 16 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid request');
  END IF;

  SELECT chat_id INTO v_chat_id FROM public.messages WHERE id = p_message_id;
  IF v_chat_id IS NULL OR NOT public.is_chat_member(v_chat_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.message_reactions
    WHERE message_id = p_message_id AND user_id = auth.uid() AND emoji = p_emoji
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.message_reactions
    WHERE message_id = p_message_id AND user_id = auth.uid() AND emoji = p_emoji;
    RETURN jsonb_build_object('success', true, 'active', false);
  END IF;

  INSERT INTO public.message_reactions (message_id, user_id, emoji)
  VALUES (p_message_id, auth.uid(), p_emoji)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'active', true);
END;
$$;
REVOKE ALL ON FUNCTION public.toggle_reaction(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_reaction(UUID, TEXT) TO authenticated;

-- Reactions for a whole chat in one call, grouped for direct rendering.
CREATE OR REPLACE FUNCTION public.get_chat_reactions(p_chat_id UUID)
RETURNS TABLE (message_id UUID, emoji TEXT, count BIGINT, reacted_by_me BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.message_id, r.emoji, COUNT(*), BOOL_OR(r.user_id = auth.uid())
  FROM public.message_reactions r
  JOIN public.messages m ON m.id = r.message_id
  WHERE m.chat_id = p_chat_id
    AND public.is_chat_member(p_chat_id, auth.uid())
  GROUP BY r.message_id, r.emoji
$$;
REVOKE ALL ON FUNCTION public.get_chat_reactions(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chat_reactions(UUID) TO authenticated;

-- Realtime for reactions so they appear without a refresh.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

COMMIT;

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
