import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  Search,
  Edit,
  Crown,
  User,
  Bookmark,
  Moon,
  Sun,
  Database,
  Download,
  LogOut,
  X,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useThemeStore } from '@/store/useThemeStore';
import { Logo } from '@/components/ui/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { UserBadges } from '@/components/ui/Badges';
import { formatChatDate, getRemainingTTL } from '@/lib/dateUtils';
import { Chat, ChatType } from '@/types';

interface SidebarProps {
  onOpenAdminPanel: () => void;
  onOpenProfile: () => void;
  onOpenSupabase: () => void;
  onOpenNewChat: () => void;
  onOpenAuth: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenAdminPanel,
  onOpenProfile,
  onOpenSupabase,
  onOpenNewChat,
  onOpenAuth,
}) => {
  const { chats, activeChatId, setActiveChatId, searchQuery, setSearchQuery, activeFilter, setActiveFilter } =
    useChatStore();
  const { profile, user, signOut } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Filter chats by folder tab and search query
  const filteredChats = chats.filter((chat) => {
    // Type filter
    if (activeFilter === 'direct' && chat.type !== 'direct') return false;
    if (activeFilter === 'group' && chat.type !== 'group') return false;
    if (activeFilter === 'channel' && chat.type !== 'channel') return false;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = (chat.title || '').toLowerCase().includes(q);
      const otherUserMatch =
        (chat.other_user?.display_name || '').toLowerCase().includes(q) ||
        (chat.other_user?.username || '').toLowerCase().includes(q);
      const msgMatch = (chat.last_message?.content || '').toLowerCase().includes(q);
      return titleMatch || otherUserMatch || msgMatch;
    }

    return true;
  });

  const getChatDisplayName = (chat: Chat) => {
    if (chat.type === 'direct' && chat.other_user) {
      return chat.other_user.display_name;
    }
    return chat.title || 'Диалог';
  };

  const getChatAvatarSrc = (chat: Chat) => {
    if (chat.type === 'direct' && chat.other_user) {
      return chat.other_user.avatar_url;
    }
    return chat.avatar_url;
  };

  return (
    <aside className="relative flex flex-col h-full w-full md:w-[380px] lg:w-[420px] flex-shrink-0 bg-white dark:bg-[#18181C] border-r border-[#E4E4E7] dark:border-[#26262F] select-none z-20">
      {/* 1. TOP HEADER (Burger, Logo, New Chat) */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-[#E4E4E7] dark:border-[#26262F]">
        <div className="flex items-center gap-2">
          {/* Burger menu button */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#25252E] transition-colors"
            title="Главное меню"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Vozduxan Brand Logo */}
          <Logo size="sm" variant="full" />
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenNewChat}
            className="p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-[#FF7A00] hover:bg-zinc-100 dark:hover:bg-[#25252E] transition-colors"
            title="Новый диалог"
          >
            <Edit className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. SEARCH INPUT (Telegram style with glowing orange border on focus) */}
      <div className="px-3.5 py-2">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск сообщений и контактов..."
            className="w-full pl-9 pr-8 py-2 bg-zinc-100 dark:bg-[#202027] border border-transparent focus:border-[#FF7A00] dark:focus:border-[#FF7A00] rounded-xl text-xs text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 transition-all focus:outline-none focus:ring-1 focus:ring-[#FF7A00]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 3. FOLDERS / TABS BAR */}
      <div className="flex px-3 border-b border-[#E4E4E7] dark:border-[#26262F] gap-1 overflow-x-auto no-scrollbar py-1">
        {[
          { id: 'all', label: 'Все чаты' },
          { id: 'direct', label: 'Личные' },
          { id: 'group', label: 'Группы' },
          { id: 'channel', label: 'Каналы' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as 'all' | 'direct' | 'group' | 'channel')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              activeFilter === tab.id
                ? 'bg-[#FF7A00]/15 text-[#FF7A00] dark:bg-[#FF7A00]/20'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. CHAT LIST */}
      <div className="flex-1 overflow-y-auto divide-y divide-transparent">
        {filteredChats.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 dark:text-zinc-500 text-xs">
            Чатов не найдено
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isActive = activeChatId === chat.id;
            const name = getChatDisplayName(chat);
            const avatarSrc = getChatAvatarSrc(chat);
            const ttl = chat.last_message ? getRemainingTTL(chat.last_message.expires_at) : null;

            return (
              <div
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={`flex items-center gap-3 px-3.5 py-3 cursor-pointer transition-colors relative ${
                  isActive
                    ? 'bg-[#FFEADC]/60 dark:bg-[#25252E]'
                    : 'hover:bg-zinc-50 dark:hover:bg-[#1E1E24]'
                }`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-[#FF7A00]" />
                )}

                {/* Avatar with status */}
                <Avatar
                  name={name}
                  src={avatarSrc}
                  size="md"
                  isOnline={chat.type === 'direct' && Boolean(chat.other_user)}
                />

                {/* Chat details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0 pr-1">
                      <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                        {name}
                      </span>
                      {chat.other_user && (
                        <UserBadges
                          role={chat.other_user.role}
                          isVerified={chat.other_user.is_verified}
                          hasVozduxPlus={chat.other_user.has_vozdux_plus}
                        />
                      )}
                    </div>
                    {chat.last_message && (
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap flex-shrink-0">
                        {formatChatDate(chat.last_message.created_at)}
                      </span>
                    )}
                  </div>

                  {/* Message preview and Steam-like TTL status */}
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-zinc-500 dark:text-zinc-400 truncate text-[11px] pr-2">
                      {chat.last_message ? (
                        <>
                          {chat.last_message.is_system && (
                            <span className="text-[#FF7A00] font-semibold mr-1">📢</span>
                          )}
                          {chat.last_message.content || 'Медиафайл'}
                        </>
                      ) : (
                        <span className="italic text-zinc-400">Нет сообщений</span>
                      )}
                    </p>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* TTL 14 Days indicator badge */}
                      {ttl && !ttl.expired && (
                        <span
                          title={`Автоудаление через ${ttl.label} (TTL 14 дней)`}
                          className="inline-flex items-center gap-0.5 text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-orange-500/10 text-[#FF7A00] border border-orange-500/20"
                        >
                          <Clock className="w-2.5 h-2.5" />
                          <span>{ttl.label}</span>
                        </span>
                      )}

                      {/* Unread badge */}
                      {Boolean(chat.unread_count && chat.unread_count > 0) && (
                        <span className="min-w-4 h-4 px-1 rounded-full bg-[#FF7A00] text-white font-bold text-[10px] flex items-center justify-center">
                          {chat.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. TELEGRAM DRAWER MENU (Шторка бокового меню) */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
            />

            {/* Sliding Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed left-0 top-0 bottom-0 w-[300px] sm:w-[320px] bg-white dark:bg-[#18181C] border-r border-[#E4E4E7] dark:border-[#282833] shadow-2xl z-50 flex flex-col justify-between"
            >
              <div>
                {/* User Header Profile Card */}
                <div className="p-5 bg-gradient-to-br from-[#FF9500] to-[#FF5500] text-white">
                  <div className="flex items-center justify-between mb-3">
                    <Avatar
                      name={profile?.display_name || 'Vozduxan'}
                      src={profile?.avatar_url}
                      size="lg"
                    />
                    <button
                      onClick={() => setIsDrawerOpen(false)}
                      className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-extrabold text-sm text-white">
                        {profile?.display_name || 'Гость'}
                      </h4>
                      {profile && (
                        <UserBadges
                          role={profile.role}
                          isVerified={profile.is_verified}
                          hasVozduxPlus={profile.has_vozdux_plus}
                        />
                      )}
                    </div>
                    <p className="text-xs text-white/80 font-mono">
                      {profile?.username ? `@${profile.username}` : 'Авторизуйтесь для общения'}
                    </p>
                    {profile?.custom_title && (
                      <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/25 text-amber-200">
                        {profile.custom_title}
                      </span>
                    )}
                  </div>
                </div>

                {/* Drawer Menu Items */}
                <div className="py-2 space-y-0.5">
                  {/* DUROV SUPREME ADMIN PANEL (highlighted) */}
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onOpenAdminPanel();
                    }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-amber-500 hover:bg-amber-500/10 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Crown className="w-4 h-4 fill-amber-500/80" />
                      </div>
                      <span>Панель Создателя 👑</span>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                      ДУРОВ
                    </span>
                  </button>

                  {/* Profile */}
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      if (user || profile) onOpenProfile();
                      else onOpenAuth();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#202027] transition-colors"
                  >
                    <User className="w-4 h-4 text-zinc-400" />
                    <span>Мой профиль</span>
                  </button>

                  {/* Saved Messages */}
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      setActiveChatId('chat-saved');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#202027] transition-colors"
                  >
                    <Bookmark className="w-4 h-4 text-[#FF7A00]" />
                    <span>Избранное</span>
                  </button>

                  {/* Theme Switcher */}
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#202027] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {theme === 'dark' ? (
                        <Moon className="w-4 h-4 text-[#FF9500]" />
                      ) : (
                        <Sun className="w-4 h-4 text-amber-500" />
                      )}
                      <span>Ночной режим</span>
                    </div>
                    <span className="text-[11px] text-zinc-400">
                      {theme === 'dark' ? 'Вкл' : 'Выкл'}
                    </span>
                  </button>

                  {/* Supabase Connection */}
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onOpenSupabase();
                    }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#202027] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Database className="w-4 h-4 text-emerald-500" />
                      <span>База данных Supabase</span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </button>
                </div>
              </div>

              {/* Bottom footer in drawer */}
              <div className="p-4 border-t border-[#E4E4E7] dark:border-[#282833] space-y-2">
                <div className="text-[10px] text-zinc-400 text-center">
                  Vozduxan Web 1.4 • Auto-clean 14 Days
                </div>

                {user || profile ? (
                  <button
                    onClick={() => {
                      signOut();
                      setIsDrawerOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Выйти из аккаунта</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onOpenAuth();
                    }}
                    className="w-full py-2 bg-[#FF7A00] hover:bg-[#E66E00] text-white text-xs font-bold rounded-xl shadow-md transition-colors"
                  >
                    Войти / Регистрация
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </aside>
  );
};
