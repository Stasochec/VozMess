import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, UserPlus, Users, Search, Check } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Profile } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { UserBadges } from '@/components/ui/Badges';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ isOpen, onClose }) => {
  const { createDirectChat, createGroupChat } = useChatStore();
  const { profile, isDemo } = useAuthStore();

  const [tab, setTab] = useState<'direct' | 'group'>('direct');
  const [usernameQuery, setUsernameQuery] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<Profile | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = usernameQuery.trim().replace(/^@/, '').toLowerCase();
    if (!clean) return;

    setIsSearching(true);
    setErrorMsg(null);
    setFoundUser(null);

    if (!isSupabaseConfigured() || isDemo) {
      setTimeout(() => {
        setIsSearching(false);
        const demoUser: Profile = {
          id: `user-${clean}`,
          username: clean,
          display_name: clean.charAt(0).toUpperCase() + clean.slice(1),
          avatar_url: null,
          role: 'user',
          custom_title: null,
          is_verified: false,
          has_vozdux_plus: false,
          bio: 'Пользователь Vozduxan',
          created_at: new Date().toISOString(),
          last_seen: new Date().toISOString(),
        };
        setFoundUser(demoUser);
      }, 250);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', clean)
        .neq('id', profile?.id || '')
        .single();

      if (error || !data) {
        setErrorMsg('Пользователь не найден');
      } else {
        setFoundUser(data);
      }
    } catch {
      setErrorMsg('Ошибка поиска пользователя');
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartDirectChat = async () => {
    if (!foundUser) return;
    await createDirectChat(foundUser);
    onClose();
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupTitle.trim()) return;
    await createGroupChat(groupTitle.trim(), []);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#16161C] border border-[#2B2B36] rounded-2xl shadow-2xl overflow-hidden text-zinc-100"
      >
        <div className="px-6 py-4 bg-[#1B1B22] border-b border-[#282833] flex items-center justify-between">
          <h3 className="font-bold text-sm text-white">Новый диалог</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="p-1.5 m-5 bg-[#121216] rounded-xl flex border border-[#262633]">
          <button
            onClick={() => setTab('direct')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === 'direct'
                ? 'bg-[#FF7A00] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Личный чат</span>
          </button>
          <button
            onClick={() => setTab('group')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === 'group'
                ? 'bg-[#FF7A00] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Создать группу</span>
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {tab === 'direct' ? (
            <div className="space-y-3">
              <form onSubmit={handleSearchUser} className="flex gap-2">
                <input
                  type="text"
                  value={usernameQuery}
                  onChange={(e) => setUsernameQuery(e.target.value)}
                  placeholder="Введите @username собеседника..."
                  className="flex-1 px-3.5 py-2.5 bg-[#1C1C24] border border-[#2E2E3C] rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00]"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-4 py-2.5 bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold text-xs rounded-xl transition-colors"
                >
                  {isSearching ? '...' : 'Найти'}
                </button>
              </form>

              {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}

              {foundUser && (
                <div className="p-3.5 rounded-xl bg-[#1C1C26] border border-[#2D2D3E] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={foundUser.display_name} src={foundUser.avatar_url} size="md" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white">
                          {foundUser.display_name}
                        </span>
                        <UserBadges
                          role={foundUser.role}
                          isVerified={foundUser.is_verified}
                          hasVozduxPlus={foundUser.has_vozdux_plus}
                        />
                      </div>
                      <span className="text-[11px] text-[#FF8A1C]">@{foundUser.username}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleStartDirectChat}
                    className="px-3 py-1.5 bg-[#FF7A00] hover:bg-[#E66E00] text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                  >
                    Написать
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Название группы:
                </label>
                <input
                  type="text"
                  required
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  placeholder="Например: Vozduxan Dev Team"
                  className="w-full px-3.5 py-2.5 bg-[#1C1C24] border border-[#2E2E3C] rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00]"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold text-xs rounded-xl shadow-md transition-colors"
              >
                Создать группу
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
