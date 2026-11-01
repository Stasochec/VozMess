import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  Share2,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { formatChatDate, formatMessageTime } from '@/lib/dateUtils';

interface MediaViewerModalProps {
  isOpen: boolean;
  mediaUrl: string | null;
  mediaType?: string | null;
  senderName?: string;
  createdAt?: string;
  caption?: string | null;
  onClose: () => void;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  isOpen,
  mediaUrl,
  mediaType = 'image',
  senderName,
  createdAt,
  caption,
  onClose,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Reset zoom and states when URL changes
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
      setIsLoading(true);
      setHasError(false);
    }
  }, [isOpen, mediaUrl]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoomLevel((z) => Math.min(3, z + 0.5));
      if (e.key === '-') setZoomLevel((z) => Math.max(1, z - 0.5));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mediaUrl) return null;

  const isImage = !mediaType || mediaType === 'image';

  const handleToggleZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel((prev) => (prev === 1 ? 2 : 1));
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const ext = mediaUrl.split('.').pop()?.split('?')[0] || (isImage ? 'webp' : 'bin');
      link.download = `vozmess_${Date.now()}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: direct window open
      window.open(mediaUrl, '_blank');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md select-none flex flex-col justify-between overflow-hidden"
      >
        {/* TOP TOOLBAR */}
        <header className="px-4 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between text-white z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors text-zinc-300 hover:text-white"
              title="Закрыть (Esc)"
            >
              <ArrowLeft className="w-5 h-5 sm:hidden" />
              <X className="w-5 h-5 hidden sm:block" />
            </button>

            <div className="min-w-0">
              <h4 className="font-bold text-xs sm:text-sm text-white truncate">
                {senderName || 'Медиафайл'}
              </h4>
              {createdAt && (
                <span className="text-[11px] text-zinc-400 block">
                  {formatChatDate(createdAt)} в {formatMessageTime(createdAt)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Zoom Button (Images only) */}
            {isImage && !hasError && (
              <button
                onClick={handleToggleZoom}
                className="p-2 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
                title={zoomLevel > 1 ? 'Отдалить' : 'Увеличить (клик)'}
              >
                {zoomLevel > 1 ? (
                  <ZoomOut className="w-5 h-5" />
                ) : (
                  <ZoomIn className="w-5 h-5" />
                )}
              </button>
            )}

            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="p-2 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
              title="Скачать на устройство"
            >
              <Download className="w-5 h-5" />
            </button>

            {/* Open in new tab */}
            <a
              href={mediaUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
              title="Открыть в новой вкладке"
            >
              <ExternalLink className="w-5 h-5" />
            </a>

            <button
              onClick={onClose}
              className="sm:hidden p-2 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* MAIN VIEWPORT / IMAGE AREA */}
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && zoomLevel === 1) onClose();
          }}
          className="flex-1 flex items-center justify-center p-2 sm:p-6 overflow-auto relative cursor-pointer"
        >
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
              <span className="w-8 h-8 border-3 border-[#FF7A00] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-zinc-400">Загрузка изображения...</span>
            </div>
          )}

          {hasError ? (
            <div className="flex flex-col items-center justify-center p-6 bg-zinc-900/80 rounded-2xl border border-rose-500/30 text-center max-w-sm">
              <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
              <h5 className="font-bold text-sm text-white">Не удалось открыть медиа</h5>
              <p className="text-xs text-zinc-400 mt-1">
                Файл недоступен или срок его хранения истек (TTL 14 дней).
              </p>
              <a
                href={mediaUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white rounded-xl transition-colors"
              >
                Попробовать открыть напрямую
              </a>
            </div>
          ) : isImage ? (
            <div
              onClick={handleToggleZoom}
              className="relative max-h-full max-w-full flex items-center justify-center transition-transform duration-200"
              style={{
                transform: `scale(${zoomLevel})`,
                cursor: zoomLevel > 1 ? 'zoom-out' : 'zoom-in',
              }}
            >
              <img
                src={mediaUrl}
                alt="Просмотр медиа"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
                className="max-h-[80vh] max-w-[95vw] sm:max-w-[85vw] object-contain rounded-lg sm:rounded-xl shadow-2xl select-none"
              />
            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-zinc-900/90 border border-zinc-800 text-center max-w-sm flex flex-col items-center">
              <FileText className="w-12 h-12 text-[#FF7A00] mb-3" />
              <h5 className="font-bold text-sm text-white">Документ / Файл</h5>
              <span className="text-xs text-zinc-400 mt-1 font-mono truncate max-w-xs">
                {mediaUrl.split('/').pop()}
              </span>
              <button
                onClick={handleDownload}
                className="mt-4 px-4 py-2.5 bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-colors shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>Скачать файл</span>
              </button>
            </div>
          )}
        </div>

        {/* BOTTOM CAPTION BAR (IF CAPTION EXISTS) */}
        {caption && caption.trim() && (
          <footer className="px-4 py-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex justify-center z-20">
            <div className="max-w-xl w-full bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center">
              <p className="text-xs sm:text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed select-text">
                {caption}
              </p>
            </div>
          </footer>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
