import { db, friendships, photos, posts, tracks, users } from "@sn/db";
import { zValidator } from "@hono/zod-validator";
import { and, eq, gte, ilike, isNull, lte, ne, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getAvatarUrl, getPhotoUrl } from "../lib/avatars.js";
import { getFriendState } from "../lib/friendship.js";
import { publicUser } from "../lib/serialize.js";
import type { AppEnv } from "../lib/types.js";
import { MAX_TRACK_BYTES, saveAudio, saveImage } from "../lib/upload.js";

export const userRoutes = new Hono<AppEnv>();

/* ---- Поиск людей ---- */
userRoutes.get("/search", async (c) => {
  const me = c.get("userId");
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 1) return c.json({ users: [] });

  const found = await db
    .select()
    .from(users)
    .where(
      and(
        ne(users.id, me),
        or(ilike(users.username, `%${q}%`), ilike(users.displayName, `%${q}%`)),
      ),
    )
    .limit(20);

  const result = await Promise.all(
    found.map(async (u) => publicUser(u, await getAvatarUrl(u.id))),
  );
  return c.json({ users: result });
});

/* ---- Расширенный поиск людей с фильтрами ---- */
function isoMinusYears(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

userRoutes.get("/discover/search", async (c) => {
  const me = c.get("userId");
  const q = (c.req.query("q") ?? "").trim();
  const city = (c.req.query("city") ?? "").trim();
  const rel = (c.req.query("relationship") ?? "").trim();
  const ageMin = c.req.query("ageMin") ? Number(c.req.query("ageMin")) : null;
  const ageMax = c.req.query("ageMax") ? Number(c.req.query("ageMax")) : null;

  const conditions = [ne(users.id, me)];
  if (q) {
    conditions.push(or(ilike(users.username, `%${q}%`), ilike(users.displayName, `%${q}%`))!);
  }
  if (city) conditions.push(ilike(users.city, `%${city}%`));
  if (rel && ["single", "in_relationship", "engaged", "married", "complicated"].includes(rel)) {
    conditions.push(eq(users.relationship, rel as never));
  }
  // возраст: birthday в формате YYYY-MM-DD сравнивается лексикографически
  if (ageMin !== null && !Number.isNaN(ageMin)) {
    conditions.push(lte(users.birthday, isoMinusYears(ageMin)));
  }
  if (ageMax !== null && !Number.isNaN(ageMax)) {
    conditions.push(gte(users.birthday, isoMinusYears(ageMax + 1)));
  }

  const found = await db
    .select()
    .from(users)
    .where(and(...conditions))
    .limit(40);

  const result = await Promise.all(
    found.map(async (u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: await getAvatarUrl(u.id),
      city: u.city,
      relationship: u.relationship,
      friendState: await getFriendState(me, u.id),
    })),
  );
  return c.json({ users: result });
});

/* ---- Обновить свой профиль ---- */
const updateSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  bio: z.string().max(500).nullable().optional(),
  status: z.string().max(140).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
    .nullable()
    .optional(),
  relationship: z
    .enum(["single", "in_relationship", "engaged", "married", "complicated"])
    .nullable()
    .optional(),
});

userRoutes.patch("/me", zValidator("json", updateSchema), async (c) => {
  const me = c.get("userId");
  const patch = c.req.valid("json");
  const [updated] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, me))
    .returning();
  return c.json({
    user: publicUser(
      updated,
      await getAvatarUrl(me),
      await getPhotoUrl(updated.coverPhotoId),
    ),
  });
});

/* ---- Выбрать обложку профиля ---- */
userRoutes.patch(
  "/me/cover",
  zValidator("json", z.object({ photoId: z.string().uuid().nullable() })),
  async (c) => {
    const me = c.get("userId");
    const { photoId } = c.req.valid("json");
    if (photoId) {
      const [photo] = await db
        .select()
        .from(photos)
        .where(and(eq(photos.id, photoId), eq(photos.userId, me)))
        .limit(1);
      if (!photo) return c.json({ error: "Фото не найдено" }, 404);
    }
    await db
      .update(users)
      .set({ coverPhotoId: photoId, updatedAt: new Date() })
      .where(eq(users.id, me));
    return c.json({ ok: true, coverUrl: await getPhotoUrl(photoId) });
  },
);

