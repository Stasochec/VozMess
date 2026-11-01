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
        console.warn('Session check error:', sessionError.message);
      }

      if (session?.user) {
        set({ user: session.user, session });

        // Fetch fresh profile from database
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileData) {
          set({ profile: profileData });
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
            .single();

          if (profileData) {
            set({ profile: profileData });
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
      let resolvedEmail = identifier.trim();

      // If user provided @username instead of email
      if (!resolvedEmail.includes('@')) {
        const cleanUsername = resolvedEmail.replace(/^@/, '').toLowerCase();
        
        // Lookup email via database function
        const { data: emailData, error: rpcErr } = await supabase.rpc('get_email_by_username', {
          user_identifier: cleanUsername,
        });

        if (rpcErr || !emailData) {
          set({ isSubmitting: false });
          return { error: `Пользователь @${cleanUsername} не найден. Проверьте никнейм.` };
        }
        resolvedEmail = emailData;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });

      if (error) {
        set({ isSubmitting: false, error: error.message });
        return { error: error.message };
      }

      if (data.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        set({
          user: data.user,
          session: data.session,
          profile: profileData,
          isSubmitting: false,
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
    if (cleanUsername.length < 2) {
      set({ isSubmitting: false, error: 'Никнейм должен содержать минимум 2 символа' });
      return { error: 'Никнейм должен содержать минимум 2 символа' };
    }

    try {
      // Check if username is already taken
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (existingUser) {
        set({ isSubmitting: false, error: `Никнейм @${cleanUsername} уже занят другим пользователем` });
        return { error: `Никнейм @${cleanUsername} уже занят другим пользователем` };
      }

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
        set({ isSubmitting: false, error: error.message });
        return { error: error.message };
      }

      if (data.user) {
        // Wait briefly for trigger on_auth_user_created to generate public.profiles row
        await new Promise((r) => setTimeout(r, 600));

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        set({
          user: data.user,
          session: data.session,
          profile: profileData,
          isSubmitting: false,
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
