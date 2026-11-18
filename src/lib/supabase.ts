import { createClient } from '@supabase/supabase-js';

export const getSupabaseCredentials = () => {
  const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  // Retired build-time escape hatch: localStorage used to be able to replace the
  // backend URL and key, which let a crafted link point the app at attacker Supabase.
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('vozdux_supabase_url');
      localStorage.removeItem('vozdux_supabase_key');
    } catch {
      // storage may be unavailable; nothing to clean up
    }
  }

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
