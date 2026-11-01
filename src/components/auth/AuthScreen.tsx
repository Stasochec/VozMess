import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, AtSign, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Logo } from '@/components/ui/Logo';
import { UsernameInput } from '@/components/ui/UsernameInput';

export const AuthScreen: React.FC = () => {
  const { signIn, signUp, isSubmitting, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isUsernameValid, setIsUsernameValid] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setFormErr(null);

    if (mode === 'signin') {
      if (!identifier.trim() || !password.trim()) {
        setFormErr('Пожалуйста, введите Email или @username и пароль');
        return;
      }
      await signIn(identifier.trim(), password);
    } else {
      if (!isUsernameValid) {
        setFormErr('Пожалуйста, укажите корректный и свободный никнейм (@username)');
        return;
      }
      if (!email.trim() || !password.trim() || !username.trim()) {
        setFormErr('Заполните все обязательные поля');
        return;
      }
      await signUp(email.trim(), password, username.trim().toLowerCase(), displayName.trim() || username.trim());
    }
  };

  const isSubmitDisabled = isSubmitting || (mode === 'signup' && !isUsernameValid);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#0F0F12] select-none font-sans relative overflow-hidden">
      {/* Background ambient orange glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#FF7A00]/10 blur-[130px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-[#16161C] border border-[#2B2B36] rounded-3xl shadow-[0_25px_60px_-15px_rgba(255,122,0,0.3)] overflow-hidden z-10"
      >
        {/* Brand Header */}
        <div className="px-6 pt-8 pb-5 text-center bg-gradient-to-b from-[#25150A] to-[#16161C] border-b border-[#291F18]">
          <div className="flex justify-center mb-3">
            <Logo size="lg" variant="full" />
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            Скоростной веб-мессенджер с автоудалением сообщений 14 дней
          </p>

          {/* Mode Switch Tabs */}
          <div className="mt-5 p-1 bg-[#101014] rounded-xl flex border border-[#262633]">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                clearError();
                setFormErr(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mode === 'signin'
                  ? 'bg-[#FF7A00] text-white shadow-md shadow-[#FF7A00]/25'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                clearError();
                setFormErr(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mode === 'signup'
                  ? 'bg-[#FF7A00] text-white shadow-md shadow-[#FF7A00]/25'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Создать аккаунт
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          <AnimatePresence>
            {(error || formErr) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error || formErr}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signin' ? (
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Email или @username:
                </label>
                <div className="relative">
                  <AtSign className="w-4 h-4 text-zinc-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="stasochec или name@example.com"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-[#1C1C24] border border-[#2E2E3C] rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00] transition-colors"
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Interactive Debounced Username Input with Live Availability Check */}
                <UsernameInput
                  value={username}
                  onChange={setUsername}
                  onValidationChange={setIsUsernameValid}
                  label="Уникальный никнейм (@username):"
                  helperNote="Для создателя укажите никнейм stasochec"
                />

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
                      placeholder="Стас"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-[#1C1C24] border border-[#2E2E3C] rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Электронная почта:
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-[#1C1C24] border border-[#2E2E3C] rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00] transition-colors"
                    />
                  </div>
                </div>
              </>
            )}

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
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#1C1C24] border border-[#2E2E3C] rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00] transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="w-full py-3 bg-gradient-to-r from-[#FF9500] to-[#FF5500] hover:from-[#E66E00] hover:to-[#E03D00] disabled:opacity-40 disabled:pointer-events-none text-white font-extrabold text-xs rounded-xl shadow-lg shadow-[#FF7A00]/30 transition-all flex items-center justify-center gap-2 mt-4"
            >
              <span>
                {isSubmitting
                  ? 'Авторизация...'
                  : mode === 'signin'
                  ? 'Войти в Vozduxan'
                  : 'Зарегистрироваться'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-2 text-center text-[11px] text-zinc-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#FF7A00]" />
            <span>Сессия сохраняется постоянно до явного выхода</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
