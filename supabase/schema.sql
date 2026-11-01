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
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 3. ТАБЛИЦА ЧАТОВ (CHATS)
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'channel')),
  title TEXT,
  description TEXT DEFAULT '',
  avatar_url TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

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

-- 7.1 ПРЯМАЯ РЕГИСТРАЦИЯ И АВТОПОДТВЕРЖДЕНИЕ БЕЗ SMTP (ОБХОД EMAIL RATE LIMIT)
DROP FUNCTION IF EXISTS public.register_user_direct(TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.register_user_direct(
  p_email TEXT,
  p_password TEXT,
  p_username TEXT DEFAULT '',
  p_display_name TEXT DEFAULT ''
)
RETURNS JSONB AS $$
DECLARE
  new_user_id UUID;
  clean_username TEXT;
  clean_email TEXT;
  encrypted_pw TEXT;
  existing_confirmed TIMESTAMPTZ;
  existing_user_id UUID;
BEGIN
  clean_email := LOWER(TRIM(p_email));
  clean_username := LOWER(REGEXP_REPLACE(COALESCE(p_username, ''), '[^a-zA-Z0-9_]', '', 'g'));

  IF clean_email IS NULL OR clean_email = '' OR clean_email NOT LIKE '%@%' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Укажите корректный адрес электронной почты');
  END IF;

  encrypted_pw := crypt(p_password, gen_salt('bf'));

  -- Проверяем, существует ли уже пользователь в auth.users
  SELECT id, email_confirmed_at INTO existing_user_id, existing_confirmed
  FROM auth.users
  WHERE LOWER(email) = clean_email
  LIMIT 1;

  IF existing_user_id IS NOT NULL THEN
    -- Если аккаунт уже подтвержден, сообщаем об этом
    IF existing_confirmed IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Пользователь с таким email уже зарегистрирован. Пожалуйста, выполните вход.');
    END IF;

    -- Если аккаунт не был подтвержден из-за лимита Supabase email rate limit:
    -- Подтверждаем email, обновляем пароль и очищаем NULL в токенах
    UPDATE auth.users
    SET email_confirmed_at = NOW(),
        encrypted_password = encrypted_pw,
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
    WHERE id = existing_user_id;

    -- Создаем identity, если отсутствует
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = existing_user_id) THEN
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), existing_user_id, jsonb_build_object('sub', existing_user_id::text, 'email', clean_email), 'email', existing_user_id::text, NOW(), NOW(), NOW()
      );
    END IF;

    -- Убеждаемся, что в profiles есть запись
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = existing_user_id) THEN
      IF clean_username = '' THEN
        clean_username := 'user_' || SUBSTRING(existing_user_id::text, 1, 6);
      END IF;

      INSERT INTO public.profiles (
        id, username, display_name, bio, role, is_verified, has_vozdux_plus
      ) VALUES (
        existing_user_id,
        clean_username,
        COALESCE(NULLIF(TRIM(p_display_name), ''), clean_username),
        'Пользуюсь мессенджером Vozduxan ⚡',
        CASE WHEN clean_username = 'stasochec' THEN 'owner' ELSE 'user' END,
        CASE WHEN clean_username = 'stasochec' THEN TRUE ELSE FALSE END,
        CASE WHEN clean_username = 'stasochec' THEN TRUE ELSE FALSE END
      );
    END IF;

    RETURN jsonb_build_object('success', true, 'user_id', existing_user_id, 'status', 'confirmed_existing');
  END IF;

  -- Новый пользователь: проверяем валидность никнейма
  IF clean_username IS NULL OR LENGTH(clean_username) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Никнейм должен содержать минимум 3 символа (латиница, цифры, _)');
  END IF;

  -- Проверяем занятость никнейма в profiles
  IF EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(username) = clean_username) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Никнейм @' || clean_username || ' уже занят');
  END IF;

  new_user_id := gen_random_uuid();

  -- Вставляем пользователя с ВСЕМИ строковыми полями (не NULL, а ''), чтобы GoTrue не падал с 500 Database error querying schema
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_current,
    email_change_token_new,
    email_change,
    phone_change_token,
    phone_change,
    reauthentication_token,
    is_sso_user,
    is_anonymous
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    clean_email,
    encrypted_pw,
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'username', clean_username,
      'display_name', COALESCE(NULLIF(TRIM(p_display_name), ''), clean_username)
    ),
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    FALSE,
    FALSE
  );

  -- Обязательно вставляем запись identity в auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', clean_email),
    'email',
    new_user_id::text,
    NOW(),
    NOW(),
    NOW()
  );

  RETURN jsonb_build_object('success', true, 'user_id', new_user_id, 'status', 'created_new');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.register_user_direct(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- 7.2 РУЧНОЕ ПОДТВЕРЖДЕНИЕ EMAIL АДМИНИСТРАТОРОМ (@stasochec)
DROP FUNCTION IF EXISTS public.admin_confirm_user_email(TEXT);
CREATE OR REPLACE FUNCTION public.admin_confirm_user_email(p_target TEXT)
RETURNS JSONB AS $$
DECLARE
  target_user_id UUID;
  caller_profile public.profiles%ROWTYPE;
  clean_target TEXT;
BEGIN
  -- Проверяем права вызывающего: строго @stasochec
  SELECT * INTO caller_profile
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_profile.username IS NULL OR LOWER(caller_profile.username) != 'stasochec' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Доступ разрешен исключительно создателю @stasochec');
  END IF;

  -- Авто-повышение роли создателя в базе, если она еще не owner
  IF caller_profile.role != 'owner' OR NOT caller_profile.is_verified OR NOT caller_profile.has_vozdux_plus THEN
    UPDATE public.profiles
    SET role = 'owner', is_verified = TRUE, has_vozdux_plus = TRUE, custom_title = 'Создатель'
    WHERE id = caller_profile.id;
  END IF;

  clean_target := LOWER(TRIM(p_target));

  -- Ищем целевого пользователя по email или никнейму
  SELECT u.id INTO target_user_id
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE LOWER(u.email) = clean_target
     OR LOWER(p.username) = LOWER(REGEXP_REPLACE(clean_target, '^@', ''))
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Пользователь не найден (укажите валидный email или @username)');
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

  -- Создаем identity, если отсутствовала
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = target_user_id) THEN
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    )
    SELECT
      gen_random_uuid(), u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', u.id::text, NOW(), NOW(), NOW()
    FROM auth.users u
    WHERE u.id = target_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', target_user_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_confirm_user_email(TEXT) TO anon, authenticated;

