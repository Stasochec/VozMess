import React from 'react';
import { AlertTriangle, Key, Database } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

export const ConfigErrorScreen: React.FC = () => {
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
              Подключение Supabase не настроено
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Мессенджер Vozduxan работает исключительно с реальной базой данных Supabase
              (PostgreSQL, Realtime и Storage). Мок-данные и заглушки отключены.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-[#1B1B24] border border-[#2D2D3E]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 mb-2">
              <Database className="w-3.5 h-3.5 text-[#FF7A00]" />
              <span>Локальная разработка</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">
              Создайте файл <span className="font-mono text-zinc-200">.env.local</span> в корне проекта:
            </p>
            <pre className="text-[11px] font-mono text-emerald-300 bg-[#0E0E13] rounded-lg p-3 overflow-x-auto">
{`VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>`}
            </pre>
          </div>

          <div className="p-4 rounded-2xl bg-[#1B1B24] border border-[#2D2D3E]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 mb-2">
              <Key className="w-3.5 h-3.5 text-[#FF7A00]" />
              <span>GitHub Pages</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Добавьте те же два значения в{' '}
              <span className="text-zinc-300 font-mono">Settings ➔ Secrets and variables ➔ Actions</span>.
              Ввод ключей через браузер отключён намеренно: он позволял подменить базу данных
              произвольной ссылкой.
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-800 text-[11px] text-zinc-500 leading-relaxed">
          После изменения переменных окружения перезапустите dev-сервер или повторно задеплойте
          проект.
        </div>
      </div>
    </div>
  );
};
