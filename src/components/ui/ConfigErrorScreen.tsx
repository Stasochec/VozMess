import React, { useState } from 'react';
import { AlertTriangle, Database, Key, CheckCircle, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { saveSupabaseCredentials } from '@/lib/supabase';

export const ConfigErrorScreen: React.FC = () => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !key.trim()) {
      setError('Необходимо указать как Project URL, так и Anon Key');
      return;
    }
    if (!url.includes('.supabase.co')) {
      setError('URL должен быть валидным Supabase адресом (https://*.supabase.co)');
      return;
    }
    saveSupabaseCredentials(url.trim(), key.trim());
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#0A0A0D] text-zinc-100 font-sans select-none">
      <div className="w-full max-w-lg bg-[#14141A] border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_-15px_rgba(255,122,0,0.3)]">
        <div className="flex justify-center mb-6">
          <Logo size="lg" variant="full" />
        </div>

        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3.5 mb-6">
          <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-amber-400">
              Требуется подключение Supabase
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Мессенджер Vozduxan работает исключительно с реальной базой данных Supabase (PostgreSQL, Realtime и Storage). Мок-данные и заглушки отключены.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#FF7A00]" />
              <span>Project URL:</span>
            </label>
            <input
              type="text"
              required
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://xyzcompany.supabase.co"
              className="w-full px-4 py-2.5 bg-[#1B1B24] border border-[#2D2D3E] rounded-xl text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#FF7A00] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[#FF7A00]" />
              <span>Project Anon / Public Key:</span>
            </label>
            <input
              type="password"
              required
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setError(null);
              }}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full px-4 py-2.5 bg-[#1B1B24] border border-[#2D2D3E] rounded-xl text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#FF7A00] transition-colors"
            />
          </div>

          {error && <p className="text-xs text-rose-400 font-semibold">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-[#FF9500] to-[#FF5500] hover:from-[#E66E00] hover:to-[#E03D00] text-white font-extrabold text-xs rounded-xl shadow-lg shadow-[#FF7A00]/30 transition-all flex items-center justify-center gap-2"
          >
            <span>Подключить базу данных</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-zinc-800 text-[11px] text-zinc-500 leading-relaxed space-y-1">
          <p>
            💡 Для автоматической сборки на GitHub Pages добавьте эти ключи в{' '}
            <span className="text-zinc-300 font-mono">Settings ➔ Secrets and variables ➔ Actions</span>:
          </p>
          <ul className="list-disc list-inside text-zinc-400 font-mono pl-1 space-y-0.5">
            <li>VITE_SUPABASE_URL</li>
            <li>VITE_SUPABASE_ANON_KEY</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
