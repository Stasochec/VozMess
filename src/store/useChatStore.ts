import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Chat, Message, Profile } from '@/types';
import { useAuthStore } from './useAuthStore';
import { RealtimeChannel } from '@supabase/supabase-js';

interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  messages: Message[];
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  searchQuery: string;
  activeFilter: 'all' | 'direct' | 'group' | 'channel';
  realtimeSubscription: RealtimeChannel | null;
  activeChatChannel: RealtimeChannel | null;

  setActiveChatId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: 'all' | 'direct' | 'group' | 'channel') => void;

  fetchChats: () => Promise<void>;
  fetchMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, content: string, mediaUrl?: string, mediaType?: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  createDirectChat: (targetUser: Profile) => Promise<string | null>;
  createGroupChat: (title: string, memberIds: string[]) => Promise<string | null>;
  broadcastAnnouncement: (text: string) => Promise<{ success: boolean; error?: string }>;
  subscribeToRealtime: () => void;
  unsubscribeFromRealtime: () => void;
  subscribeToChatMessages: (chatId: string) => void;
  unsubscribeFromChatMessages: () => void;
  addRealtimeMessage: (message: Message) => void;
  removeRealtimeMessage: (messageId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  messages: [],
  isLoadingChats: false,
  isLoadingMessages: false,
  searchQuery: '',
  activeFilter: 'all',
  realtimeSubscription: null,
  activeChatChannel: null,

  setActiveChatId: (id) => {
    const prevId = get().activeChatId;
    if (prevId !== id) {
      get().unsubscribeFromChatMessages();
    }
    set({ activeChatId: id });
    if (id) {
      get().fetchMessages(id);
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setActiveFilter: (activeFilter) => set({ activeFilter }),

  fetchChats: async () => {
    const authStore = useAuthStore.getState();
    const currentUserId = authStore.user?.id;

    if (!isSupabaseConfigured() || !currentUserId) {
      set({ chats: [], isLoadingChats: false });
      return;
    }

    set({ isLoadingChats: true });
    try {
      // 1. Get all chats where current user is a member
      const { data: memberRecords, error: memberErr } = await supabase
        .from('chat_members')
        .select(`
          chat_id,
          chats (*)
        `)
        .eq('user_id', currentUserId);

      if (memberErr) throw memberErr;

      const loadedChats: Chat[] = [];
      const nowIso = new Date().toISOString();

      for (const item of memberRecords || []) {
        const rawChat = (item as unknown as { chats: Chat }).chats;
        if (!rawChat) continue;

        // Fetch last non-expired message
        const { data: lastMsgs } = await supabase
          .from('messages')
          .select('*, sender:profiles(*)')
          .eq('chat_id', rawChat.id)
          .gt('expires_at', nowIso)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastMessage = lastMsgs && lastMsgs.length > 0 ? lastMsgs[0] : null;

        // For direct chats, fetch the counterpart's profile
        let otherUser: Profile | undefined = undefined;
        if (rawChat.type === 'direct') {
          const { data: otherMember } = await supabase
            .from('chat_members')
            .select('user_id, profiles(*)')
            .eq('chat_id', rawChat.id)
            .neq('user_id', currentUserId)
            .maybeSingle();

          if (otherMember) {
            otherUser = (otherMember as unknown as { profiles: Profile }).profiles;
          }
        }

        loadedChats.push({
          ...rawChat,
          last_message: lastMessage,
          other_user: otherUser,
          unread_count: 0,
        });
      }

      // Sort chats by most recent message or update timestamp
      loadedChats.sort((a, b) => {
        const timeA = new Date(a.last_message?.created_at || a.updated_at).getTime();
        const timeB = new Date(b.last_message?.created_at || b.updated_at).getTime();
        return timeB - timeA;
      });

      set({ chats: loadedChats });

      // Automatically select first chat if none is active on desktop
      if (!get().activeChatId && loadedChats.length > 0 && window.innerWidth >= 768) {
        get().setActiveChatId(loadedChats[0].id);
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
      set({ chats: [] });
    } finally {
      set({ isLoadingChats: false });
    }
  },

  fetchMessages: async (chatId: string) => {
    if (!isSupabaseConfigured() || !chatId) {
      set({ messages: [], isLoadingMessages: false });
      return;
    }

    set({ isLoadingMessages: true });
    try {
      const nowIso = new Date().toISOString();

      // Auto-deletion TTL: Only load messages whose 14-day lifetime has not expired
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles(*)
        `)
        .eq('chat_id', chatId)
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: true });

      if (error) throw error;
      set({ messages: data || [] });
    } catch (err) {
      console.error('Error fetching messages:', err);
      set({ messages: [] });
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: async (chatId: string, content: string, mediaUrl?: string, mediaType?: string) => {
    const authStore = useAuthStore.getState();
    const currentUser = authStore.user;
    const currentProfile = authStore.profile;

    if (!currentUser || !isSupabaseConfigured()) return;

    // 14 days auto-deletion TTL expiration
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      chat_id: chatId,
      sender_id: currentUser.id,
      content: content.trim() || null,
      media_url: mediaUrl || null,
      media_type: mediaType || null,
      is_system: false,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      is_read: false,
      sender: currentProfile || undefined,
    };

    // Instant optimistic update
    set((state) => ({
      messages: [...state.messages, optimisticMessage],
      chats: state.chats.map((c) =>
        c.id === chatId
          ? { ...c, last_message: optimisticMessage, updated_at: optimisticMessage.created_at }
          : c
      ),
    }));

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: currentUser.id,
          content: content.trim() || null,
          media_url: mediaUrl || null,
          media_type: mediaType || null,
          expires_at: expiresAt,
        })
        .select('*, sender:profiles(*)')
        .single();

      if (error) throw error;

      // Replace optimistic placeholder with confirmed record
      set((state) => ({
        messages: state.messages.map((m) => (m.id === optimisticMessage.id ? data : m)),
      }));

      await supabase
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chatId);
    } catch (err) {
      console.error('Failed to send message:', err);
      // Remove optimistic message if insert failed
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== optimisticMessage.id),
      }));
    }
  },

  deleteMessage: async (messageId: string) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    }));

    if (!isSupabaseConfigured()) return;

    try {
      await supabase.from('messages').delete().eq('id', messageId);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  },

  createDirectChat: async (targetUser: Profile) => {
    const authStore = useAuthStore.getState();
    const currentUserId = authStore.user?.id;

    if (!isSupabaseConfigured() || !currentUserId) {
      throw new Error('Supabase не настроен или пользователь не авторизован');
    }

    try {
      let chatId: string | null = null;

      // 1. Попытка создания/получения через быстрый атомарный RPC
      const { data: rpcChatId, error: rpcErr } = await supabase.rpc('create_or_get_direct_chat', {
        p_target_user_id: targetUser.id,
      });

      if (!rpcErr && rpcChatId) {
        chatId = rpcChatId;
      } else {
        if (rpcErr) {
          console.warn('RPC create_or_get_direct_chat error/missing, using client fallback:', rpcErr.message);
        }

        // 2. Клиентский fallback без рекурсивных джойнов
        const { data: myMemberships } = await supabase
          .from('chat_members')
          .select('chat_id')
          .eq('user_id', currentUserId);

        if (myMemberships && myMemberships.length > 0) {
          const myChatIds = myMemberships.map((m) => m.chat_id);

          const { data: theirMemberships } = await supabase
            .from('chat_members')
            .select('chat_id')
            .in('chat_id', myChatIds)
            .eq('user_id', targetUser.id);

          if (theirMemberships && theirMemberships.length > 0) {
            const candidateIds = theirMemberships.map((m) => m.chat_id);
            const { data: directChat } = await supabase
              .from('chats')
              .select('id')
              .in('id', candidateIds)
              .eq('type', 'direct')
              .limit(1)
              .maybeSingle();

            if (directChat) {
              chatId = directChat.id;
            }
          }
        }

        // Если существующий чат не найден, создаем новый
        if (!chatId) {
          const { data: newChat, error: chatErr } = await supabase
            .from('chats')
            .insert({ type: 'direct', created_by: currentUserId })
            .select('id')
            .single();

          if (chatErr) throw chatErr;
          chatId = newChat.id;

          const { error: membersErr } = await supabase.from('chat_members').insert([
            { chat_id: chatId, user_id: currentUserId, role: 'owner' },
            { chat_id: chatId, user_id: targetUser.id, role: 'member' },
          ]);

          if (membersErr) throw membersErr;
        }
      }

      if (!chatId) throw new Error('Не удалось получить ID диалога');

      // 3. МГНОВЕННОЕ ОПТИМИСТИЧНОЕ ДОБАВЛЕНИЕ ЧАТА В СТЕЙТ
      // Это исключает задержки и открывает окно чата сразу
      const existingInState = get().chats.find((c) => c.id === chatId);
      const chatObject: Chat = existingInState || {
        id: chatId,
        type: 'direct',
        created_by: currentUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        other_user: targetUser,
        last_message: null,
        unread_count: 0,
      };

      set((state) => ({
        activeChatId: chatId,
        chats: state.chats.some((c) => c.id === chatId)
          ? state.chats.map((c) => (c.id === chatId ? { ...c, other_user: targetUser } : c))
          : [chatObject, ...state.chats],
      }));

      // Загружаем сообщения
      await get().fetchMessages(chatId);

      // Фоново обновляем полный список чатов
      get().fetchChats().catch(console.error);

      return chatId;
    } catch (err) {
      console.error('Error creating direct chat:', err);
      throw err;
    }
  },

  createGroupChat: async (title: string, memberIds: string[]) => {
    const authStore = useAuthStore.getState();
    const currentUserId = authStore.user?.id;

    if (!isSupabaseConfigured() || !currentUserId) return null;

    try {
      const { data: newChat, error: chatErr } = await supabase
        .from('chats')
        .insert({ type: 'group', title: title.trim(), created_by: currentUserId })
        .select()
        .single();

      if (chatErr) throw chatErr;

      const membersToInsert = [
        { chat_id: newChat.id, user_id: currentUserId, role: 'owner' as const },
        ...memberIds.map((uid) => ({ chat_id: newChat.id, user_id: uid, role: 'member' as const })),
      ];

      await supabase.from('chat_members').insert(membersToInsert);

      const groupChatObj: Chat = {
        id: newChat.id,
        type: 'group',
        title: title.trim(),
        created_by: currentUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message: null,
        unread_count: 0,
      };

      set((state) => ({
        activeChatId: newChat.id,
        chats: [groupChatObj, ...state.chats],
      }));

      await get().fetchMessages(newChat.id);
      get().fetchChats().catch(console.error);
      return newChat.id;
    } catch (err) {
      console.error('Error creating group chat:', err);
      return null;
    }
  },

  broadcastAnnouncement: async (text: string) => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'База данных не подключена' };
    }

    try {
      const { error } = await supabase.rpc('broadcast_god_announcement', {
        announcement_text: text,
      });

      if (error) throw error;

      await get().fetchChats();
      if (get().activeChatId) {
        await get().fetchMessages(get().activeChatId!);
      }
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Ошибка отправки анонса',
      };
    }
  },

  subscribeToRealtime: () => {
    if (!isSupabaseConfigured()) return;

    get().unsubscribeFromRealtime();

    const channel = supabase
      .channel('vozduxan_global_stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const newMsg = payload.new as Message;

          // Fetch sender profile info for sidebar preview
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMsg.sender_id)
            .maybeSingle();

          const populatedMsg: Message = {
            ...newMsg,
            sender: senderProfile || undefined,
          };

          // Update sidebar chat list
          set((state) => ({
            chats: state.chats.map((c) =>
              c.id === newMsg.chat_id
                ? { ...c, last_message: populatedMsg, updated_at: populatedMsg.created_at }
                : c
            ),
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          const deletedId = payload.old.id;
          get().removeRealtimeMessage(deletedId);
        }
      )
      .subscribe();

    set({ realtimeSubscription: channel });
  },

  unsubscribeFromRealtime: () => {
    const { realtimeSubscription } = get();
    if (realtimeSubscription) {
      supabase.removeChannel(realtimeSubscription);
      set({ realtimeSubscription: null });
    }
  },

  subscribeToChatMessages: (chatId: string) => {
    if (!isSupabaseConfigured() || !chatId) return;

    // Перед подпиской на новый чат отписываемся от предыдущего канала:
    const currentChannel = get().activeChatChannel;
    if (currentChannel) {
      supabase.removeChannel(currentChannel);
      set({ activeChatChannel: null });
    }

    const channelName = `chat_room_${chatId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.chat_id !== chatId) return;

          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMsg.sender_id)
            .maybeSingle();

          const populatedMsg: Message = {
            ...newMsg,
            sender: senderProfile || undefined,
          };

          get().addRealtimeMessage(populatedMsg);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          get().removeRealtimeMessage(payload.old.id);
        }
      )
      .subscribe();

    set({ activeChatChannel: channel });
  },

  unsubscribeFromChatMessages: () => {
    const currentChannel = get().activeChatChannel;
    if (currentChannel) {
      supabase.removeChannel(currentChannel);
      set({ activeChatChannel: null });
    }
  },

  addRealtimeMessage: (newMsg: Message) => {
    set((state) => {
      // Исключаем дублирование: если такое сообщение уже есть в стейте
      if (state.messages.some((m) => m.id === newMsg.id)) {
        return state;
      }

      // Проверяем, не заменяет ли это оптимистичное сообщение
      const optimisticIndex = state.messages.findIndex(
        (m) =>
          m.id.startsWith('temp-') &&
          m.sender_id === newMsg.sender_id &&
          m.chat_id === newMsg.chat_id &&
          (m.content === newMsg.content || m.media_url === newMsg.media_url)
      );

      let nextMessages = [...state.messages];
      if (optimisticIndex !== -1) {
        nextMessages[optimisticIndex] = newMsg;
      } else {
        nextMessages.push(newMsg);
      }

      return {
        messages: nextMessages,
        chats: state.chats.map((c) =>
          c.id === newMsg.chat_id
            ? { ...c, last_message: newMsg, updated_at: newMsg.created_at }
            : c
        ),
      };
    });
  },

  removeRealtimeMessage: (messageId: string) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    }));
  },
}));
