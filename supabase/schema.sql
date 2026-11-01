-- ==============================================================================
-- VOZDUXAN MESSENGER DATABASE SCHEMA (SUPABASE)
-- Чистый production-скрипт с защитой для создателя @stasochec («Панель Бога»)
-- Запускается в один клик в Supabase SQL Editor (100% идемпотентный)
-- ==============================================================================

-- 1. РАСШИРЕНИЯ
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Попытка включить pg_cron для регулярной очистки сообщений
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "pg_cron";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron extension not supported on this tier; cleanup function will still be available for invocation.';
END $$;

-- 2. ТАБЛИЦА ПРОФИЛЕЙ (PROFILES)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT DEFAULT 'Пользуюсь мессенджером Vozduxan ⚡',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'moderator', 'user')),
  custom_title TEXT DEFAULT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  has_vozdux_plus BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 3. ТАБЛИЦА ЧАТОВ (CHATS)
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'channel')),
  title TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. УЧАСТНИКИ ЧАТОВ (CHAT_MEMBERS)
CREATE TABLE IF NOT EXISTS public.chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_members_user ON public.chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat ON public.chat_members(chat_id);

-- 5. ТАБЛИЦА СООБЩЕНИЙ (MESSAGES) С АВТОУДАЛЕНИЕМ 14 ДНЕЙ (TTL)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  is_read BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON public.messages(chat_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON public.messages(expires_at);

-- 6. ТРИГГЕР НАЗНАЧЕНИЯ «БОГА» (@stasochec) И РЕГИСТРАЦИИ ПОЛЬЗОВАТЕЛЕЙ
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  raw_username TEXT;
  clean_username TEXT;
  raw_display_name TEXT;
BEGIN
  -- Извлекаем имя пользователя из user_metadata или email
  raw_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1)
  );

  clean_username := LOWER(REGEXP_REPLACE(raw_username, '[^a-zA-Z0-9_]', '', 'g'));
  IF clean_username IS NULL OR LENGTH(clean_username) < 2 THEN
    clean_username := 'user_' || SUBSTRING(NEW.id::text, 1, 6);
  END IF;

  -- Проверка на уникальность для предотвращения коллизий
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = clean_username) THEN
    clean_username := clean_username || '_' || SUBSTRING(NEW.id::text, 1, 4);
  END IF;

  raw_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    clean_username
  );

  -- ПРОВЕРКА СОЗДАТЕЛЯ: СТРОГО @stasochec ПОЛУЧАЕТ РОЛЬ OWNER И ПРИВИЛЕГИИ БОГА
  IF clean_username = 'stasochec' THEN
    INSERT INTO public.profiles (
      id,
      username,
      display_name,
      avatar_url,
      bio,
      role,
      custom_title,
      is_verified,
      has_vozdux_plus
    ) VALUES (
      NEW.id,
      'stasochec',
      COALESCE(NEW.raw_user_meta_data->>'display_name', 'stasochec'),
      NEW.raw_user_meta_data->>'avatar_url',
      'Создатель и архитектор Vozduxan ⚡',
      'owner',
      'Создатель',
      TRUE,
      TRUE
    );
  ELSE
    -- Обычный зарегистрированный пользователь
    INSERT INTO public.profiles (
      id,
      username,
      display_name,
      avatar_url,
      bio,
      role,
      custom_title,
      is_verified,
      has_vozdux_plus
    ) VALUES (
      NEW.id,
      clean_username,
      raw_display_name,
      NEW.raw_user_meta_data->>'avatar_url',
      'Пользуюсь мессенджером Vozduxan ⚡',
      'user',
      NULL,
      FALSE,
      FALSE
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. ФУНКЦИИ ПРОВЕРКИ НИКНЕЙМА И ВХОДА (RPC)
DROP FUNCTION IF EXISTS public.check_username_available(TEXT);
CREATE OR REPLACE FUNCTION public.check_username_available(check_username TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  clean_nick TEXT;
BEGIN
  clean_nick := LOWER(REGEXP_REPLACE(check_username, '^@', ''));
  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE LOWER(username) = clean_nick
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_email_by_username(TEXT);
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT AS $$
DECLARE
  found_email TEXT;
  clean_id TEXT;
BEGIN
  clean_id := LOWER(REGEXP_REPLACE(p_username, '^@', ''));

  SELECT u.email INTO found_email
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE LOWER(p.username) = clean_id
  LIMIT 1;

  RETURN found_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon, authenticated;

-- 8. АВТОУДАЛЕНИЕ СООБЩЕНИЙ СТАРШЕ 14 ДНЕЙ (TTL)
CREATE OR REPLACE FUNCTION public.delete_expired_messages()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM public.messages
  WHERE expires_at <= NOW() OR created_at < (NOW() - INTERVAL '14 days');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Расписание pg_cron (каждый час, с корректной обработкой вложенных блоков в PL/pgSQL)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('clean-expired-messages-hourly');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    BEGIN
      PERFORM cron.schedule(
        'clean-expired-messages-hourly',
        '0 * * * *',
        'SELECT public.delete_expired_messages();'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;

-- 9. STORAGE: БАКЕТ chat-media И ТРИГГЕР НА АВТОУДАЛЕНИЕ ФАЙЛОВ
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Read chat-media" ON storage.objects;
CREATE POLICY "Public Read chat-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "Authenticated Upload chat-media" ON storage.objects;
CREATE POLICY "Authenticated Upload chat-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "Authenticated Delete chat-media" ON storage.objects;
CREATE POLICY "Authenticated Delete chat-media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-media');

CREATE OR REPLACE FUNCTION public.cleanup_message_storage()
RETURNS TRIGGER AS $$
DECLARE
  file_path TEXT;
BEGIN
  IF OLD.media_url IS NOT NULL AND OLD.media_url LIKE '%/storage/v1/object/public/chat-media/%' THEN
    file_path := SUBSTRING(OLD.media_url FROM '/storage/v1/object/public/chat-media/(.*)');
    IF file_path IS NOT NULL AND file_path <> '' THEN
      DELETE FROM storage.objects
      WHERE bucket_id = 'chat-media' AND name = file_path;
    END IF;
  END IF;
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_cleanup_message_storage ON public.messages;
CREATE TRIGGER tr_cleanup_message_storage
  AFTER DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_message_storage();

-- 10. RPC «ПАНЕЛИ БОГА»: ГЛОБАЛЬНЫЙ АНОНС ВО ВСЕ ЧАТЫ
DROP FUNCTION IF EXISTS public.broadcast_god_announcement(TEXT);
CREATE OR REPLACE FUNCTION public.broadcast_god_announcement(announcement_text TEXT)
RETURNS VOID AS $$
DECLARE
  sender_user RECORD;
  chat_rec RECORD;
BEGIN
  SELECT username, role INTO sender_user
  FROM public.profiles
  WHERE id = auth.uid();

  -- Проверка прав: строго role owner и @stasochec
  IF sender_user.role <> 'owner' OR LOWER(sender_user.username) <> 'stasochec' THEN
    RAISE EXCEPTION 'Доступ запрещен. Только создатель @stasochec может делать глобальные анонсы.';
  END IF;

  FOR chat_rec IN SELECT id FROM public.chats LOOP
    INSERT INTO public.messages (
      chat_id,
      sender_id,
      content,
      is_system,
      expires_at
    ) VALUES (
      chat_rec.id,
      auth.uid(),
      '⚡ ОФИЦИАЛЬНЫЙ АНОНС ОТ @stasochec: ' || announcement_text,
      TRUE,
      NOW() + INTERVAL '14 days'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. REALTIME ВКЛЮЧЕНИЕ ДЛЯ messages И profiles
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.chats REPLICA IDENTITY FULL;
ALTER TABLE public.chat_members REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 12. ROW LEVEL SECURITY (RLS) ПОЛИТИКИ
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Профили: чтение всем авторизованным
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;
CREATE POLICY "Profiles readable by authenticated"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Профили: пользователь обновляет только свои данные, если не owner
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'owner'
    OR (
      role = (SELECT role FROM public.profiles WHERE id = auth.uid())
      AND has_vozdux_plus = (SELECT has_vozdux_plus FROM public.profiles WHERE id = auth.uid())
      AND is_verified = (SELECT is_verified FROM public.profiles WHERE id = auth.uid())
    )
  )
);

-- Профили: Создатель @stasochec («Панель Бога») может обновлять любые профили
DROP POLICY IF EXISTS "God can update any profile" ON public.profiles;
CREATE POLICY "God can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'owner'
    AND LOWER(username) = 'stasochec'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'owner'
    AND LOWER(username) = 'stasochec'
  )
);

