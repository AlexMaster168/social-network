import { channelSubscriptions, channels, db, posts, users } from "@sn/db";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getAvatarUrls } from "../lib/avatars.js";
import { serializePosts } from "../lib/posts-serialize.js";
import type { AppEnv } from "../lib/types.js";
import { saveImage, savePostAttachments } from "../lib/upload.js";
import { parsePostInput } from "./posts.js";

export const channelRoutes = new Hono<AppEnv>();

type Role = "owner" | "admin" | "member";

/** Роль пользователя в канале (null — не участник). */
async function getRole(channelId: string, userId: string): Promise<Role | null> {
  const [row] = await db
    .select({ role: channelSubscriptions.role })
    .from(channelSubscriptions)
    .where(
      and(
        eq(channelSubscriptions.channelId, channelId),
        eq(channelSubscriptions.userId, userId),
      ),
    )
    .limit(1);
  return (row?.role as Role) ?? null;
}
const canManage = (r: Role | null) => r === "owner" || r === "admin";
const canPost = (r: Role | null) => r === "owner" || r === "admin";

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "channel";
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let i = 1;
  while ((await db.select({ id: channels.id }).from(channels).where(eq(channels.slug, slug))).length) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

/** Каталог каналов с количеством подписчиков и флагом подписки. */
channelRoutes.get("/", async (c) => {
  const me = c.get("userId");
  const rows = await db
    .select({
      channel: channels,
      owner: users,
      subscribers: sql<number>`count(${channelSubscriptions.id})::int`,
    })
    .from(channels)
    .innerJoin(users, eq(channels.ownerId, users.id))
    .leftJoin(channelSubscriptions, eq(channelSubscriptions.channelId, channels.id))
    .groupBy(channels.id, users.id)
    .orderBy(desc(channels.createdAt));

  const mySubs = await db
    .select({ channelId: channelSubscriptions.channelId })
    .from(channelSubscriptions)
    .where(eq(channelSubscriptions.userId, me));
  const subSet = new Set(mySubs.map((s) => s.channelId));

  return c.json({
    channels: rows.map((r) => ({
      id: r.channel.id,
      name: r.channel.name,
      slug: r.channel.slug,
      description: r.channel.description,
      imageUrl: r.channel.imageUrl,
      owner: { id: r.owner.id, username: r.owner.username, displayName: r.owner.displayName },
      subscribers: r.subscribers,
      isSubscribed: subSet.has(r.channel.id),
      isOwner: r.channel.ownerId === me,
    })),
  });
});

/** Создать канал. */
channelRoutes.post(
  "/",
  zValidator(
    "json",
    z.object({ name: z.string().min(2).max(60), description: z.string().max(300).optional() }),
  ),
  async (c) => {
    const me = c.get("userId");
    const { name, description } = c.req.valid("json");
    const slug = await uniqueSlug(name);
    const [channel] = await db
      .insert(channels)
      .values({ ownerId: me, name, slug, description: description ?? null })
      .returning();
    // владелец автоматически участник с ролью owner
    await db
      .insert(channelSubscriptions)
      .values({ channelId: channel.id, userId: me, role: "owner" });
    return c.json({ channel }, 201);
  },
);

