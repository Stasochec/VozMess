import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MessageSquare,
  Copy,
  Check,
  Calendar,
  Users,
  Info,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { Profile, Chat } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { UserBadges } from '@/components/ui/Badges';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { formatChatDate } from '@/lib/dateUtils';

interface UserProfileModalProps {
  user: Profile | null;
  isOpen: boolean;
  onClose: () => void;
  onStartDirectChat?: (target: Profile) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onStartDirectChat,
}) => {
  const { chats, createDirectChat, setActiveChatId } = useChatStore();
  const { user: currentAuthUser, profile: currentProfile } = useAuthStore();

  const [copied, setCopied] = useState(false);
  const [commonGroups, setCommonGroups] = useState<Chat[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load common groups between current user and target user
  useEffect(() => {
    if (!isOpen || !user || !currentAuthUser || !isSupabaseConfigured()) {
      setCommonGroups([]);
      return;
    }

    // If viewing own profile, no common groups needed
    if (user.id === currentAuthUser.id) {
      setCommonGroups([]);
      return;
    }

    const fetchCommonGroups = async () => {
      setIsLoadingGroups(true);
      try {
        // Find chats where the target user is a member
        const { data: targetMemberships, error } = await supabase
          .from('chat_members')
          .select('chat_id')
          .eq('user_id', user.id);

        if (!error && targetMemberships) {
          const targetChatIds = new Set(targetMemberships.map((m) => m.chat_id));
          // Intersect with the groups that current user is already in (stored in useChatStore)
          const myGroups = chats.filter(
            (c) => (c.type === 'group' || c.type === 'channel') && targetChatIds.has(c.id)
          );
          setCommonGroups(myGroups);
        }
      } catch (err) {
        console.warn('Error fetching common groups:', err);
      } finally {
        setIsLoadingGroups(false);
      }
    };

    fetchCommonGroups();
  }, [isOpen, user, currentAuthUser, chats]);

  if (!isOpen || !user) return null;

  const isSelf = currentAuthUser?.id === user.id;

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(`@${user.username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = async () => {
    if (onStartDirectChat) {
      onStartDirectChat(user);
      onClose();
    } else {
      await createDirectChat(user);
      onClose();
    }
  };

  const handleOpenGroup = (chatId: string) => {
    setActiveChatId(chatId);
    onClose();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#16161C] border border-[#2B2B38] rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden text-zinc-100 flex flex-col max-h-[90vh]"
      >
        {/* HERO BANNER & AVATAR */}
        <div className="relative pt-10 pb-6 px-6 bg-gradient-to-b from-[#2B170B] via-[#1E140F] to-[#16161C] border-b border-[#2B2B38] flex flex-col items-center text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Large Avatar */}
          <div className="relative mb-3">
            <Avatar name={user.display_name} src={user.avatar_url} size="xl" isOnline />
          </div>

          {/* Name & Badges */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center mb-1">
            <h2 className="font-extrabold text-lg text-white tracking-wide">
              {user.display_name}
            </h2>
            <UserBadges
              role={user.role}
              username={user.username}
              isVerified={user.is_verified}
              hasVozduxPlus={user.has_vozdux_plus}
              isHidden={user.is_hidden}
              customTitle={user.custom_title}
              showRoleText
            />
          </div>

          {/* @username with copy button */}
          <div className="flex items-center gap-1 text-xs text-[#FF7A00] font-mono mt-0.5">
            <span>@{user.username}</span>
            <button
              onClick={handleCopyUsername}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
              title="Скопировать @username"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            {copied && (
              <span className="text-[10px] text-emerald-400 font-sans font-semibold">
                Скопировано!
              </span>
            )}
          </div>

          {/* Action: Send message */}
          {!isSelf && (
            <div className="mt-4 w-full flex gap-2">
              <button
                onClick={handleSendMessage}
                className="flex-1 py-2.5 bg-gradient-to-r from-[#FF7A00] to-[#FF5500] hover:from-[#E66E00] hover:to-[#E03D00] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#FF7A00]/25 transition-all flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Написать сообщение</span>
              </button>
            </div>
          )}
        </div>

        {/* DETAILS BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Bio / О себе */}
          <div className="p-4 rounded-2xl bg-[#1C1C24] border border-[#2B2B38] space-y-1">
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#FF7A00]" />
              <span>О себе</span>
            </div>
            <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {user.bio || 'Пользуюсь скоростным мессенджером Vozduxan ⚡'}
            </p>
          </div>

          {/* Registration Date */}
          <div className="p-4 rounded-2xl bg-[#1C1C24] border border-[#2B2B38] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-zinc-400">
              <Calendar className="w-4 h-4 text-[#FF7A00]" />
              <span>Дата регистрации</span>
            </div>
            <span className="font-semibold text-zinc-200">
              {user.created_at ? formatChatDate(user.created_at) : 'Недавно'}
            </span>
          </div>

          {/* COMMON GROUPS (ОБЩИЕ ГРУППЫ) */}
          {!isSelf && (
            <div className="p-4 rounded-2xl bg-[#1C1C24] border border-[#2B2B38] space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-zinc-300">
                  <Users className="w-4 h-4 text-[#FF7A00]" />
                  <span>Общие группы</span>
                </div>
                <span className="text-[11px] font-semibold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
                  {commonGroups.length}
                </span>
              </div>

              {isLoadingGroups ? (
                <div className="py-3 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-[#FF7A00] border-t-transparent rounded-full animate-spin" />
                  <span>Поиск общих групп...</span>
                </div>
              ) : commonGroups.length === 0 ? (
                <p className="text-xs text-zinc-500 py-1">Нет общих групп</p>
              ) : (
                <div className="space-y-1.5 pt-1">
                  {commonGroups.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => handleOpenGroup(g.id)}
                      className="p-2.5 rounded-xl bg-[#23232E] hover:bg-[#2B2B38] border border-transparent hover:border-[#FF7A00]/40 transition-colors flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={g.title || 'Группа'} src={g.avatar_url} size="sm" />
                        <span className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white">
                          {g.title || 'Группа'}
                        </span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-[#FF7A00] transition-colors flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