-- 7.3 РЕЖИМ НЕВИДИМКИ: СКРЫТИЕ АККАУНТА СОЗДАТЕЛЕМ (@stasochec)
DROP FUNCTION IF EXISTS public.admin_set_user_hidden(TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION public.admin_set_user_hidden(
  p_target TEXT,
  p_is_hidden BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
  caller_profile public.profiles%ROWTYPE;
  target_user public.profiles%ROWTYPE;
  clean_target TEXT;
BEGIN
  -- Проверяем права: строго создатель @stasochec или роль owner
  SELECT * INTO caller_profile
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_profile.username IS NULL OR (LOWER(caller_profile.username) != 'stasochec' AND caller_profile.role != 'owner') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Доступ разрешен исключительно создателю @stasochec');
  END IF;

  clean_target := LOWER(REGEXP_REPLACE(TRIM(p_target), '^@', ''));

  SELECT p.* INTO target_user
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE LOWER(p.username) = clean_target
     OR LOWER(COALESCE(u.email, '')) = clean_target
     OR LOWER(p.display_name) = clean_target
  LIMIT 1;

  IF target_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Пользователь ' || p_target || ' не найден');
  END IF;

  IF LOWER(target_user.username) = 'stasochec' AND p_is_hidden THEN
    RETURN jsonb_build_object('success', false, 'error', 'Нельзя скрыть аккаунт главного создателя @stasochec');
  END IF;

  UPDATE public.profiles
  SET is_hidden = p_is_hidden
  WHERE id = target_user.id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user.id,
    'username', target_user.username,
    'is_hidden', p_is_hidden
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.admin_set_user_hidden(TEXT, BOOLEAN) TO anon, authenticated;

-- 7.5 БЫСТРЫЙ ПОИСК ПОЛЬЗОВАТЕЛЯ ДЛЯ ПАНЕЛИ БОГА (ПО НИКУ, EMAIL, ИМЕНИ)
DROP FUNCTION IF EXISTS public.admin_search_user(TEXT);
CREATE OR REPLACE FUNCTION public.admin_search_user(p_query TEXT)
RETURNS JSONB AS $$
DECLARE
  clean_q TEXT;
  res JSONB;
BEGIN
  clean_q := LOWER(REGEXP_REPLACE(TRIM(p_query), '^@', ''));

  SELECT to_jsonb(p) INTO res
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE LOWER(p.username) = clean_q
     OR LOWER(p.username) LIKE clean_q || '%'
     OR LOWER(p.display_name) LIKE '%' || clean_q || '%'
     OR LOWER(COALESCE(u.email, '')) = clean_q
  ORDER BY
    CASE
      WHEN LOWER(p.username) = clean_q THEN 1
      WHEN LOWER(COALESCE(u.email, '')) = clean_q THEN 2
      WHEN LOWER(p.username) LIKE clean_q || '%' THEN 3
      ELSE 4
    END,
    p.created_at DESC
  LIMIT 1;

  IF res IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Пользователь не найден');
  END IF;

  RETURN jsonb_build_object('success', true, 'profile', res);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.admin_search_user(TEXT) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';

-- 7.4 СОЗДАНИЕ ИЛИ ПОЛУЧЕНИЕ DIRECT-ДИАЛОГА (БЕЗ РЕКУРСИИ И С АТОМАРНОСТЬЮ)
DROP FUNCTION IF EXISTS public.create_or_get_direct_chat(UUID);
CREATE OR REPLACE FUNCTION public.create_or_get_direct_chat(p_target_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_chat_id UUID;
  v_current_user_id UUID;
BEGIN
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Необходима авторизация';
  END IF;

  IF v_current_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Нельзя создать диалог с самим собой';
  END IF;

  -- 1. Ищем существующий общий личный диалог между двумя пользователями
  SELECT c.id INTO v_chat_id
  FROM public.chats c
  JOIN public.chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = v_current_user_id
  JOIN public.chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = p_target_user_id
  WHERE c.type = 'direct'
  LIMIT 1;

  IF v_chat_id IS NOT NULL THEN
    RETURN v_chat_id;
  END IF;

  -- 2. Создаем новый личный диалог
  INSERT INTO public.chats (type, created_by)
  VALUES ('direct', v_current_user_id)
  RETURNING id INTO v_chat_id;

  -- 3. Добавляем обоих участников
  INSERT INTO public.chat_members (chat_id, user_id, role)
  VALUES 
    (v_chat_id, v_current_user_id, 'owner'),
    (v_chat_id, p_target_user_id, 'member');

  RETURN v_chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_or_get_direct_chat(UUID) TO anon, authenticated;

-- Хелпер для получения роли текущего пользователя без RLS рекурсии
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT CASE
    WHEN LOWER(username) = 'stasochec' THEN 'owner'
    ELSE role
  END
  FROM public.profiles
  WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon, authenticated, service_role;

-- Хелпер для RLS без бесконечной рекурсии
CREATE OR REPLACE FUNCTION public.is_chat_member(p_chat_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_id = p_chat_id AND user_id = p_user_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_chat_member(UUID, UUID) TO anon, authenticated, service_role;

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

-- Профили: чтение всем авторизованным (с учетом скрытых профилей: видны только себе, Создателю @stasochec и модераторам)
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;
CREATE POLICY "Profiles readable by authenticated"
ON public.profiles FOR SELECT
TO authenticated
USING (
  NOT is_hidden
  OR id = auth.uid()
  OR public.get_my_role() IN ('owner', 'moderator')
);

-- Профили: пользователь обновляет только свои данные
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Профили: Создатель @stasochec («Панель Бога») может обновлять любые профили
DROP POLICY IF EXISTS "God can update any profile" ON public.profiles;
CREATE POLICY "God can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  public.get_my_role() = 'owner'
)
WITH CHECK (
  public.get_my_role() = 'owner'
);

-- Чаты: чтение участникам (через нерекурсивный хелпер)
DROP POLICY IF EXISTS "Chats visible to participants" ON public.chats;
CREATE POLICY "Chats visible to participants"
ON public.chats FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() OR public.is_chat_member(id, auth.uid())
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
  created_by = auth.uid() OR public.is_chat_member(id, auth.uid()) OR public.get_my_role() = 'owner'
);

-- Чаты: удаление (создатель, админы или Создатель @stasochec)
DROP POLICY IF EXISTS "Chat creator or owner can delete chat" ON public.chats;
CREATE POLICY "Chat creator or owner can delete chat"
ON public.chats FOR DELETE
TO authenticated
USING (
  created_by = auth.uid() OR public.get_my_role() = 'owner'
);

-- Участники чатов: чтение (без рекурсии: пользователь видит себя или соучастников чата)
DROP POLICY IF EXISTS "Members visible to chat participants" ON public.chat_members;
CREATE POLICY "Members visible to chat participants"
ON public.chat_members FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR public.is_chat_member(chat_id, auth.uid())
);

-- Участники чатов: добавление
DROP POLICY IF EXISTS "Users can join or add members" ON public.chat_members;
CREATE POLICY "Users can join or add members"
ON public.chat_members FOR INSERT
TO authenticated
WITH CHECK (true);

-- Участники чатов: обновление роли (назначение / снятие админа)
DROP POLICY IF EXISTS "Admins can update member roles" ON public.chat_members;
CREATE POLICY "Admins can update member roles"
ON public.chat_members FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.chat_id = public.chat_members.chat_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
  )
  OR public.get_my_role() = 'owner'
);

