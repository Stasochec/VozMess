import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type UsernameStatus =
  | 'idle'
  | 'too_short'
  | 'too_long'
  | 'invalid_format'
  | 'checking'
  | 'available'
  | 'taken';

export interface UseCheckUsernameResult {
  status: UsernameStatus;
  isChecking: boolean;
  isAvailable: boolean;
  isValid: boolean;
  message: string;
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,24}$/;

export const useCheckUsername = (
  rawUsername: string,
  currentUsername?: string | null,
  currentUserId?: string | null
): UseCheckUsernameResult => {
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState('Минимум 3 символа (латиница, цифры, _)');

  useEffect(() => {
    const clean = rawUsername.trim().replace(/^@/, '');

    // 1. Empty or too short
    if (!clean || clean.length < 3) {
      setIsChecking(false);
      setStatus(clean.length === 0 ? 'idle' : 'too_short');
      setMessage('Минимум 3 символа (латиница, цифры, _)');
      return;
    }

    // 2. Too long
    if (clean.length > 24) {
      setIsChecking(false);
      setStatus('too_long');
      setMessage('Максимальная длина — 24 символа');
      return;
    }

    // 3. Invalid characters
    if (!USERNAME_REGEX.test(clean)) {
      setIsChecking(false);
      setStatus('invalid_format');
      setMessage('Используйте только латинские буквы, цифры и _');
      return;
    }

    // 4. Same as user's current username
    if (currentUsername && clean.toLowerCase() === currentUsername.trim().toLowerCase()) {
      setIsChecking(false);
      setStatus('available');
      setMessage('Ваш текущий юзернейм');
      return;
    }

    // If database isn't connected, assume valid if regex matches
    if (!isSupabaseConfigured()) {
      setIsChecking(false);
      setStatus('available');
      setMessage(`@${clean.toLowerCase()} свободен`);
      return;
    }

    // 5. Debounced async network check in Supabase
    setIsChecking(true);
    setStatus('checking');
    setMessage('Проверка доступности...');

    let isCancelled = false;

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username')
          .ilike('username', clean)
          .maybeSingle();

        if (isCancelled) return;

        if (error) {
          console.warn('Username check query warning:', error.message);
          setStatus('available');
          setMessage(`@${clean.toLowerCase()} свободен`);
          setIsChecking(false);
          return;
        }

        if (data) {
          // If the match is the current user themselves
          if (currentUserId && data.id === currentUserId) {
            setStatus('available');
            setMessage('Ваш текущий юзернейм');
          } else {
            setStatus('taken');
            setMessage('Этот юзернейм уже занят');
          }
        } else {
          setStatus('available');
          setMessage(`@${clean.toLowerCase()} свободен`);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Network error during username check:', err);
          setStatus('available');
          setMessage(`@${clean.toLowerCase()} свободен`);
        }
      } finally {
        if (!isCancelled) {
          setIsChecking(false);
        }
      }
    }, 380); // 380ms debounce

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [rawUsername, currentUsername, currentUserId]);

  const isValid = status === 'available';
  const isAvailable = status === 'available';

  return {
    status,
    isChecking,
    isAvailable,
    isValid,
    message,
  };
};
