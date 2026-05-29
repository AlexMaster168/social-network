import {
  conversationParticipants,
  conversations,
  db,
  messages,
  users,
} from "@sn/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getAvatarUrls } from "./avatars.js";
import type { Attachment } from "./posts-serialize.js";
import { EMPTY_REACTIONS, getMessageReactions, type ReactionSummary } from "./reactions.js";

export interface ChatMessage {
  id: string;
  conversationId: string;
  content: string;
  attachment: Attachment | null;
  editedAt: Date | null;
  createdAt: Date;
  reactions: ReactionSummary["reactions"];
  myReaction: string | null;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

/** Собирает вложение из полей сообщения (с поддержкой legacy голосовых). */
function buildAttachment(m: {
  attachmentUrl: string | null;
  attachmentKind: Attachment["kind"] | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  type: "text" | "voice";
  audioUrl: string | null;
}): Attachment | null {
  if (m.attachmentUrl && m.attachmentKind) {
    return { url: m.attachmentUrl, kind: m.attachmentKind, name: m.attachmentName, mime: m.attachmentMime };
  }
  if (m.type === "voice" && m.audioUrl) {
    return { url: m.audioUrl, kind: "voice", name: null, mime: "audio/webm" };
  }
  return null;
}

/** Проверяет, что пользователь — участник диалога. */
export async function isParticipant(conversationId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: conversationParticipants.id })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Возвращает id участников диалога. */
export async function getParticipantIds(conversationId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, conversationId));
  return rows.map((r) => r.userId);
}

/** Находит существующий личный диалог двух людей или создаёт новый. */
export async function getOrCreateDirectConversation(
  meId: string,
  otherId: string,
): Promise<string> {
  // ищем диалог, в котором участвуют ровно эти двое
  const candidates = await db
    .select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(inArray(conversationParticipants.userId, [meId, otherId]));

  const counts = new Map<string, number>();
  for (const row of candidates) {
    counts.set(row.conversationId, (counts.get(row.conversationId) ?? 0) + 1);
  }
  for (const [conversationId, count] of counts) {
    if (count === 2) {
      // проверим, что это диалог именно на двоих
      const total = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversationId, conversationId));
      if (total[0]?.c === 2) return conversationId;
    }
  }

  const [conv] = await db.insert(conversations).values({}).returning();
  await db.insert(conversationParticipants).values([
    { conversationId: conv.id, userId: meId },
    { conversationId: conv.id, userId: otherId },
  ]);
  return conv.id;
}

/** Список диалогов пользователя с собеседником и последним сообщением. */
export async function listConversations(meId: string) {
  const myConvs = await db
    .select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, meId));
  const convIds = myConvs.map((r) => r.conversationId);
  if (convIds.length === 0) return [];

  // собеседники (для личных диалогов — второй участник)
  const otherParts = await db
    .select({
      conversationId: conversationParticipants.conversationId,
      userId: conversationParticipants.userId,
    })
    .from(conversationParticipants)
    .where(inArray(conversationParticipants.conversationId, convIds));

  const otherByConv = new Map<string, string>();
  for (const p of otherParts) {
    if (p.userId !== meId) otherByConv.set(p.conversationId, p.userId);
  }

  // последнее сообщение каждого диалога
  const lastMessages = await db
    .select()
    .from(messages)
    .where(inArray(messages.conversationId, convIds))
    .orderBy(desc(messages.createdAt));
  const lastByConv = new Map<string, (typeof lastMessages)[number]>();
  for (const m of lastMessages) {
    if (!lastByConv.has(m.conversationId)) lastByConv.set(m.conversationId, m);
  }

  const otherIds = [...otherByConv.values()];
  const otherUsers = otherIds.length
    ? await db.select().from(users).where(inArray(users.id, otherIds))
    : [];
  const avatarMap = await getAvatarUrls(otherIds);
  const usersById = new Map(otherUsers.map((u) => [u.id, u]));

  return convIds
    .map((conversationId) => {
      const otherId = otherByConv.get(conversationId);
      const other = otherId ? usersById.get(otherId) : undefined;
      const last = lastByConv.get(conversationId);
      return {
        conversationId,
        other: other
          ? {
              id: other.id,
              username: other.username,
              displayName: other.displayName,
              avatarUrl: avatarMap.get(other.id) ?? null,
            }
          : null,
        lastMessage: last
          ? { content: last.content, createdAt: last.createdAt, senderId: last.senderId }
          : null,
      };
    })
    .sort((a, b) => {
      const ta = a.lastMessage?.createdAt?.getTime() ?? 0;
      const tb = b.lastMessage?.createdAt?.getTime() ?? 0;
      return tb - ta;
    });
}

/** История сообщений диалога. */
export async function listMessages(
  conversationId: string,
  viewerId: string,
): Promise<ChatMessage[]> {
  const rows = await db
    .select({ message: messages, sender: users })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  const avatarMap = await getAvatarUrls([...new Set(rows.map((r) => r.sender.id))]);
  const reactionMap = await getMessageReactions(rows.map((r) => r.message.id), viewerId);
  return rows.map(({ message, sender }) => ({
    id: message.id,
    conversationId: message.conversationId,
    content: message.content,
    attachment: buildAttachment(message),
    editedAt: message.editedAt,
    createdAt: message.createdAt,
    ...(reactionMap.get(message.id) ?? EMPTY_REACTIONS),
    sender: {
      id: sender.id,
      username: sender.username,
      displayName: sender.displayName,
      avatarUrl: avatarMap.get(sender.id) ?? null,
    },
  }));
}

/** Создаёт сообщение (текст и/или вложение) и возвращает его в сериализованном виде. */
export async function createMessage(
  conversationId: string,
  senderId: string,
  opts: { content?: string; attachment?: Attachment },
): Promise<ChatMessage> {
  const a = opts.attachment;
  const [msg] = await db
    .insert(messages)
    .values({
      conversationId,
      senderId,
      content: opts.content ?? "",
      attachmentUrl: a?.url ?? null,
      attachmentKind: a?.kind ?? null,
      attachmentName: a?.name ?? null,
      attachmentMime: a?.mime ?? null,
    })
    .returning();
  const [sender] = await db.select().from(users).where(eq(users.id, senderId)).limit(1);
  const avatarMap = await getAvatarUrls([senderId]);
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    content: msg.content,
    attachment: buildAttachment(msg),
    editedAt: msg.editedAt,
    createdAt: msg.createdAt,
    reactions: [],
    myReaction: null,
    sender: {
      id: sender.id,
      username: sender.username,
      displayName: sender.displayName,
      avatarUrl: avatarMap.get(senderId) ?? null,
    },
  };
}

/** Возвращает одно сообщение в сериализованном виде (с реакциями для viewerId). */
export async function getMessage(
  messageId: string,
  viewerId: string,
): Promise<ChatMessage | null> {
  const [row] = await db
    .select({ message: messages, sender: users })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.id, messageId))
    .limit(1);
  if (!row) return null;
  const avatarMap = await getAvatarUrls([row.sender.id]);
  const reactionMap = await getMessageReactions([messageId], viewerId);
  return {
    id: row.message.id,
    conversationId: row.message.conversationId,
    content: row.message.content,
    attachment: buildAttachment(row.message),
    editedAt: row.message.editedAt,
    createdAt: row.message.createdAt,
    ...(reactionMap.get(messageId) ?? EMPTY_REACTIONS),
    sender: {
      id: row.sender.id,
      username: row.sender.username,
      displayName: row.sender.displayName,
      avatarUrl: avatarMap.get(row.sender.id) ?? null,
    },
  };
}
