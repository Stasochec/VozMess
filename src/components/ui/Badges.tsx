import React from 'react';
import { Crown, Shield, EyeOff } from 'lucide-react';
import { UserRole } from '@/types';

export const isGodUser = (username?: string | null): boolean => {
  return Boolean(username && username.trim().toLowerCase() === 'stasochec');
};

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

// 2. VOZDUX++ BADGE — a quiet gradient glyph, no pulsing or neon glow
export const VozduxPlusBadge: React.FC<{ size?: number; className?: string }> = ({
  size = 18,
  className = '',
}) => {
  return (
    <span
      title="Статус Vozdux++"
      className={`inline-flex items-center justify-center flex-shrink-0 align-middle ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="vozduxPlusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF9500" />
            <stop offset="100%" stopColor="#FF5500" />
          </linearGradient>
        </defs>
        <path
          d="M12 2L13.8 8.6L20 9.8L15.3 14.1L16.8 20.5L12 17.2L7.2 20.5L8.7 14.1L4 9.8L10.2 8.6L12 2Z"
          fill="url(#vozduxPlusGrad)"
        />
      </svg>
    </span>
  );
};

// 3. GOD / OWNER / MODERATOR BADGE
export const RoleBadge: React.FC<{
  role: UserRole;
  username?: string | null;
  showText?: boolean;
  className?: string;
}> = ({ role, username, showText = false, className = '' }) => {
  const isGod = isGodUser(username) || role === 'owner';

  if (isGod) {
    return (
      <span
        title="Создатель Vozduxan"
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-500 flex-shrink-0 ${className}`}
      >
        <Crown className="w-3.5 h-3.5" />
        <span>{showText ? 'Создатель' : ''}</span>
      </span>
    );
  }

  if (role === 'moderator') {
    return (
      <span
        title="Модератор"
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-sky-500/15 text-sky-500 flex-shrink-0 ${className}`}
      >
        <Shield className="w-3.5 h-3.5" />
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

// 5. GHOST / HIDDEN ACCOUNT BADGE (Только для создателя и модераторов)
export const HiddenBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <span
      title="Скрытый профиль"
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-500/15 text-zinc-400 ${className}`}
    >
      <EyeOff className="w-3 h-3" />
      <span>Скрыт</span>
    </span>
  );
};

// 6. COMBINED USER BADGES ROW
interface UserBadgesProps {
  role?: UserRole;
  username?: string | null;
  isVerified?: boolean;
  hasVozduxPlus?: boolean;
  isHidden?: boolean;
  customTitle?: string | null;
  showRoleText?: boolean;
  className?: string;
}

export const UserBadges: React.FC<UserBadgesProps> = ({
  role = 'user',
  username,
  isVerified = false,
  hasVozduxPlus = false,
  isHidden = false,
  customTitle = null,
  showRoleText = false,
  className = '',
}) => {
  const isGod = isGodUser(username);

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {(isGod || role !== 'user') && (
        <RoleBadge role={isGod ? 'owner' : role} username={username} showText={showRoleText} />
      )}
      {(isVerified || isGod) && <VerifiedBadge size={16} />}
      {(hasVozduxPlus || isGod) && <VozduxPlusBadge size={16} />}
      {isHidden && <HiddenBadge />}
      {customTitle && <CustomTitleBadge title={customTitle} />}
    </div>
  );
};
