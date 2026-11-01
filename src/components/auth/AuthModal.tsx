import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, User, AtSign, ArrowRight, ShieldCheck, Zap, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Logo } from '@/components/ui/Logo';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { signIn, signUp, loginAsDemo, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalErr(null);

    if (!email.trim() || !password.trim()) {
      setLocalErr('Пожалуйста, заполните все обязательные поля');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const res = await signIn(email, password);
        if (res.error) setLocalErr(res.error);
        else if (onClose) onClose();
      } else {
        if (!username.trim()) {
          setLocalErr('Укажите желаемый @username');
          setSubmitting(false);
          return;
        }
        const res = await signUp(email, password, username, displayName || username);
        if (res.error) setLocalErr(res.error);
        else if (onClose) onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94 }}
        className="w-full max-w-md bg-[#16161C] border border-[#2B2B36] rounded-3xl shadow-[0_20px_50px_rgba(255,122,0,0.25)] overflow-hidden text-zinc-100"
      >
        {/* Brand Banner */}
        <div className="px-6 pt-8 pb-6 text-center bg-gradient-to-b from-[#26160B] to-[#16161C] border-b border-[#29221C]">
          <div className="flex justify-center mb-3">
            <Logo size="lg" variant="full" />
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            Скоростной защищенный мессенджер нового поколения
          </p>

          {/* Mode switch pills */}
          <div className="mt-5 p-1 bg-[#101014] rounded-xl flex border border-[#272733]">
            <button
              onClick={() => {
                setMode('signin');
                clearError();
                setLocalErr(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mode === 'signin'
                  ? 'bg-[#FF7A00] text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Вход
            </button>
            <button
              onClick={() => {
                setMode('signup');
                clearError();
                setLocalErr(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mode === 'signup'
                  ? 'bg-[#FF7A00] text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Регистрация
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {(error || localErr) && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error || localErr}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Имя пользователя (@username):
                  </label>
                  <div className="relative">
                    <AtSign className="w-4 h-4 text-zinc-500 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      placeholder="durov"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-[#1C1C24] border border-[#2E2E3C] rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                </div>

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
                      placeholder="Павел Дуров"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-[#1C1C24] border border-[#2E2E3C] rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Email:</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#1C1C24] border border-[#2E2E3C] rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Пароль:</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#1C1C24] border border-[#2E2E3C] rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.8 bg-gradient-to-r from-[#FF9500] to-[#FF5500] hover:from-[#E66E00] hover:to-[#E03D00] disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-[#FF7A00]/30 transition-all flex items-center justify-center gap-2 mt-2"
            >
              <span>{submitting ? 'Загрузка...' : mode === 'signin' ? 'Войти в Vozduxan' : 'Создать аккаунт'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Login */}
          <div className="pt-3 border-t border-[#262633] space-y-2">
            <button
              type="button"
              onClick={() => {
                loginAsDemo('owner');
                if (onClose) onClose();
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Zap className="w-4 h-4 text-[#FF7A00]" />
              <span>Войти как Создатель (Durov Demo 👑)</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
