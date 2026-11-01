import { createClient } from '@supabase/supabase-js';

// Retrieve credentials from environment or localStorage
const getSavedCredentials = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('vozdux_supabase_url') : null;
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('vozdux_supabase_key') : null;

  const url = (localUrl || envUrl || '').trim();
  const key = (localKey || envKey || '').trim();

  return { url, key };
};

const credentials = getSavedCredentials();

export const isSupabaseConfigured = (): boolean => {
  const { url, key } = getSavedCredentials();
  return Boolean(
    url &&
    key &&
    url.startsWith('https://') &&
    url.includes('.supabase.co') &&
    key.length > 20
  );
};

// Fallback dummy URL to prevent createClient crashing during initial boot
const fallbackUrl = 'https://vozduxan-placeholder.supabase.co';
const fallbackKey = 'placeholder-anon-key-vozduxan-1234567890';

export const supabase = createClient(
  credentials.url && credentials.url.startsWith('https://') ? credentials.url : fallbackUrl,
  credentials.key || fallbackKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

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
