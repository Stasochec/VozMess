import React, { useState } from 'react';
import { Check, CheckCheck, Clock, Trash2 } from 'lucide-react';
import { Message } from '@/types';
import { formatMessageTime, getRemainingTTL } from '@/lib/dateUtils';
import { UserBadges } from '@/components/ui/Badges';

interface MessageBubbleProps {
  message: Message;
  currentUserId?: string;
  isOwnerOrMod?: boolean;
  onDelete?: (id: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  currentUserId,
  isOwnerOrMod = false,
  onDelete,
}) => {
  const [showDelete, setShowDelete] = useState(false);

  const isOutgoing = message.sender_id === currentUserId;
  const ttl = getRemainingTTL(message.expires_at, message.created_at);

  // 1. SYSTEM MESSAGES / GOD ANNOUNCEMENTS
  if (message.is_system) {
    return (
      <div className="flex justify-center my-3 px-4">
        <div className="max-w-lg rounded-2xl p-3.5 bg-gradient-to-r from-orange-500/15 via-amber-500/20 to-orange-500/15 border border-[#FF7A00]/40 shadow-[0_4px_20px_rgba(255,122,0,0.15)] text-center backdrop-blur-sm">
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
      className={`group flex items-end gap-1.5 my-1.5 px-3 sm:px-4 ${
        isOutgoing ? 'justify-end' : 'justify-start'
      }`}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      {/* Delete quick action */}
      {isOutgoing && (showDelete || isOwnerOrMod) && onDelete && (
        <button
          onClick={() => onDelete(message.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zinc-400 hover:text-rose-500 rounded"
          title="Удалить сообщение"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Bubble Container */}
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-sm shadow-sm transition-all ${
          isOutgoing
            ? 'bg-[#FFEADC] dark:bg-[#994200] text-zinc-900 dark:text-zinc-50 rounded-br-none border border-orange-200/50 dark:border-orange-600/30'
            : 'bg-white dark:bg-[#212127] text-zinc-900 dark:text-zinc-100 rounded-bl-none border border-zinc-200/60 dark:border-[#2C2C35]'
        }`}
      >
        {/* Sender info for group chats */}
        {!isOutgoing && message.sender && (
          <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold text-[#FF7A00] dark:text-[#FFA033]">
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
          <div className="mb-2 rounded-xl overflow-hidden max-h-72">
            <img
              src={message.media_url}
              alt="Вложение"
              className="w-full h-full object-cover rounded-xl"
              loading="lazy"
            />
          </div>
        )}

        {/* Content */}
        {message.content && (
          <p className="whitespace-pre-wrap leading-relaxed break-words text-[13px] sm:text-sm">
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

      {!isOutgoing && (showDelete || isOwnerOrMod) && isOwnerOrMod && onDelete && (
        <button
          onClick={() => onDelete(message.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zinc-400 hover:text-rose-500 rounded"
          title="Удалить сообщение как модератор/Бог"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
