import { commentReactions, comments, db, postReactions, posts, users } from "@sn/db";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, isNull } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { getAvatarUrls } from "../lib/avatars.js";
import { serializePosts } from "../lib/posts-serialize.js";
import {
  ALLOWED_EMOJI,
  EMPTY_REACTIONS,
  getCommentReactions,
} from "../lib/reactions.js";
import type { AppEnv } from "../lib/types.js";
import { savePostAttachments } from "../lib/upload.js";

/** Собирает File[] из multipart-полей files/file/image. */
export function collectFiles(body: Record<string, unknown>): File[] {
  const out: File[] = [];
  for (const key of ["files", "file", "image"]) {
    const v = body[key];
    if (Array.isArray(v)) out.push(...v.filter((x): x is File => x instanceof File));
    else if (v instanceof File) out.push(v);
  }
  return out;
}

/** Парсит тело запроса поста (multipart или json) -> { content, files }. */
export async function parsePostInput(
  c: Context<AppEnv>,
): Promise<{ content: string; files: File[] }> {
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody({ all: true });
    return { content: String(body["content"] ?? "").trim(), files: collectFiles(body) };
  }
  const json = await c.req.json().catch(() => ({}));
  return { content: String(json.content ?? "").trim(), files: [] };
}

const emojiSchema = z.object({ emoji: z.enum(ALLOWED_EMOJI) });

export const postRoutes = new Hono<AppEnv>();

/* ---- Лента: все посты, по убыванию даты ---- */
postRoutes.get("/", async (c) => {
  const me = c.get("userId");
  const limit = Math.min(Number(c.req.query("limit") ?? 30), 100);
  const offset = Number(c.req.query("offset") ?? 0);
  const authorUsername = c.req.query("author"); // опциональный фильтр по автору

  // только личные посты (канальные показываются на странице канала)
  const conditions = [isNull(posts.channelId)];
  if (authorUsername) conditions.push(eq(users.username, authorUsername));

  const rows = await db
    .select({ post: posts, author: users })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);

  const feed = await serializePosts(rows, me);
  return c.json({ posts: feed });
});

/* ---- Создать пост (текст + опц. картинка multipart) ---- */
postRoutes.post("/", async (c) => {
  const me = c.get("userId");
  const { content, files } = await parsePostInput(c);

  if (!content && files.length === 0) {
    return c.json({ error: "Пост не может быть пустым" }, 400);
  }

  const [post] = await db.insert(posts).values({ authorId: me, content }).returning();

  try {
    await savePostAttachments(post.id, files);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Ошибка загрузки файла" }, 400);
  }

  const [author] = await db.select().from(users).where(eq(users.id, me)).limit(1);
  const [serialized] = await serializePosts([{ post, author }], me);
  return c.json({ post: serialized }, 201);
});

/* ---- Один пост ---- */
postRoutes.get("/:id", async (c) => {
  const me = c.get("userId");
  const id = c.req.param("id");
  const [row] = await db
    .select({ post: posts, author: users })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, id))
    .limit(1);
  if (!row) return c.json({ error: "Пост не найден" }, 404);
  const [serialized] = await serializePosts([row], me);
  return c.json({ post: serialized });
});

/* ---- Удалить свой пост ---- */
postRoutes.delete("/:id", async (c) => {
  const me = c.get("userId");
  const id = c.req.param("id");
  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!post) return c.json({ error: "Пост не найден" }, 404);
  if (post.authorId !== me) return c.json({ error: "Это не твой пост" }, 403);
  await db.delete(posts).where(eq(posts.id, id));
  return c.json({ ok: true });
});

/* ---- Лайк/дизлайк (toggle) ---- */
postRoutes.put(
  "/:id/reaction",
  zValidator("json", z.object({ type: z.enum(["like", "dislike"]) })),
  async (c) => {
    const me = c.get("userId");
    const postId = c.req.param("id");
    const { type } = c.req.valid("json");

    const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
    if (!post) return c.json({ error: "Пост не найден" }, 404);

    const [existing] = await db
      .select()
      .from(postReactions)
      .where(and(eq(postReactions.postId, postId), eq(postReactions.userId, me)))
      .limit(1);

    if (!existing) {
      await db.insert(postReactions).values({ postId, userId: me, type });
    } else if (existing.type === type) {
      // повторный клик той же реакцией — снимаем
      await db.delete(postReactions).where(eq(postReactions.id, existing.id));
    } else {
      // меняем лайк <-> дизлайк
      await db
        .update(postReactions)
        .set({ type })
        .where(eq(postReactions.id, existing.id));
    }

    // вернём свежие агрегаты
    const [row] = await db
      .select({ post: posts, author: users })
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.id, postId))
      .limit(1);
    const [serialized] = await serializePosts([row], me);
    return c.json({ post: serialized });
  },
);

