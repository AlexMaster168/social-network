import { db, friendships, users } from "@sn/db";
import { zValidator } from "@hono/zod-validator";
import { and, eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getAvatarUrls } from "../lib/avatars.js";
import type { AppEnv } from "../lib/types.js";

export const friendRoutes = new Hono<AppEnv>();

function pairCondition(a: string, b: string) {
  return or(
    and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
    and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
  );
}

async function usersWithAvatars(ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db.select().from(users).where(or(...ids.map((id) => eq(users.id, id))));
  const avatarMap = await getAvatarUrls(ids);
  return rows.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: avatarMap.get(u.id) ?? null,
  }));
}

/* ---- Отправить заявку (или принять встречную) ---- */
friendRoutes.post(
  "/request",
  zValidator("json", z.object({ userId: z.string().uuid() })),
  async (c) => {
    const me = c.get("userId");
    const { userId: target } = c.req.valid("json");
    if (target === me) return c.json({ error: "Нельзя добавить самого себя" }, 400);

    const [exists] = await db.select().from(users).where(eq(users.id, target)).limit(1);
    if (!exists) return c.json({ error: "Пользователь не найден" }, 404);

    const [existing] = await db.select().from(friendships).where(pairCondition(me, target)).limit(1);

    if (existing) {
      if (existing.status === "accepted") {
        return c.json({ error: "Вы уже друзья", state: "friends" }, 409);
      }
      if (existing.requesterId === me) {
        return c.json({ error: "Заявка уже отправлена", state: "outgoing" }, 409);
      }
      // встречная заявка — принимаем, дружба становится взаимной
      await db
        .update(friendships)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(friendships.id, existing.id));
      return c.json({ ok: true, state: "friends" });
    }

    await db.insert(friendships).values({ requesterId: me, addresseeId: target });
    return c.json({ ok: true, state: "outgoing" }, 201);
  },
);

/* ---- Принять входящую заявку ---- */
friendRoutes.post(
  "/accept",
  zValidator("json", z.object({ userId: z.string().uuid() })),
  async (c) => {
    const me = c.get("userId");
    const { userId: requester } = c.req.valid("json");

    const [pending] = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.requesterId, requester),
          eq(friendships.addresseeId, me),
          eq(friendships.status, "pending"),
        ),
      )
      .limit(1);

    if (!pending) return c.json({ error: "Заявка не найдена" }, 404);

    await db
      .update(friendships)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(friendships.id, pending.id));
    return c.json({ ok: true, state: "friends" });
  },
);

/* ---- Удалить из друзей / отменить / отклонить заявку ---- */
friendRoutes.delete("/:userId", async (c) => {
  const me = c.get("userId");
  const other = c.req.param("userId");
  await db.delete(friendships).where(pairCondition(me, other));
  return c.json({ ok: true, state: "none" });
});

/* ---- Список друзей ---- */
friendRoutes.get("/", async (c) => {
  const me = c.get("userId");
  const accepted = await db
    .select()
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, me), eq(friendships.addresseeId, me)),
      ),
    );

  const friendIds = accepted.map((f) => (f.requesterId === me ? f.addresseeId : f.requesterId));
  return c.json({ friends: await usersWithAvatars(friendIds) });
});

/* ---- Входящие заявки ---- */
friendRoutes.get("/requests/incoming", async (c) => {
  const me = c.get("userId");
  const rows = await db
    .select()
    .from(friendships)
    .where(and(eq(friendships.addresseeId, me), eq(friendships.status, "pending")));
  return c.json({ requests: await usersWithAvatars(rows.map((r) => r.requesterId)) });
});

/* ---- Исходящие заявки ---- */
friendRoutes.get("/requests/outgoing", async (c) => {
  const me = c.get("userId");
  const rows = await db
    .select()
    .from(friendships)
    .where(and(eq(friendships.requesterId, me), eq(friendships.status, "pending")));
  return c.json({ requests: await usersWithAvatars(rows.map((r) => r.addresseeId)) });
});
