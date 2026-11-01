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
  chats: [],
  activeChatId: null,
  messages: [],
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

      // Steam TTL: Only load messages whose 14-day lifetime has not expired
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

    // Steam-like 14 days TTL expiration
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

    if (!isSupabaseConfigured() || !currentUserId) return null;

    try {
      // 1. Check if direct chat already exists between these two users
      const { data: existingMemberships } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', currentUserId);

      if (existingMemberships && existingMemberships.length > 0) {
        const chatIds = existingMemberships.map((m) => m.chat_id);

        const { data: sharedChat } = await supabase
          .from('chat_members')
          .select('chat_id, chats!inner(type)')
          .in('chat_id', chatIds)
          .eq('user_id', targetUser.id)
          .eq('chats.type', 'direct')
          .maybeSingle();

        if (sharedChat) {
          set({ activeChatId: sharedChat.chat_id });
          await get().fetchMessages(sharedChat.chat_id);
          return sharedChat.chat_id;
        }
      }

      // 2. Create new direct chat
      const { data: newChat, error: chatErr } = await supabase
        .from('chats')
        .insert({ type: 'direct', created_by: currentUserId })
        .select()
        .single();

      if (chatErr) throw chatErr;

      // 3. Add both members
      await supabase.from('chat_members').insert([
        { chat_id: newChat.id, user_id: currentUserId, role: 'owner' },
        { chat_id: newChat.id, user_id: targetUser.id, role: 'member' },
      ]);

      await get().fetchChats();
      set({ activeChatId: newChat.id });
      await get().fetchMessages(newChat.id);
      return newChat.id;
    } catch (err) {
      console.error('Error creating direct chat:', err);
      return null;
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

      await get().fetchChats();
      set({ activeChatId: newChat.id });
      await get().fetchMessages(newChat.id);
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
      .channel('vozduxan_realtime_stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const newMsg = payload.new as Message;
          const { activeChatId } = get();

          // Fetch sender profile info
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMsg.sender_id)
            .single();

          const populatedMsg: Message = {
            ...newMsg,
            sender: senderProfile || undefined,
          };

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
