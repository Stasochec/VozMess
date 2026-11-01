import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { GodAdminPanel } from '@/components/admin/GodAdminPanel';
import { ProfileModal } from '@/components/auth/ProfileModal';
import { NewChatModal } from '@/components/chat/NewChatModal';
import { UserProfileModal } from '@/components/profile/UserProfileModal';
import { GroupProfileModal } from '@/components/profile/GroupProfileModal';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { ConfigErrorScreen } from '@/components/ui/ConfigErrorScreen';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useThemeStore } from '@/store/useThemeStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Profile, Chat } from '@/types';

function MessengerScreen() {
  const { init: initAuth, user, isInitialLoading } = useAuthStore();
  const { fetchChats, subscribeToRealtime, unsubscribeFromRealtime, activeChatId, setActiveChatId } =
    useChatStore();
  const { theme } = useThemeStore();

  const [isGodPanelOpen, setIsGodPanelOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  // Profile inspection state (Telegram style)
  const [selectedUserProfile, setSelectedUserProfile] = useState<Profile | null>(null);
  const [selectedGroupChat, setSelectedGroupChat] = useState<Chat | null>(null);

  // Sync theme attribute with documentElement
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Initialize auth session on mount
  useEffect(() => {
    initAuth();
  }, []);

  // When user is authenticated, load chats and subscribe to realtime stream
  useEffect(() => {
    if (user && isSupabaseConfigured()) {
      fetchChats();
      subscribeToRealtime();
    }

    return () => {
      unsubscribeFromRealtime();
    };
  }, [user]);

  // 1. STRICT CONFIGURATION CHECK
  // If Supabase credentials are missing or invalid, block access and show config screen
  if (!isSupabaseConfigured()) {
    return <ConfigErrorScreen />;
  }

  // 2. LOADING SCREEN WHILE CHECKING STORED SESSION
  if (isInitialLoading) {
    return (
      <div className="h-[100dvh] w-[100dvw] flex flex-col items-center justify-center bg-[#0F0F12] select-none text-zinc-100 font-sans">
        <div className="flex flex-col items-center gap-6">
          <Logo size="xl" variant="icon-only" />
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
            <span className="w-4 h-4 border-2 border-[#FF7A00] border-t-transparent rounded-full animate-spin" />
            <span>Подключение к Vozduxan Core...</span>
          </div>
        </div>
      </div>
    );
  }

  // 3. STRICT AUTH GATE: NO ACCESS WITHOUT VALID LOGGED IN SESSION
  if (!user) {
    return <AuthScreen />;
  }

  // 4. MAIN MESSENGER INTERFACE
  return (
    <div className="flex flex-col h-[100dvh] w-[100dvw] bg-[#0F0F12] text-zinc-100 overflow-hidden font-sans">
      <div className="flex-1 flex w-full h-full overflow-hidden relative">
        {/* Left Sidebar */}
        <div
          className={`h-full ${
            activeChatId ? 'hidden md:flex' : 'flex w-full md:w-auto'
          }`}
        >
          <Sidebar
            onOpenGodPanel={() => setIsGodPanelOpen(true)}
            onOpenProfile={() => setIsProfileOpen(true)}
            onOpenNewChat={() => setIsNewChatOpen(true)}
          />
        </div>

        {/* Right Active Chat Pane */}
        <div
          className={`flex-1 h-full ${
            activeChatId ? 'flex w-full' : 'hidden md:flex'
          }`}
        >
          <ChatArea
            onBack={() => setActiveChatId(null)}
            onOpenUserProfile={(user) => setSelectedUserProfile(user)}
            onOpenGroupProfile={(chat) => setSelectedGroupChat(chat)}
          />
        </div>
      </div>

      {/* Modals */}
      {isGodPanelOpen && (
        <GodAdminPanel isOpen={isGodPanelOpen} onClose={() => setIsGodPanelOpen(false)} />
      )}
      {isProfileOpen && (
        <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      )}
      {isNewChatOpen && (
        <NewChatModal
          isOpen={isNewChatOpen}
          onClose={() => setIsNewChatOpen(false)}
          onOpenUserProfile={(user) => setSelectedUserProfile(user)}
        />
      )}

      {/* Telegram-style User Profile Modal */}
      {selectedUserProfile && (
        <UserProfileModal
          user={selectedUserProfile}
          isOpen={Boolean(selectedUserProfile)}
          onClose={() => setSelectedUserProfile(null)}
        />
      )}

      {/* Telegram-style Group Profile Modal */}
      {selectedGroupChat && (
        <GroupProfileModal
          chat={selectedGroupChat}
          isOpen={Boolean(selectedGroupChat)}
          onClose={() => setSelectedGroupChat(null)}
          onOpenUserProfile={(user) => {
            setSelectedUserProfile(user);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="*" element={<MessengerScreen />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}
