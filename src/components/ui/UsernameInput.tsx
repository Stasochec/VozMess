import React, { useEffect } from 'react';
import { AtSign, Check, X, Loader2 } from 'lucide-react';
import { useCheckUsername } from '@/hooks/useCheckUsername';

interface UsernameInputProps {
  value: string;
  onChange: (value: string) => void;
  currentUsername?: string | null;
  currentUserId?: string | null;
  label?: string;
  required?: boolean;
  onValidationChange?: (isValid: boolean) => void;
  helperNote?: string;
}

export const UsernameInput: React.FC<UsernameInputProps> = ({
  value,
  onChange,
  currentUsername = null,
  currentUserId = null,
  label = 'Имя пользователя (@username):',
  required = true,
  onValidationChange,
  helperNote,
}) => {
  const { status, isChecking, isValid, message } = useCheckUsername(
    value,
    currentUsername,
    currentUserId
  );

  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(isValid);
    }
  }, [isValid, onValidationChange]);

  // Determine border and ring styles based on status
  const getInputBorderClass = () => {
    if (isChecking) {
      return 'border-[#FF7A00]/60 ring-1 ring-[#FF7A00]/30';
    }
    switch (status) {
      case 'available':
        return 'border-emerald-500/60 ring-1 ring-emerald-500/30 text-emerald-100';
      case 'taken':
      case 'invalid_format':
        return 'border-rose-500/60 ring-1 ring-rose-500/30 text-rose-100';
      case 'too_short':
      case 'too_long':
        return value.trim().length > 0
          ? 'border-amber-500/50 ring-1 ring-amber-500/20'
          : 'border-[#2E2E3C] focus:border-[#FF7A00]';
      default:
        return 'border-[#2E2E3C] focus:border-[#FF7A00]';
    }
  };

  // Determine message color
  const getMessageColor = () => {
    switch (status) {
      case 'available':
        return 'text-emerald-400 font-semibold';
      case 'taken':
        return 'text-rose-400 font-semibold';
      case 'invalid_format':
      case 'too_long':
        return 'text-amber-400 font-semibold';
      case 'too_short':
        return 'text-zinc-500';
      default:
        return 'text-zinc-500';
    }
  };

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs font-semibold text-zinc-400 mb-1">
          {label}
        </label>
      )}

      <div className="relative">
        <AtSign className="w-4 h-4 text-zinc-500 absolute left-3 top-3 pointer-events-none" />

        <input
          type="text"
          required={required}
          value={value}
          maxLength={24}
          onChange={(e) => {
            // Automatically strip leading @ and disallow spaces
            const val = e.target.value.replace(/^@/, '').replace(/\s+/g, '');
            onChange(val);
          }}
          placeholder="username"
          className={`w-full pl-9 pr-9 py-2.5 bg-[#1C1C24] border rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all ${getInputBorderClass()}`}
        />

        {/* Right Status Icon Indicator */}
        <div className="absolute right-3 top-3 flex items-center justify-center pointer-events-none">
          {isChecking ? (
            <Loader2 className="w-4 h-4 text-[#FF7A00] animate-spin" />
          ) : status === 'available' ? (
            <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Check className="w-3.5 h-3.5" />
            </div>
          ) : status === 'taken' || status === 'invalid_format' ? (
            <div className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <X className="w-3.5 h-3.5" />
            </div>
          ) : null}
        </div>
      </div>

      {/* Helper / Status message */}
      <div className="flex items-center justify-between text-[11px] px-0.5">
        <span className={`transition-colors ${getMessageColor()}`}>{message}</span>
        {value.length > 0 && (
          <span className="text-[10px] text-zinc-500 font-mono">
            {value.length}/24
          </span>
        )}
      </div>

      {helperNote && (
        <span className="text-[10px] text-zinc-500 block px-0.5 mt-0.5">
          {helperNote}
        </span>
      )}
    </div>
  );
};