/** Инфо о канале по slug. */
channelRoutes.get("/:slug", async (c) => {
  const me = c.get("userId");
  const slug = c.req.param("slug");
  const [row] = await db
    .select({ channel: channels, owner: users })
    .from(channels)
    .innerJoin(users, eq(channels.ownerId, users.id))
    .where(eq(channels.slug, slug))
    .limit(1);
  if (!row) return c.json({ error: "Канал не найден" }, 404);

  const [{ c: subscribers }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(channelSubscriptions)
    .where(eq(channelSubscriptions.channelId, row.channel.id));
  const myRole = await getRole(row.channel.id, me);

  return c.json({
    channel: {
      id: row.channel.id,
      name: row.channel.name,
      slug: row.channel.slug,
      description: row.channel.description,
      imageUrl: row.channel.imageUrl,
      owner: { id: row.owner.id, username: row.owner.username, displayName: row.owner.displayName },
      subscribers,
      isSubscribed: myRole !== null,
      isOwner: row.channel.ownerId === me,
      myRole,
      canManage: canManage(myRole),
      canPost: canPost(myRole),
    },
  });
});

/** Список участников канала с ролями. */
channelRoutes.get("/:id/members", async (c) => {
  const me = c.get("userId");
  const channelId = c.req.param("id");
  if (!(await getRole(channelId, me))) {
    return c.json({ error: "Нет доступа" }, 403);
  }
  const rows = await db
    .select({
      userId: channelSubscriptions.userId,
      role: channelSubscriptions.role,
      username: users.username,
      displayName: users.displayName,
    })
    .from(channelSubscriptions)
    .innerJoin(users, eq(channelSubscriptions.userId, users.id))
    .where(eq(channelSubscriptions.channelId, channelId));
  const avatarMap = await getAvatarUrls(rows.map((r) => r.userId));
  const order: Record<string, number> = { owner: 0, admin: 1, member: 2 };
  return c.json({
    members: rows
      .map((r) => ({
        id: r.userId,
        username: r.username,
        displayName: r.displayName,
        avatarUrl: avatarMap.get(r.userId) ?? null,
        role: r.role,
      }))
      .sort((a, b) => order[a.role] - order[b.role]),
  });
});

/** Добавить участника (owner/admin). Роль admin может назначать только owner. */
channelRoutes.post(
  "/:id/members",
  zValidator(
    "json",
    z.object({ userId: z.string().uuid(), role: z.enum(["member", "admin"]).optional() }),
  ),
  async (c) => {
    const me = c.get("userId");
    const channelId = c.req.param("id");
    const { userId, role = "member" } = c.req.valid("json");

    const myRole = await getRole(channelId, me);
    if (!canManage(myRole)) return c.json({ error: "Недостаточно прав" }, 403);
    if (role === "admin" && myRole !== "owner") {
      return c.json({ error: "Назначать админов может только владелец" }, 403);
    }
    const [exists] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!exists) return c.json({ error: "Пользователь не найден" }, 404);

    await db
      .insert(channelSubscriptions)
      .values({ channelId, userId, role })
      .onConflictDoUpdate({
        target: [channelSubscriptions.channelId, channelSubscriptions.userId],
        set: { role },
      });
    return c.json({ ok: true });
  },
);

/** Сменить роль участника (только owner). Нельзя менять владельца. */
channelRoutes.patch(
  "/:id/members/:userId",
  zValidator("json", z.object({ role: z.enum(["admin", "member"]) })),
  async (c) => {
    const me = c.get("userId");
    const channelId = c.req.param("id");
    const userId = c.req.param("userId");
    const { role } = c.req.valid("json");

    if ((await getRole(channelId, me)) !== "owner") {
      return c.json({ error: "Менять роли может только владелец" }, 403);
    }
    const targetRole = await getRole(channelId, userId);
    if (!targetRole) return c.json({ error: "Участник не найден" }, 404);
    if (targetRole === "owner") return c.json({ error: "Нельзя менять роль владельца" }, 400);

    await db
      .update(channelSubscriptions)
      .set({ role })
      .where(
        and(
          eq(channelSubscriptions.channelId, channelId),
          eq(channelSubscriptions.userId, userId),
        ),
      );
    return c.json({ ok: true });
  },
);

/** Удалить участника. owner — любого (кроме owner); admin — только member. */
channelRoutes.delete("/:id/members/:userId", async (c) => {
  const me = c.get("userId");
  const channelId = c.req.param("id");
  const userId = c.req.param("userId");

  const myRole = await getRole(channelId, me);
  if (!canManage(myRole)) return c.json({ error: "Недостаточно прав" }, 403);
  const targetRole = await getRole(channelId, userId);
  if (!targetRole) return c.json({ error: "Участник не найден" }, 404);
  if (targetRole === "owner") return c.json({ error: "Нельзя удалить владельца" }, 400);
  if (myRole === "admin" && targetRole === "admin") {
    return c.json({ error: "Админ не может удалять других админов" }, 403);
  }

  await db
    .delete(channelSubscriptions)
    .where(
      and(
        eq(channelSubscriptions.channelId, channelId),
        eq(channelSubscriptions.userId, userId),
      ),
    );
  return c.json({ ok: true });
});

