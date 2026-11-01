import React from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  isOnline?: boolean;
  className?: string;
  showBadge?: boolean;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
  '2xl': 'w-28 h-28 text-4xl',
};

const onlineBadgeSizes = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
  xl: 'w-4 h-4',
  '2xl': 'w-5 h-5',
};

// Generates warm orange/amber/coral tones based on user name
const getGradientByName = (name: string) => {
  const gradients = [
    'from-orange-500 to-amber-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-orange-500',
    'from-orange-600 to-red-600',
    'from-yellow-500 to-orange-600',
    'from-amber-600 to-rose-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  isOnline = false,
  className = '',
  showBadge = true,
}) => {
  const initials = (name || '?')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const gradient = getGradientByName(name || 'V');

  return (
    <div className={`relative inline-block flex-shrink-0 select-none ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center font-bold text-white shadow-md bg-gradient-to-tr ${gradient}`}
      >
        {src ? (
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide broken image and reveal gradient initials
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {showBadge && isOnline && (
        <span
          className={`absolute bottom-0 right-0 ${onlineBadgeSizes[size]} bg-emerald-500 border-2 border-[#18181C] dark:border-[#18181C] rounded-full ring-1 ring-emerald-400/50 shadow-sm`}
          title="В сети"
        />
      )}
    </div>
  );
};
