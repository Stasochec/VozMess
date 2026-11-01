import { useState, useEffect, useRef } from 'react';
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

  // Request counter to avoid stale responses overwriting newer ones
  const latestRequestIdRef = useRef(0);

  useEffect(() => {
    let isCurrent = true;
    const cleanUsername = rawUsername.trim().replace(/^@/, '');

    // Increment request ID to invalidate any pending in-flight queries
    const currentRequestId = ++latestRequestIdRef.current;

    // 1. Client-side validation: Empty
    if (cleanUsername.length === 0) {
      setIsChecking(false);
      setStatus('idle');
      setMessage('Минимум 3 символа (латиница, цифры, _)');
      return;
    }

    // 2. Client-side validation: Length < 3
    if (cleanUsername.length < 3) {
      setIsChecking(false);
      setStatus('too_short');
      setMessage('Минимум 3 символа (латиница, цифры, _)');
      return;
    }

    // 3. Client-side validation: Length > 24
    if (cleanUsername.length > 24) {
      setIsChecking(false);
      setStatus('too_long');
      setMessage('Максимальная длина — 24 символа');
      return;
    }

    // 4. Client-side validation: Disallow cyrillic, spaces, and special chars
    if (!USERNAME_REGEX.test(cleanUsername)) {
      setIsChecking(false);
      setStatus('invalid_format');
      setMessage('Используйте только латинские буквы, цифры и _');
      return;
    }

    // 5. User's own current username check (no network call needed)
    if (currentUsername && cleanUsername.toLowerCase() === currentUsername.trim().toLowerCase()) {
      setIsChecking(false);
      setStatus('available');
      setMessage('Ваш текущий юзернейм');
      return;
    }

    // If Supabase is not configured, pass regex validation
    if (!isSupabaseConfigured()) {
      setIsChecking(false);
      setStatus('available');
      setMessage(`@${cleanUsername.toLowerCase()} свободен`);
      return;
    }

    // 6. Valid format passed: Initiate 350ms debounced RPC check with race-condition guard
    setIsChecking(true);
    setStatus('checking');
    setMessage('Проверка доступности...');

    const timer = setTimeout(async () => {
      try {
        const { data: isAvailable, error } = await supabase.rpc('check_username_available', {
          check_username: cleanUsername,
        });

        // Stale check: ignore if component unmounted or another query started
        if (!isCurrent || currentRequestId !== latestRequestIdRef.current) {
          return;
        }

        if (error) {
          console.warn('RPC check_username_available warning:', error.message);
          // Fallback check via query if RPC fails
          const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .ilike('username', cleanUsername)
            .maybeSingle();

          if (!isCurrent || currentRequestId !== latestRequestIdRef.current) return;

          if (existingUser && (!currentUserId || existingUser.id !== currentUserId)) {
            setStatus('taken');
            setMessage('Этот юзернейм уже занят');
          } else {
            setStatus('available');
            setMessage(`@${cleanUsername.toLowerCase()} свободен`);
          }
          return;
        }

        if (isAvailable === false) {
          setStatus('taken');
          setMessage('Этот юзернейм уже занят');
        } else {
          setStatus('available');
          setMessage(`@${cleanUsername.toLowerCase()} свободен`);
        }
      } catch (err) {
        if (isCurrent && currentRequestId === latestRequestIdRef.current) {
          console.error('RPC network error:', err);
          setStatus('available');
          setMessage(`@${cleanUsername.toLowerCase()} свободен`);
        }
      } finally {
        if (isCurrent && currentRequestId === latestRequestIdRef.current) {
          setIsChecking(false);
        }
      }
    }, 350); // 350ms debounce

    return () => {
      isCurrent = false;
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
