import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Chat, Message, Profile, ChatType } from '@/types';
import { useAuthStore } from './useAuthStore';
import { RealtimeChannel } from '@supabase/supabase-js';

// Mock Initial Data for Offline / Demo Mode
const INITIAL_DEMO_CHATS: Chat[] = [
  {
    id: 'chat-saved',
    type: 'saved',
    title: 'Избранное',
    avatar_url: null,
    created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    unread_count: 0,
    last_message: {
      id: 'msg-s1',
      chat_id: 'chat-saved',
      sender_id: 'demo-durov-id',
      content: '⚡ Заметки: релиз Vozduxan Web с оранжевым брендингом и автоудалением 14 дней готов.',
      is_system: false,
      created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      expires_at: new Date(Date.now() + 1000 * 3600 * 24 * 13 + 1000 * 3600 * 23).toISOString(),
      is_read: true,
    },
  },
  {
    id: 'chat-official',
    type: 'channel',
    title: 'Vozduxan Official ⚡',
    avatar_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    unread_count: 1,
    last_message: {
      id: 'msg-o1',
      chat_id: 'chat-official',
      sender_id: 'demo-durov-id',
      content: '🚀 Добро пожаловать в Vozduxan Web! Все сообщения автоматически исчезают ровно через 14 дней, как в Steam.',
      is_system: true,
      created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      expires_at: new Date(Date.now() + 1000 * 3600 * 24 * 13 + 1000 * 3600 * 23).toISOString(),
      is_read: false,
    },
  },
  {
    id: 'chat-nikita',
    type: 'direct',
    title: 'Никита (Архитектор)',
    avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    unread_count: 0,
    other_user: {
      id: 'user-nikita',
      username: 'nikita_dev',
      display_name: 'Никита',
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      bio: 'Разрабатываю Realtime архитектуру на Supabase',
      role: 'moderator',
      custom_title: 'Архитектор сети',
      is_verified: true,
      has_vozdux_plus: true,
      created_at: new Date(Date.now() - 3600000 * 24 * 20).toISOString(),
      last_seen: new Date().toISOString(),
    },
    last_message: {
      id: 'msg-n1',
      chat_id: 'chat-nikita',
      sender_id: 'user-nikita',
      content: 'Оранжевая палитра выглядит потрясающе! PWA установилось без системных рамок на Android.',
      is_system: false,
      created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      expires_at: new Date(Date.now() + 1000 * 3600 * 24 * 13 + 1000 * 3600 * 22).toISOString(),
      is_read: true,
    },
  },
  {
    id: 'chat-devs',
    type: 'group',
    title: 'Vozduxan Core Team 🔥',
    avatar_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=150&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    unread_count: 0,
    last_message: {
      id: 'msg-g1',
      chat_id: 'chat-devs',
      sender_id: 'user-nikita',
      content: 'Панель Создателя «как у Дурова» готова: поиск по юзернейму, выдача Vozdux++, галочки и роли в 1 клик!',
      is_system: false,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      expires_at: new Date(Date.now() + 1000 * 3600 * 24 * 13 + 1000 * 3600 * 18).toISOString(),
      is_read: true,
    },
  },
];

