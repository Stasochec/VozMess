-- ==============================================================================
-- VOZDUXAN SECURITY PATCH  (idempotent — run in Supabase SQL Editor after schema.sql)
--
-- Fixes:
--   * any authenticated user could set their own role to 'owner'  (privilege escalation)
--   * any authenticated user could add themselves to any chat      (read all messages)
--   * register_user_direct wrote to auth.* and reset other users' passwords
--   * get_email_by_username leaked every email to anonymous callers (dropped)
--   * owner privileges derived from a self-chosen username
--   * public media bucket + unrestricted delete of other users' files
--   * broad anon grants on all tables, routines and future objects
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. GRANTS: no anonymous access, nothing inherited through PUBLIC by default.
-- ------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL ROUTINES  IN SCHEMA public FROM PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL     ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL     ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.profiles, public.chats, public.chat_members, public.messages
  TO authenticated;
REVOKE UPDATE ON public.chats, public.chat_members, public.messages FROM authenticated;
GRANT UPDATE (title, description, avatar_url, is_private, updated_at)
  ON public.chats TO authenticated;
GRANT UPDATE (role) ON public.chat_members TO authenticated;
GRANT UPDATE (content) ON public.messages TO authenticated;

-- Users may only edit their own cosmetic profile columns. role / is_verified /
-- has_vozdux_plus are never writable from the client.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (username, display_name, avatar_url, bio, is_hidden, last_seen)
  ON public.profiles TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. RESERVE THE CREATOR USERNAME
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_creator_username()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF LOWER(NEW.username) = 'stasochec' AND LOWER(OLD.username) <> 'stasochec' THEN
    RAISE EXCEPTION 'This username is reserved';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_creator_username() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_protect_creator_username ON public.profiles;
CREATE TRIGGER tr_protect_creator_username
  BEFORE UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_creator_username();

