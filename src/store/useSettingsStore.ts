import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SettingsState {
  // Notifications & Sounds
  soundEnabled: boolean;
  sendSoundEnabled: boolean;
  desktopNotifications: boolean;

  // Appearance & Chat
  fontSize: 'sm' | 'md' | 'lg';
  sendOnEnter: boolean;

  // Privacy
  whoCanSeeLastSeen: 'all' | 'nobody';
  whoCanAddToGroups: 'all' | 'contacts';

  // Actions
  setSoundEnabled: (v: boolean) => void;
  setSendSoundEnabled: (v: boolean) => void;
  setDesktopNotifications: (v: boolean) => void;
  setFontSize: (v: 'sm' | 'md' | 'lg') => void;
  setSendOnEnter: (v: boolean) => void;
  setWhoCanSeeLastSeen: (v: 'all' | 'nobody') => void;
  setWhoCanAddToGroups: (v: 'all' | 'contacts') => void;
  clearCache: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      sendSoundEnabled: true,
      desktopNotifications: false,

      fontSize: 'md',
      sendOnEnter: true,

      whoCanSeeLastSeen: 'all',
      whoCanAddToGroups: 'all',

      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setSendSoundEnabled: (sendSoundEnabled) => set({ sendSoundEnabled }),
      setDesktopNotifications: (desktopNotifications) => set({ desktopNotifications }),

      setFontSize: (fontSize) => set({ fontSize }),
      setSendOnEnter: (sendOnEnter) => set({ sendOnEnter }),

      setWhoCanSeeLastSeen: (whoCanSeeLastSeen) => set({ whoCanSeeLastSeen }),
      setWhoCanAddToGroups: (whoCanAddToGroups) => set({ whoCanAddToGroups }),

      clearCache: () => {
        // Clear non-essential cached items while keeping auth credentials
        const url = localStorage.getItem('vozdux_supabase_url');
        const key = localStorage.getItem('vozdux_supabase_key');
        const token = localStorage.getItem('vozduxan_auth_token');

        sessionStorage.clear();

        if (url) localStorage.setItem('vozdux_supabase_url', url);
        if (key) localStorage.setItem('vozdux_supabase_key', key);
        if (token) localStorage.setItem('vozduxan_auth_token', token);
      },
    }),
    {
      name: 'vozduxan_settings_storage',
    }
  )
);