/* ---- Комментарии поста ---- */
postRoutes.get("/:id/comments", async (c) => {
  const me = c.get("userId");
  const postId = c.req.param("id");
  const rows = await db
    .select({ comment: comments, author: users })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(comments.createdAt);

  const avatarMap = await getAvatarUrls([...new Set(rows.map((r) => r.author.id))]);
  const reactionMap = await getCommentReactions(rows.map((r) => r.comment.id), me);
  return c.json({
    comments: rows.map(({ comment, author }) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      editedAt: comment.editedAt,
      author: {
        id: author.id,
        username: author.username,
        displayName: author.displayName,
        avatarUrl: avatarMap.get(author.id) ?? null,
      },
      ...(reactionMap.get(comment.id) ?? EMPTY_REACTIONS),
    })),
  });
});

postRoutes.post(
  "/:id/comments",
  zValidator("json", z.object({ content: z.string().min(1).max(2000) })),
  async (c) => {
    const me = c.get("userId");
    const postId = c.req.param("id");
    const { content } = c.req.valid("json");

    const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
    if (!post) return c.json({ error: "Пост не найден" }, 404);

    const [comment] = await db
      .insert(comments)
      .values({ postId, authorId: me, content })
      .returning();
    const [author] = await db.select().from(users).where(eq(users.id, me)).limit(1);
    const avatarMap = await getAvatarUrls([me]);

    return c.json(
      {
        comment: {
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt,
          editedAt: comment.editedAt,
          author: {
            id: author.id,
            username: author.username,
            displayName: author.displayName,
            avatarUrl: avatarMap.get(me) ?? null,
          },
          reactions: [],
          myReaction: null,
        },
      },
      201,
    );
  },
);

/* ---- Редактировать свой комментарий ---- */
postRoutes.patch(
  "/comments/:commentId",
  zValidator("json", z.object({ content: z.string().min(1).max(2000) })),
  async (c) => {
    const me = c.get("userId");
    const commentId = c.req.param("commentId");
    const { content } = c.req.valid("json");
    const [comment] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
    if (!comment) return c.json({ error: "Комментарий не найден" }, 404);
    if (comment.authorId !== me) return c.json({ error: "Это не твой комментарий" }, 403);
    const [updated] = await db
      .update(comments)
      .set({ content, editedAt: new Date() })
      .where(eq(comments.id, commentId))
      .returning();
    return c.json({ ok: true, content: updated.content, editedAt: updated.editedAt });
  },
);

/* ---- Реакция на комментарий (тоггл эмодзи) ---- */
postRoutes.put("/comments/:commentId/reaction", zValidator("json", emojiSchema), async (c) => {
  const me = c.get("userId");
  const commentId = c.req.param("commentId");
  const { emoji } = c.req.valid("json");

  const [comment] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
  if (!comment) return c.json({ error: "Комментарий не найден" }, 404);

  const [existing] = await db
    .select()
    .from(commentReactions)
    .where(and(eq(commentReactions.commentId, commentId), eq(commentReactions.userId, me)))
    .limit(1);

  if (!existing) {
    await db.insert(commentReactions).values({ commentId, userId: me, emoji });
  } else if (existing.emoji === emoji) {
    await db.delete(commentReactions).where(eq(commentReactions.id, existing.id));
  } else {
    await db.update(commentReactions).set({ emoji }).where(eq(commentReactions.id, existing.id));
  }

  const map = await getCommentReactions([commentId], me);
  return c.json(map.get(commentId) ?? EMPTY_REACTIONS);
});

postRoutes.delete("/comments/:commentId", async (c) => {
  const me = c.get("userId");
  const commentId = c.req.param("commentId");
  const [comment] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  if (!comment) return c.json({ error: "Комментарий не найден" }, 404);
  if (comment.authorId !== me) return c.json({ error: "Это не твой комментарий" }, 403);
  await db.delete(comments).where(eq(comments.id, commentId));
  return c.json({ ok: true });
});
