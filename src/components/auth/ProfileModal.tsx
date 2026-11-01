import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, User, FileText, Image as ImageIcon, LogOut, Check } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Avatar } from '@/components/ui/Avatar';
import { UserBadges } from '@/components/ui/Badges';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { profile, updateProfile, signOut } = useAuthStore();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!isOpen || !profile) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateProfile({
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl.trim() || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#16161C] border border-[#2B2B36] rounded-2xl shadow-2xl overflow-hidden text-zinc-100"
      >
        <div className="px-6 py-4 bg-[#1B1B22] border-b border-[#282833] flex items-center justify-between">
          <h3 className="font-bold text-sm text-white">Мой профиль</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-[#1B1B24] border border-[#2B2B38]">
            <Avatar name={profile.display_name} src={avatarUrl || profile.avatar_url} size="xl" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-white text-base truncate">
                  {displayName || profile.display_name}
                </span>
                <UserBadges
                  role={profile.role}
                  username={profile.username}
                  isVerified={profile.is_verified}
                  hasVozduxPlus={profile.has_vozdux_plus}
                  customTitle={profile.custom_title}
                  showRoleText
                />
              </div>
              <span className="text-xs text-[#FF8A1C] font-mono">@{profile.username}</span>
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                {bio || 'Пользуюсь мессенджером Vozduxan ⚡'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Отображаемое имя:
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#1C1C24] border border-[#2E2E3C] rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Ссылка на аватарку (URL):
              </label>
              <div className="relative">
                <ImageIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#1C1C24] border border-[#2E2E3C] rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                О себе (Bio):
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-zinc-500 absolute left-3 top-3 pointer-events-none" />
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-[#1C1C24] border border-[#2E2E3C] rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00] resize-none"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2.5 bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold text-xs rounded-xl shadow-md shadow-[#FF7A00]/25 transition-colors flex items-center justify-center gap-1.5"
              >
                {saved && <Check className="w-4 h-4" />}
                <span>{isSaving ? 'Сохранение...' : saved ? 'Сохранено!' : 'Сохранить изменения'}</span>
              </button>
            </div>
          </form>

          <div className="pt-3 border-t border-[#262633] flex justify-between items-center">
            <span className="text-xs text-zinc-500">Завершить сеанс</span>
            <button
              onClick={() => {
                signOut();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-semibold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Выйти из аккаунта</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
