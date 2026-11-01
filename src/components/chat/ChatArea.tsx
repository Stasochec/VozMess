import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Paperclip,
  Smile,
  Send,
  Clock,
  X,
  FileImage,
} from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Avatar } from '@/components/ui/Avatar';
import { UserBadges } from '@/components/ui/Badges';
import { MessageBubble } from './MessageBubble';
import { Logo } from '@/components/ui/Logo';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { compressImage, CompressResult } from '@/utils/imageCompressor';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Message } from '@/types';

interface ChatAreaProps {
  onBack: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ onBack }) => {
  const { chats, activeChatId, messages, sendMessage, deleteMessage, isLoadingMessages } = useChatStore();
  const { user, profile } = useAuthStore();

  const [inputContent, setInputContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalKb: number;
    compressedKb: number;
    reduction: number;
  } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const activeChat = chats.find((c) => c.id === activeChatId);

  // 1. REALTIME SUBSCRIPTION PER ACTIVE CHAT WITH CLEANUP
  useEffect(() => {
    // Перед подпиской на новый чат отписываемся от предыдущего канала:
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!activeChat) {
    return (
      <div className="flex-1 hidden md:flex flex-col items-center justify-center p-8 bg-zinc-100 dark:bg-[#0F0F12] select-none text-center">
        <div className="p-8 rounded-3xl bg-white/60 dark:bg-[#16161C]/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/50 max-w-sm flex flex-col items-center">
          <Logo size="lg" variant="full" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-4 leading-relaxed">
            Выберите диалог в левой колонке или начните новый. Все сообщения защищены и автоматически удаляются через 14 дней.
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

  // 2. CLIENT-SIDE COMPRESSION HOOKUP
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (file.type.startsWith('image/')) {
      setIsCompressing(true);
      try {
        // Compress down to 1280px max dimension, webp quality 0.8
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

  const handleClearAttachment = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setCompressionInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputContent.trim() && !selectedFile) return;

    let mediaUrl: string | undefined = undefined;
    let mediaType: string | undefined = undefined;

    if (selectedFile && user && isSupabaseConfigured()) {
      setIsUploading(true);
      try {
        const fileExt = selectedFile.name.split('.').pop() || 'webp';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(filePath, selectedFile, {
            contentType: selectedFile.type,
          });

        if (!uploadError) {
          const { data } = supabase.storage.from('chat-media').getPublicUrl(filePath);
          mediaUrl = data.publicUrl;
          mediaType = selectedFile.type.startsWith('image/') ? 'image' : 'file';
        } else {
          console.error('Storage upload error:', uploadError.message);
        }
      } catch (err) {
        console.error('Media upload error:', err);
      } finally {
        setIsUploading(false);
      }
    }

    await sendMessage(activeChat.id, inputContent, mediaUrl, mediaType);
    setInputContent('');
    handleClearAttachment();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sampleEmojis = ['🔥', '⚡', '👑', '🛡️', '🚀', '🧡', '👍', '👌', '😎', '🎉', '💨', '✨'];

  return (
    <main className="flex-1 flex flex-col h-full bg-[#F4F4F5] dark:bg-[#0F0F12] overflow-hidden relative">
      {/* 1. CHAT HEADER */}
      <header className="h-14 sm:h-16 px-3.5 sm:px-5 flex items-center justify-between bg-white dark:bg-[#18181C] border-b border-[#E4E4E7] dark:border-[#26262F] z-10 select-none shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="md:hidden p-1.5 -ml-1 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#25252E] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Avatar
            name={chatTitle}
            src={chatAvatar}
            size="md"
            isOnline={activeChat.type === 'direct' && Boolean(activeChat.other_user)}
          />

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-extrabold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 truncate">
                {chatTitle}
              </h3>
              {activeChat.other_user && (
                <UserBadges
                  role={activeChat.other_user.role}
                  username={activeChat.other_user.username}
                  isVerified={activeChat.other_user.is_verified}
                  hasVozduxPlus={activeChat.other_user.has_vozdux_plus}
                  customTitle={activeChat.other_user.custom_title}
                  showRoleText
                />
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              {activeChat.type === 'direct' ? (
                <span className="text-emerald-500 font-medium">в сети</span>
              ) : (
                <span>чат сообщества</span>
              )}
              <span>•</span>
              <span className="text-[#FF7A00] font-medium flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                <span>Автоудаление 14 дней</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
          <div
            title="Все сообщения автоматически удаляются ровно через 14 дней"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-[#FF7A00] border border-orange-500/20"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Vozdux TTL: 14d</span>
          </div>
        </div>
      </header>

      {/* 2. MESSAGES STREAM */}
      <div className="flex-1 overflow-y-auto py-3 px-1 sm:px-2 flex flex-col space-y-1">
        {isLoadingMessages ? (
          <div className="flex-1 flex items-center justify-center text-xs text-zinc-400 gap-2">
            <span className="w-4 h-4 border-2 border-[#FF7A00] border-t-transparent rounded-full animate-spin" />
            <span>Загрузка сообщений...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center text-[#FF7A00] mb-3">
              <Clock className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
              Здесь пока нет сообщений
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs">
              Отправьте первое сообщение! Оно будет сохранено на 14 дней и автоматически удалится.
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
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. ATTACHMENT PREVIEW */}
      {(previewUrl || isCompressing) && (
        <div className="px-4 py-2.5 bg-white/95 dark:bg-[#18181C]/95 border-t border-[#E4E4E7] dark:border-[#26262F] flex items-center justify-between backdrop-blur-xs">
          {isCompressing ? (
            <div className="flex items-center gap-2.5 text-xs text-orange-500 font-semibold py-1">
              <span className="w-4 h-4 border-2 border-[#FF7A00] border-t-transparent rounded-full animate-spin" />
              <span>Оптимизация изображения через HTML Canvas (до 1280px WebP)...</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={previewUrl!}
                alt="Preview"
                className="w-12 h-12 object-cover rounded-xl border border-orange-400 shadow-xs"
              />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block truncate">
                  {selectedFile?.name || 'Изображение готово к отправке'}
                </span>
                {compressionInfo && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      ⚡ Сжато: {compressionInfo.compressedKb} КБ (-{compressionInfo.reduction}%)
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
            className="p-1 rounded-full text-zinc-400 hover:text-rose-500 transition-colors ml-2"
            title="Отменить вложение"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. EMOJI PICKER POPUP */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 right-4 sm:right-20 p-3 bg-white dark:bg-[#1E1E26] border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl z-30 flex gap-2 flex-wrap max-w-xs">
          {sampleEmojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                setInputContent((prev) => prev + emoji);
                setShowEmojiPicker(false);
              }}
              className="text-lg hover:scale-125 transition-transform p-1 cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* 5. BOTTOM INPUT BAR */}
      <footer className="p-2 sm:p-3 bg-white dark:bg-[#18181C] border-t border-[#E4E4E7] dark:border-[#26262F]">
        <div className="max-w-4xl mx-auto flex items-end gap-2">
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
            className="p-2.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-[#FF7A00] hover:bg-zinc-100 dark:hover:bg-[#25252E] transition-colors flex-shrink-0"
            title="Прикрепить изображение"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <div className="flex-1 relative flex items-center bg-zinc-100 dark:bg-[#22222B] rounded-2xl border border-transparent focus-within:border-[#FF7A00] dark:focus-within:border-[#FF7A00] transition-all px-3.5 py-1.5">
            <textarea
              rows={1}
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Написать сообщение... (Enter для отправки)"
              className="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none resize-none max-h-32 min-h-[24px] py-1 leading-relaxed"
            />

            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="p-1.5 text-zinc-400 hover:text-[#FF7A00] transition-colors"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={() => handleSend()}
            disabled={(!inputContent.trim() && !selectedFile) || isUploading}
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FF9500] to-[#FF5500] hover:from-[#E66E00] hover:to-[#E03D00] disabled:opacity-40 disabled:pointer-events-none text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-[#FF7A00]/30 transition-transform active:scale-95"
            title="Отправить (Enter)"
          >
            <Send className="w-4.5 h-4.5 ml-0.5" />
          </button>
        </div>
      </footer>
    </main>
  );
};