/** Посты канала. */
channelRoutes.get("/:slug/posts", async (c) => {
  const me = c.get("userId");
  const slug = c.req.param("slug");
  const [channel] = await db.select().from(channels).where(eq(channels.slug, slug)).limit(1);
  if (!channel) return c.json({ error: "Канал не найден" }, 404);

  const rows = await db
    .select({ post: posts, author: users })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.channelId, channel.id))
    .orderBy(desc(posts.createdAt));
  const feed = await serializePosts(rows, me);

  // приклеиваем роль каждого автора в этом канале
  const authorIds = [...new Set(feed.map((p) => p.author.id))];
  if (authorIds.length) {
    const roleRows = await db
      .select({ userId: channelSubscriptions.userId, role: channelSubscriptions.role })
      .from(channelSubscriptions)
      .where(
        and(
          eq(channelSubscriptions.channelId, channel.id),
          inArray(channelSubscriptions.userId, authorIds),
        ),
      );
    const roleMap = new Map(roleRows.map((r) => [r.userId, r.role]));
    for (const p of feed) p.author.role = roleMap.get(p.author.id) ?? null;
  }
  return c.json({ posts: feed });
});

/** Создать пост в канал (только владелец). */
channelRoutes.post("/:id/posts", async (c) => {
  const me = c.get("userId");
  const channelId = c.req.param("id");
  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
  if (!channel) return c.json({ error: "Канал не найден" }, 404);
  if (!canPost(await getRole(channelId, me))) {
    return c.json({ error: "Постить могут только владелец и админы" }, 403);
  }

  const { content, files } = await parsePostInput(c);
  if (!content && files.length === 0) return c.json({ error: "Пост не может быть пустым" }, 400);

  const [post] = await db
    .insert(posts)
    .values({ authorId: me, channelId, content })
    .returning();
  try {
    await savePostAttachments(post.id, files);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Ошибка загрузки" }, 400);
  }
  const [author] = await db.select().from(users).where(eq(users.id, me)).limit(1);
  const [serialized] = await serializePosts([{ post, author }], me);
  return c.json({ post: serialized }, 201);
});

/** Подписаться. */
channelRoutes.post("/:id/subscribe", async (c) => {
  const me = c.get("userId");
  const channelId = c.req.param("id");
  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
  if (!channel) return c.json({ error: "Канал не найден" }, 404);
  await db
    .insert(channelSubscriptions)
    .values({ channelId, userId: me })
    .onConflictDoNothing();
  return c.json({ ok: true, isSubscribed: true });
});

/** Отписаться. */
channelRoutes.delete("/:id/subscribe", async (c) => {
  const me = c.get("userId");
  const channelId = c.req.param("id");
  await db
    .delete(channelSubscriptions)
    .where(
      and(eq(channelSubscriptions.channelId, channelId), eq(channelSubscriptions.userId, me)),
    );
  return c.json({ ok: true, isSubscribed: false });
});

/** Редактировать канал (название/описание) — owner/admin. */
channelRoutes.patch(
  "/:id",
  zValidator(
    "json",
    z.object({
      name: z.string().min(2).max(60).optional(),
      description: z.string().max(300).nullable().optional(),
    }),
  ),
  async (c) => {
    const me = c.get("userId");
    const channelId = c.req.param("id");
    if (!canManage(await getRole(channelId, me))) {
      return c.json({ error: "Недостаточно прав" }, 403);
    }
    const patch = c.req.valid("json");
    const [updated] = await db
      .update(channels)
      .set(patch)
      .where(eq(channels.id, channelId))
      .returning();
    return c.json({ channel: updated });
  },
);

/** Загрузить картинку канала — owner/admin. */
channelRoutes.post("/:id/image", async (c) => {
  const me = c.get("userId");
  const channelId = c.req.param("id");
  if (!canManage(await getRole(channelId, me))) {
    return c.json({ error: "Недостаточно прав" }, 403);
  }
  const body = await c.req.parseBody();
  const file = body["image"];
  if (!(file instanceof File) || file.size === 0) {
    return c.json({ error: "Не приложена картинка" }, 400);
  }
  let saved;
  try {
    saved = await saveImage(file);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Ошибка" }, 400);
  }
  await db.update(channels).set({ imageUrl: saved.url }).where(eq(channels.id, channelId));
  return c.json({ ok: true, imageUrl: saved.url });
});

/** Удалить канал (только владелец). */
channelRoutes.delete("/:id", async (c) => {
  const me = c.get("userId");
  const channelId = c.req.param("id");
  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
  if (!channel) return c.json({ error: "Канал не найден" }, 404);
  if (channel.ownerId !== me) return c.json({ error: "Это не твой канал" }, 403);
  await db.delete(channels).where(eq(channels.id, channelId));
  return c.json({ ok: true });
});
