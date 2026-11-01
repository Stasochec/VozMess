import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Users,
  UserPlus,
  LogOut,
  Crown,
  Search,
  Shield,
  Trash2,
  Calendar,
  AlertCircle,
  Check,
} from 'lucide-react';
import { Chat, Profile } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { UserBadges } from '@/components/ui/Badges';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { formatChatDate } from '@/lib/dateUtils';

interface GroupMemberRecord {
  id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  profile: Profile;
}

interface GroupProfileModalProps {
  chat: Chat | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenUserProfile?: (user: Profile) => void;
}

export const GroupProfileModal: React.FC<GroupProfileModalProps> = ({
  chat,
  isOpen,
  onClose,
  onOpenUserProfile,
}) => {
  const { user: currentAuthUser } = useAuthStore();
  const { fetchChats, setActiveChatId } = useChatStore();

  const [members, setMembers] = useState<GroupMemberRecord[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');

  // Add member state
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addUsernameQuery, setAddUsernameQuery] = useState('');
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [addMemberMsg, setAddMemberMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load members of this group
  const loadMembers = async () => {
    if (!chat || !isSupabaseConfigured()) return;
    setIsLoadingMembers(true);
    try {
      const { data, error } = await supabase
        .from('chat_members')
        .select(`
          id,
          role,
          joined_at,
          profiles (
            id,
            username,
            display_name,
            avatar_url,
            bio,
            role,
            custom_title,
            is_verified,
            has_vozdux_plus
          )
        `)
        .eq('chat_id', chat.id)
        .order('joined_at', { ascending: true });

      if (error) {
        console.error('Error loading group members:', error.message);
        return;
      }

      const parsed: GroupMemberRecord[] = (data || [])
        .map((item) => {
          const prof = (item as unknown as { profiles: Profile }).profiles;
          if (!prof) return null;
          return {
            id: item.id,
            role: item.role as 'owner' | 'admin' | 'member',
            joined_at: item.joined_at,
            profile: prof,
          };
        })
        .filter((m): m is GroupMemberRecord => Boolean(m));

      setMembers(parsed);
    } catch (err) {
      console.error('Failed to load group members:', err);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (isOpen && chat) {
      loadMembers();
      setIsAddingMember(false);
      setAddMemberMsg(null);
    }
  }, [isOpen, chat?.id]);

  if (!isOpen || !chat) return null;

  const currentMember = members.find((m) => m.profile.id === currentAuthUser?.id);
  const isOwner = currentMember?.role === 'owner' || chat.created_by === currentAuthUser?.id;

  // Filter members by query
  const filteredMembers = members.filter((m) => {
    if (!searchMemberQuery.trim()) return true;
    const q = searchMemberQuery.toLowerCase();
    return (
      m.profile.display_name.toLowerCase().includes(q) ||
      m.profile.username.toLowerCase().includes(q)
    );
  });

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = addUsernameQuery.trim().replace(/^@/, '').toLowerCase();
    if (!cleanNick) return;

    setAddMemberLoading(true);
    setAddMemberMsg(null);

    try {
      // 1. Find profile by username
      const { data: targetProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', cleanNick)
        .maybeSingle();

      if (profileErr || !targetProfile) {
        setAddMemberMsg({ text: `Пользователь @${cleanNick} не найден`, isError: true });
        return;
      }

      // 2. Check if already in group
      if (members.some((m) => m.profile.id === targetProfile.id)) {
        setAddMemberMsg({ text: `@${cleanNick} уже состоит в этой группе`, isError: true });
        return;
      }

      // 3. Insert into chat_members
      const { error: insertErr } = await supabase.from('chat_members').insert({
        chat_id: chat.id,
        user_id: targetProfile.id,
        role: 'member',
      });

      if (insertErr) {
        setAddMemberMsg({ text: `Ошибка добавления: ${insertErr.message}`, isError: true });
        return;
      }

      setAddMemberMsg({ text: `@${cleanNick} успешно добавлен в группу!`, isError: false });
      setAddUsernameQuery('');
      await loadMembers();
      fetchChats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка добавления';
      setAddMemberMsg({ text: msg, isError: true });
    } finally {
      setAddMemberLoading(false);
    }
  };

  const handleRemoveMember = async (targetUserId: string, targetName: string) => {
    if (!window.confirm(`Удалить участника ${targetName} из группы?`)) return;

    try {
      const { error } = await supabase
        .from('chat_members')
        .delete()
        .eq('chat_id', chat.id)
        .eq('user_id', targetUserId);

      if (!error) {
        await loadMembers();
        fetchChats();
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  const handleLeaveGroup = async () => {
    if (!currentAuthUser) return;
    if (!window.confirm('Вы уверены, что хотите покинуть эту группу?')) return;

    try {
      await supabase
        .from('chat_members')
        .delete()
        .eq('chat_id', chat.id)
        .eq('user_id', currentAuthUser.id);

      setActiveChatId(null);
      await fetchChats();
      onClose();
    } catch (err) {
      console.error('Failed to leave group:', err);
    }
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
        {/* HERO BANNER & GROUP INFO */}
        <div className="relative pt-10 pb-6 px-6 bg-gradient-to-b from-[#2B1A0F] via-[#1E140F] to-[#16161C] border-b border-[#2B2B38] flex flex-col items-center text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Group Avatar */}
          <div className="mb-3">
            <Avatar name={chat.title || 'Группа'} src={chat.avatar_url} size="xl" />
          </div>

          <h2 className="font-extrabold text-lg text-white tracking-wide">
            {chat.title || 'Группа'}
          </h2>

          <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
            <span className="flex items-center gap-1 font-semibold text-[#FF7A00]">
              <Users className="w-3.5 h-3.5" />
              <span>{members.length} участников</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-zinc-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>{chat.created_at ? formatChatDate(chat.created_at) : 'Создана'}</span>
            </span>
          </div>

          {/* Action buttons */}
          <div className="mt-4 w-full flex gap-2">
            <button
              onClick={() => setIsAddingMember((prev) => !prev)}
              className="flex-1 py-2 bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Добавить участника</span>
            </button>

            <button
              onClick={handleLeaveGroup}
              className="px-3.5 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
              title="Покинуть группу"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Выйти</span>
            </button>
          </div>
        </div>

        {/* ADD MEMBER DRAWER */}
        <AnimatePresence>
          {isAddingMember && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-[#2B2B38] bg-[#1A1A24] p-4 space-y-2 overflow-hidden"
            >
              <h4 className="text-xs font-bold text-zinc-200">Добавить участника по никнейму:</h4>
              <form onSubmit={handleAddMember} className="flex gap-2">
                <input
                  type="text"
                  value={addUsernameQuery}
                  onChange={(e) => setAddUsernameQuery(e.target.value)}
                  placeholder="Введите @username..."
                  className="flex-1 px-3 py-2 bg-[#121218] border border-[#2D2D3B] rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00]"
                />
                <button
                  type="submit"
                  disabled={addMemberLoading || !addUsernameQuery.trim()}
                  className="px-4 py-2 bg-[#FF7A00] hover:bg-[#E66E00] disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors"
                >
                  {addMemberLoading ? '...' : 'Добавить'}
                </button>
              </form>

              {addMemberMsg && (
                <p
                  className={`text-xs font-semibold ${
                    addMemberMsg.isError ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {addMemberMsg.text}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* SEARCH MEMBERS & LIST */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchMemberQuery}
              onChange={(e) => setSearchMemberQuery(e.target.value)}
              placeholder="Поиск участников группы..."
              className="w-full pl-8 pr-3.5 py-1.5 bg-[#1C1C24] border border-[#2B2B38] rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00] transition-colors"
            />
          </div>

          {isLoadingMembers ? (
            <div className="py-6 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-[#FF7A00] border-t-transparent rounded-full animate-spin" />
              <span>Загрузка участников...</span>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-500">Участники не найдены</div>
          ) : (
            <div className="space-y-1 divide-y divide-zinc-800/40">
              {filteredMembers.map((m) => {
                const isMemberOwner = m.role === 'owner';
                const canRemove = isOwner && m.profile.id !== currentAuthUser?.id;

                return (
                  <div
                    key={m.id}
                    className="pt-2 flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-[#20202B] transition-colors group"
                  >
                    {/* Clickable profile trigger */}
                    <div
                      onClick={() => {
                        onClose();
                        onOpenUserProfile?.(m.profile);
                      }}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    >
                      <Avatar
                        name={m.profile.display_name}
                        src={m.profile.avatar_url}
                        size="md"
                        isOnline
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-zinc-100 group-hover:text-[#FFA033] transition-colors truncate">
                            {m.profile.display_name}
                          </span>
                          <UserBadges
                            role={m.profile.role}
                            username={m.profile.username}
                            isVerified={m.profile.is_verified}
                            hasVozduxPlus={m.profile.has_vozdux_plus}
                            isHidden={m.profile.is_hidden}
                          />
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                          <span>@{m.profile.username}</span>
                          {isMemberOwner && (
                            <span className="text-amber-400 font-semibold flex items-center gap-0.5 text-[10px]">
                              <Crown className="w-3 h-3 fill-amber-400" />
                              <span>Владелец</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Remove member button for group owner */}
                    {canRemove && (
                      <button
                        onClick={() => handleRemoveMember(m.profile.id, m.profile.display_name)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                        title="Удалить из группы"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