-- Участники чатов: удаление (выход из группы или исключение админами/владельцем)
DROP POLICY IF EXISTS "Users can leave chats" ON public.chat_members;
DROP POLICY IF EXISTS "Users can leave or admins remove members" ON public.chat_members;
CREATE POLICY "Users can leave or admins remove members"
ON public.chat_members FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.chat_id = public.chat_members.chat_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
  )
  OR public.get_my_role() = 'owner'
);

-- Сообщения: чтение участникам чата
DROP POLICY IF EXISTS "Messages readable by chat members" ON public.messages;
CREATE POLICY "Messages readable by chat members"
ON public.messages FOR SELECT
TO authenticated
USING (
  public.is_chat_member(chat_id, auth.uid())
);

-- Сообщения: отправка участникам чата
DROP POLICY IF EXISTS "Messages insertable by chat members" ON public.messages;
CREATE POLICY "Messages insertable by chat members"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND public.is_chat_member(chat_id, auth.uid())
);

-- Сообщения: удаление автором, модератором или Богом (@stasochec)
DROP POLICY IF EXISTS "Authors, mods or God can delete messages" ON public.messages;
CREATE POLICY "Authors, mods or God can delete messages"
ON public.messages FOR DELETE
TO authenticated
USING (
  auth.uid() = sender_id
  OR public.get_my_role() IN ('owner', 'moderator')
);

