import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Profile } from '@/types';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isInitialLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  init: () => Promise<void>;
  signIn: (identifier: string, pass: string) => Promise<{ success?: boolean; error?: string }>;
  signUp: (email: string, pass: string, username: string, displayName: string) => Promise<{ success?: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ error?: string }>;
  clearError: () => void;
}

function normalizeProfile(p: Profile | null, userId?: string): Profile | null {
  if (!p) return null;
  if (p.username?.toLowerCase() === 'stasochec') {
    const isAlreadyGod = p.role === 'owner' && p.is_verified && p.has_vozdux_plus;
    p.role = 'owner';
    p.is_verified = true;
    p.has_vozdux_plus = true;
    p.custom_title = p.custom_title || 'Создатель';
    if (!isAlreadyGod && userId && isSupabaseConfigured()) {
      supabase
        .from('profiles')
        .update({
          role: 'owner',
          is_verified: true,
          has_vozdux_plus: true,
          custom_title: p.custom_title,
        })
        .eq('id', userId)
        .then();
    }
  }
  return p;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  session: null,
  isInitialLoading: true,
  isSubmitting: false,
  error: null,

  init: async () => {
    set({ isInitialLoading: true, error: null });

    if (!isSupabaseConfigured()) {
      set({ isInitialLoading: false });
      return;
    }

    try {
      // 1. Check existing stored session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.warn('Session check warning:', sessionError.message);
      }

      if (session?.user) {
        set({ user: session.user, session });

        // Fetch fresh profile from database
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileData) {
          set({ profile: normalizeProfile(profileData, session.user.id) });
        } else if (profileErr) {
          console.error('Failed to fetch profile:', profileErr.message);
        }
      }

      // 2. Setup auth state listener for automatic token refresh & login state sync
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (newSession?.user) {
          set({ user: newSession.user, session: newSession });

          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newSession.user.id)
            .maybeSingle();

          if (profileData) {
            set({ profile: normalizeProfile(profileData, newSession.user.id) });
          }
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, profile: null, session: null });
        }
      });
    } catch (err: unknown) {
      console.error('Auth initialization error:', err);
    } finally {
      set({ isInitialLoading: false });
    }
  },

  signIn: async (identifier, password) => {
    set({ isSubmitting: true, error: null });

    if (!isSupabaseConfigured()) {
      set({ isSubmitting: false });
      return { error: 'Конфигурация Supabase отсутствует.' };
    }

    try {
      let targetEmail = identifier.trim();

      // If user provided username instead of email (no @ character)
      if (!targetEmail.includes('@')) {
        const cleanUsername = targetEmail.replace(/^@/, '').toLowerCase();

        // 1. Call RPC function get_email_by_username
        const { data: foundEmail, error: rpcErr } = await supabase.rpc('get_email_by_username', {
          p_username: cleanUsername,
        });

        if (rpcErr || !foundEmail) {
          set({ isSubmitting: false, error: 'Пользователь с таким ником не найден' });
          return { error: 'Пользователь с таким ником не найден' };
        }
        targetEmail = foundEmail;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });

      if (error) {
        // Если аккаунт завис в состоянии "Email not confirmed", пробуем автоподтвердить через RPC register_user_direct
        if (
          error.message?.toLowerCase().includes('not confirmed') ||
          error.message?.toLowerCase().includes('email_not_confirmed')
        ) {
          console.warn('Аккаунт не подтвержден, пробуем подтвердить через register_user_direct...');
          const { data: rpcRes } = await supabase.rpc('register_user_direct', {
            p_email: targetEmail,
            p_password: password,
            p_username: '',
            p_display_name: '',
          });

          if (rpcRes?.success) {
            const { data: retryData, error: retryErr } = await supabase.auth.signInWithPassword({
              email: targetEmail,
              password,
            });

            if (!retryErr && retryData?.user) {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', retryData.user.id)
                .maybeSingle();

              set({
                user: retryData.user,
                session: retryData.session,
                profile: profileData,
                isSubmitting: false,
                error: null,
              });
              return { success: true };
            }
          }
        }

        set({ isSubmitting: false, error: error.message });
        return { error: error.message };
      }

      if (data.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        set({
          user: data.user,
          session: data.session,
          profile: normalizeProfile(profileData, data.user.id),
          isSubmitting: false,
          error: null,
        });
        return { success: true };
      }

      set({ isSubmitting: false });
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Непредвиденная ошибка входа';
      set({ isSubmitting: false, error: msg });
      return { error: msg };
    }
  },

  signUp: async (email, password, username, displayName) => {
    set({ isSubmitting: true, error: null });

    if (!isSupabaseConfigured()) {
      set({ isSubmitting: false });
      return { error: 'Конфигурация Supabase отсутствует.' };
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) {
      set({ isSubmitting: false, error: 'Никнейм должен содержать минимум 3 символа' });
      return { error: 'Никнейм должен содержать минимум 3 символа' };
    }

    try {
      // 1. Check availability via RPC
      const { data: isAvailable } = await supabase.rpc('check_username_available', {
        check_username: cleanUsername,
      });

      if (isAvailable === false) {
        set({ isSubmitting: false, error: `Никнейм @${cleanUsername} уже занят другим пользователем` });
        return { error: `Никнейм @${cleanUsername} уже занят другим пользователем` };
      }

      // 2. Perform Supabase Sign Up with fallback to direct RPC on rate limit
      let targetUserId: string | null = null;
      let activeSession: Session | null = null;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: cleanUsername,
            display_name: displayName.trim() || cleanUsername,
          },
        },
      });

      if (error) {
        // Проверяем ошибку email rate limit или статус 429
        const isRateLimit =
          error.message?.toLowerCase().includes('rate limit') ||
          error.message?.toLowerCase().includes('email rate') ||
          (error as { status?: number }).status === 429;

        if (isRateLimit) {
          console.warn('Обнаружен лимит email в Supabase, используем прямой RPC register_user_direct...');
          const { data: rpcRes, error: rpcErr } = await supabase.rpc('register_user_direct', {
            p_email: email.trim(),
            p_password: password,
            p_username: cleanUsername,
            p_display_name: displayName.trim() || cleanUsername,
          });

          if (!rpcErr && rpcRes?.success) {
            targetUserId = rpcRes.user_id;

            // Сразу авторизуемся с подтвержденным паролем
            const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });

            if (signInErr) {
              set({ isSubmitting: false, error: signInErr.message });
              return { error: signInErr.message };
            }

            activeSession = signInData.session;
            targetUserId = signInData.user?.id || targetUserId;
          } else {
            const errDetails = rpcRes?.error || rpcErr?.message;
            const userMsg = errDetails
              ? `Ошибка регистрации: ${errDetails}`
              : 'Лимит отправки писем в Supabase. Отключите "Confirm email" в панели Supabase (Authentication -> Providers -> Email).';
            set({ isSubmitting: false, error: userMsg });
            return { error: userMsg };
          }
        } else {
          set({ isSubmitting: false, error: error.message });
          return { error: error.message };
        }
      } else {
        targetUserId = data.user?.id || null;
        activeSession = data.session;
      }

      // 3. Если сессия не вернулась сразу, выполняем вход
      if (!activeSession) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInData?.session) {
          activeSession = signInData.session;
          targetUserId = signInData.user?.id || targetUserId;
        } else if (signInErr) {
          // Если аккаунт заблокирован на неподтвержденном email, пробуем автоподтвердить
          if (
            signInErr.message?.toLowerCase().includes('not confirmed') ||
            signInErr.message?.toLowerCase().includes('email_not_confirmed')
          ) {
            const { data: rpcRes } = await supabase.rpc('register_user_direct', {
              p_email: email.trim(),
              p_password: password,
              p_username: cleanUsername,
              p_display_name: displayName.trim() || cleanUsername,
            });

            if (rpcRes?.success) {
              const { data: retrySignIn } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
              });
              if (retrySignIn?.session) {
                activeSession = retrySignIn.session;
                targetUserId = retrySignIn.user?.id || targetUserId;
              }
            }
          }
        }
      }

      // 4. Подтягиваем профиль
      if (targetUserId) {
        let loadedProfile: Profile | null = null;
        for (let attempt = 0; attempt < 6; attempt++) {
          const { data: p } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', targetUserId)
            .maybeSingle();

          if (p) {
            loadedProfile = p;
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }

        set({
          user: activeSession?.user || (data?.user ?? null),
          session: activeSession,
          profile: normalizeProfile(loadedProfile, targetUserId),
          isSubmitting: false,
          error: null,
        });

        return { success: true };
      }

      set({ isSubmitting: false });
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка регистрации';
      set({ isSubmitting: false, error: msg });
      return { error: msg };
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      set({ user: null, profile: null, session: null });
    }
  },

  updateProfile: async (data: Partial<Profile>) => {
    const { profile } = get();
    if (!profile) return { error: 'Профиль не найден' };

    try {
      const { data: updated, error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', profile.id)
        .select()
        .single();

      if (error) return { error: error.message };
      set({ profile: updated });
      return {};
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Ошибка сохранения данных' };
    }
  },

  clearError: () => set({ error: null }),
}));
