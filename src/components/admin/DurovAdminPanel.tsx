import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown,
  Shield,
  Search,
  Megaphone,
  Check,
  Sparkles,
  AlertTriangle,
  UserCheck,
  X,
  Edit3,
  Flame,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Profile, UserRole } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { UserBadges, VerifiedBadge, VozduxPlusBadge } from '@/components/ui/Badges';

interface DurovAdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DurovAdminPanel: React.FC<DurovAdminPanelProps> = ({ isOpen, onClose }) => {
  const { profile, isDemo } = useAuthStore();
  const { broadcastAnnouncement } = useChatStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [targetUser, setTargetUser] = useState<Profile | null>(null);
  const [customTitleInput, setCustomTitleInput] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Broadcast state
  const [broadcastText, setBroadcastText] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  if (!isOpen) return null;

  // Access check: only owner has supreme admin privileges
  const isOwner = profile?.role === 'owner';

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handleSearchUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = searchQuery.trim().replace(/^@/, '').toLowerCase();
    if (!clean) return;

    setIsSearching(true);
    setSearchError(null);
    setTargetUser(null);

    // Mock search for demo mode
    if (!isSupabaseConfigured() || isDemo) {
      setTimeout(() => {
        setIsSearching(false);
        if (clean === 'nikita_dev' || clean === 'nikita') {
          const user: Profile = {
            id: 'user-nikita',
            username: 'nikita_dev',
            display_name: 'Никита',
            avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
            role: 'moderator',
            custom_title: 'Архитектор сети',
            is_verified: true,
            has_vozdux_plus: true,
            bio: 'Разрабатываю Realtime архитектуру на Supabase',
            created_at: new Date().toISOString(),
            last_seen: new Date().toISOString(),
          };
          setTargetUser(user);
          setCustomTitleInput(user.custom_title || '');
        } else if (clean === 'durov' || clean === 'durov_vozdux') {
          setTargetUser(profile);
          setCustomTitleInput(profile?.custom_title || '');
        } else {
          // Generate simulated user for instant testing
          const simulated: Profile = {
            id: `sim-${clean}`,
            username: clean,
            display_name: clean.charAt(0).toUpperCase() + clean.slice(1),
            avatar_url: null,
            role: 'user',
            custom_title: null,
            is_verified: false,
            has_vozdux_plus: false,
            bio: 'Новый пользователь Vozduxan',
            created_at: new Date().toISOString(),
            last_seen: new Date().toISOString(),
          };
          setTargetUser(simulated);
          setCustomTitleInput('');
        }
      }, 350);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', clean)
        .single();

      if (error || !data) {
        setSearchError(`Пользователь @${clean} не найден`);
      } else {
        setTargetUser(data);
        setCustomTitleInput(data.custom_title || '');
      }
    } catch (err: unknown) {
      setSearchError('Ошибка выполнения поиска');
    } finally {
      setIsSearching(false);
    }
  };

  // 1-Click Toggle Vozdux++
  const handleToggleVozduxPlus = async () => {
    if (!targetUser) return;
    const nextVal = !targetUser.has_vozdux_plus;

    if (!isSupabaseConfigured() || isDemo) {
      setTargetUser({ ...targetUser, has_vozdux_plus: nextVal });
      showNotification(`Vozdux++ ${nextVal ? 'активирован' : 'отключен'} для @${targetUser.username}`);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ has_vozdux_plus: nextVal })
      .eq('id', targetUser.id);

    if (!error) {
      setTargetUser({ ...targetUser, has_vozdux_plus: nextVal });
      showNotification(`Vozdux++ ${nextVal ? 'активирован' : 'отключен'} для @${targetUser.username}`);
    }
  };

  // 1-Click Toggle Verified
  const handleToggleVerified = async () => {
    if (!targetUser) return;
    const nextVal = !targetUser.is_verified;

    if (!isSupabaseConfigured() || isDemo) {
      setTargetUser({ ...targetUser, is_verified: nextVal });
      showNotification(`Статус Verified ${nextVal ? 'выдан' : 'снят'} для @${targetUser.username}`);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ is_verified: nextVal })
      .eq('id', targetUser.id);

    if (!error) {
      setTargetUser({ ...targetUser, is_verified: nextVal });
      showNotification(`Статус Verified ${nextVal ? 'выдан' : 'снят'} для @${targetUser.username}`);
    }
  };

  // 1-Click Toggle Moderator Role
  const handleToggleModerator = async () => {
    if (!targetUser) return;
    const nextRole: UserRole = targetUser.role === 'moderator' ? 'user' : 'moderator';

    if (!isSupabaseConfigured() || isDemo) {
      setTargetUser({ ...targetUser, role: nextRole });
      showNotification(`Роль @${targetUser.username} изменена на: ${nextRole}`);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role: nextRole })
      .eq('id', targetUser.id);

    if (!error) {
      setTargetUser({ ...targetUser, role: nextRole });
      showNotification(`Роль @${targetUser.username} изменена на: ${nextRole}`);
    }
  };

  // Save Custom Title
  const handleSaveCustomTitle = async () => {
    if (!targetUser) return;
    const titleVal = customTitleInput.trim() || null;

    if (!isSupabaseConfigured() || isDemo) {
      setTargetUser({ ...targetUser, custom_title: titleVal });
      showNotification(`Кастомный титул обновлен для @${targetUser.username}`);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ custom_title: titleVal })
      .eq('id', targetUser.id);

    if (!error) {
      setTargetUser({ ...targetUser, custom_title: titleVal });
      showNotification(`Кастомный титул сохранен для @${targetUser.username}`);
    }
  };

  // Broadcast announcement to all chats
  const handleSendBroadcast = async () => {
    if (!broadcastText.trim()) return;
    setIsBroadcasting(true);

    try {
      const res = await broadcastAnnouncement(broadcastText.trim());
      if (res.success) {
        setBroadcastText('');
        showNotification('🚀 Глобальное системное оповещение успешно отправлено во все чаты!');
      } else {
        alert(res.error || 'Ошибка отправки оповещения');
      }
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-[#141418] border border-[#2B2B36] rounded-2xl shadow-[0_20px_60px_-15px_rgba(255,122,0,0.35)] overflow-hidden text-zinc-100"
      >
        {/* Header with Supreme Durov Styling */}
        <div className="relative px-6 py-4.5 bg-gradient-to-r from-[#201712] via-[#241a12] to-[#1c130d] border-b border-[#362315] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF9500] to-[#FF4500] flex items-center justify-center shadow-[0_0_15px_rgba(255,122,0,0.5)]">
              <Crown className="w-5 h-5 text-white drop-shadow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-lg text-white tracking-wide">
                  Панель Создателя «Дуров»
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest bg-[#FF7A00]/20 text-[#FFA852] border border-[#FF7A00]/40">
                  VOZDUX++ SUPREME
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Центр абсолютного управления привилегиями, ролями и оповещениями
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert Banner */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-emerald-500/15 border-b border-emerald-500/30 px-6 py-2.5 flex items-center gap-2 text-emerald-400 text-xs font-semibold"
            >
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {!isOwner ? (
            <div className="p-6 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-3">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="font-bold text-amber-400 text-base">Доступ ограничен</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Эта панель доступна исключительно владельцу с ролью <span className="text-amber-400 font-bold">owner</span> (Создатель Vozduxan). Первый зарегистрированный аккаунт в базе данных автоматически получает статус Создателя.
              </p>
              <button
                onClick={() => {
                  useAuthStore.getState().loginAsDemo('owner');
                  showNotification('Вы переключены в режим Создателя (Durov Mode)');
                }}
                className="mt-2 px-4 py-2 bg-[#FF7A00] hover:bg-[#E66E00] text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-[#FF7A00]/25"
              >
                Войти в Demo как Создатель 👑
              </button>
            </div>
          ) : (
            <>
              {/* SECTION 1: USER PRIVILEGE MANAGEMENT */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#FF7A00]" />
                    Управление пользователем по @username
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSearchQuery('nikita_dev');
                        setTimeout(() => handleSearchUser(), 50);
                      }}
                      className="text-[11px] text-[#FF9500] hover:underline"
                    >
                      @nikita_dev
                    </button>
                    <button
                      onClick={() => {
                        setSearchQuery('durov_vozdux');
                        setTimeout(() => handleSearchUser(), 50);
                      }}
                      className="text-[11px] text-[#FF9500] hover:underline"
                    >
                      @durov_vozdux
                    </button>
                  </div>
                </div>

                {/* Search Form */}
                <form onSubmit={handleSearchUser} className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Введите @username пользователя..."
                      className="w-full pl-9 pr-4 py-2.5 bg-[#1B1B22] border border-[#2D2D38] rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00] transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="px-4 py-2.5 bg-[#FF7A00] hover:bg-[#E66E00] disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors shadow-md shadow-[#FF7A00]/25 flex items-center gap-1.5"
                  >
                    {isSearching ? 'Поиск...' : 'Найти'}
                  </button>
                </form>

                {searchError && (
                  <p className="text-xs text-rose-400 font-medium pl-1">{searchError}</p>
                )}

                {/* Target User Details Card */}
                {targetUser && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4.5 rounded-xl bg-[#191921] border border-[#2E2E3C] space-y-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={targetUser.display_name}
                          src={targetUser.avatar_url}
                          size="lg"
                          isOnline
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base">
                              {targetUser.display_name}
                            </span>
                            <UserBadges
                              role={targetUser.role}
                              isVerified={targetUser.is_verified}
                              hasVozduxPlus={targetUser.has_vozdux_plus}
                              customTitle={targetUser.custom_title}
                              showRoleText
                            />
                          </div>
                          <span className="text-xs text-[#FF8A1C] font-mono">
                            @{targetUser.username}
                          </span>
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-zinc-500">
                        ID: {targetUser.id.slice(0, 8)}...
                      </div>
                    </div>

                    {/* Quick 1-Click Action Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      {/* 1. Toggle Vozdux++ */}
                      <button
                        onClick={handleToggleVozduxPlus}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                          targetUser.has_vozdux_plus
                            ? 'bg-gradient-to-b from-[#331C0D] to-[#241308] border-[#FF7A00]/50 text-white shadow-[0_0_12px_rgba(255,122,0,0.25)]'
                            : 'bg-[#1E1E28] border-[#2C2C3A] text-zinc-400 hover:border-zinc-500'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          <VozduxPlusBadge size={18} />
                          <span>Vozdux++</span>
                        </div>
                        <span className="text-[10px] font-semibold text-[#FF9500]">
                          {targetUser.has_vozdux_plus ? '● АКТИВИРОВАН' : '○ Выключен'}
                        </span>
                      </button>

                      {/* 2. Toggle Verified Orange Checkmark */}
                      <button
                        onClick={handleToggleVerified}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                          targetUser.is_verified
                            ? 'bg-gradient-to-b from-[#2E1A0A] to-[#201206] border-[#FF7A00]/50 text-white shadow-[0_0_12px_rgba(255,122,0,0.25)]'
                            : 'bg-[#1E1E28] border-[#2C2C3A] text-zinc-400 hover:border-zinc-500'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          <VerifiedBadge size={18} />
                          <span>Verified ✅</span>
                        </div>
                        <span className="text-[10px] font-semibold text-[#FF9500]">
                          {targetUser.is_verified ? '● ПОДТВЕРЖДЕН' : '○ Без галочки'}
                        </span>
                      </button>

                      {/* 3. Toggle Moderator Role */}
                      <button
                        onClick={handleToggleModerator}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                          targetUser.role === 'moderator'
                            ? 'bg-gradient-to-b from-[#0F222B] to-[#0A171D] border-cyan-500/50 text-white shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                            : 'bg-[#1E1E28] border-[#2C2C3A] text-zinc-400 hover:border-zinc-500'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-cyan-400">
                          <Shield className="w-4 h-4" />
                          <span>Модератор</span>
                        </div>
                        <span className="text-[10px] font-semibold text-cyan-400">
                          {targetUser.role === 'moderator' ? '● НАЗНАЧЕН' : '○ Обычный юзер'}
                        </span>
                      </button>
                    </div>

                    {/* Custom Title Input */}
                    <div className="pt-2 border-t border-[#292936] space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5 text-[#FF7A00]" />
                        Кастомный титул (отображается бейджем в профиле):
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customTitleInput}
                          onChange={(e) => setCustomTitleInput(e.target.value)}
                          placeholder="Например: Архитектор Vozduxan, VIP..."
                          className="flex-1 px-3.5 py-2 bg-[#14141B] border border-[#2D2D3B] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF7A00]"
                        />
                        <button
                          onClick={handleSaveCustomTitle}
                          className="px-3.5 py-2 bg-zinc-800 hover:bg-[#FF7A00] hover:text-white text-zinc-200 text-xs font-bold rounded-lg border border-zinc-700 transition-colors"
                        >
                          Сохранить
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* SECTION 2: GLOBAL ANNOUNCEMENT (DUROV BROADCAST) */}
              <div className="pt-4 border-t border-[#2C2C38] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-[#FF7A00]" />
                    Глобальное системное оповещение (Durov Broadcast)
                  </h3>
                  <span className="text-[11px] text-amber-500 font-semibold flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" /> Во все активные чаты
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-[#1C1613] to-[#151210] border border-[#3D2515] space-y-3">
                  <p className="text-xs text-zinc-400">
                    Отправка официального уведомления от имени Создателя. Сообщение появится во всех диалогах с золотистым бейджем оповещения. Как и всё в Vozduxan, сообщение исчезнет через 14 дней.
                  </p>

                  <textarea
                    rows={3}
                    value={broadcastText}
                    onChange={(e) => setBroadcastText(e.target.value)}
                    placeholder="Текст глобального сообщения... (например: Обновление системы: ускорена доставка медиа и добавлены новые темы оформления!)"
                    className="w-full p-3 bg-[#111012] border border-[#3E2818] rounded-xl text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#FF7A00] resize-none"
                  />

                  <div className="flex justify-end">
                    <button
                      onClick={handleSendBroadcast}
                      disabled={isBroadcasting || !broadcastText.trim()}
                      className="px-4 py-2.5 bg-gradient-to-r from-[#FF7A00] to-[#FF4500] hover:from-[#E66E00] hover:to-[#E03D00] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-[#FF7A00]/30 transition-all flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isBroadcasting ? 'Рассылка...' : 'Опубликовать во все чаты 📢'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#101014] border-t border-[#23232C] flex items-center justify-between text-xs text-zinc-500">
          <span>Vozduxan Supreme Protocol v1.4 • TTL 14 Days</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1E1E26] hover:bg-[#282833] text-zinc-300 text-xs font-semibold rounded-lg transition-colors"
          >
            Закрыть
          </button>
        </div>
      </motion.div>
    </div>
  );
};
