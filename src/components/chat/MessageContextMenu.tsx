import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CornerUpLeft,
  Pencil,
  Pin,
  Download,
  Copy,
  CornerUpRight,
  Trash2,
  CheckSquare,
  Check,
  CheckCheck,
  ChevronDown,
} from 'lucide-react';
import { Message } from '@/types';
import { formatChatDate, formatMessageTime } from '@/lib/dateUtils';

interface MessageContextMenuProps {
  isOpen: boolean;
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
  isOpen,
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

  // Top telegram reaction emojis
  const reactions = ['❤️', '🔥', '🌚', '🤨', '😱', '🖕'];

  // Close on Escape or scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Viewport bounds calculation
  const menuWidth = 220;
  const menuHeight = 340;
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
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[90] bg-black/35 backdrop-blur-[1px] select-none"
    >
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.85, y: -6 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          transition: { type: 'spring', damping: 25, stiffness: 400 },
        }}
        exit={{ opacity: 0, scale: 0.85, y: -6, transition: { duration: 0.15 } }}
        style={{
          position: 'fixed',
          left: `${posX}px`,
          top: `${posY}px`,
        }}
        className="flex flex-col items-center gap-1.5 z-[91]"
      >
        {/* 1. TOP REACTION PILL (TELEGRAM STYLE) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative bg-white dark:bg-[#1E1E26] rounded-full px-2.5 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] border border-zinc-200/80 dark:border-zinc-700/80 flex items-center gap-1.5"
        >
          {reactions.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReact?.(message, emoji);
                onClose();
              }}
              className="text-lg hover:scale-130 active:scale-95 transition-transform p-0.5 cursor-pointer"
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={() => {
              onReact?.(message, '✨');
              onClose();
            }}
            className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Speech bubble tail pointing to menu card */}
          <div className="absolute -bottom-1.5 left-6 w-3 h-3 bg-white dark:bg-[#1E1E26] rotate-45 border-r border-b border-zinc-200/80 dark:border-zinc-700/80" />
        </motion.div>

        {/* 2. CONTEXT MENU CARD */}
        <div className="w-[215px] bg-white dark:bg-[#1E1E26] text-zinc-800 dark:text-zinc-100 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.4)] border border-zinc-200/80 dark:border-zinc-700/80 overflow-hidden py-1">
          {/* Ответить */}
          <button
            onClick={() => {
              onReply?.(message);
              onClose();
            }}
            className="w-full px-3.5 py-2 flex items-center gap-3 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-[#282834] transition-colors"
          >
            <CornerUpLeft className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span>Ответить</span>
          </button>

          {/* Изменить (для своих сообщений) */}
          {canEdit && (
            <button
              onClick={() => {
                onEdit?.(message);
                onClose();
              }}
              className="w-full px-3.5 py-2 flex items-center gap-3 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-[#282834] transition-colors"
            >
              <Pencil className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <span>Изменить</span>
            </button>
          )}

          {/* Закрепить */}
          <button
            onClick={() => {
              onPin?.(message);
              onClose();
            }}
            className="w-full px-3.5 py-2 flex items-center gap-3 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-[#282834] transition-colors"
          >
            <Pin className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span>Закрепить</span>
          </button>

          {/* Сохранить как... / Копировать */}
          {message.media_url ? (
            <button
              onClick={handleDownload}
              className="w-full px-3.5 py-2 flex items-center gap-3 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-[#282834] transition-colors"
            >
              <Download className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <span>Сохранить как...</span>
            </button>
          ) : (
            <button
              onClick={handleCopyText}
              className="w-full px-3.5 py-2 flex items-center gap-3 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-[#282834] transition-colors"
            >
              <Copy className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <span>Копировать</span>
            </button>
          )}

          {/* Переслать */}
          <button
            onClick={() => {
              handleCopyText();
            }}
            className="w-full px-3.5 py-2 flex items-center gap-3 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-[#282834] transition-colors"
          >
            <CornerUpRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span>Переслать</span>
          </button>

          {/* Удалить */}
          {canDelete && (
            <button
              onClick={() => {
                if (window.confirm('Удалить это сообщение?')) {
                  onDelete?.(message.id);
                  onClose();
                }
              }}
              className="w-full px-3.5 py-2 flex items-center gap-3 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Удалить</span>
            </button>
          )}

          {/* Выделить (Telegram Select Mode) */}
          <button
            onClick={() => {
              onSelect?.(message);
              onClose();
            }}
            className="w-full px-3.5 py-2 flex items-center gap-3 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-[#282834] transition-colors"
          >
            <CheckSquare className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span>Выделить</span>
          </button>

          {/* 3. BOTTOM DELIVERY TIMESTAMP */}
          <div className="pt-2 mt-1 border-t border-zinc-200/60 dark:border-zinc-800 px-3.5 pb-1 flex items-center gap-1.5 text-[11px] text-zinc-400">
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
    </div>
  );
};