-- ==============================================================================
-- 13. ГРАНТЫ ДОСТУПА И ПЕРЕЗАГРУЗКА SCHEMA CACHE POSTGREST
-- Устраняет ошибку "Database error querying schema"
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- 14. ЛЕЧЕНИЕ "500: Database error querying schema" В SUPABASE AUTH (GOTRUE)
-- GoTrue падает с ошибкой "Database error querying schema", если в auth.users
-- строковые поля токенов равны NULL (Go struct Scan converting NULL to string).
-- ==============================================================================

-- 14.1 Очищаем NULL во всех существующих записях auth.users
UPDATE auth.users
SET
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
WHERE
  confirmation_token IS NULL
  OR recovery_token IS NULL
  OR email_change_token_current IS NULL
  OR email_change_token_new IS NULL
  OR email_change IS NULL
  OR phone_change_token IS NULL
  OR phone_change IS NULL
  OR reauthentication_token IS NULL
  OR is_sso_user IS NULL
  OR is_anonymous IS NULL;

-- 14.2 Восстанавливаем identities для пользователей без identity
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  u.id::text,
  NOW(),
  NOW(),
  NOW()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
);

-- 14.3 Защитный триггер: никогда не допускать NULL в строковых полях auth.users
CREATE OR REPLACE FUNCTION public.clean_auth_user_nulls()
RETURNS TRIGGER AS $$
BEGIN
  NEW.confirmation_token := COALESCE(NEW.confirmation_token, '');
  NEW.recovery_token := COALESCE(NEW.recovery_token, '');
  NEW.email_change_token_current := COALESCE(NEW.email_change_token_current, '');
  NEW.email_change_token_new := COALESCE(NEW.email_change_token_new, '');
  NEW.email_change := COALESCE(NEW.email_change, '');
  NEW.phone_change_token := COALESCE(NEW.phone_change_token, '');
  NEW.phone_change := COALESCE(NEW.phone_change, '');
  NEW.reauthentication_token := COALESCE(NEW.reauthentication_token, '');
  NEW.is_sso_user := COALESCE(NEW.is_sso_user, FALSE);
  NEW.is_anonymous := COALESCE(NEW.is_anonymous, FALSE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_clean_auth_user_nulls ON auth.users;
CREATE TRIGGER tr_clean_auth_user_nulls
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.clean_auth_user_nulls();
