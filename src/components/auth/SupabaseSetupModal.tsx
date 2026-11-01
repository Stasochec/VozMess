import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Key, CheckCircle, Copy, Check, ExternalLink, X, Zap } from 'lucide-react';
import { isSupabaseConfigured, saveSupabaseCredentials } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({ isOpen, onClose }) => {
  const [url, setUrl] = useState(
    localStorage.getItem('vozdux_supabase_url') || import.meta.env.VITE_SUPABASE_URL || ''
  );
  const [anonKey, setAnonKey] = useState(
    localStorage.getItem('vozdux_supabase_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  );
  const [copied, setCopied] = useState(false);
  const { loginAsDemo } = useAuthStore();

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      alert('Пожалуйста, укажите URL и Anon Key проекта Supabase');
      return;
    }
    saveSupabaseCredentials(url, anonKey);
    onClose();
  };

  const copySqlNotice = () => {
    setCopied(true);
    navigator.clipboard.writeText('-- Файл supabase/schema.sql находится в корне репозитория');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDemoClick = () => {
    loginAsDemo('owner');
    onClose();
  };

  const isConfigured = isSupabaseConfigured();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-[#15151A] border border-[#2B2B36] rounded-2xl shadow-2xl overflow-hidden text-zinc-100"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#1B1B22] border-b border-[#282833] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Подключение Supabase</h3>
              <p className="text-[11px] text-zinc-400">
                База данных, Realtime и хранилище мессенджера
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#1D1D26] border border-[#2D2D3B]">
            <span className="text-xs text-zinc-300">Статус подключения:</span>
            {isConfigured ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <CheckCircle className="w-4 h-4" /> Подключено к облаку
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
                ● Ожидает настройки (или Демо-режим)
              </span>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Project URL:
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full px-3.5 py-2.5 bg-[#1C1C24] border border-[#2E2E3C] rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-[#FF7A00]" />
                Project Anon / Public Key:
              </label>
              <input
                type="password"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3.5 py-2.5 bg-[#1C1C24] border border-[#2E2E3C] rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#FF7A00]"
              />
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Вы также можете прописать эти значения в GitHub Secrets (
              <code className="text-[#FF9500]">VITE_SUPABASE_URL</code> и{' '}
              <code className="text-[#FF9500]">VITE_SUPABASE_ANON_KEY</code>) для автоматической сборки.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold text-xs rounded-xl shadow-md shadow-[#FF7A00]/25 transition-colors"
              >
                Сохранить и подключить
              </button>
            </div>
          </form>

          {/* Instant Demo Option */}
          <div className="pt-3 border-t border-[#262633] flex items-center justify-between">
            <span className="text-xs text-zinc-400">Нет аккаунта прямо сейчас?</span>
            <button
              onClick={handleDemoClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-[#FFA852] border border-[#FF7A00]/30 hover:border-[#FF7A00] text-xs font-bold transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-[#FF7A00]" />
              Включить Демо-режим 👑
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
