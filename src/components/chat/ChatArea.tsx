import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Paperclip,
  Smile,
  Send,
  Clock,
  X,
  FileImage,
  UploadCloud,
  AlertCircle,
  Pin,
  Pencil,
  CornerUpLeft,
  Check,
} from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Avatar } from '@/components/ui/Avatar';
import { UserBadges } from '@/components/ui/Badges';
import { MessageBubble } from './MessageBubble';
import { MediaViewerModal } from './MediaViewerModal';
import { MessageContextMenu } from './MessageContextMenu';
import { Logo } from '@/components/ui/Logo';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { compressImage, CompressResult } from '@/utils/imageCompressor';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Message, Chat, Profile } from '@/types';
import { useSettingsStore } from '@/store/useSettingsStore';
import { usePresenceStore } from '@/store/usePresenceStore';
import { soundEffects } from '@/lib/soundUtils';
import { formatLastSeen } from '@/lib/dateUtils';
import { AnimatePresence } from 'framer-motion';

interface ChatAreaProps {
  onBack: () => void;
  onOpenUserProfile?: (user: Profile) => void;
  onOpenGroupProfile?: (chat: Chat) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  onBack,
  onOpenUserProfile,
  onOpenGroupProfile,
}) => {
  const {
    chats,
    activeChatId,
    messages,
    sendMessage,
    editMessage,
    deleteMessage,
    isLoadingMessages,
  } = useChatStore();
  const { user, profile } = useAuthStore();
  const { sendOnEnter, sendSoundEnabled } = useSettingsStore();
  const { isUserOnline } = usePresenceStore();

  const [inputContent, setInputContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalKb: number;
    compressedKb: number;
    reduction: number;
  } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Lightbox Media Viewer State
  const [viewingMedia, setViewingMedia] = useState<{
    url: string;
    type?: string | null;
    caption?: string | null;
    senderName?: string;
    createdAt?: string;
  } | null>(null);

  // Context Menu State (Telegram PKM / Mobile Tap)
  const [contextMenu, setContextMenu] = useState<{
    message: Message;
    position: { x: number; y: number };
  } | null>(null);

  // Message Action States (Reply, Edit, Pin)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingMessage, setReplyingMessage] = useState<Message | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const activeChat = chats.find((c) => c.id === activeChatId);

  // 1. REALTIME SUBSCRIPTION PER ACTIVE CHAT WITH CLEANUP
  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (!activeChatId || !isSupabaseConfigured()) return;

    const channelName = `chat_messages_${activeChatId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${activeChatId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.chat_id !== activeChatId) return;

          // Fetch sender profile info
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMsg.sender_id)
            .maybeSingle();

          const populatedMsg: Message = {
            ...newMsg,
            sender: senderProfile || undefined,
          };

          useChatStore.getState().addRealtimeMessage(populatedMsg);

          // Incoming sound and desktop notification for other senders
          if (newMsg.sender_id !== user?.id) {
            const settings = useSettingsStore.getState();
            if (settings.soundEnabled) {
              soundEffects.playIncoming();
            }
            if (
              settings.desktopNotifications &&
              document.hidden &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              try {
                new Notification(senderProfile?.display_name || 'Vozduxan', {
                  body: newMsg.content || 'Новое вложение',
                  icon: senderProfile?.avatar_url || undefined,
                });
              } catch {
                // Ignore notification error
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${activeChatId}`,
        },
        (payload) => {
          useChatStore.getState().removeRealtimeMessage(payload.old.id);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [activeChatId]);

  // Smooth scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Process and compress chosen file (from input, paste, or drag & drop)
  const processSelectedFile = async (file: File) => {
    setUploadErrorMsg(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (file.type.startsWith('image/')) {
      setIsCompressing(true);
      try {
        const res: CompressResult = await compressImage(file, 1280, 0.8);
        setSelectedFile(res.file);
        setPreviewUrl(res.previewUrl);
        setCompressionInfo({
          originalKb: Math.round(res.originalSize / 1024),
          compressedKb: Math.round(res.compressedSize / 1024),
          reduction: res.reductionPercentage,
        });
      } finally {
        setIsCompressing(false);
      }
    } else {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setCompressionInfo(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleClearAttachment = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setCompressionInfo(null);
    setUploadErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Clipboard Paste support (Ctrl+V / Mobile Paste)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processSelectedFile(file);
          break;
        }
      }
    }
  };

  // Drag and Drop support
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processSelectedFile(file);
    }
  };

  // Textarea auto-resize
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputContent(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  // Context Menu Actions
  const handleStartReply = (msg: Message) => {
    setReplyingMessage(msg);
    setEditingMessage(null);
    textareaRef.current?.focus();
  };

  const handleStartEdit = (msg: Message) => {
    setEditingMessage(msg);
    setReplyingMessage(null);
    setInputContent(msg.content || '');
    textareaRef.current?.focus();
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputContent.trim() && !selectedFile) || !activeChat) return;

    // 1. IF IN EDIT MODE -> UPDATE EXISTING MESSAGE
    if (editingMessage) {
      const updatedText = inputContent.trim();
      if (updatedText) {
        await editMessage(editingMessage.id, updatedText);
      }
      setEditingMessage(null);
      setInputContent('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }

    // 2. NORMAL MESSAGE OR REPLY SENDING
    let mediaUrl: string | undefined = undefined;
    let mediaType: string | undefined = undefined;

    if (selectedFile && user && isSupabaseConfigured()) {
      setIsUploading(true);
      setUploadErrorMsg(null);

      try {
        const fileExt = selectedFile.name.split('.').pop() || 'webp';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(filePath, selectedFile, {
            contentType: selectedFile.type,
            upsert: true,
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError.message);
          setUploadErrorMsg(
            `Ошибка отправки фото: ${uploadError.message}. Убедитесь, что в Supabase создан бакет 'chat-media'.`
          );
          setIsUploading(false);
          return;
        }

        const { data } = supabase.storage.from('chat-media').getPublicUrl(filePath);
        mediaUrl = data.publicUrl;
        mediaType = selectedFile.type.startsWith('image/') ? 'image' : 'file';
      } catch (err: unknown) {
        console.error('Media upload error:', err);
        const msg = err instanceof Error ? err.message : 'Ошибка отправки файла';
        setUploadErrorMsg(`Ошибка отправки: ${msg}`);
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    if (sendSoundEnabled) {
      soundEffects.playSent();
    }

    // Handle reply prefix if quoting another message
    let finalContent = inputContent.trim();
    if (replyingMessage) {
      const author = replyingMessage.sender?.display_name || 'сообщение';
      const quote = (replyingMessage.content || 'Вложение').slice(0, 45);
      finalContent = `↩️ В ответ ${author}: «${quote}»\n${finalContent}`;
      setReplyingMessage(null);
    }

    await sendMessage(activeChat.id, finalContent, mediaUrl, mediaType);
    setInputContent('');
    handleClearAttachment();

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (sendOnEnter) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    } else {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  // 2. EMPTY STATE WHEN NO CHAT IS SELECTED
  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-100 dark:bg-[#0F0F12] select-none text-center relative">
        <button
          onClick={onBack}
          className="md:hidden absolute top-4 left-4 p-2.5 rounded-2xl bg-zinc-200 dark:bg-[#202028] text-zinc-700 dark:text-zinc-200 transition-colors"
          title="Вернуться к списку чатов"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="p-8 rounded-3xl bg-white/70 dark:bg-[#16161C]/70 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/50 max-w-sm flex flex-col items-center shadow-lg">
          <Logo size="lg" variant="full" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-4 leading-relaxed">
            Выберите диалог в списке слева или начните новый. Все сообщения защищены и автоматически
            удаляются через 14 дней.
          </p>
          <div className="mt-4 px-3 py-1 rounded-full bg-orange-500/10 text-[#FF7A00] text-[11px] font-semibold border border-orange-500/20">
            ⚡ Vozduxan Protocol • TTL 14 Days
          </div>
        </div>
      </div>
    );
  }

  const chatTitle =
    activeChat.type === 'direct' && activeChat.other_user
      ? activeChat.other_user.display_name
      : activeChat.title || 'Чат';

  const chatAvatar =
    activeChat.type === 'direct' && activeChat.other_user
      ? activeChat.other_user.avatar_url
      : activeChat.avatar_url;

  const isOwnerOrMod =
    profile?.role === 'owner' ||
    profile?.role === 'moderator' ||
    profile?.username?.toLowerCase() === 'stasochec';

  const sampleEmojis = ['🔥', '⚡', '👑', '🛡️', '🚀', '🧡', '👍', '👌', '😎', '🎉', '💨', '✨'];

  return (
    <main
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 flex flex-col h-full bg-[#F4F4F5] dark:bg-[#0F0F12] overflow-hidden relative"
    >
      {/* DRAG & DROP OVERLAY */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-40 bg-[#FF7A00]/20 backdrop-blur-xs border-3 border-dashed border-[#FF7A00] flex flex-col items-center justify-center p-6 text-center select-none pointer-events-none">
          <div className="w-16 h-16 rounded-3xl bg-[#FF7A00] text-white flex items-center justify-center shadow-xl animate-bounce mb-3">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="font-extrabold text-base text-white drop-shadow">
            Отпустите фото для быстрой отправки
          </h3>
          <p className="text-xs text-zinc-200 mt-1">
            Изображение будет оптимизировано в WebP перед передачей
          </p>
        </div>
      )}

      {/* 1. CHAT HEADER (MOBILE ADAPTED) */}
      <header className="h-14 sm:h-16 px-3 sm:px-5 flex items-center justify-between bg-white dark:bg-[#18181C] border-b border-[#E4E4E7] dark:border-[#26262F] z-10 select-none shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Mobile Back Button (Touch target min 42px) */}
          <button
            onClick={onBack}
            className="md:hidden w-10 h-10 -ml-1 flex items-center justify-center rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#25252E] active:scale-95 transition-all"
            title="Назад к чатам"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Clickable Header Info (Opens Profile or Group Modal) */}
          <div
            onClick={() => {
              if (activeChat.type === 'direct' && activeChat.other_user) {
                onOpenUserProfile?.(activeChat.other_user);
              } else if (activeChat.type === 'group' || activeChat.type === 'channel') {
                onOpenGroupProfile?.(activeChat);
              }
            }}
            className="flex items-center gap-2.5 sm:gap-3 min-w-0 cursor-pointer p-1 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors flex-1"
            title="Открыть информацию"
          >
            <Avatar
              name={chatTitle}
              src={chatAvatar}
              size="md"
              isOnline={
                activeChat.type === 'direct' && activeChat.other_user
                  ? isUserOnline(activeChat.other_user, profile)
                  : false
              }
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {chatTitle}
                </h3>
                {activeChat.type === 'direct' && activeChat.other_user && (
                  <UserBadges
                    role={activeChat.other_user.role}
                    username={activeChat.other_user.username}
                    isVerified={activeChat.other_user.is_verified}
                    hasVozduxPlus={activeChat.other_user.has_vozdux_plus}
                    isHidden={activeChat.other_user.is_hidden}
                    customTitle={activeChat.other_user.custom_title}
                  />
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {activeChat.type === 'direct' && activeChat.other_user ? (
                  isUserOnline(activeChat.other_user, profile) ? (
                    <span className="text-emerald-500 font-semibold">в сети</span>
                  ) : (
                    formatLastSeen(activeChat.other_user.last_seen)
                  )
                ) : (
                  `${activeChat.members?.length || 1} участников • нажми для настроек ⚙️`
                )}
              </p>
            </div>
          </div>
        </div>

        {/* TTL 14 Days Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-[#FF7A00] text-xs font-mono font-bold border border-orange-500/20">
          <Clock className="w-3.5 h-3.5" />
          <span>TTL 14 Дней</span>
        </div>
      </header>

      {/* PINNED MESSAGE BANNER */}
      {pinnedMessage && (
        <div className="px-4 py-2 bg-[#FF7A00]/10 border-b border-[#FF7A00]/20 flex items-center justify-between text-xs text-zinc-200 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <Pin className="w-3.5 h-3.5 text-[#FF7A00] flex-shrink-0" />
            <div className="min-w-0 truncate">
              <span className="font-bold text-[#FF8A1C] mr-1.5">Закрепленное сообщение:</span>
              <span className="text-zinc-300">
                {pinnedMessage.content || (pinnedMessage.media_url ? 'Фото' : 'Сообщение')}
              </span>
            </div>
          </div>
          <button
            onClick={() => setPinnedMessage(null)}
            className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
            title="Открепить"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. MESSAGES STREAM */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-1 sm:space-y-2 overscroll-contain">
        {isLoadingMessages ? (
          <div className="h-full flex items-center justify-center text-xs text-zinc-400">
            <span className="w-5 h-5 border-2 border-[#FF7A00] border-t-transparent rounded-full animate-spin mr-2" />
            Загрузка сообщений...
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-xs text-center p-6 select-none">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-[#FF7A00] flex items-center justify-center mb-3">
              ⚡
            </div>
            <p className="font-semibold text-zinc-300">Сообщений пока нет</p>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-xs">
              Отправьте первое сообщение или прикрепите фото. Сообщения удаляются ровно через 14 дней.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              currentUserId={user?.id}
              isOwnerOrMod={isOwnerOrMod}
              onDelete={deleteMessage}
              onOpenUserProfile={onOpenUserProfile}
              onOpenMedia={(url, type, caption, senderName, createdAt) =>
                setViewingMedia({ url, type, caption, senderName, createdAt })
              }
              onOpenContextMenu={(e, m) =>
                setContextMenu({
                  message: m,
                  position: { x: e.clientX, y: e.clientY },
                })
              }
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. ATTACHMENT UPLOAD ERROR BANNER */}
      {uploadErrorMsg && (
        <div className="px-4 py-2.5 bg-rose-500/15 border-t border-rose-500/30 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{uploadErrorMsg}</span>
          </div>
          <button
            onClick={() => setUploadErrorMsg(null)}
            className="p-1 rounded text-rose-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. ATTACHMENT PREVIEW DRAWER */}
      {(previewUrl || isCompressing) && (
        <div className="px-3 sm:px-4 py-2.5 bg-white/95 dark:bg-[#18181C]/95 border-t border-[#E4E4E7] dark:border-[#26262F] flex items-center justify-between backdrop-blur-xs">
          {isCompressing ? (
            <div className="flex items-center gap-2.5 text-xs text-orange-500 font-semibold py-1">
              <span className="w-4 h-4 border-2 border-[#FF7A00] border-t-transparent rounded-full animate-spin" />
              <span>Сжатие через Canvas WebP (до 1280px)...</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={previewUrl!}
                alt="Preview"
                className="w-12 h-12 object-cover rounded-xl border border-orange-400 shadow-xs flex-shrink-0"
              />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block truncate">
                  {selectedFile?.name || 'Фото готово к отправке'}
                </span>
                {compressionInfo && (
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      ⚡ {compressionInfo.compressedKb} КБ (-{compressionInfo.reduction}%)
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      было {compressionInfo.originalKb} КБ
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          <button
            onClick={handleClearAttachment}
            className="p-1.5 rounded-full text-zinc-400 hover:text-rose-500 transition-colors ml-2"
            title="Отменить вложение"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 5. REPLY BAR (TELEGRAM QUOTE BANNER) */}
      {replyingMessage && (
        <div className="px-4 py-2 bg-zinc-100 dark:bg-[#1E1E26] border-t border-[#E4E4E7] dark:border-[#26262F] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <CornerUpLeft className="w-4 h-4 text-[#FF7A00] flex-shrink-0" />
            <div className="min-w-0 truncate">
              <span className="font-bold text-[#FF8A1C] block truncate">
                Ответ {replyingMessage.sender?.display_name || 'пользователю'}:
              </span>
              <span className="text-zinc-400 truncate block text-[11px]">
                {replyingMessage.content || 'Медиафайл'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setReplyingMessage(null)}
            className="p-1 rounded text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 6. EDITING BAR */}
      {editingMessage && (
        <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/25 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <Pencil className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div className="min-w-0 truncate">
              <span className="font-bold block">Редактирование сообщения</span>
              <span className="text-[11px] text-amber-300/80 truncate block">
                {editingMessage.content}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null);
              setInputContent('');
            }}
            className="p-1 rounded text-amber-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 7. EMOJI PICKER POPUP (MOBILE ADAPTED) */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-3 right-3 sm:left-auto sm:right-20 p-3 bg-white dark:bg-[#1E1E26] border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl z-30 flex gap-2.5 flex-wrap justify-center sm:justify-start max-w-xs mx-auto">
          {sampleEmojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                setInputContent((prev) => prev + emoji);
                setShowEmojiPicker(false);
              }}
              className="text-xl hover:scale-125 active:scale-95 transition-transform p-1 cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* 8. BOTTOM INPUT BAR (MOBILE VIRTUAL KEYBOARD OPTIMIZED) */}
      <footer className="p-2 sm:p-3 bg-white dark:bg-[#18181C] border-t border-[#E4E4E7] dark:border-[#26262F] pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="max-w-4xl mx-auto flex items-end gap-1.5 sm:gap-2">
          {/* File input (Camera or Gallery) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-[#FF7A00] hover:bg-zinc-100 dark:hover:bg-[#25252E] active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
            title="Прикрепить изображение (или вставьте Ctrl+V)"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Text input with Paste support and Auto-resize */}
          <div className="flex-1 relative flex items-center bg-zinc-100 dark:bg-[#22222B] rounded-2xl border border-transparent focus-within:border-[#FF7A00] dark:focus-within:border-[#FF7A00] transition-all px-3 py-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputContent}
              onChange={handleTextareaChange}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              placeholder={
                editingMessage
                  ? 'Измените текст сообщения...'
                  : selectedFile
                  ? 'Добавьте подпись к фото...'
                  : 'Написать сообщение... (Enter для отправки)'
              }
              className="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none resize-none max-h-28 min-h-[26px] py-1 leading-relaxed"
            />

            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="p-1.5 text-zinc-400 hover:text-[#FF7A00] transition-colors ml-1"
              title="Эмодзи"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>

          {/* Send or Save Edit button */}
          <button
            onClick={() => handleSend()}
            disabled={(!inputContent.trim() && !selectedFile) || isUploading || isCompressing}
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FF9500] to-[#FF5500] hover:from-[#E66E00] hover:to-[#E03D00] disabled:opacity-40 disabled:pointer-events-none text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-[#FF7A00]/30 transition-transform active:scale-95"
            title={editingMessage ? 'Сохранить изменения' : 'Отправить (Enter)'}
          >
            {isUploading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : editingMessage ? (
              <Check className="w-5 h-5" />
            ) : (
              <Send className="w-4.5 h-4.5 ml-0.5" />
            )}
          </button>
        </div>
      </footer>

      {/* FULLSCREEN LIGHTBOX MEDIA VIEWER */}
      {viewingMedia && (
        <MediaViewerModal
          isOpen={Boolean(viewingMedia)}
          mediaUrl={viewingMedia.url}
          mediaType={viewingMedia.type}
          caption={viewingMedia.caption}
          senderName={viewingMedia.senderName}
          createdAt={viewingMedia.createdAt}
          onClose={() => setViewingMedia(null)}
        />
      )}

      {/* TELEGRAM-STYLE MESSAGE CONTEXT MENU (PKM / MOBILE TAP) */}
      <AnimatePresence>
        {contextMenu && (
          <MessageContextMenu
            isOpen={Boolean(contextMenu)}
            message={contextMenu.message}
            position={contextMenu.position}
            isOutgoing={contextMenu.message.sender_id === user?.id}
            isOwnerOrMod={isOwnerOrMod}
            onClose={() => setContextMenu(null)}
            onReply={handleStartReply}
            onEdit={handleStartEdit}
            onPin={(msg) => setPinnedMessage(msg)}
            onDelete={(id) => deleteMessage(id)}
            onReact={async (msg, emoji) => {
              if (sendSoundEnabled) soundEffects.playSent();
              // Optionally send reaction or quick reply
              await sendMessage(activeChat.id, `${emoji}`);
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
};
