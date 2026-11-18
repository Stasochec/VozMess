import { supabase } from './supabase';

export const CHAT_MEDIA_BUCKET = 'chat-media';

// New media is stored as an opaque object path: <chat_id>/<user_id>/<file>.
// Old rows may still hold a full public URL; those are passed through untouched.
const isObjectPath = (value: string) => !/^https?:\/\//i.test(value);

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6;
const urlCache = new Map<string, { url: string; expiresAt: number }>();

export const resolveMediaUrl = async (value?: string | null): Promise<string | null> => {
  if (!value) return null;
  if (!isObjectPath(value)) return value;

  const cached = urlCache.get(value);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .createSignedUrl(value, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.warn('Failed to sign media URL:', error?.message);
    return null;
  }

  urlCache.set(value, {
    url: data.signedUrl,
    expiresAt: Date.now() + (SIGNED_URL_TTL_SECONDS - 120) * 1000,
  });
  return data.signedUrl;
};

export const invalidateMediaUrl = (value?: string | null) => {
  if (value) urlCache.delete(value);
};

export const buildMediaPath = (chatId: string, userId: string, fileName: string) =>
  `${chatId}/${userId}/${fileName}`;
