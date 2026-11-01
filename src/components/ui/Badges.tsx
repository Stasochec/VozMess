import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Shield, Check } from 'lucide-react';
import { UserRole } from '@/types';

// 1. VERIFIED ORANGE BADGE (Оранжевая галочка подтверждения)
export const VerifiedBadge: React.FC<{ size?: number; className?: string }> = ({
  size = 16,
  className = '',
}) => {
  return (
    <span
      title="Подтвержденный профиль Vozduxan"
      className={`inline-flex items-center justify-center flex-shrink-0 align-middle ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className="text-[#FF7A00] drop-shadow-[0_1px_4px_rgba(255,122,0,0.5)]"
        fill="currentColor"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.8 14.2l-3.5-3.5 1.4-1.4 2.1 2.1 5.6-5.6 1.4 1.4-7 7z" />
      </svg>
    </span>
  );
};

// 2. VOZDUX++ BADGE (Анимированная оранжевая звезда Telegram Premium аналог)
export const VozduxPlusBadge: React.FC<{ size?: number; className?: string }> = ({
  size = 18,
  className = '',
}) => {
  return (
    <span
      title="Подписка Vozdux++ ⚡"
      className={`inline-flex items-center justify-center flex-shrink-0 align-middle ${className}`}
      style={{ width: size, height: size }}
    >
      <motion.div
        animate={{
          scale: [1, 1.12, 1],
          filter: [
            'drop-shadow(0 0 3px #FF7A00)',
            'drop-shadow(0 0 8px #FF9500)',
            'drop-shadow(0 0 3px #FF7A00)',
          ],
        }}
        transition={{
          repeat: Infinity,
          duration: 2.2,
          ease: 'easeInOut',
        }}
        className="flex items-center justify-center"
      >
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="vozduxStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFAA00" />
              <stop offset="50%" stopColor="#FF7A00" />
              <stop offset="100%" stopColor="#FF4400" />
            </linearGradient>
          </defs>
          {/* 8-pointed sparkling star */}
          <path
            d="M12 2L13.8 8.6L20 9.8L15.3 14.1L16.8 20.5L12 17.2L7.2 20.5L8.7 14.1L4 9.8L10.2 8.6L12 2Z"
            fill="url(#vozduxStarGrad)"
            stroke="#FFF4EB"
            strokeWidth="0.8"
          />
        </svg>
      </motion.div>
    </span>
  );
};

// 3. OWNER CROWN & MODERATOR SHIELD BADGES
export const RoleBadge: React.FC<{
  role: UserRole;
  showText?: boolean;
  className?: string;
}> = ({ role, showText = false, className = '' }) => {
  if (role === 'owner') {
    return (
      <span
        title="Создатель Vozduxan"
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-amber-500/20 via-orange-500/25 to-yellow-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_10px_rgba(255,180,0,0.25)] flex-shrink-0 ${className}`}
      >
        <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400/80 drop-shadow-[0_0_4px_#F59E0B]" />
        {showText && <span>Создатель</span>}
      </span>
    );
  }

  if (role === 'moderator') {
    return (
      <span
        title="Модератор сообщества"
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.2)] flex-shrink-0 ${className}`}
      >
        <Shield className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/70" />
        {showText && <span>Модератор</span>}
      </span>
    );
  }

  return null;
};

// 4. CUSTOM TITLE BADGE
export const CustomTitleBadge: React.FC<{ title: string; className?: string }> = ({
  title,
  className = '',
}) => {
  if (!title) return null;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase tracking-wider bg-orange-500/15 text-[#FF7A00] border border-orange-500/30 ${className}`}
    >
      {title}
    </span>
  );
};

// 5. COMBINED USER BADGES ROW
interface UserBadgesProps {
  role?: UserRole;
  isVerified?: boolean;
  hasVozduxPlus?: boolean;
  customTitle?: string | null;
  showRoleText?: boolean;
  className?: string;
}

export const UserBadges: React.FC<UserBadgesProps> = ({
  role = 'user',
  isVerified = false,
  hasVozduxPlus = false,
  customTitle = null,
  showRoleText = false,
  className = '',
}) => {
  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {role !== 'user' && <RoleBadge role={role} showText={showRoleText} />}
      {isVerified && <VerifiedBadge size={16} />}
      {hasVozduxPlus && <VozduxPlusBadge size={16} />}
      {customTitle && <CustomTitleBadge title={customTitle} />}
    </div>
  );
};