/* ---- Загрузка фото (одно или несколько) ---- */
userRoutes.post("/me/photos", async (c) => {
  const me = c.get("userId");
  const body = await c.req.parseBody({ all: true });
  const raw = body["files"] ?? body["file"];
  const files = (Array.isArray(raw) ? raw : [raw]).filter(
    (f): f is File => f instanceof File,
  );

  if (files.length === 0) {
    return c.json({ error: "Не приложено ни одного файла (поле files)" }, 400);
  }

  const inserted = [];
  try {
    for (const file of files) {
      const { url } = await saveImage(file);
      const [photo] = await db
        .insert(photos)
        .values({ userId: me, url })
        .returning();
      inserted.push(photo);
    }
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Ошибка загрузки" }, 400);
  }

  // если у пользователя ещё нет главной фотки — ставим первую загруженную
  const [user] = await db.select().from(users).where(eq(users.id, me)).limit(1);
  if (user && !user.avatarPhotoId && inserted[0]) {
    await db
      .update(users)
      .set({ avatarPhotoId: inserted[0].id, updatedAt: new Date() })
      .where(eq(users.id, me));
  }

  return c.json({ photos: inserted }, 201);
});

/* ---- Выбрать главную фотографию ---- */
userRoutes.patch("/me/avatar", zValidator("json", z.object({ photoId: z.string().uuid() })), async (c) => {
  const me = c.get("userId");
  const { photoId } = c.req.valid("json");

  const [photo] = await db
    .select()
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.userId, me)))
    .limit(1);
  if (!photo) return c.json({ error: "Фото не найдено" }, 404);

  await db
    .update(users)
    .set({ avatarPhotoId: photoId, updatedAt: new Date() })
    .where(eq(users.id, me));
  return c.json({ ok: true, avatarUrl: photo.url });
});

/* ---- Удалить фотографию ---- */
userRoutes.delete("/me/photos/:id", async (c) => {
  const me = c.get("userId");
  const photoId = c.req.param("id");

  const [photo] = await db
    .select()
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.userId, me)))
    .limit(1);
  if (!photo) return c.json({ error: "Фото не найдено" }, 404);

  // если удаляем главную — сбрасываем avatarPhotoId
  const [user] = await db.select().from(users).where(eq(users.id, me)).limit(1);
  if (user?.avatarPhotoId === photoId) {
    await db.update(users).set({ avatarPhotoId: null }).where(eq(users.id, me));
  }
  await db.delete(photos).where(eq(photos.id, photoId));
  return c.json({ ok: true });
});

/* ---- Загрузить музыкальный трек ---- */
userRoutes.post("/me/tracks", async (c) => {
  const me = c.get("userId");
  const body = await c.req.parseBody();
  const file = body["audio"];
  const title = String(body["title"] ?? "").trim();
  if (!(file instanceof File) || file.size === 0) {
    return c.json({ error: "Не приложен аудиофайл (поле audio)" }, 400);
  }
  let url: string;
  try {
    url = (await saveAudio(file, MAX_TRACK_BYTES)).url;
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Ошибка аудио" }, 400);
  }
  const name = title || file.name.replace(/\.[^.]+$/, "") || "Без названия";
  const [track] = await db.insert(tracks).values({ userId: me, title: name, url }).returning();
  return c.json({ track }, 201);
});

/* ---- Удалить трек ---- */
userRoutes.delete("/me/tracks/:id", async (c) => {
  const me = c.get("userId");
  const trackId = c.req.param("id");
  const [track] = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, trackId), eq(tracks.userId, me)))
    .limit(1);
  if (!track) return c.json({ error: "Трек не найден" }, 404);
  await db.delete(tracks).where(eq(tracks.id, trackId));
  return c.json({ ok: true });
});

/* ---- Публичный профиль по username ---- */
userRoutes.get("/:username", async (c) => {
  const me = c.get("userId");
  const username = c.req.param("username");

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user) return c.json({ error: "Пользователь не найден" }, 404);

  const gallery = await db.select().from(photos).where(eq(photos.userId, user.id));
  const userTracks = await db
    .select()
    .from(tracks)
    .where(eq(tracks.userId, user.id))
    .orderBy(tracks.createdAt);
  const friendState = await getFriendState(me, user.id);

  // счётчики: посты и друзья (принятые заявки в любом направлении)
  const [[postsCountRow], [friendsCountRow]] = await Promise.all([
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(posts)
      .where(and(eq(posts.authorId, user.id), isNull(posts.channelId))),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, "accepted"),
          or(eq(friendships.requesterId, user.id), eq(friendships.addresseeId, user.id)),
        ),
      ),
  ]);

  return c.json({
    user: publicUser(
      user,
      await getAvatarUrl(user.id),
      await getPhotoUrl(user.coverPhotoId),
    ),
    photos: gallery,
    tracks: userTracks,
    friendState,
    isMe: me === user.id,
    counts: {
      posts: postsCountRow?.c ?? 0,
      friends: friendsCountRow?.c ?? 0,
    },
  });
});
