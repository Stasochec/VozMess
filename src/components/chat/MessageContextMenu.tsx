import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  CornerUpLeft,
  Pencil,
  Pin,
  Download,
  Copy,
  CornerUpRight,
  Trash2,
  CheckCircle2,
  Check,
  CheckCheck,
  ChevronDown,
} from 'lucide-react';
import { Message } from '@/types';
import { formatChatDate, formatMessageTime } from '@/lib/dateUtils';

interface MessageContextMenuProps {
  message: Message;
  position: { x: number; y: number };
  isOutgoing: boolean;
  isOwnerOrMod: boolean;
  onClose: () => void;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onPin?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onCopy?: (text: string) => void;
  onReact?: (message: Message, emoji: string) => void;
  onSaveMedia?: (mediaUrl: string) => void;
  onSelect?: (message: Message) => void;
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  message,
  position,
  isOutgoing,
  isOwnerOrMod,
  onClose,
  onReply,
  onEdit,
  onPin,
  onDelete,
  onCopy,
  onReact,
  onSaveMedia,
  onSelect,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Top telegram reaction emojis (exact match to screenshot)
  const reactions = ['❤️', '🔥', '🌚', '🤨', '😱', '🖕'];

  // Close on Escape or scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Viewport bounds calculation
  const menuWidth = 230;
  const menuHeight = 360;
  const padding = 12;

  let posX = position.x;
  let posY = position.y;

  if (typeof window !== 'undefined') {
    if (posX + menuWidth > window.innerWidth - padding) {
      posX = window.innerWidth - menuWidth - padding;
    }
    if (posX < padding) {
      posX = padding;
    }
    if (posY + menuHeight > window.innerHeight - padding) {
      posY = window.innerHeight - menuHeight - padding;
    }
    if (posY < padding) {
      posY = padding;
    }
  }

  const handleCopyText = () => {
    if (message.content) {
      if (onCopy) onCopy(message.content);
      else navigator.clipboard.writeText(message.content);
    }
    onClose();
  };

  const handleDownload = () => {
    if (message.media_url) {
      if (onSaveMedia) onSaveMedia(message.media_url);
      else {
        const link = document.createElement('a');
        link.href = message.media_url;
        link.download = `media_${Date.now()}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
    onClose();
  };

  const canEdit = isOutgoing && Boolean(message.content);
  const canDelete = isOutgoing || isOwnerOrMod;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[2px] select-none"
    >
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.88, y: -8 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          transition: { type: 'spring', damping: 25, stiffness: 420 },
        }}
        exit={{ opacity: 0, scale: 0.88, y: -8, transition: { duration: 0.12 } }}
        style={{
          position: 'fixed',
          left: `${posX}px`,
          top: `${posY}px`,
        }}
        className="flex flex-col items-start gap-2 z-[91]"
      >
        {/* 1. TOP REACTION PILL (TELEGRAM STYLE AS SHOWN IN PHOTO) */}
        <div className="relative bg-white dark:bg-[#1E1E26] text-zinc-800 dark:text-zinc-100 rounded-full px-3 py-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.35)] border border-zinc-200/90 dark:border-zinc-700/80 flex items-center gap-2">
          {reactions.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onReact?.(message, emoji);
                onClose();
              }}
              className="text-xl hover:scale-130 active:scale-90 transition-transform p-0.5 cursor-pointer"
              title={`Реакция ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onReact?.(message, '✨');
              onClose();
            }}
            className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-500 hover:text-white transition-colors cursor-pointer"
            title="Еще реакции"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Speech bubble tail pointing towards menu */}
          <div className="absolute -bottom-1.5 left-7 w-3 h-3 bg-white dark:bg-[#1E1E26] rotate-45 border-r border-b border-zinc-200/90 dark:border-zinc-700/80" />
        </div>

        {/* 2. CONTEXT MENU CARD */}
        <div className="w-[220px] bg-white dark:bg-[#1E1E26] text-zinc-800 dark:text-zinc-100 rounded-2xl shadow-[0_20px_45px_rgba(0,0,0,0.45)] border border-zinc-200/90 dark:border-zinc-700/80 overflow-hidden py-1.5 font-sans">
          {/* Ответить */}
          <button
            type="button"
            onClick={() => {
              onReply?.(message);
              onClose();
            }}
            className="w-full px-4 py-2 flex items-center gap-3 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-[#282834] transition-colors cursor-pointer"
          >
            <CornerUpLeft className="w-4 h-4 text-zinc-500 dark:text-zinc-400 stroke-[2.2]" />
            <span>Ответить</span>
          </button>

          {/* Изменить (для своих сообщений) */}
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                onEdit?.(message);
                onClose();
              }}
              className="w-full px-4 py-2 flex items-center gap-3 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-[#282834] transition-colors cursor-pointer"
            >
              <Pencil className="w-4 h-4 text-zinc-500 dark:text-zinc-400 stroke-[2.2]" />
              <span>Изменить</span>
            </button>
          )}

          {/* Закрепить */}
          <button
            type="button"
            onClick={() => {
              onPin?.(message);
              onClose();
            }}
            className="w-full px-4 py-2 flex items-center gap-3 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-[#282834] transition-colors cursor-pointer"
          >
            <Pin className="w-4 h-4 text-zinc-500 dark:text-zinc-400 stroke-[2.2]" />
            <span>Закрепить</span>
          </button>

          {/* Сохранить как... / Копировать */}
          {message.media_url ? (
            <button
              type="button"
              onClick={handleDownload}
              className="w-full px-4 py-2 flex items-center gap-3 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-[#282834] transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-zinc-500 dark:text-zinc-400 stroke-[2.2]" />
              <span>Сохранить как...</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCopyText}
              className="w-full px-4 py-2 flex items-center gap-3 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-[#282834] transition-colors cursor-pointer"
            >
              <Copy className="w-4 h-4 text-zinc-500 dark:text-zinc-400 stroke-[2.2]" />
              <span>Копировать</span>
            </button>
          )}

          {/* Переслать */}
          <button
            type="button"
            onClick={() => {
              handleCopyText();
            }}
            className="w-full px-4 py-2 flex items-center gap-3 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-[#282834] transition-colors cursor-pointer"
          >
            <CornerUpRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400 stroke-[2.2]" />
            <span>Переслать</span>
          </button>

          {/* Удалить */}
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Удалить это сообщение?')) {
                  onDelete?.(message.id);
                  onClose();
                }
              }}
              className="w-full px-4 py-2 flex items-center gap-3 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-500 stroke-[2.2]" />
              <span>Удалить</span>
            </button>
          )}

          {/* Выделить (Telegram Select Mode) */}
          <button
            type="button"
            onClick={() => {
              onSelect?.(message);
              onClose();
            }}
            className="w-full px-4 py-2 flex items-center gap-3 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-[#282834] transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-zinc-500 dark:text-zinc-400 stroke-[2.2]" />
            <span>Выделить</span>
          </button>

          {/* 3. BOTTOM DELIVERY TIMESTAMP */}
          <div className="pt-2 mt-1 border-t border-zinc-200/60 dark:border-zinc-800 px-4 pb-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
            {message.is_read ? (
              <CheckCheck className="w-3.5 h-3.5 text-[#FF7A00]" />
            ) : (
              <Check className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <span>
              {formatChatDate(message.created_at)} в {formatMessageTime(message.created_at)}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
