import React, { useState } from 'react';
import { Check, CheckCheck, Clock, Trash2, ZoomIn, FileText } from 'lucide-react';
import { Message, Profile } from '@/types';
import { formatMessageTime, getRemainingTTL } from '@/lib/dateUtils';
import { UserBadges } from '@/components/ui/Badges';
import { useSettingsStore } from '@/store/useSettingsStore';

interface MessageBubbleProps {
  message: Message;
  currentUserId?: string;
  isOwnerOrMod?: boolean;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onOpenUserProfile?: (user: Profile) => void;
  onOpenMedia?: (
    mediaUrl: string,
    mediaType?: string | null,
    caption?: string | null,
    senderName?: string,
    createdAt?: string
  ) => void;
  onOpenContextMenu?: (e: React.MouseEvent, message: Message) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  currentUserId,
  isOwnerOrMod = false,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
  onDelete,
  onOpenUserProfile,
  onOpenMedia,
  onOpenContextMenu,
}) => {
  const [showDelete, setShowDelete] = useState(false);
  const { fontSize } = useSettingsStore();

  const isOutgoing = message.sender_id === currentUserId;
  const ttl = getRemainingTTL(message.expires_at, message.created_at);

  const textSizeClass =
    fontSize === 'sm'
      ? 'text-[12px] sm:text-[13px]'
      : fontSize === 'lg'
      ? 'text-[15px] sm:text-[16px]'
      : 'text-[13px] sm:text-sm';

  // 1. SYSTEM MESSAGES / GOD ANNOUNCEMENTS
  if (message.is_system) {
    return (
      <div
        onClick={() => {
          if (isSelectMode) onToggleSelect?.(message.id);
        }}
        className={`flex justify-center my-3 px-4 ${isSelectMode ? 'cursor-pointer' : ''}`}
      >
        <div
          className={`max-w-lg rounded-2xl p-3.5 bg-gradient-to-r from-orange-500/15 via-amber-500/20 to-orange-500/15 border shadow-[0_4px_20px_rgba(255,122,0,0.15)] text-center backdrop-blur-sm transition-all ${
            isSelected
              ? 'border-[#FF7A00] ring-2 ring-[#FF7A00] shadow-[0_0_15px_rgba(255,122,0,0.35)]'
              : 'border-[#FF7A00]/40'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 text-xs font-black text-[#FFA033] mb-1">
            <span className="text-sm">⚡</span>
            <span className="uppercase tracking-wider">ОФИЦИАЛЬНОЕ ОПОВЕЩЕНИЕ</span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">
            {message.content}
          </p>
          <div className="mt-1.5 flex items-center justify-center gap-2 text-[10px] text-zinc-400">
            <span>{formatMessageTime(message.created_at)}</span>
            <span>•</span>
            <span className="inline-flex items-center gap-0.5 text-orange-400 font-mono">
              <Clock className="w-2.5 h-2.5" />
              <span>TTL: {ttl.label}</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. NORMAL CHAT MESSAGES
  return (
    <div
      onClick={() => {
        if (isSelectMode) onToggleSelect?.(message.id);
      }}
      className={`group flex items-center gap-3 my-1 px-3 sm:px-4 rounded-xl transition-colors ${
        isSelectMode ? 'cursor-pointer hover:bg-orange-500/5 select-none' : ''
      } ${
        isSelectMode && isSelected ? 'bg-[#FF7A00]/10 dark:bg-[#FF7A00]/15' : ''
      }`}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      {/* Checkbox for Select Mode (Telegram style on far left) */}
      {isSelectMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(message.id);
          }}
          className="self-center p-1 cursor-pointer flex-shrink-0 transition-transform active:scale-90"
          title={isSelected ? 'Снять выделение' : 'Выделить сообщение'}
        >
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-[#FF7A00] text-white shadow-[0_0_8px_rgba(255,122,0,0.5)] scale-110'
                : 'border-2 border-zinc-400 dark:border-zinc-500 hover:border-[#FF7A00] bg-transparent'
            }`}
          >
            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </div>
        </button>
      )}

      {/* Bubble alignment wrapper */}
      <div className={`flex-1 flex items-end gap-1.5 min-w-0 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
        {/* Delete quick action (desktop hover when not in select mode) */}
        {!isSelectMode && isOutgoing && (showDelete || isOwnerOrMod) && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(message.id);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zinc-400 hover:text-rose-500 rounded"
            title="Удалить сообщение"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Bubble Container */}
        <div
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isSelectMode) {
            onToggleSelect?.(message.id);
          } else {
            onOpenContextMenu?.(e, message);
          }
        }}
        onClick={(e) => {
          if (isSelectMode) {
            e.stopPropagation();
            onToggleSelect?.(message.id);
            return;
          }
          // On mobile or on double click, open Telegram context menu
          if (typeof window !== 'undefined' && window.innerWidth < 768) {
            onOpenContextMenu?.(e, message);
          }
        }}
        className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-sm shadow-sm transition-all ${
          isSelectMode ? 'cursor-pointer select-none' : 'cursor-pointer sm:cursor-default'
        } ${
          isSelected
            ? 'ring-2 ring-[#FF7A00] shadow-[0_0_14px_rgba(255,122,0,0.35)] ' +
              (isOutgoing
                ? 'bg-amber-100 dark:bg-[#b85200] border-orange-400'
                : 'bg-zinc-100 dark:bg-[#2b2b36] border-orange-400')
            : isOutgoing
            ? 'bg-[#FFEADC] dark:bg-[#994200] text-zinc-900 dark:text-zinc-50 rounded-br-none border border-orange-200/50 dark:border-orange-600/30'
            : 'bg-white dark:bg-[#212127] text-zinc-900 dark:text-zinc-100 rounded-bl-none border border-zinc-200/60 dark:border-[#2C2C35]'
        }`}
      >
        {/* Sender info for group chats */}
        {!isOutgoing && message.sender && (
          <div
            onClick={(e) => {
              if (isSelectMode) {
                e.stopPropagation();
                onToggleSelect?.(message.id);
                return;
              }
              onOpenUserProfile?.(message.sender!);
            }}
            className="flex items-center gap-1.5 mb-1 text-[11px] font-bold text-[#FF7A00] dark:text-[#FFA033] cursor-pointer hover:underline"
            title="Открыть профиль"
          >
            <span>{message.sender.display_name}</span>
            <UserBadges
              role={message.sender.role}
              username={message.sender.username}
              isVerified={message.sender.is_verified}
              hasVozduxPlus={message.sender.has_vozdux_plus}
            />
          </div>
        )}

        {/* Media attachment */}
        {message.media_url && (
          <div
            onClick={(e) => {
              if (isSelectMode) {
                e.stopPropagation();
                onToggleSelect?.(message.id);
                return;
              }
              onOpenMedia?.(
                message.media_url!,
                message.media_type,
                message.content,
                message.sender?.display_name,
                message.created_at
              );
            }}
            className="mb-2 rounded-xl overflow-hidden cursor-pointer relative group/img bg-black/5 dark:bg-black/25 max-w-full"
            title="Нажмите, чтобы открыть фото на весь экран"
          >
            {message.media_type === 'file' ? (
              <div className="p-3 flex items-center gap-2.5 bg-black/10 dark:bg-black/30 rounded-xl hover:bg-black/20 transition-colors">
                <FileText className="w-6 h-6 text-[#FF7A00]" />
                <div className="min-w-0">
                  <span className="text-xs font-semibold block truncate">Файл во вложении</span>
                  <span className="text-[10px] text-zinc-400">Нажмите для просмотра</span>
                </div>
              </div>
            ) : (
              <>
                <img
                  src={message.media_url}
                  alt="Вложение"
                  className="w-full max-h-80 sm:max-h-96 object-contain rounded-xl transition-transform duration-200 group-hover/img:scale-[1.01]"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
                  <div className="p-2 rounded-full bg-black/60 text-white shadow-lg">
                    <ZoomIn className="w-5 h-5" />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Content */}
        {message.content && (
          <p className={`whitespace-pre-wrap leading-relaxed break-words ${textSizeClass}`}>
            {message.content}
          </p>
        )}

        {/* Footer info: TTL 14 Days + Time + Delivery ticks */}
        <div
          className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] select-none ${
            isOutgoing
              ? 'text-zinc-600 dark:text-orange-200/75'
              : 'text-zinc-400 dark:text-zinc-400'
          }`}
        >
          <span
            title={`Сообщение удалится через ${ttl.label} (TTL 14 дней)`}
            className={`inline-flex items-center gap-0.5 px-1 rounded font-mono ${
              ttl.isUrgent
                ? 'bg-rose-500/20 text-rose-400 font-bold'
                : 'opacity-85'
            }`}
          >
            <Clock className="w-2.5 h-2.5" />
            <span>{ttl.label}</span>
          </span>

          <span className="font-mono">{formatMessageTime(message.created_at)}</span>

          {isOutgoing && (
            <span className="text-[#FF7A00] dark:text-orange-200">
              {message.is_read ? (
                <CheckCheck className="w-3.5 h-3.5" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
            </span>
          )}
        </div>

        {/* Message Bubble Tails SVG */}
        {isOutgoing ? (
          <div className="absolute right-[-7px] bottom-0 w-2 h-3 overflow-hidden pointer-events-none">
            <svg viewBox="0 0 8 12" className="w-2 h-3 fill-[#FFEADC] dark:fill-[#994200]">
              <path d="M0 0 L8 12 L0 12 Z" />
            </svg>
          </div>
        ) : (
          <div className="absolute left-[-7px] bottom-0 w-2 h-3 overflow-hidden pointer-events-none">
            <svg viewBox="0 0 8 12" className="w-2 h-3 fill-white dark:fill-[#212127]">
              <path d="M8 0 L0 12 L8 12 Z" />
            </svg>
          </div>
        )}
      </div>

      {!isSelectMode && !isOutgoing && (showDelete || isOwnerOrMod) && isOwnerOrMod && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(message.id);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zinc-400 hover:text-rose-500 rounded"
          title="Удалить сообщение как модератор/Бог"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
      </div>
    </div>
  );
};
