export type UserRole = 'owner' | 'moderator' | 'user';
export type ChatType = 'direct' | 'group' | 'channel';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  role: UserRole;
  custom_title?: string | null;
  is_verified: boolean;
  has_vozdux_plus: boolean;
  created_at: string;
  last_seen: string;
}

export interface ChatMember {
  id: string;
  chat_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  last_read_at: string;
  profile?: Profile;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  media_url?: string | null;
  media_type?: string | null;
  is_system: boolean;
  created_at: string;
  expires_at: string;
  is_read: boolean;
  sender?: Profile;
}

export interface Chat {
  id: string;
  type: ChatType;
  title?: string | null;
  avatar_url?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  last_message?: Message | null;
  unread_count?: number;
  members?: ChatMember[];
  other_user?: Profile; // Для личных чатов (direct)
}