-- Чаты: чтение участникам
DROP POLICY IF EXISTS "Chats visible to participants" ON public.chats;
CREATE POLICY "Chats visible to participants"
ON public.chats FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
  )
  OR created_by = auth.uid()
);

-- Чаты: создание
DROP POLICY IF EXISTS "Authenticated users can create chats" ON public.chats;
CREATE POLICY "Authenticated users can create chats"
ON public.chats FOR INSERT
TO authenticated
WITH CHECK (true);

-- Чаты: обновление
DROP POLICY IF EXISTS "Participants can update chats" ON public.chats;
CREATE POLICY "Participants can update chats"
ON public.chats FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
  )
);

-- Участники чатов: чтение
DROP POLICY IF EXISTS "Members visible to chat participants" ON public.chat_members;
CREATE POLICY "Members visible to chat participants"
ON public.chat_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members AS cm
    WHERE cm.chat_id = chat_members.chat_id
    AND cm.user_id = auth.uid()
  )
  OR user_id = auth.uid()
);

-- Участники чатов: добавление
DROP POLICY IF EXISTS "Users can join or add members" ON public.chat_members;
CREATE POLICY "Users can join or add members"
ON public.chat_members FOR INSERT
TO authenticated
WITH CHECK (true);

-- Участники чатов: удаление
DROP POLICY IF EXISTS "Users can leave chats" ON public.chat_members;
CREATE POLICY "Users can leave chats"
ON public.chat_members FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Сообщения: чтение участникам чата
DROP POLICY IF EXISTS "Messages readable by chat members" ON public.messages;
CREATE POLICY "Messages readable by chat members"
ON public.messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = messages.chat_id
    AND chat_members.user_id = auth.uid()
  )
);

-- Сообщения: отправка участникам чата
DROP POLICY IF EXISTS "Messages insertable by chat members" ON public.messages;
CREATE POLICY "Messages insertable by chat members"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.chat_id = messages.chat_id
    AND chat_members.user_id = auth.uid()
  )
);

-- Сообщения: удаление автором, модератором или Богом (@stasochec)
DROP POLICY IF EXISTS "Authors, mods or God can delete messages" ON public.messages;
CREATE POLICY "Authors, mods or God can delete messages"
ON public.messages FOR DELETE
TO authenticated
USING (
  auth.uid() = sender_id
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner', 'moderator')
);
