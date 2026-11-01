/**
 * Date and Steam-like 14-day TTL formatting utilities
 */

export const formatMessageTime = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
};

export const formatChatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return formatMessageTime(dateStr);
    }

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return 'Вчера';
    }

    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
};

export interface TTLInfo {
  label: string;
  isUrgent: boolean;
  expired: boolean;
  percentRemaining: number;
}

/**
 * Calculates remaining TTL for Steam-like 14 days auto-deletion
 */
export const getRemainingTTL = (expiresAtStr: string, createdAtStr?: string): TTLInfo => {
  try {
    const expireTime = new Date(expiresAtStr).getTime();
    const now = Date.now();
    const diff = expireTime - now;

    if (diff <= 0) {
      return {
        label: 'Истекло',
        isUrgent: true,
        expired: true,
        percentRemaining: 0,
      };
    }

    const totalDuration = 14 * 24 * 60 * 60 * 1000; // 14 days in ms
    const percentRemaining = Math.max(0, Math.min(100, Math.round((diff / totalDuration) * 100)));

    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

    let label = '';
    if (days > 0) {
      label = `${days}д ${hours}ч`;
    } else if (hours > 0) {
      label = `${hours}ч ${minutes}м`;
    } else {
      label = `${Math.max(1, minutes)}м`;
    }

    return {
      label,
      isUrgent: days < 2,
      expired: false,
      percentRemaining,
    };
  } catch {
    return {
      label: '14д',
      isUrgent: false,
      expired: false,
      percentRemaining: 100,
    };
  }
};