-- ------------------------------------------------------------------------------
-- 3. REMOVE THE AUTH BYPASSES
-- ------------------------------------------------------------------------------
-- Both functions are dropped outright, so no stale grant can resurrect them.
-- DROP IF EXISTS also makes this block safe to re-run.
DROP FUNCTION IF EXISTS public.register_user_direct(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_email_by_username(TEXT);

-- Username no longer confers privileges; strip anything it granted historically.
UPDATE public.profiles
   SET role = 'user',
       is_verified = FALSE,
       has_vozdux_plus = FALSE,
       custom_title = NULL
 WHERE LOWER(username) = 'stasochec';

-- ------------------------------------------------------------------------------
-- 4. SIGNUP TRIGGER: new accounts always start as plain users.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  raw_username TEXT;
  clean_username TEXT;
  raw_display_name TEXT;
BEGIN
  raw_username := COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1));
  clean_username := LOWER(REGEXP_REPLACE(raw_username, '[^a-zA-Z0-9_]', '', 'g'));

  IF clean_username IS NULL OR LENGTH(clean_username) < 2 THEN
    clean_username := 'user_' || SUBSTRING(NEW.id::text, 1, 6);
  END IF;
  IF LOWER(clean_username) = 'stasochec'
     OR EXISTS (SELECT 1 FROM public.profiles WHERE username = clean_username) THEN
    clean_username := clean_username || '_' || SUBSTRING(NEW.id::text, 1, 4);
  END IF;

  raw_display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', clean_username);

  INSERT INTO public.profiles (id, username, display_name, avatar_url, bio, role,
                               custom_title, is_verified, has_vozdux_plus)
  VALUES (NEW.id, clean_username, raw_display_name,
          NEW.raw_user_meta_data->>'avatar_url',
          'Пользуюсь мессенджером Vozduxan ⚡',
          'user', NULL, FALSE, FALSE);

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5. ROLE / MEMBERSHIP HELPERS
-- ------------------------------------------------------------------------------
-- Nickname availability is the only thing anonymous clients may ask about.
REVOKE ALL ON FUNCTION public.check_username_available(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_chat_member(p_chat_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.chat_members WHERE chat_id = p_chat_id AND user_id = p_user_id
  )
$$;
REVOKE ALL ON FUNCTION public.is_chat_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_chat_member(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_chat_admin(p_chat_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_id = p_chat_id AND user_id = p_user_id AND role IN ('owner', 'admin')
  )
$$;
REVOKE ALL ON FUNCTION public.is_chat_admin(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_chat_admin(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 8. CHAT LIFECYCLE RPCs
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_or_get_direct_chat(p_target_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_chat_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL OR p_target_user_id IS NULL OR v_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Invalid request';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT c.id INTO v_chat_id
  FROM public.chats c
  JOIN public.chat_members a ON a.chat_id = c.id AND a.user_id = v_user_id
  JOIN public.chat_members b ON b.chat_id = c.id AND b.user_id = p_target_user_id
  WHERE c.type = 'direct'
  LIMIT 1;
  IF v_chat_id IS NOT NULL THEN
    RETURN v_chat_id;
  END IF;

  INSERT INTO public.chats (type, created_by) VALUES ('direct', v_user_id) RETURNING id INTO v_chat_id;
  INSERT INTO public.chat_members (chat_id, user_id, role)
  VALUES (v_chat_id, v_user_id, 'owner'), (v_chat_id, p_target_user_id, 'member');

  RETURN v_chat_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_or_get_direct_chat(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_or_get_direct_chat(UUID) TO authenticated;

-- Joining by invite link: group chats accept anyone with the link (the link
-- itself is the secret, like Telegram's shared invite URLs).
CREATE OR REPLACE FUNCTION public.join_group_by_link(p_chat_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_chat RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT id, type INTO v_chat FROM public.chats WHERE id = p_chat_id;
  IF v_chat.id IS NULL OR v_chat.type <> 'group' THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = p_chat_id AND user_id = v_user_id) THEN
    RETURN TRUE;
  END IF;

  INSERT INTO public.chat_members (chat_id, user_id, role) VALUES (p_chat_id, v_user_id, 'member');
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.join_group_by_link(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_group_by_link(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 9. RLS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can join or add members" ON public.chat_members;
CREATE POLICY "Chat creator or admins add members"
ON public.chat_members FOR INSERT TO authenticated
WITH CHECK (
  (
    EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_id AND c.created_by = auth.uid())
    AND role IN ('owner', 'member')
  )
  OR (
    public.is_chat_admin(chat_id, auth.uid())
    AND role IN ('member', 'admin')
  )
);

DROP POLICY IF EXISTS "Admins can update member roles" ON public.chat_members;
DROP POLICY IF EXISTS "Chat admins update member roles" ON public.chat_members;
CREATE POLICY "Chat admins update member roles"
ON public.chat_members FOR UPDATE TO authenticated
USING (public.is_chat_admin(chat_id, auth.uid()) AND role <> 'owner')
WITH CHECK (public.is_chat_admin(chat_id, auth.uid()) AND role IN ('member', 'admin'));

DROP POLICY IF EXISTS "Users can leave chats" ON public.chat_members;
DROP POLICY IF EXISTS "Users can leave or admins remove members" ON public.chat_members;
CREATE POLICY "Users leave or admins remove members"
ON public.chat_members FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_chat_admin(chat_id, auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create chats" ON public.chats;
CREATE POLICY "Users create chats as themselves"
ON public.chats FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Creators or chat admins update chats" ON public.chats;
CREATE POLICY "Creators or chat admins update chats"
ON public.chats FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_chat_admin(id, auth.uid())
  OR public.get_my_role() = 'owner'
)
WITH CHECK (
  created_by = auth.uid()
  OR public.is_chat_admin(id, auth.uid())
  OR public.get_my_role() = 'owner'
);

DROP POLICY IF EXISTS "Messages insertable by chat members" ON public.messages;
CREATE POLICY "Members send non-system messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND is_system = FALSE
  AND public.is_chat_member(chat_id, auth.uid())
);

DROP POLICY IF EXISTS "Authors, mods or God can delete messages" ON public.messages;
CREATE POLICY "Authors or trusted moderators delete messages"
ON public.messages FOR DELETE TO authenticated
USING (
  sender_id = auth.uid()
  OR public.get_my_role() IN ('owner', 'moderator')
);

DROP POLICY IF EXISTS "Authors edit own messages" ON public.messages;
CREATE POLICY "Authors edit own messages"
ON public.messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid() AND is_system = FALSE)
WITH CHECK (sender_id = auth.uid() AND is_system = FALSE);

-- ------------------------------------------------------------------------------
-- 10. ADMIN RPCs — role checked server-side, never callable by anon.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_search_user(p_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  clean_q TEXT;
  res JSONB;
BEGIN
  IF public.get_my_role() NOT IN ('owner', 'moderator') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  clean_q := LOWER(REGEXP_REPLACE(TRIM(p_query), '^@', ''));
  IF clean_q = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT to_jsonb(p) INTO res
  FROM public.profiles p
  WHERE LOWER(p.username) = clean_q
     OR LOWER(p.username) LIKE clean_q || '%'
     OR LOWER(p.display_name) LIKE '%' || clean_q || '%'
  ORDER BY
    CASE
      WHEN LOWER(p.username) = clean_q THEN 1
      WHEN LOWER(p.username) LIKE clean_q || '%' THEN 2
      ELSE 3
    END
  LIMIT 1;

  IF res IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'profile', res);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_search_user(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_user(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_user_id UUID,
  p_role TEXT DEFAULT NULL,
  p_is_verified BOOLEAN DEFAULT NULL,
  p_has_vozdux_plus BOOLEAN DEFAULT NULL,
  p_custom_title TEXT DEFAULT NULL,
  p_is_hidden BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT := public.get_my_role();
BEGIN
  IF v_caller_role NOT IN ('owner', 'moderator') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  IF p_role IS NOT NULL THEN
    IF v_caller_role <> 'owner' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the owner can change roles');
    END IF;
    IF p_role NOT IN ('user', 'moderator') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid role');
    END IF;
    IF p_user_id = auth.uid() THEN
      RETURN jsonb_build_object('success', false, 'error', 'You cannot change your own role');
    END IF;
  END IF;

  UPDATE public.profiles
     SET role            = COALESCE(p_role, role),
         is_verified     = COALESCE(p_is_verified, is_verified),
         has_vozdux_plus = COALESCE(p_has_vozdux_plus, has_vozdux_plus),
         custom_title    = CASE WHEN p_custom_title IS NULL THEN custom_title
                                ELSE NULLIF(TRIM(p_custom_title), '') END,
         is_hidden       = COALESCE(p_is_hidden, is_hidden)
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_user(UUID, TEXT, BOOLEAN, BOOLEAN, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user(UUID, TEXT, BOOLEAN, BOOLEAN, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_hidden(p_target TEXT, p_is_hidden BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  clean_target TEXT;
  target_id UUID;
BEGIN
  IF public.get_my_role() NOT IN ('owner', 'moderator') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  clean_target := LOWER(REGEXP_REPLACE(TRIM(p_target), '^@', ''));
  SELECT id INTO target_id FROM public.profiles WHERE LOWER(username) = clean_target LIMIT 1;

  IF target_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  UPDATE public.profiles SET is_hidden = p_is_hidden WHERE id = target_id;
  RETURN jsonb_build_object('success', true, 'user_id', target_id, 'is_hidden', p_is_hidden);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_user_hidden(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_hidden(TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_confirm_user_email(p_target TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  target_user_id UUID;
  clean_target TEXT;
BEGIN
  IF public.get_my_role() <> 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  clean_target := LOWER(TRIM(p_target));

  SELECT u.id INTO target_user_id
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE LOWER(u.email) = clean_target
     OR LOWER(p.username) = LOWER(REGEXP_REPLACE(clean_target, '^@', ''))
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  UPDATE auth.users
     SET email_confirmed_at = NOW(),
         confirmation_token = COALESCE(confirmation_token, ''),
         recovery_token = COALESCE(recovery_token, ''),
         email_change_token_current = COALESCE(email_change_token_current, ''),
         email_change_token_new = COALESCE(email_change_token_new, ''),
         email_change = COALESCE(email_change, ''),
         phone_change_token = COALESCE(phone_change_token, ''),
         phone_change = COALESCE(phone_change, ''),
         reauthentication_token = COALESCE(reauthentication_token, ''),
         is_sso_user = COALESCE(is_sso_user, FALSE),
         is_anonymous = COALESCE(is_anonymous, FALSE)
   WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', target_user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_confirm_user_email(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_user_email(TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 11. BROADCAST (owner only)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.broadcast_god_announcement(announcement_text TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  chat_rec RECORD;
BEGIN
  IF public.get_my_role() <> 'owner' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF announcement_text IS NULL OR TRIM(announcement_text) = '' THEN
    RAISE EXCEPTION 'Empty announcement';
  END IF;

  FOR chat_rec IN SELECT id FROM public.chats LOOP
    INSERT INTO public.messages (chat_id, sender_id, content, is_system, expires_at)
    VALUES (chat_rec.id, auth.uid(), '⚡ ОФИЦИАЛЬНЫЙ АНОНС: ' || announcement_text,
            TRUE, NOW() + INTERVAL '14 days');
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.broadcast_god_announcement(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_god_announcement(TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 12. MAINTENANCE FUNCTIONS: internal only.
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.delete_expired_messages() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_message_storage() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clean_auth_user_nulls() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 13. STORAGE: private bucket, chat-membership scoped access.
--     Object path: <chat_id>/<uploader_id>/<file>
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.storage_path_chat_id(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v TEXT := split_part(p_name, '/', 1);
BEGIN
  IF v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN v::uuid;
  END IF;
  RETURN NULL;
END;
$$;

-- Path convention: <chat_id>/<uploader_id>/<filename>
-- Read: any member of the chat. Write: only into the caller's own subtree.
CREATE OR REPLACE FUNCTION public.is_chat_media_reader(p_name TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_user_id = auth.uid()
     AND public.storage_path_chat_id(p_name) IS NOT NULL
     AND public.is_chat_member(public.storage_path_chat_id(p_name), p_user_id)
$$;
REVOKE ALL ON FUNCTION public.is_chat_media_reader(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_chat_media_reader(TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_chat_media_writer(p_name TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_user_id = auth.uid()
     AND split_part(p_name, '/', 2) = p_user_id::text
     AND public.is_chat_media_reader(p_name, p_user_id)
$$;
REVOKE ALL ON FUNCTION public.is_chat_media_writer(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_chat_media_writer(TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.storage_path_chat_id(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_path_chat_id(TEXT) TO authenticated;

UPDATE storage.buckets SET public = FALSE WHERE id = 'chat-media';

DROP POLICY IF EXISTS "Public Read chat-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload chat-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete chat-media" ON storage.objects;
DROP POLICY IF EXISTS "Members read chat media" ON storage.objects;
DROP POLICY IF EXISTS "Members upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders or admins delete chat media" ON storage.objects;
DROP POLICY IF EXISTS "Legacy chat media readable" ON storage.objects;

CREATE POLICY "Members read chat media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media'
  AND public.is_chat_media_reader(name, auth.uid())
);

-- Legacy objects use the old <uploader_id>/<file> layout, which carries no chat
-- id. Resolve access through the message that references them instead.
CREATE POLICY "Legacy chat media readable"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media'
  AND public.storage_path_chat_id(name) IS NULL
  AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.media_url = name
      AND public.is_chat_member(m.chat_id, auth.uid())
  )
);

CREATE POLICY "Members upload chat media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND owner = auth.uid()
  AND public.is_chat_media_writer(name, auth.uid())
);

CREATE POLICY "Uploaders or admins delete chat media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (
    owner = auth.uid()
    OR public.is_chat_admin(public.storage_path_chat_id(name), auth.uid())
  )
);

-- ------------------------------------------------------------------------------
-- 14. EXISTING MEDIA
--     Object keys are left untouched: renaming rows in storage.objects does not
--     move the underlying object and would break every existing file. Old public
--     URLs are converted to object paths in messages.media_url so the client can
--     sign them; the "Legacy chat media readable" policy keeps them accessible
--     until the TTL removes them.
-- ------------------------------------------------------------------------------
UPDATE public.messages
   SET media_url = split_part(media_url, '/storage/v1/object/public/chat-media/', 2)
 WHERE media_url LIKE '%/storage/v1/object/public/chat-media/%'
   AND split_part(media_url, '/storage/v1/object/public/chat-media/', 2) <> '';

-- ------------------------------------------------------------------------------
-- 15. TTL CLEANUP understands both URL and object-path formats.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_message_storage()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  file_path TEXT;
BEGIN
  IF OLD.media_url IS NULL OR OLD.media_url = '' THEN
    RETURN OLD;
  END IF;

  IF OLD.media_url LIKE '%/storage/v1/object/public/chat-media/%' THEN
    file_path := split_part(OLD.media_url, '/storage/v1/object/public/chat-media/', 2);
  ELSIF OLD.media_url NOT LIKE 'http%' THEN
    file_path := OLD.media_url;
  END IF;

  IF file_path IS NOT NULL AND file_path <> '' THEN
    DELETE FROM storage.objects WHERE bucket_id = 'chat-media' AND name = file_path;
  END IF;

  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_message_storage() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 16. TTL ENFORCEMENT: expires_at can never exceed now()+14d.
--     (UPDATE content only — media_url/chat_id/sender_id immutable.)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clamp_message_ttl()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.chat_id := OLD.chat_id;
    NEW.sender_id := OLD.sender_id;
    NEW.media_url := OLD.media_url;
    NEW.media_type := OLD.media_type;
    NEW.is_system := OLD.is_system;
    NEW.created_at := OLD.created_at;
    NEW.is_read := OLD.is_read;
  END IF;

  IF NEW.expires_at IS NULL OR NEW.expires_at > NOW() + INTERVAL '14 days' THEN
    NEW.expires_at := NOW() + INTERVAL '14 days';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.clamp_message_ttl() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_clamp_message_ttl ON public.messages;
CREATE TRIGGER tr_clamp_message_ttl
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.clamp_message_ttl();

COMMIT;

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- ONE MANUAL STEP — choose the creator by real auth user id, not by username:
--
--   UPDATE public.profiles
--      SET role = 'owner', is_verified = TRUE,
--          has_vozdux_plus = TRUE, custom_title = 'Создатель'
--    WHERE id = '<AUTH_USER_UUID>';
-- ==============================================================================
