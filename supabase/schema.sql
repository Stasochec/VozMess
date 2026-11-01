-- ==============================================================================
-- VOZDUXAN MESSENGER DATABASE SCHEMA (SUPABASE)
-- Полный самодостаточный скрипт инициализации БД
-- Запускается в один клик в Supabase SQL Editor
-- ==============================================================================

-- 1. РАСШИРЕНИЯ
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Попытка включить pg_cron (включен по умолчанию на Supabase Pro / кастомных инстансах)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "pg_cron";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron extension not enabled or not allowed on this plan, falling back to manual or client-side checks';
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

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 3. ТАБЛИЦА ЧАТОВ (CHATS)
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'channel', 'saved')),
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

-- 6. ТРИГГЕР ДЛЯ ПЕРВОГО ПОЛЬЗОВАТЕЛЯ («ДУРОВ» / OWNER)
-- Самый первый зарегистрировавшийся в системе получает права Owner, статус Verified и Vozdux++!
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  users_count INT;
  raw_username TEXT;
  clean_username TEXT;
BEGIN
  -- Считаем сколько профилей уже существует
  SELECT COUNT(*) INTO users_count FROM public.profiles;

  -- Формируем никнейм из метаданных или email
  raw_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1)
  );
  
  -- Очистка от спецсимволов и дефолтное имя
  clean_username := LOWER(REGEXP_REPLACE(raw_username, '[^a-zA-Z0-9_]', '', 'g'));
  IF clean_username IS NULL OR LENGTH(clean_username) < 3 THEN
    clean_username := 'vozdux_' || SUBSTRING(NEW.id::text, 1, 6);
  END IF;

  -- Проверка на уникальность
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = clean_username) THEN
    clean_username := clean_username || '_' || SUBSTRING(NEW.id::text, 1, 4);
  END IF;

  IF users_count = 0 THEN
    -- САМЫЙ ПЕРВЫЙ ПОЛЬЗОВАТЕЛЬ СТАНОВИТСЯ «ДУРОВЫМ» (OWNER)
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
      COALESCE(NEW.raw_user_meta_data->>'display_name', 'Создатель Vozduxan'),
      NEW.raw_user_meta_data->>'avatar_url',
      'Создатель и архитектор мессенджера Vozduxan ⚡',
      'owner',
      'Создатель Vozduxan',
      TRUE,
      TRUE
    );
  ELSE
    -- Обычный пользователь
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
      COALESCE(NEW.raw_user_meta_data->>'display_name', clean_username),
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

-- Привязка триггера к таблице auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. ФУНКЦИЯ И ТРИГГЕРЫ TTL: УДАЛЕНИЕ СООБЩЕНИЙ СТАРШЕ 14 ДНЕЙ
CREATE OR REPLACE FUNCTION public.delete_expired_messages()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM public.messages
  WHERE expires_at <= NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Планировщик pg_cron (каждый час проверяет и удаляет просроченные сообщения)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('clean-expired-messages-hourly');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
      PERFORM cron.schedule(
        'clean-expired-messages-hourly',
        '0 * * * *',
        'SELECT public.delete_expired_messages();'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping cron schedule registration (not supported in this environment)';
  END;
END $$;

-- 8. STORAGE: БАКЕТ ДЛЯ МЕДИА (chat-media)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Политики хранилища: чтение доступно всем, загрузка — авторизованным
CREATE POLICY "Public Read chat-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');

CREATE POLICY "Authenticated Upload chat-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

CREATE POLICY "Authenticated Delete own media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-media' AND (auth.uid() = owner OR auth.uid()::text = (storage.foldername(name))[1]));

-- Триггер для очистки файлов storage при удалении сообщения
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
  -- Не прерываем удаление сообщения, если удаление файла завершилось с ошибкой
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_cleanup_message_storage ON public.messages;
CREATE TRIGGER tr_cleanup_message_storage
  AFTER DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_message_storage();

-- 9. RPC ДЛЯ ГЛОБАЛЬНОГО ОПОВЕЩЕНИЯ (ТОЛЬКО ДЛЯ РОЛИ OWNER)
CREATE OR REPLACE FUNCTION public.broadcast_global_announcement(announcement_text TEXT)
RETURNS VOID AS $$
DECLARE
  sender_role TEXT;
  chat_rec RECORD;
BEGIN
  -- Проверяем роль текущего пользователя
  SELECT role INTO sender_role FROM public.profiles WHERE id = auth.uid();
  IF sender_role <> 'owner' THEN
    RAISE EXCEPTION 'Access denied. Only Owner can send global announcements.';
  END IF;

  -- Отправляем системное сообщение во все существующие чаты
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
      '📢 ОФИЦИАЛЬНОЕ ОПОВЕЩЕНИЕ VOZDUXAN: ' || announcement_text,
      TRUE,
      NOW() + INTERVAL '14 days'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. REALTIME ВКЛЮЧЕНИЕ
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

-- 11. ROW LEVEL SECURITY (RLS) ПОЛИТИКИ

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Профили: читать могут все аутентифицированные пользователи
CREATE POLICY "Profiles readable by authenticated"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Профили: редактировать может сам пользователь
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND (
    -- Обычный юзер не может повысить себя до owner или выдать vozdux_plus
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'owner'
    OR (role = (SELECT role FROM public.profiles WHERE id = auth.uid()) 
        AND has_vozdux_plus = (SELECT has_vozdux_plus FROM public.profiles WHERE id = auth.uid())
        AND is_verified = (SELECT is_verified FROM public.profiles WHERE id = auth.uid()))
  )
);

-- Профили: Owner может редактировать любой профиль (роли, бейджи, галочки)
CREATE POLICY "Owner can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'owner'
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'owner'
);

-- Чаты: читать могут участники чата
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

-- Чаты: создавать может любой авторизованный пользователь
CREATE POLICY "Authenticated users can create chats"
ON public.chats FOR INSERT
TO authenticated
WITH CHECK (true);

-- Чаты: обновлять могут участники
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
CREATE POLICY "Users can join or add members"
ON public.chat_members FOR INSERT
TO authenticated
WITH CHECK (true);

-- Участники чатов: удаление
CREATE POLICY "Users can leave chats"
ON public.chat_members FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Сообщения: чтение только участникам чата
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

-- Сообщения: отправка участниками чата
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

-- Сообщения: удаление автором сообщения или модератором/овнером
CREATE POLICY "Authors or mods can delete messages"
ON public.messages FOR DELETE
TO authenticated
USING (
  auth.uid() = sender_id
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner', 'moderator')
);
