import { createClient } from '@supabase/supabase-js';

export const getSupabaseCredentials = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('vozdux_supabase_url') : null;
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('vozdux_supabase_key') : null;

  const url = (localUrl || envUrl || '').trim();
  const key = (localKey || envKey || '').trim();

  return { url, key };
};

export const isSupabaseConfigured = (): boolean => {
  const { url, key } = getSupabaseCredentials();
  return Boolean(
    url &&
    key &&
    url.startsWith('https://') &&
    url.includes('.supabase.co') &&
    key.length > 25
  );
};

const creds = getSupabaseCredentials();

// Dummy valid URL format strictly to avoid createClient throwing during early boot before ConfigErrorScreen displays
const validInitUrl = isSupabaseConfigured() ? creds.url : 'https://unconfigured-instance.supabase.co';
const validInitKey = isSupabaseConfigured() ? creds.key : 'unconfigured-anon-key-placeholder-32-chars-min';

export const supabase = createClient(validInitUrl, validInitKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'vozduxan_auth_token',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const saveSupabaseCredentials = (url: string, key: string) => {
  localStorage.setItem('vozdux_supabase_url', url.trim());
  localStorage.setItem('vozdux_supabase_key', key.trim());
  window.location.reload();
};

export const clearSupabaseCredentials = () => {
  localStorage.removeItem('vozdux_supabase_url');
  localStorage.removeItem('vozdux_supabase_key');
  window.location.reload();
};
