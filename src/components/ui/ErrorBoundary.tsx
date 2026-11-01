import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Logo } from './Logo';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Vozduxan caught error in ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-[#0F0F12] text-zinc-100 select-none font-sans">
          <div className="max-w-md w-full p-8 rounded-3xl bg-[#16161C] border border-rose-500/30 text-center shadow-[0_20px_50px_rgba(244,63,94,0.15)] space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="font-extrabold text-lg text-white">Произошла ошибка интерфейса</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Работа приложения была безопасно изолирована. Нажмите кнопку ниже, чтобы перезапустить интерфейс:
            </p>
            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-black/40 border border-zinc-800 text-[11px] font-mono text-rose-300 overflow-x-auto text-left">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-3 bg-[#FF7A00] hover:bg-[#E66E00] text-white font-extrabold text-xs rounded-xl shadow-lg shadow-[#FF7A00]/25 transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Перезагрузить приложение</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
