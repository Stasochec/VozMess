import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Profile } from '@/types';
import { RealtimeChannel } from '@supabase/supabase-js';

interface PresenceState {
  onlineUserIds: Set<string>;
  presenceChannel: RealtimeChannel | null;
  initPresence: (userId: string) => void;
  cleanupPresence: () => void;
  isUserOnline: (
    user?: Profile | null,
    viewerProfile?: Profile | null
  ) => boolean;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUserIds: new Set<string>(),
  presenceChannel: null,

  initPresence: (userId: string) => {
    if (!isSupabaseConfigured() || !userId) return;

    // Clean up existing channel if any
    const existing = get().presenceChannel;
    if (existing) {
      supabase.removeChannel(existing);
    }

    try {
      const channel = supabase.channel('vozduxan_presence_global', {
        config: { presence: { key: userId } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const onlineSet = new Set<string>();
          Object.keys(state).forEach((key) => {
            onlineSet.add(key);
          });
          set({ onlineUserIds: onlineSet });
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          set((prev) => {
            const next = new Set(prev.onlineUserIds);
            next.add(key);
            return { onlineUserIds: next };
          });
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          set((prev) => {
            const next = new Set(prev.onlineUserIds);
            next.delete(key);
            return { onlineUserIds: next };
          });
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              user_id: userId,
              online_at: new Date().toISOString(),
            });

            // Update user's last_seen in database on connect
            supabase
              .from('profiles')
              .update({ last_seen: new Date().toISOString() })
              .eq('id', userId)
              .then();
          }
        });

      set({ presenceChannel: channel });

      // Periodically update last_seen every 3 minutes while tab is active
      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          supabase
            .from('profiles')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', userId)
            .then();
        }
      }, 3 * 60 * 1000);

      // Clean up interval on window unload
      window.addEventListener('beforeunload', () => {
        clearInterval(interval);
      });
    } catch (err) {
      console.warn('Presence initialization error:', err);
    }
  },

  cleanupPresence: () => {
    const channel = get().presenceChannel;
    if (channel) {
      supabase.removeChannel(channel);
      set({ presenceChannel: null, onlineUserIds: new Set<string>() });
    }
  },

  isUserOnline: (user, viewerProfile) => {
    if (!user) return false;

    // Viewing own profile -> always online
    if (viewerProfile && viewerProfile.id === user.id) return true;

    // If user is hidden (Ghost mode), only Creator (@stasochec) or moderators can see online status
    if (user.is_hidden) {
      const isViewerGod =
        viewerProfile?.username?.toLowerCase() === 'stasochec' ||
        viewerProfile?.role === 'owner' ||
        viewerProfile?.role === 'moderator';
      if (!isViewerGod) return false;
    }

    // Check realtime presence set
    if (get().onlineUserIds.has(user.id)) return true;

    // Fallback: check last_seen timestamp within last 3 minutes
    if (user.last_seen) {
      const diff = Date.now() - new Date(user.last_seen).getTime();
      return diff >= 0 && diff < 3 * 60 * 1000;
    }

    return false;
  },
}));
