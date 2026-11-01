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
  ShieldOff,
  Trash2,
  Calendar,
  AlertCircle,
  Check,
  Settings,
  ArrowLeft,
  Copy,
  Globe,
  Lock,
  Share2,
  Sparkles,
  Edit3,
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
  const { user: currentAuthUser, profile: currentProfile } = useAuthStore();
  const { fetchChats, setActiveChatId } = useChatStore();

  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [members, setMembers] = useState<GroupMemberRecord[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');

  // Add member state
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addUsernameQuery, setAddUsernameQuery] = useState('');
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [addMemberMsg, setAddMemberMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Edit settings form state
  const [editTitle, setEditTitle] = useState(chat?.title || '');
  const [editDescription, setEditDescription] = useState(chat?.description || '');
  const [editAvatarUrl, setEditAvatarUrl] = useState(chat?.avatar_url || '');
  const [editIsPrivate, setEditIsPrivate] = useState(chat?.is_private ?? false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Invite link copy feedback
  const [copiedLink, setCopiedLink] = useState(false);

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
            has_vozdux_plus,
            is_hidden
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
      setEditTitle(chat.title || '');
      setEditDescription(chat.description || '');
      setEditAvatarUrl(chat.avatar_url || '');
      setEditIsPrivate(chat.is_private ?? false);
      setIsEditingSettings(false);
      setIsAddingMember(false);
      setAddMemberMsg(null);
      setSettingsMsg(null);
      loadMembers();
    }
  }, [isOpen, chat?.id]);

  if (!isOpen || !chat) return null;

  const isGod =
    currentProfile?.username?.toLowerCase() === 'stasochec' || currentProfile?.role === 'owner';
  const currentMember = members.find((m) => m.profile.id === currentAuthUser?.id);
  const isOwner =
    currentMember?.role === 'owner' || chat.created_by === currentAuthUser?.id || isGod;
  const isAdmin = isOwner || currentMember?.role === 'admin';

  // Filter members by query
  const filteredMembers = members.filter((m) => {
    if (!searchMemberQuery.trim()) return true;
    const q = searchMemberQuery.toLowerCase();
    return (
      m.profile.display_name.toLowerCase().includes(q) ||
      m.profile.username.toLowerCase().includes(q)
    );
  });

  const inviteLink = `${window.location.origin}${window.location.pathname}#group=${chat.id}`;

  const handleCopyInviteLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteLink);
      } else {
        const input = document.createElement('input');
        input.value = inviteLink;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleShareInviteLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Группа: ${chat.title || 'Vozduxan'}`,
          text: `Присоединяйтесь к беседе «${chat.title}» в мессенджере Vozduxan:`,
          url: inviteLink,
        });
      } catch {
        handleCopyInviteLink();
      }
    } else {
      handleCopyInviteLink();
    }
  };

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

  const handleToggleAdmin = async (member: GroupMemberRecord) => {
    if (!isOwner) return;
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    const actionLabel = newRole === 'admin' ? 'назначить администратором' : 'снять права администратора с';

    if (!window.confirm(`Вы уверены, что хотите ${actionLabel} @${member.profile.username}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('chat_members')
        .update({ role: newRole })
        .eq('id', member.id);

      if (error) {
        alert(`Не удалось изменить роль: ${error.message}`);
      } else {
        await loadMembers();
      }
    } catch (err) {
      console.error('Failed to toggle admin:', err);
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
      } else {
        alert(`Ошибка удаления: ${error.message}`);
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

  const handleDeleteGroup = async () => {
    if (!isOwner) return;
    if (
      !window.confirm(
        'ВНИМАНИЕ! Вы собираетесь навсегда удалить эту группу, все сообщения и медиафайлы. Это действие необратимо. Продолжить?'
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase.from('chats').delete().eq('id', chat.id);
      if (error) {
        alert(`Ошибка при удалении группы: ${error.message}`);
      } else {
        setActiveChatId(null);
        await fetchChats();
        onClose();
      }
    } catch (err) {
      console.error('Failed to delete group:', err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      setSettingsMsg({ text: 'Название группы не может быть пустым', isError: true });
      return;
    }

    setIsSavingSettings(true);
    setSettingsMsg(null);

    try {
      // Direct update on chats table
      const updates: {
        title: string;
        avatar_url: string | null;
        description?: string;
        is_private?: boolean;
        updated_at: string;
      } = {
        title: editTitle.trim(),
        avatar_url: editAvatarUrl.trim() || null,
        description: editDescription.trim(),
        is_private: editIsPrivate,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('chats').update(updates).eq('id', chat.id);

      if (error) {
        // Fallback in case description/is_private columns are pending in DB schema
        if (error.message.includes('column') || error.code === '42703') {
          const { error: fallbackErr } = await supabase
            .from('chats')
            .update({
              title: editTitle.trim(),
              avatar_url: editAvatarUrl.trim() || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', chat.id);

          if (fallbackErr) throw fallbackErr;
        } else {
          throw error;
        }
      }

      setSettingsMsg({ text: 'Настройки группы успешно сохранены!', isError: false });
      await fetchChats();
      setTimeout(() => {
        setIsEditingSettings(false);
        setSettingsMsg(null);
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка сохранения настроек';
      setSettingsMsg({ text: msg, isError: true });
    } finally {
      setIsSavingSettings(false);
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
        className="w-full max-w-lg bg-[#16161C] border border-[#2B2B38] rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden text-zinc-100 flex flex-col max-h-[90vh]"
      >
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-[#2B2B38] bg-[#1A1A22] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isEditingSettings ? (
              <button
                onClick={() => setIsEditingSettings(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Назад к профилю"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : null}

            <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
              <span>{isEditingSettings ? 'Настройки группы' : 'Информация о группе'}</span>
              {!isEditingSettings && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    chat.is_private
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {chat.is_private ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                  <span>{chat.is_private ? 'Частная' : 'Публичная'}</span>
                </span>
              )}
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            {!isEditingSettings && isAdmin && (
              <button
                onClick={() => setIsEditingSettings(true)}
                className="p-2 rounded-xl text-zinc-400 hover:text-[#FF7A00] hover:bg-[#FF7A00]/10 transition-colors"
                title="Редактировать группу"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: TELEGRAM-STYLE GROUP INFO & MEMBERS                               */}
        {/* ========================================================================= */}
        {!isEditingSettings ? (
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
            {/* HERO BANNER & GROUP INFO */}
            <div className="pt-8 pb-6 px-6 bg-gradient-to-b from-[#2B1A0F] via-[#1E140F] to-[#16161C] flex flex-col items-center text-center">
              {/* Group Avatar */}
              <div className="mb-3 relative group">
                <Avatar name={chat.title || 'Группа'} src={chat.avatar_url} size="xl" />
                {isAdmin && (
                  <button
                    onClick={() => setIsEditingSettings(true)}
                    className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                    title="Изменить фото группы"
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                )}
              </div>

              <h2 className="font-extrabold text-xl text-white tracking-wide">
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

              {/* Action Buttons Bar */}
              <div className="mt-5 w-full flex gap-2">
                <button
                  onClick={() => setIsAddingMember((prev) => !prev)}
                  className="flex-1 py-2.5 bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Добавить</span>
                </button>

                {isAdmin && (
                  <button
                    onClick={() => setIsEditingSettings(true)}
                    className="px-3.5 py-2.5 bg-[#252533] hover:bg-[#303042] text-zinc-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 border border-[#343447]"
                    title="Настройки группы"
                  >
                    <Settings className="w-4 h-4 text-[#FF7A00]" />
                    <span>Настройки</span>
                  </button>
                )}

                <button
                  onClick={handleLeaveGroup}
                  className="px-3.5 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                  title="Покинуть группу"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Выйти</span>
                </button>
              </div>
            </div>

            {/* ADD MEMBER FORM (INLINE DRAWER) */}
            <AnimatePresence>
              {isAddingMember && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-[#1A1A24] p-4 space-y-2 overflow-hidden border-b border-[#2B2B38]"
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

            {/* GROUP DETAILS: DESCRIPTION & INVITE LINK */}
            <div className="p-4 sm:p-5 space-y-3.5 bg-[#14141A]/50">
              {/* Description */}
              <div className="p-3.5 rounded-2xl bg-[#1C1C24] border border-[#2B2B38] space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF7A00]">
                  Описание
                </span>
                <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {chat.description && chat.description.trim() ? (
                    chat.description
                  ) : (
                    <span className="text-zinc-500 italic">Описание группы отсутствует.</span>
                  )}
                </p>
              </div>

              {/* Telegram-style Invite link */}
              <div className="p-3.5 rounded-2xl bg-[#1C1C24] border border-[#2B2B38] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Ссылка-приглашение
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleCopyInviteLink}
                      className="px-2.5 py-1 rounded-lg bg-[#FF7A00]/15 hover:bg-[#FF7A00]/25 text-[#FF8A1C] text-[11px] font-bold flex items-center gap-1 transition-colors border border-[#FF7A00]/30"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Скопировано!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Копировать</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleShareInviteLink}
                      className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      title="Поделиться"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-xs font-mono text-zinc-300 truncate bg-[#121218] px-3 py-2 rounded-xl border border-zinc-800">
                  {inviteLink}
                </div>
                <p className="text-[11px] text-zinc-500">
                  Любой пользователь Vozduxan сможет перейти в эту беседу по ссылке.
                </p>
              </div>
            </div>

            {/* MEMBERS LIST */}
            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Участники ({members.length})
                </h4>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchMemberQuery}
                  onChange={(e) => setSearchMemberQuery(e.target.value)}
                  placeholder="Поиск по участникам..."
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
                    const isMemberAdmin = m.role === 'admin';
                    const isMe = m.profile.id === currentAuthUser?.id;
                    const canKick =
                      (isOwner && !isMe) ||
                      (isAdmin && !isMemberOwner && !isMemberAdmin && !isMe);

                    return (
                      <div
                        key={m.id}
                        className="pt-2 flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-[#20202B] transition-colors group"
                      >
                        {/* Member avatar & names (Clickable for profile view) */}
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
                              {isMemberOwner ? (
                                <span className="text-amber-400 font-semibold flex items-center gap-0.5 text-[10px]">
                                  <Crown className="w-3 h-3 fill-amber-400" />
                                  <span>Владелец</span>
                                </span>
                              ) : isMemberAdmin ? (
                                <span className="text-sky-400 font-semibold flex items-center gap-0.5 text-[10px]">
                                  <Shield className="w-3 h-3" />
                                  <span>Админ</span>
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons on member */}
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          {/* Owner can toggle admin */}
                          {isOwner && !isMemberOwner && !isMe && (
                            <button
                              onClick={() => handleToggleAdmin(m)}
                              className={`p-1.5 rounded-lg text-xs transition-colors ${
                                isMemberAdmin
                                  ? 'text-amber-400 hover:bg-amber-500/10'
                                  : 'text-zinc-500 hover:text-sky-400 hover:bg-sky-500/10'
                              }`}
                              title={
                                isMemberAdmin
                                  ? 'Разжаловать из администраторов'
                                  : 'Назначить администратором'
                              }
                            >
                              {isMemberAdmin ? (
                                <ShieldOff className="w-4 h-4" />
                              ) : (
                                <Shield className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {/* Kick button */}
                          {canKick && (
                            <button
                              onClick={() =>
                                handleRemoveMember(m.profile.id, m.profile.display_name)
                              }
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Удалить из группы"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW 2: TELEGRAM-STYLE GROUP SETTINGS (EDIT MODE)                         */
          /* ========================================================================= */
          <form onSubmit={handleSaveSettings} className="flex-1 overflow-y-auto p-5 space-y-5">
            {settingsMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  settingsMsg.isError
                    ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                    : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                }`}
              >
                {settingsMsg.isError ? (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <Check className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{settingsMsg.text}</span>
              </div>
            )}

            {/* Avatar URL & Live Preview */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#1C1C24] border border-[#2B2B38]">
              <Avatar name={editTitle || 'Группа'} src={editAvatarUrl} size="xl" />
              <div className="flex-1 min-w-0 space-y-1">
                <label className="block text-xs font-bold text-zinc-200">
                  Аватар группы (URL):
                </label>
                <input
                  type="url"
                  value={editAvatarUrl}
                  onChange={(e) => setEditAvatarUrl(e.target.value)}
                  placeholder="https://example.com/group-cover.png"
                  className="w-full px-3 py-2 bg-[#121217] border border-[#2D2D3B] rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF7A00]"
                />
                <span className="text-[10px] text-zinc-500 block">
                  Вставьте прямую ссылку на фото или оставьте пустым
                </span>
              </div>
            </div>

            {/* Group Title */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-200">Название группы:</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Введите название группы..."
                className="w-full px-3.5 py-2.5 bg-[#1C1C24] border border-[#2D2D3B] rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF7A00]"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-zinc-200">Описание группы:</label>
                <span className="text-[10px] text-zinc-500">{editDescription.length} / 255</span>
              </div>
              <textarea
                rows={3}
                maxLength={255}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Добавьте правила, описание или полезные ссылки..."
                className="w-full px-3.5 py-2.5 bg-[#1C1C24] border border-[#2D2D3B] rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF7A00]"
              />
            </div>

            {/* Group Type (Public vs Private) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-200">Тип группы:</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditIsPrivate(false)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    !editIsPrivate
                      ? 'bg-[#FF7A00]/15 border-[#FF7A00] text-white shadow-sm'
                      : 'bg-[#1C1C24] border-[#2D2D3B] text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Globe
                      className={`w-4 h-4 ${!editIsPrivate ? 'text-[#FF7A00]' : 'text-zinc-400'}`}
                    />
                    <span className="font-bold text-xs">Публичная</span>
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    Любой может вступить по ссылке или найти в поиске
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setEditIsPrivate(true)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    editIsPrivate
                      ? 'bg-[#FF7A00]/15 border-[#FF7A00] text-white shadow-sm'
                      : 'bg-[#1C1C24] border-[#2D2D3B] text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Lock
                      className={`w-4 h-4 ${editIsPrivate ? 'text-[#FF7A00]' : 'text-zinc-400'}`}
                    />
                    <span className="font-bold text-xs">Частная</span>
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    Вход только по приглашению администратора
                  </p>
                </button>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingSettings || !editTitle.trim()}
                className="w-full py-3 bg-[#FF7A00] hover:bg-[#E66E00] disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors shadow-md shadow-[#FF7A00]/25 flex items-center justify-center gap-2"
              >
                {isSavingSettings ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Сохранение...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Сохранить настройки</span>
                  </>
                )}
              </button>
            </div>

            {/* Danger Zone: Delete Group Permanently (Owner only) */}
            {isOwner && (
              <div className="pt-4 border-t border-rose-500/20 space-y-2">
                <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                  Опасная зона
                </span>
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-rose-200 block">Удалить группу</span>
                    <span className="text-[10px] text-rose-300/80">
                      Удалить группу, всех участников и историю навсегда
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeleteGroup}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </motion.div>
    </div>
  );
};
