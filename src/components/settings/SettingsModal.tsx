import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Bell,
  Lock,
  Palette,
  HardDrive,
  LogOut,
  Check,
  Shield,
  KeyRound,
  Trash2,
  Moon,
  Sun,
  Volume2,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Avatar } from '@/components/ui/Avatar';
import { UserBadges } from '@/components/ui/Badges';
import { UsernameInput } from '@/components/ui/UsernameInput';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { formatChatDate } from '@/lib/dateUtils';

type SettingsTab = 'profile' | 'notifications' | 'privacy' | 'appearance' | 'storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'profile',
}) => {
  const { profile, user, updateProfile, signOut } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const {
    soundEnabled,
    sendSoundEnabled,
    desktopNotifications,
    fontSize,
    sendOnEnter,
    whoCanSeeLastSeen,
    whoCanAddToGroups,
    setSoundEnabled,
    setSendSoundEnabled,
    setDesktopNotifications,
    setFontSize,
    setSendOnEnter,
    setWhoCanSeeLastSeen,
    setWhoCanAddToGroups,
    clearCache,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // Profile edit states
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [isUsernameValid, setIsUsernameValid] = useState(true);
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Cache clear feedback
  const [cacheCleared, setCacheCleared] = useState(false);

  if (!isOpen || !profile) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUsernameValid) {
      setProfileSaveError('Укажите корректный и свободный @username');
      return;
    }

    setIsSavingProfile(true);
    setProfileSaveError(null);
    try {
      const cleanNick = username.trim().toLowerCase();
      const res = await updateProfile({
        username: cleanNick,
        display_name: displayName.trim() || cleanNick,
        bio: bio.trim(),
        avatar_url: avatarUrl.trim() || null,
      });

      if (res.error) {
        setProfileSaveError(res.error);
      } else {
        setProfileSaveSuccess(true);
        setTimeout(() => setProfileSaveSuccess(false), 2500);
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 6) {
      setPasswordMsg({ text: 'Пароль должен содержать минимум 6 символов', isError: true });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'Пароли не совпадают', isError: true });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordMsg({ text: error.message, isError: true });
      } else {
        setPasswordMsg({ text: 'Пароль успешно обновлен!', isError: false });
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      setPasswordMsg({ text: 'Ошибка смены пароля', isError: true });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRequestDesktopNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Ваш браузер не поддерживает Push-уведомления');
      return;
    }

    if (Notification.permission === 'granted') {
      setDesktopNotifications(!desktopNotifications);
    } else {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setDesktopNotifications(true);
      } else {
        setDesktopNotifications(false);
      }
    }
  };

  const handleClearAppCache = () => {
    clearCache();
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 3000);
  };

  const navItems = [
    { id: 'profile' as SettingsTab, label: 'Мой аккаунт', icon: User, color: 'text-orange-400' },
    { id: 'notifications' as SettingsTab, label: 'Уведомления и звуки', icon: Bell, color: 'text-amber-400' },
    { id: 'privacy' as SettingsTab, label: 'Конфиденциальность', icon: Shield, color: 'text-emerald-400' },
    { id: 'appearance' as SettingsTab, label: 'Оформление и чаты', icon: Palette, color: 'text-sky-400' },
    { id: 'storage' as SettingsTab, label: 'Память и данные', icon: HardDrive, color: 'text-purple-400' },
  ];

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
        className="w-full max-w-3xl h-[88vh] max-h-[700px] bg-[#16161C] border border-[#2B2B38] rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden text-zinc-100 flex flex-col md:flex-row"
      >
        {/* LEFT SIDEBAR NAVIGATION (RESPONSIVE: TABS PILL-BAR ON MOBILE, FULL SIDEBAR ON DESKTOP) */}
        <aside className="w-full md:w-64 bg-[#141419] border-b md:border-b-0 md:border-r border-[#262633] flex flex-col flex-shrink-0">
          {/* Header */}
          <div className="p-3 sm:p-4 border-b border-[#262633] flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <span className="text-[#FF7A00]">⚙️</span>
              <span>Настройки</span>
            </h3>
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
              title="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Mini Card (Desktop only to save vertical space on mobile) */}
          <div className="hidden md:flex p-4 bg-gradient-to-br from-[#24150B]/60 to-[#141419] border-b border-[#262633] items-center gap-3">
            <Avatar name={profile.display_name} src={profile.avatar_url} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="font-bold text-xs text-white truncate">{profile.display_name}</span>
                <UserBadges
                  role={profile.role}
                  username={profile.username}
                  isVerified={profile.is_verified}
                  hasVozduxPlus={profile.has_vozdux_plus}
                />
              </div>
              <span className="text-[11px] text-[#FF8A1C] font-mono">@{profile.username}</span>
            </div>
          </div>

          {/* Navigation Items: Horizontal scroll on mobile, vertical stack on desktop */}
          <div className="flex md:flex-col overflow-x-auto md:overflow-y-auto p-2 gap-1.5 md:gap-1 flex-shrink-0 no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex-shrink-0 flex items-center justify-between px-3.5 py-2 md:py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-[#FF7A00] text-white shadow-md shadow-[#FF7A00]/25'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 bg-[#1C1C24] md:bg-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.color}`} />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 opacity-60 hidden md:block ${isActive ? 'text-white' : ''}`} />
                </button>
              );
            })}
          </div>

          {/* Bottom Sign Out (Desktop) */}
          <div className="hidden md:block p-3 border-t border-[#262633]">
            <button
              onClick={() => {
                if (window.confirm('Вы действительно хотите выйти из аккаунта?')) {
                  signOut();
                  onClose();
                }
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Выйти из аккаунта</span>
            </button>
          </div>
        </aside>

        {/* RIGHT CONTENT PANE */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#16161C] overflow-hidden">
          {/* Top Title Bar (Desktop only, mobile already has pill bar) */}
          <header className="hidden md:flex px-6 py-4 border-b border-[#262633] items-center justify-between bg-[#191921]/60">
            <h4 className="font-extrabold text-sm text-white">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h4>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 1. TAB: PROFILE & ACCOUNT */}
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg">
                {profileSaveSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span>Профиль успешно сохранен!</span>
                  </div>
                )}
                {profileSaveError && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs">
                    {profileSaveError}
                  </div>
                )}

                {/* Avatar Preview & URL */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#1C1C24] border border-[#2B2B38]">
                  <Avatar name={displayName || profile.display_name} src={avatarUrl || profile.avatar_url} size="xl" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <label className="block text-xs font-semibold text-zinc-300">
                      Ссылка на аватар (URL):
                    </label>
                    <input
                      type="url"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://example.com/avatar.png"
                      className="w-full px-3 py-2 bg-[#121217] border border-[#2D2D3B] rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF7A00]"
                    />
                    <span className="text-[10px] text-zinc-500 block">
                      Прямая ссылка на изображение (PNG, JPG, WebP)
                    </span>
                  </div>
                </div>

                {/* Display Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Имя и фамилия:
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ваше имя..."
                    className="w-full px-3.5 py-2.5 bg-[#1C1C24] border border-[#2D2D3B] rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>

                {/* Username Input with Validation */}
                <UsernameInput
                  value={username}
                  onChange={setUsername}
                  currentUsername={profile.username}
                  onValidationChange={setIsUsernameValid}
                />

                {/* Bio */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-300">
                    О себе (Bio):
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={140}
                    placeholder="Напишите несколько слов о себе..."
                    className="w-full px-3.5 py-2.5 bg-[#1C1C24] border border-[#2D2D3B] rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF7A00]"
                  />
                  <div className="text-right text-[10px] text-zinc-500">
                    {bio.length} / 140 символов
                  </div>
                </div>

                {/* Email (Readonly info) */}
                <div className="p-3.5 rounded-xl bg-[#14141A] border border-[#262633] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-zinc-500 block">Привязанный Email:</span>
                    <span className="text-xs font-mono text-zinc-300">{user?.email || 'Не указан'}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Подтвержден ✅
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSavingProfile || !isUsernameValid}
                  className="w-full py-2.5 bg-[#FF7A00] hover:bg-[#E66E00] disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors shadow-md shadow-[#FF7A00]/25 flex items-center justify-center gap-2"
                >
                  {isSavingProfile ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Сохранение...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Сохранить изменения профиля</span>
                    </>
                  )}
                </button>

                {/* Mobile-only Sign Out Button */}
                <div className="md:hidden pt-4 border-t border-[#262633]">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Вы действительно хотите выйти из аккаунта?')) {
                        signOut();
                        onClose();
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs rounded-xl transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Выйти из аккаунта</span>
                  </button>
                </div>
              </form>
            )}

            {/* 2. TAB: NOTIFICATIONS & SOUNDS */}
            {activeTab === 'notifications' && (
              <div className="space-y-4 max-w-lg">
                <div className="p-4 rounded-2xl bg-[#1C1C24] border border-[#2B2B38] space-y-4">
                  {/* Message sound toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-zinc-200 block">Звуки сообщений</span>
                      <span className="text-[11px] text-zinc-500">Воспроизводить звук при входящем сообщении</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                        soundEnabled ? 'bg-[#FF7A00]' : 'bg-zinc-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          soundEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Send sound toggle */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#262633]">
                    <div>
                      <span className="font-bold text-xs text-zinc-200 block">Звук отправки сообщения</span>
                      <span className="text-[11px] text-zinc-500">Воспроизводить щелчок при отправке</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSendSoundEnabled(!sendSoundEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                        sendSoundEnabled ? 'bg-[#FF7A00]' : 'bg-zinc-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          sendSoundEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Desktop Push notifications toggle */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#262633]">
                    <div>
                      <span className="font-bold text-xs text-zinc-200 block">Всплывающие уведомления</span>
                      <span className="text-[11px] text-zinc-500">Показывать уведомления браузера</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRequestDesktopNotifications}
                      className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                        desktopNotifications ? 'bg-[#FF7A00]' : 'bg-zinc-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          desktopNotifications ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. TAB: PRIVACY & SECURITY */}
            {activeTab === 'privacy' && (
              <div className="space-y-5 max-w-lg">
                {/* Vozdux TTL 14d Security Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/15 to-orange-500/10 border border-orange-500/30 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-[#FF7A00] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-extrabold text-xs text-white">Протокол Vozdux TTL (14 дней)</h5>
                    <p className="text-[11px] text-zinc-300 mt-1 leading-relaxed">
                      Все сообщения в личных и групповых чатах защищены сквозным таймером самоуничтожения. Каждое сообщение автоматически и безвозвратно удаляется ровно через 14 дней с момента отправки.
                    </p>
                  </div>
                </div>

                {/* Privacy toggles */}
                <div className="p-4 rounded-2xl bg-[#1C1C24] border border-[#2B2B38] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-zinc-200 block">Кто видит время захода</span>
                      <span className="text-[11px] text-zinc-500">Отображение статуса «в сети» в чатах</span>
                    </div>
                    <select
                      value={whoCanSeeLastSeen}
                      onChange={(e) => setWhoCanSeeLastSeen(e.target.value as 'all' | 'nobody')}
                      className="px-3 py-1.5 bg-[#141419] border border-[#2E2E3C] rounded-lg text-xs text-white focus:outline-none focus:border-[#FF7A00]"
                    >
                      <option value="all">Все</option>
                      <option value="nobody">Никто</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#262633]">
                    <div>
                      <span className="font-bold text-xs text-zinc-200 block">Кто может добавлять в группы</span>
                      <span className="text-[11px] text-zinc-500">Приглашения в новые группы</span>
                    </div>
                    <select
                      value={whoCanAddToGroups}
                      onChange={(e) => setWhoCanAddToGroups(e.target.value as 'all' | 'contacts')}
                      className="px-3 py-1.5 bg-[#141419] border border-[#2E2E3C] rounded-lg text-xs text-white focus:outline-none focus:border-[#FF7A00]"
                    >
                      <option value="all">Все пользователи</option>
                      <option value="contacts">Только контакты</option>
                    </select>
                  </div>
                </div>

                {/* Password Change Form */}
                <form onSubmit={handleChangePassword} className="p-4 rounded-2xl bg-[#1C1C24] border border-[#2B2B38] space-y-3">
                  <h5 className="font-bold text-xs text-white flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#FF7A00]" />
                    <span>Смена пароля</span>
                  </h5>

                  {passwordMsg && (
                    <div
                      className={`p-2.5 rounded-lg text-xs ${
                        passwordMsg.isError
                          ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                          : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                      }`}
                    >
                      {passwordMsg.text}
                    </div>
                  )}

                  <div className="space-y-2">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Новый пароль (минимум 6 символов)..."
                      className="w-full px-3 py-2 bg-[#141419] border border-[#2E2E3C] rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF7A00]"
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Повторите новый пароль..."
                      className="w-full px-3 py-2 bg-[#141419] border border-[#2E2E3C] rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isChangingPassword || !newPassword}
                    className="px-4 py-2 bg-[#FF7A00] hover:bg-[#E66E00] disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
                  >
                    {isChangingPassword ? 'Обновление...' : 'Обновить пароль'}
                  </button>
                </form>
              </div>
            )}

            {/* 4. TAB: APPEARANCE & CHATS */}
            {activeTab === 'appearance' && (
              <div className="space-y-4 max-w-lg">
                <div className="p-4 rounded-2xl bg-[#1C1C24] border border-[#2B2B38] space-y-4">
                  {/* Theme Switcher */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-zinc-200 block">Цветовая тема</span>
                      <span className="text-[11px] text-zinc-500">Тёмная или светлая тема оформления</span>
                    </div>
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="px-3 py-1.5 rounded-xl bg-[#141419] border border-[#2E2E3C] text-xs font-semibold text-zinc-200 hover:text-white flex items-center gap-2 transition-colors"
                    >
                      {theme === 'dark' ? (
                        <>
                          <Moon className="w-3.5 h-3.5 text-[#FF7A00]" />
                          <span>Тёмная тема</span>
                        </>
                      ) : (
                        <>
                          <Sun className="w-3.5 h-3.5 text-amber-500" />
                          <span>Светлая тема</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Font Size in messages */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#262633]">
                    <div>
                      <span className="font-bold text-xs text-zinc-200 block">Размер текста сообщений</span>
                      <span className="text-[11px] text-zinc-500">Масштабирование текста внутри облачков</span>
                    </div>
                    <div className="flex bg-[#141419] rounded-xl p-1 border border-[#2E2E3C]">
                      {(['sm', 'md', 'lg'] as const).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setFontSize(size)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            fontSize === size
                              ? 'bg-[#FF7A00] text-white shadow-sm'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          {size === 'sm' ? '13px' : size === 'md' ? '14px' : '16px'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Send on Enter toggle */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#262633]">
                    <div>
                      <span className="font-bold text-xs text-zinc-200 block">Отправка сообщений</span>
                      <span className="text-[11px] text-zinc-500">
                        {sendOnEnter ? 'Нажатие Enter отправляет (Shift+Enter — перенос)' : 'Нажатие Ctrl+Enter отправляет'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSendOnEnter(!sendOnEnter)}
                      className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                        sendOnEnter ? 'bg-[#FF7A00]' : 'bg-zinc-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          sendOnEnter ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 5. TAB: DATA & STORAGE */}
            {activeTab === 'storage' && (
              <div className="space-y-4 max-w-lg">
                <div className="p-4 rounded-2xl bg-[#1C1C24] border border-[#2B2B38] space-y-4">
                  <div>
                    <span className="font-bold text-xs text-zinc-200 block">Клиентская оптимизация медиа</span>
                    <span className="text-[11px] text-zinc-400 block mt-1 leading-relaxed">
                      В мессенджер встроена canvas-оптимизация изображений: фото перед отправкой автоматически конвертируются в WebP с разрешением до 1280px. Вес файла уменьшается до 90% без потери четкости.
                    </span>
                    <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      ⚡ Включено и активно
                    </span>
                  </div>

                  <div className="pt-3 border-t border-[#262633] flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-zinc-200 block">Кэш приложения</span>
                      <span className="text-[11px] text-zinc-500">Очистить временные данные и сессионный кэш</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearAppCache}
                      className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors border border-zinc-700"
                    >
                      Очистить кэш
                    </button>
                  </div>

                  {cacheCleared && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>Кэш приложения успешно очищен!</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </motion.div>
    </div>
  );
};
