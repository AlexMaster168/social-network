import { db, messageReactions, messages, users } from "@sn/db";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  createMessage,
  getMessage,
  getOrCreateDirectConversation,
  getParticipantIds,
  isParticipant,
  listConversations,
  listMessages,
} from "../lib/messaging.js";
import { ALLOWED_EMOJI } from "../lib/reactions.js";
import type { AppEnv } from "../lib/types.js";
import { saveAnyFile, type AttachmentKind } from "../lib/upload.js";
import { broadcastMessage, broadcastToParticipants } from "../ws/hub.js";

export const conversationRoutes = new Hono<AppEnv>();

/* ---- Список диалогов ---- */
conversationRoutes.get("/", async (c) => {
  const me = c.get("userId");
  return c.json({ conversations: await listConversations(me) });
});

/* ---- Открыть (или создать) личный диалог с пользователем ---- */
conversationRoutes.post(
  "/direct",
  zValidator("json", z.object({ userId: z.string().uuid() })),
  async (c) => {
    const me = c.get("userId");
    const { userId: other } = c.req.valid("json");
    if (other === me) return c.json({ error: "Нельзя писать самому себе" }, 400);

    const [exists] = await db.select().from(users).where(eq(users.id, other)).limit(1);
    if (!exists) return c.json({ error: "Пользователь не найден" }, 404);

    const conversationId = await getOrCreateDirectConversation(me, other);
    return c.json({ conversationId });
  },
);

/* ---- История сообщений ---- */
conversationRoutes.get("/:id/messages", async (c) => {
  const me = c.get("userId");
  const conversationId = c.req.param("id");
  if (!(await isParticipant(conversationId, me))) {
    return c.json({ error: "Нет доступа к диалогу" }, 403);
  }
  return c.json({ messages: await listMessages(conversationId, me) });
});

/* ---- Отправить сообщение (REST; также рассылается по WebSocket) ---- */
conversationRoutes.post(
  "/:id/messages",
  zValidator("json", z.object({ content: z.string().min(1).max(4000) })),
  async (c) => {
    const me = c.get("userId");
    const conversationId = c.req.param("id");
    if (!(await isParticipant(conversationId, me))) {
      return c.json({ error: "Нет доступа к диалогу" }, 403);
    }
    const { content } = c.req.valid("json");
    const message = await createMessage(conversationId, me, { content: content.trim() });
    const participantIds = await getParticipantIds(conversationId);
    broadcastMessage(participantIds, message);
    return c.json({ message }, 201);
  },
);

/* ---- Отправить вложение (multipart: file/audio + опц. kind, content) ---- */
conversationRoutes.post("/:id/attachment", async (c) => {
  const me = c.get("userId");
  const conversationId = c.req.param("id");
  if (!(await isParticipant(conversationId, me))) {
    return c.json({ error: "Нет доступа к диалогу" }, 403);
  }
  const body = await c.req.parseBody();
  const file = (body["file"] ?? body["audio"]) as unknown;
  if (!(file instanceof File) || file.size === 0) {
    return c.json({ error: "Не приложен файл" }, 400);
  }
  // явный kind для голосовых/видеосообщений, иначе определяется по mime
  const kindParam = String(body["kind"] ?? "");
  const kindOverride = ["voice", "video_note"].includes(kindParam)
    ? (kindParam as AttachmentKind)
    : undefined;
  const content = String(body["content"] ?? "").trim();

  let saved;
  try {
    saved = await saveAnyFile(file, kindOverride);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Ошибка файла" }, 400);
  }
  const message = await createMessage(conversationId, me, { content, attachment: saved });
  const participantIds = await getParticipantIds(conversationId);
  broadcastMessage(participantIds, message);
  return c.json({ message }, 201);
});

/* ---- Редактировать своё сообщение (только текст) ---- */
conversationRoutes.patch(
  "/messages/:messageId",
  zValidator("json", z.object({ content: z.string().min(1).max(4000) })),
  async (c) => {
    const me = c.get("userId");
    const messageId = c.req.param("messageId");
    const { content } = c.req.valid("json");

    const [msg] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!msg) return c.json({ error: "Сообщение не найдено" }, 404);
    if (msg.senderId !== me) return c.json({ error: "Это не твоё сообщение" }, 403);
    if (msg.type !== "text") return c.json({ error: "Можно редактировать только текст" }, 400);

    await db
      .update(messages)
      .set({ content: content.trim(), editedAt: new Date() })
      .where(eq(messages.id, messageId));

    const updated = await getMessage(messageId, me);
    const participantIds = await getParticipantIds(msg.conversationId);
    const forOthers = updated ? { ...updated, myReaction: null } : updated;
    broadcastToParticipants(participantIds, { type: "message:update", message: forOthers });
    return c.json({ message: updated });
  },
);

/* ---- Удалить своё сообщение ---- */
conversationRoutes.delete("/messages/:messageId", async (c) => {
  const me = c.get("userId");
  const messageId = c.req.param("messageId");
  const [msg] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
  if (!msg) return c.json({ error: "Сообщение не найдено" }, 404);
  if (msg.senderId !== me) return c.json({ error: "Это не твоё сообщение" }, 403);

  await db.delete(messages).where(eq(messages.id, messageId));
  const participantIds = await getParticipantIds(msg.conversationId);
  broadcastToParticipants(participantIds, {
    type: "message:delete",
    messageId,
    conversationId: msg.conversationId,
  });
  return c.json({ ok: true });
});

/* ---- Реакция на сообщение (тоггл эмодзи) ---- */
conversationRoutes.put(
  "/messages/:messageId/reaction",
  zValidator("json", z.object({ emoji: z.enum(ALLOWED_EMOJI) })),
  async (c) => {
    const me = c.get("userId");
    const messageId = c.req.param("messageId");
    const { emoji } = c.req.valid("json");

    const [msg] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!msg) return c.json({ error: "Сообщение не найдено" }, 404);
    if (!(await isParticipant(msg.conversationId, me))) {
      return c.json({ error: "Нет доступа к диалогу" }, 403);
    }

    const [existing] = await db
      .select()
      .from(messageReactions)
      .where(and(eq(messageReactions.messageId, messageId), eq(messageReactions.userId, me)))
      .limit(1);

    if (!existing) {
      await db.insert(messageReactions).values({ messageId, userId: me, emoji });
    } else if (existing.emoji === emoji) {
      await db.delete(messageReactions).where(eq(messageReactions.id, existing.id));
    } else {
      await db.update(messageReactions).set({ emoji }).where(eq(messageReactions.id, existing.id));
    }

    const updated = await getMessage(messageId, me);
    const participantIds = await getParticipantIds(msg.conversationId);
    // другим участникам шлём без myReaction (они мёржат свой локально)
    const forOthers = updated ? { ...updated, myReaction: null } : updated;
    broadcastToParticipants(participantIds, { type: "message:update", message: forOthers });
    return c.json({ message: updated });
  },
);
