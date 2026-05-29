export type Relationship =
  | "single"
  | "in_relationship"
  | "engaged"
  | "married"
  | "complicated";

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio: string | null;
  status: string | null;
  city: string | null;
  birthday: string | null;
  relationship: Relationship | null;
  avatarPhotoId: string | null;
  avatarUrl: string | null;
  coverPhotoId: string | null;
  coverUrl: string | null;
  createdAt: string;
}

export interface UserBrief {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Photo {
  id: string;
  userId: string;
  url: string;
  createdAt: string;
}

export type AttachmentKind = "image" | "video" | "audio" | "voice" | "video_note" | "file";

export interface Attachment {
  url: string;
  kind: AttachmentKind;
  name: string | null;
  mime: string | null;
}

export interface Post {
  id: string;
  content: string;
  imageUrl: string | null;
  attachments: Attachment[];
  createdAt: string;
  author: UserBrief & { role?: ChannelRole | null };
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  myReaction: "like" | "dislike" | null;
}

export interface Reaction {
  emoji: string;
  count: number;
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  author: UserBrief;
  reactions: Reaction[];
  myReaction: string | null;
}

export type FriendState = "none" | "friends" | "outgoing" | "incoming";

export interface Track {
  id: string;
  userId: string;
  title: string;
  url: string;
  createdAt: string;
}

export interface ProfileResponse {
  user: User;
  photos: Photo[];
  tracks: Track[];
  friendState: FriendState;
  isMe: boolean;
  counts: { posts: number; friends: number };
}

export type ChannelRole = "owner" | "admin" | "member";

export interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  owner: { id: string; username: string; displayName: string };
  subscribers: number;
  isSubscribed: boolean;
  isOwner: boolean;
  myRole?: ChannelRole | null;
  canManage?: boolean;
  canPost?: boolean;
}

export interface ChannelMember {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: ChannelRole;
}

export interface DiscoverUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  city: string | null;
  relationship: Relationship | null;
  friendState: FriendState;
}

export interface ConversationListItem {
  conversationId: string;
  other: UserBrief | null;
  lastMessage: { content: string; createdAt: string; senderId: string } | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  content: string;
  attachment: Attachment | null;
  editedAt: string | null;
  createdAt: string;
  reactions: Reaction[];
  myReaction: string | null;
  sender: UserBrief;
}
