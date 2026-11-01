import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Profile, UserRole } from '@/types';

// Mock profile for demo mode when Supabase isn't connected yet
const DEMO_OWNER_PROFILE: Profile = {
  id: 'demo-durov-id',
  username: 'durov_vozdux',
  display_name: 'Павел Дуров',
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  bio: 'Архитектор Vozduxan. Скорость, свобода и нулевая цензура.',
  role: 'owner',
  custom_title: 'Создатель Vozduxan',
  is_verified: true,
  has_vozdux_plus: true,
  created_at: new Date().toISOString(),
  last_seen: new Date().toISOString(),
};

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isDemo: boolean;
  error: string | null;
  init: () => Promise<void>;
  signIn: (email: string, pass: string) => Promise<{ error?: string }>;
  signUp: (email: string, pass: string, username: string, displayName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ error?: string }>;
  loginAsDemo: (role?: UserRole) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  session: null,
  isLoading: true,
  isDemo: false,
  error: null,

  init: async () => {
    set({ isLoading: true, error: null });

    // Check if Supabase is properly configured
    if (!isSupabaseConfigured()) {
      // Check if user previously selected demo
      const savedDemo = localStorage.getItem('vozdux_demo_mode');
      if (savedDemo === 'true') {
        set({
          user: { id: DEMO_OWNER_PROFILE.id, email: 'durov@vozduxan.app' } as unknown as User,
          profile: DEMO_OWNER_PROFILE,
          isDemo: true,
          isLoading: false,
        });
        return;
      }
      set({ isLoading: false });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        set({ user: session.user, session, isDemo: false });

        // Fetch user profile from public.profiles
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileData) {
          set({ profile: profileData });
        } else if (profileErr) {
          console.warn('Profile fetch warning:', profileErr);
        }
      }

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (newSession?.user) {
          set({ user: newSession.user, session: newSession, isDemo: false });
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newSession.user.id)
            .single();

          if (profileData) {
            set({ profile: profileData });
          }
        } else {
          set({ user: null, profile: null, session: null });
        }
      });
    } catch (err: unknown) {
      console.error('Auth initialization error:', err);
      set({ error: err instanceof Error ? err.message : 'Ошибка инициализации авторизации' });
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    set({ error: null });
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase не подключен. Укажите URL и Anon Key или используйте Демо-режим.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { error: error.message };

      if (data.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        set({ user: data.user, session: data.session, profile: profileData, isDemo: false });
      }

      return {};
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка входа';
      set({ error: msg });
      return { error: msg };
    }
  },

  signUp: async (email, password, username, displayName) => {
    set({ error: null });
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase не подключен. Укажите URL и Anon Key или используйте Демо-режим.' };
    }

    try {
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (cleanUsername.length < 3) {
        return { error: 'Имя пользователя должно содержать минимум 3 символа' };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: cleanUsername,
            display_name: displayName.trim() || cleanUsername,
          },
        },
      });

      if (error) return { error: error.message };

      if (data.user) {
        // Wait a tick for on_auth_user_created trigger
        setTimeout(async () => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user!.id)
            .single();

          if (profileData) {
            set({ profile: profileData });
          }
        }, 800);

        set({ user: data.user, session: data.session, isDemo: false });
      }

      return {};
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка регистрации';
      set({ error: msg });
      return { error: msg };
    }
  },

  signOut: async () => {
    if (get().isDemo) {
      localStorage.removeItem('vozdux_demo_mode');
      set({ user: null, profile: null, session: null, isDemo: false });
      return;
    }

    try {
      await supabase.auth.signOut();
    } finally {
      set({ user: null, profile: null, session: null, isDemo: false });
    }
  },

  updateProfile: async (data: Partial<Profile>) => {
    const { profile, isDemo } = get();
    if (!profile) return { error: 'Нет активного профиля' };

    if (isDemo) {
      const updated = { ...profile, ...data };
      set({ profile: updated });
      return {};
    }

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
      return { error: err instanceof Error ? err.message : 'Ошибка сохранения' };
    }
  },

  loginAsDemo: (role: UserRole = 'owner') => {
    const demoUser: Profile = {
      ...DEMO_OWNER_PROFILE,
      role,
      is_verified: role === 'owner' || role === 'moderator',
      has_vozdux_plus: true,
      custom_title: role === 'owner' ? 'Создатель Vozduxan' : role === 'moderator' ? 'Старший Модератор' : null,
    };

    localStorage.setItem('vozdux_demo_mode', 'true');
    set({
      user: { id: demoUser.id, email: 'demo@vozduxan.app' } as unknown as User,
      profile: demoUser,
      isDemo: true,
      isLoading: false,
    });
  },

  clearError: () => set({ error: null }),
}));