const INITIAL_DEMO_MESSAGES: Record<string, Message[]> = {
  'chat-official': [
    {
      id: 'mo-1',
      chat_id: 'chat-official',
      sender_id: 'demo-durov-id',
      content: 'Добро пожаловать в официальный канал веб-мессенджера Vozduxan!',
      is_system: false,
      created_at: new Date(Date.now() - 1000 * 3600 * 24 * 3).toISOString(),
      expires_at: new Date(Date.now() + 1000 * 3600 * 24 * 11).toISOString(),
      is_read: true,
    },
    {
      id: 'mo-2',
      chat_id: 'chat-official',
      sender_id: 'demo-durov-id',
      content: 'Главные особенности:\n• Авторский оранжевый брендинг (#FF7A00)\n• Автоудаление всех сообщений ровно через 14 дней (как в Steam)\n• Статусы Vozdux++ ⚡, Verified ✅ и роли Создателя 👑\n• PWA режим без рамок браузера',
      is_system: false,
      created_at: new Date(Date.now() - 1000 * 3600 * 24).toISOString(),
      expires_at: new Date(Date.now() + 1000 * 3600 * 24 * 13).toISOString(),
      is_read: true,
    },
    {
      id: 'msg-o1',
      chat_id: 'chat-official',
      sender_id: 'demo-durov-id',
      content: '📢 ОФИЦИАЛЬНОЕ ОПОВЕЩЕНИЕ VOZDUXAN: Сервера запущены. Приятного общения!',
      is_system: true,
      created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      expires_at: new Date(Date.now() + 1000 * 3600 * 24 * 13 + 1000 * 3600 * 23).toISOString(),
      is_read: false,
    },
  ],
  'chat-nikita': [
    {
      id: 'mn-1',
      chat_id: 'chat-nikita',
      sender_id: 'demo-durov-id',
      content: 'Привет, Никита! Как продвигается тестирование PWA на мобильных устройствах?',
      is_system: false,
      created_at: new Date(Date.now() - 1000 * 3600 * 2).toISOString(),
      expires_at: new Date(Date.now() + 1000 * 3600 * 24 * 13 + 1000 * 3600 * 22).toISOString(),
      is_read: true,
    },
    {
      id: 'msg-n1',
      chat_id: 'chat-nikita',
      sender_id: 'user-nikita',
      content: 'Оранжевая палитра выглядит потрясающе! PWA установилось без системных рамок на Android.',
      is_system: false,
      created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      expires_at: new Date(Date.now() + 1000 * 3600 * 24 * 13 + 1000 * 3600 * 22).toISOString(),
      is_read: true,
    },
  ],
  'chat-saved': [
    {
      id: 'msg-s1',
      chat_id: 'chat-saved',
      sender_id: 'demo-durov-id',
      content: '⚡ Заметки: релиз Vozduxan Web с оранжевым брендингом и автоудалением 14 дней готов.',
      is_system: false,
      created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      expires_at: new Date(Date.now() + 1000 * 3600 * 24 * 13 + 1000 * 3600 * 23).toISOString(),
      is_read: true,
    },
  ],
  'chat-devs': [
    {
      id: 'msg-g1',
      chat_id: 'chat-devs',
      sender_id: 'user-nikita',
      content: 'Панель Создателя «как у Дурова» готова: поиск по юзернейму, выдача Vozdux++, галочки и роли в 1 клик!',
      is_system: false,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      expires_at: new Date(Date.now() + 1000 * 3600 * 24 * 13 + 1000 * 3600 * 18).toISOString(),
      is_read: true,
    },
  ],
};

interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  messages: Message[];
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  searchQuery: string;
  activeFilter: 'all' | 'direct' | 'group' | 'channel';
  realtimeSubscription: RealtimeChannel | null;

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
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: INITIAL_DEMO_CHATS,
  activeChatId: 'chat-official',
  messages: INITIAL_DEMO_MESSAGES['chat-official'] || [],
  isLoadingChats: false,
  isLoadingMessages: false,
  searchQuery: '',
  activeFilter: 'all',
  realtimeSubscription: null,

  setActiveChatId: (id) => {
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

    if (!isSupabaseConfigured() || authStore.isDemo || !currentUserId) {
      set({ chats: INITIAL_DEMO_CHATS, isLoadingChats: false });
      return;
    }

    set({ isLoadingChats: true });
    try {
      // Fetch chats where user is a member
      const { data: memberChats, error: memberErr } = await supabase
        .from('chat_members')
        .select(`
          chat_id,
          chats (
            id,
            type,
            title,
            avatar_url,
            created_by,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', currentUserId);

      if (memberErr) throw memberErr;

      const loadedChats: Chat[] = [];

      for (const item of memberChats || []) {
        const rawChat = (item as unknown as { chats: Chat }).chats;
        if (!rawChat) continue;

        // Fetch last message for each chat (not expired)
        const { data: lastMsgs } = await supabase
          .from('messages')
          .select('*, sender:profiles(*)')
          .eq('chat_id', rawChat.id)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1);

        const lastMessage = lastMsgs && lastMsgs.length > 0 ? lastMsgs[0] : null;

        // If direct chat, fetch the other participant's profile
        let otherUser: Profile | undefined = undefined;
        if (rawChat.type === 'direct') {
          const { data: otherMember } = await supabase
            .from('chat_members')
            .select('user_id, profiles(*)')
            .eq('chat_id', rawChat.id)
            .neq('user_id', currentUserId)
            .single();

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

      // Sort by last updated / message
      loadedChats.sort((a, b) => {
        const timeA = new Date(a.last_message?.created_at || a.updated_at).getTime();
        const timeB = new Date(b.last_message?.created_at || b.updated_at).getTime();
        return timeB - timeA;
      });

      if (loadedChats.length > 0) {
        set({ chats: loadedChats });
        if (!get().activeChatId) {
          get().setActiveChatId(loadedChats[0].id);
        }
      } else {
        // Fallback to demo chats if DB has no chats yet
        set({ chats: INITIAL_DEMO_CHATS });
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
      set({ chats: INITIAL_DEMO_CHATS });
    } finally {
      set({ isLoadingChats: false });
    }
  },

  fetchMessages: async (chatId: string) => {
    const authStore = useAuthStore.getState();

    if (!isSupabaseConfigured() || authStore.isDemo) {
      const demoMsgs = INITIAL_DEMO_MESSAGES[chatId] || [];
      set({ messages: demoMsgs, isLoadingMessages: false });
      return;
    }

    set({ isLoadingMessages: true });
    try {
      const nowIso = new Date().toISOString();
      // Only fetch messages that haven't expired (TTL 14 days)
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
      set({ messages: INITIAL_DEMO_MESSAGES[chatId] || [] });
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: async (chatId: string, content: string, mediaUrl?: string, mediaType?: string) => {
    const authStore = useAuthStore.getState();
    const currentUser = authStore.user;
    const currentProfile = authStore.profile;

    if (!currentUser && !authStore.isDemo) return;

    // Steam-like 14 days TTL expiration
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      chat_id: chatId,
      sender_id: currentUser?.id || 'demo-durov-id',
      content: content.trim() || null,
      media_url: mediaUrl || null,
      media_type: mediaType || null,
      is_system: false,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      is_read: false,
      sender: currentProfile || undefined,
    };

    // Optimistic UI update
    set((state) => ({
      messages: [...state.messages, optimisticMessage],
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, last_message: optimisticMessage, updated_at: optimisticMessage.created_at } : c
      ),
    }));

    if (!isSupabaseConfigured() || authStore.isDemo) {
      // Store in memory demo messages
      if (!INITIAL_DEMO_MESSAGES[chatId]) {
        INITIAL_DEMO_MESSAGES[chatId] = [];
      }
      INITIAL_DEMO_MESSAGES[chatId].push(optimisticMessage);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: currentUser!.id,
          content: content.trim() || null,
          media_url: mediaUrl || null,
          media_type: mediaType || null,
          expires_at: expiresAt,
        })
        .select('*, sender:profiles(*)')
        .single();

      if (error) throw error;

      // Replace optimistic message with actual DB record
      set((state) => ({
        messages: state.messages.map((m) => (m.id === optimisticMessage.id ? data : m)),
      }));

      // Update chat updated_at
      await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  },

  deleteMessage: async (messageId: string) => {
    const authStore = useAuthStore.getState();

    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    }));

    if (!isSupabaseConfigured() || authStore.isDemo) return;

    try {
      await supabase.from('messages').delete().eq('id', messageId);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  },

  createDirectChat: async (targetUser: Profile) => {
    const authStore = useAuthStore.getState();
    const currentUserId = authStore.user?.id;

    if (!isSupabaseConfigured() || authStore.isDemo || !currentUserId) {
      // Create local demo chat
      const demoId = `chat-direct-${targetUser.username}`;
      const newChat: Chat = {
        id: demoId,
        type: 'direct',
        title: targetUser.display_name,
        avatar_url: targetUser.avatar_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        other_user: targetUser,
        unread_count: 0,
      };

      set((state) => ({
        chats: [newChat, ...state.chats],
        activeChatId: demoId,
      }));
      return demoId;
    }

    try {
      // 1. Create chat
      const { data: newChat, error: chatErr } = await supabase
        .from('chats')
        .insert({ type: 'direct', created_by: currentUserId })
        .select()
        .single();

      if (chatErr) throw chatErr;

      // 2. Add members
      await supabase.from('chat_members').insert([
        { chat_id: newChat.id, user_id: currentUserId, role: 'owner' },
        { chat_id: newChat.id, user_id: targetUser.id, role: 'member' },
      ]);

      await get().fetchChats();
      set({ activeChatId: newChat.id });
      return newChat.id;
    } catch (err) {
      console.error('Error creating direct chat:', err);
      return null;
    }
  },

  createGroupChat: async (title: string, memberIds: string[]) => {
    const authStore = useAuthStore.getState();
    const currentUserId = authStore.user?.id;

    if (!isSupabaseConfigured() || authStore.isDemo || !currentUserId) {
      const demoId = `chat-group-${Date.now()}`;
      const newChat: Chat = {
        id: demoId,
        type: 'group',
        title,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        unread_count: 0,
      };
      set((state) => ({
        chats: [newChat, ...state.chats],
        activeChatId: demoId,
      }));
      return demoId;
    }

    try {
      const { data: newChat, error: chatErr } = await supabase
        .from('chats')
        .insert({ type: 'group', title, created_by: currentUserId })
        .select()
        .single();

      if (chatErr) throw chatErr;

      const membersToInsert = [
        { chat_id: newChat.id, user_id: currentUserId, role: 'owner' },
        ...memberIds.map((uid) => ({ chat_id: newChat.id, user_id: uid, role: 'member' as const })),
      ];

      await supabase.from('chat_members').insert(membersToInsert);

      await get().fetchChats();
      set({ activeChatId: newChat.id });
      return newChat.id;
    } catch (err) {
      console.error('Error creating group chat:', err);
      return null;
    }
  },

  broadcastAnnouncement: async (text: string) => {
    const authStore = useAuthStore.getState();

    if (!isSupabaseConfigured() || authStore.isDemo) {
      // In demo mode, broadcast to all demo chats
      const sysMsg: Message = {
        id: `sys-${Date.now()}`,
        chat_id: '',
        sender_id: 'demo-durov-id',
        content: `📢 ОФИЦИАЛЬНОЕ ОПОВЕЩЕНИЕ VOZDUXAN: ${text}`,
        is_system: true,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
        is_read: false,
      };

      set((state) => {
        const updatedChats = state.chats.map((c) => ({
          ...c,
          last_message: { ...sysMsg, chat_id: c.id },
        }));
        return {
          chats: updatedChats,
          messages: state.activeChatId ? [...state.messages, { ...sysMsg, chat_id: state.activeChatId }] : state.messages,
        };
      });

      return { success: true };
    }

    try {
      const { error } = await supabase.rpc('broadcast_global_announcement', {
        announcement_text: text,
      });

      if (error) throw error;
      await get().fetchChats();
      if (get().activeChatId) {
        await get().fetchMessages(get().activeChatId!);
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Ошибка отправки' };
    }
  },

  subscribeToRealtime: () => {
    if (!isSupabaseConfigured()) return;

    // Clean up existing subscription
    get().unsubscribeFromRealtime();

    const channel = supabase
      .channel('realtime_vozduxan')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const newMsg = payload.new as Message;
          const { activeChatId } = get();

          // Fetch sender details
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMsg.sender_id)
            .single();

          const populatedMsg: Message = {
            ...newMsg,
            sender: senderProfile || undefined,
          };

          // If message belongs to active chat, add to view
          if (activeChatId && newMsg.chat_id === activeChatId) {
            set((state) => {
              if (state.messages.some((m) => m.id === newMsg.id)) return state;
              return { messages: [...state.messages, populatedMsg] };
            });
          }

          // Update last message in chat list
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
          set((state) => ({
            messages: state.messages.filter((m) => m.id !== deletedId),
          }));
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
}));
