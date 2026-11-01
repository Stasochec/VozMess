import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { DurovAdminPanel } from '@/components/admin/DurovAdminPanel';
import { ProfileModal } from '@/components/auth/ProfileModal';
import { SupabaseSetupModal } from '@/components/auth/SupabaseSetupModal';
import { NewChatModal } from '@/components/chat/NewChatModal';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useThemeStore } from '@/store/useThemeStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Database, Crown, AlertCircle } from 'lucide-react';

function MessengerScreen() {
  const { init: initAuth, user, profile, isDemo, isLoading } = useAuthStore();
  const { fetchChats, subscribeToRealtime, unsubscribeFromRealtime, activeChatId, setActiveChatId } =
    useChatStore();
  const { theme } = useThemeStore();

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSupabaseOpen, setIsSupabaseOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Initialize Auth & Data
  useEffect(() => {
    initAuth().then(() => {
      fetchChats();
      subscribeToRealtime();
    });

    return () => {
      unsubscribeFromRealtime();
    };
  }, []);

  const isConfigured = isSupabaseConfigured();

  return (
    <div className="flex flex-col h-[100dvh] w-[100dvw] bg-[#0F0F12] text-zinc-100 overflow-hidden font-sans">
      {/* Top Banner when running in Demo or Supabase awaiting configuration */}
      {!isConfigured && (
        <div className="bg-gradient-to-r from-amber-600/90 via-orange-600/90 to-amber-700/90 text-white px-3 py-1.5 text-xs font-semibold flex items-center justify-between z-30 shadow-md">
          <div className="flex items-center gap-2">
            <span className="p-0.5 rounded bg-black/20 text-white font-mono text-[10px]">
              {isDemo ? '👑 DUROV DEMO' : '⚡ ПРЕДПРОСМОТР'}
            </span>
            <span className="truncate">
              {isDemo
                ? 'Вы вошли как Создатель (Павел Дуров). База данных работает в оффлайн-режиме.'
                : 'Supabase не подключен. Работает демо-режим с автоудалением 14 дней.'}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setIsSupabaseOpen(true)}
              className="px-2.5 py-0.5 bg-black/30 hover:bg-black/50 text-white rounded-md text-[11px] font-bold border border-white/30 transition-colors flex items-center gap-1"
            >
              <Database className="w-3 h-3" />
              <span>Подключить Supabase</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Telegram Layout Container */}
      <div className="flex-1 flex w-full h-full overflow-hidden relative">
        {/* Left Sidebar (visible on desktop or when no chat is active on mobile) */}
        <div
          className={`h-full ${
            activeChatId ? 'hidden md:flex' : 'flex w-full md:w-auto'
          }`}
        >
          <Sidebar
            onOpenAdminPanel={() => setIsAdminOpen(true)}
            onOpenProfile={() => setIsProfileOpen(true)}
            onOpenSupabase={() => setIsSupabaseOpen(true)}
            onOpenNewChat={() => setIsNewChatOpen(true)}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        </div>

        {/* Right Active Chat Pane (visible on desktop or when chat is selected on mobile) */}
        <div
          className={`flex-1 h-full ${
            activeChatId ? 'flex w-full' : 'hidden md:flex'
          }`}
        >
          <ChatArea onBack={() => setActiveChatId(null)} />
        </div>
      </div>

      {/* Global Modals */}
      <DurovAdminPanel isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <SupabaseSetupModal isOpen={isSupabaseOpen} onClose={() => setIsSupabaseOpen(false)} />
      <NewChatModal isOpen={isNewChatOpen} onClose={() => setIsNewChatOpen(false)} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="*" element={<MessengerScreen />} />
      </Routes>
    </HashRouter>
  );
}
