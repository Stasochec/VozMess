import React from 'react';
import { motion } from 'framer-motion';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  variant?: 'icon-only' | 'full';
  className?: string;
  showSubtitle?: boolean;
}

const sizeMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 52,
  xl: 68,
};

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  variant = 'full',
  className = '',
  showSubtitle = true,
}) => {
  const pixelSize = typeof size === 'number' ? size : sizeMap[size];

  return (
    <motion.div
      className={`inline-flex items-center gap-3 select-none cursor-pointer group ${className}`}
      whileHover="hover"
      initial="rest"
    >
      {/* Dynamic Air Vortex & Speech V Icon */}
      <div
        style={{ width: pixelSize, height: pixelSize }}
        className="relative flex-shrink-0 flex items-center justify-center"
      >
        <svg
          viewBox="0 0 120 120"
          width="100%"
          height="100%"
          className="overflow-visible drop-shadow-[0_4px_12px_rgba(255,122,0,0.35)]"
        >
          <defs>
            <linearGradient id="vozduxLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF9500" />
              <stop offset="50%" stopColor="#FF7A00" />
              <stop offset="100%" stopColor="#FF5500" />
            </linearGradient>

            <linearGradient id="vozduxInnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#FFE4CC" stopOpacity="0.85" />
            </linearGradient>

            <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Squircle base capsule with glowing orange gradient */}
          <motion.rect
            x="6"
            y="6"
            width="108"
            height="108"
            rx="30"
            fill="url(#vozduxLogoGrad)"
            variants={{
              rest: { scale: 1 },
              hover: { scale: 1.04, rotate: 2 },
            }}
            transition={{ type: 'spring', stiffness: 350, damping: 20 }}
          />

          {/* Subtle Ambient Air Velocity Track */}
          <circle
            cx="60"
            cy="60"
            r="40"
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity="0.2"
            strokeWidth="1.5"
            strokeDasharray="4 6"
          />

          {/* Swirling Air Stream Flow transforming into speech bubble contour */}
          <motion.path
            d="M 32 68 C 28 50, 40 34, 60 34 C 82 34, 94 48, 92 68 C 90 82, 78 90, 60 90 C 48 90, 38 84, 32 78 L 26 86 C 24 88, 21 86, 22 83 L 26 71"
            fill="none"
            stroke="url(#vozduxInnerGrad)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={{
              rest: { pathLength: 1, opacity: 0.9 },
              hover: { pathLength: 1, opacity: 1, scale: 1.02 },
            }}
          />

          {/* Core High-Speed Supersonic 'V' Wing */}
          <motion.path
            d="M 40 46 L 60 82 L 80 46"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={{
              rest: { y: 0 },
              hover: { y: -2 },
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          />

          {/* Fast Flow Accent Jet */}
          <motion.circle
            cx="80"
            cy="46"
            r="4.5"
            fill="#FFFFFF"
            filter="url(#logoGlow)"
            variants={{
              rest: { scale: 1, opacity: 0.8 },
              hover: { scale: 1.35, opacity: 1 },
            }}
          />
        </svg>
      </div>

      {/* Typography Lettering for variant="full" */}
      {variant === 'full' && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-100 to-zinc-200 dark:from-white dark:to-zinc-300 text-lg sm:text-xl font-sans">
              VOZDUX
            </span>
            <span className="font-black tracking-tight text-[#FF7A00] text-lg sm:text-xl font-sans">
              AN
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A00] shadow-[0_0_8px_#FF7A00] inline-block animate-pulse" />
          </div>
          {showSubtitle && (
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#FF9500] dark:text-[#FFA63D] mt-0.5">
              AIR MESSENGER
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
};
