import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/* ============================================================
 *  Enums
 * ========================================================== */

export const reactionType = pgEnum("reaction_type", ["like", "dislike"]);
export const friendStatus = pgEnum("friend_status", ["pending", "accepted"]);
export const relationship = pgEnum("relationship", [
  "single",
  "in_relationship",
  "engaged",
  "married",
  "complicated",
]);
export const messageType = pgEnum("message_type", ["text", "voice"]);
export const channelRole = pgEnum("channel_role", ["owner", "admin", "member"]);
export const attachmentKind = pgEnum("attachment_kind", [
  "image",
  "video",
  "audio",
  "voice",
  "video_note",
  "file",
]);

/* ============================================================
 *  Users
 * ========================================================== */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  status: text("status"), // короткий статус-строка под именем
  city: text("city"),
  birthday: text("birthday"), // ISO-дата YYYY-MM-DD
  relationship: relationship("relationship"),
  // id главной фотографии и обложки (FK задаётся логикой приложения,
  // жёсткий constraint опущен сознательно — иначе цикл users<->photos)
  avatarPhotoId: uuid("avatar_photo_id"),
  coverPhotoId: uuid("cover_photo_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ============================================================
 *  Photos (у пользователя их несколько, одна — главная/аватар)
 * ========================================================== */

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("photos_user_idx").on(t.userId)],
);

/* ============================================================
 *  Music tracks (на профиле пользователя)
 * ========================================================== */

export const tracks = pgTable(
  "tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tracks_user_idx").on(t.userId)],
);

/* ============================================================
 *  Channels (личные каналы) + подписки
 * ========================================================== */

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("channels_owner_idx").on(t.ownerId)],
);

export const channelSubscriptions = pgTable(
  "channel_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: channelRole("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("channel_subscription_unique").on(t.channelId, t.userId),
    index("channel_subscriptions_user_idx").on(t.userId),
  ],
);

/* ============================================================
 *  Posts
 * ========================================================== */

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // если задан — пост принадлежит каналу (не попадает в общую ленту/профиль)
    channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("posts_author_idx").on(t.authorId), index("posts_channel_idx").on(t.channelId)],
);

/* ---- Вложения постов (несколько файлов любого типа) ---- */
export const postAttachments = pgTable(
  "post_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    kind: attachmentKind("kind").notNull(),
    name: text("name"),
    mime: text("mime"),
    size: integer("size"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("post_attachments_post_idx").on(t.postId)],
);

/* ============================================================
 *  Post reactions (лайки/дизлайки) — один юзер = одна реакция на пост
 * ========================================================== */

export const postReactions = pgTable(
  "post_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: reactionType("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("post_reactions_unique").on(t.postId, t.userId)],
);

/* ============================================================
 *  Comments
 * ========================================================== */

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_post_idx").on(t.postId)],
);

/* ---- Реакции на комментарии (эмодзи, один юзер = одна реакция) ---- */
export const commentReactions = pgTable(
  "comment_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("comment_reactions_unique").on(t.commentId, t.userId)],
);

/* ============================================================
 *  Friendships (взаимная дружба через заявки)
 *  requester -> addressee, status: pending | accepted
 *  Взаимность = строка со status='accepted'.
 * ========================================================== */

export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: uuid("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("friendships_pair_unique").on(t.requesterId, t.addresseeId),
    index("friendships_requester_idx").on(t.requesterId),
    index("friendships_addressee_idx").on(t.addresseeId),
  ],
);

/* ============================================================
 *  Messenger: conversations + participants + messages
 * ========================================================== */

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  isGroup: boolean("is_group").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("conversation_participant_unique").on(t.conversationId, t.userId),
    index("conversation_participants_user_idx").on(t.userId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    type: messageType("type").notNull().default("text"),
    audioUrl: text("audio_url"),
    attachmentUrl: text("attachment_url"),
    attachmentKind: attachmentKind("attachment_kind"),
    attachmentName: text("attachment_name"),
    attachmentMime: text("attachment_mime"),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

/* ---- Реакции на сообщения (эмодзи, один юзер = одна реакция) ---- */
export const messageReactions = pgTable(
  "message_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("message_reactions_unique").on(t.messageId, t.userId)],
);

/* ============================================================
 *  Relations (для удобных join-запросов через drizzle query API)
 * ========================================================== */

export const usersRelations = relations(users, ({ many }) => ({
  photos: many(photos),
  posts: many(posts),
  comments: many(comments),
  reactions: many(postReactions),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  user: one(users, { fields: [photos.userId], references: [users.id] }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  reactions: many(postReactions),
  comments: many(comments),
}));

export const postReactionsRelations = relations(postReactions, ({ one }) => ({
  post: one(posts, { fields: [postReactions.postId], references: [posts.id] }),
  user: one(users, { fields: [postReactions.userId], references: [users.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  participants: many(conversationParticipants),
  messages: many(messages),
}));

export const conversationParticipantsRelations = relations(
  conversationParticipants,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationParticipants.conversationId],
      references: [conversations.id],
    }),
    user: one(users, {
      fields: [conversationParticipants.userId],
      references: [users.id],
    }),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}));

/* ============================================================
 *  Type helpers
 * ========================================================== */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Photo = typeof photos.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type PostReaction = typeof postReactions.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type CommentReaction = typeof commentReactions.$inferSelect;
export type MessageReaction = typeof messageReactions.$inferSelect;
export type Track = typeof tracks.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type ChannelSubscription = typeof channelSubscriptions.$inferSelect;
export type PostAttachment = typeof postAttachments.$inferSelect;
export type AttachmentKind = (typeof attachmentKind.enumValues)[number];
