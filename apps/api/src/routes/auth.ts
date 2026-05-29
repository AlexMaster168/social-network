import { db, users } from "@sn/db";
import { zValidator } from "@hono/zod-validator";
import { eq, or } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import { signToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import type { AppEnv } from "../lib/types.js";
import { requireAuth } from "../middleware/auth.js";
import { publicUser } from "../lib/serialize.js";
import { getAvatarUrl, getPhotoUrl } from "../lib/avatars.js";

/** Сериализует юзера с резолвом аватара и обложки. */
async function fullUser(user: Parameters<typeof publicUser>[0]) {
  return publicUser(
    user,
    await getAvatarUrl(user.id),
    await getPhotoUrl(user.coverPhotoId),
  );
}

const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Минимум 3 символа")
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, "Только латиница, цифры и _"),
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Минимум 6 символов").max(100),
  displayName: z.string().min(1, "Укажи имя").max(64),
});

const loginSchema = z.object({
  login: z.string().min(1), // username или email
  password: z.string().min(1),
});

export const authRoutes = new Hono<AppEnv>();

function setAuthCookie(c: Context<AppEnv>, token: string) {
  setCookie(c, "token", token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

authRoutes.post("/register", zValidator("json", registerSchema), async (c) => {
  const { username, email, password, displayName } = c.req.valid("json");

  const existing = await db
    .select({ id: users.id, username: users.username, email: users.email })
    .from(users)
    .where(or(eq(users.username, username), eq(users.email, email)));

  if (existing.length > 0) {
    const taken = existing[0].username === username ? "username" : "email";
    return c.json({ error: `Такой ${taken} уже занят` }, 409);
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ username, email, passwordHash, displayName })
    .returning();

  const token = await signToken({ sub: user.id, username: user.username });
  setAuthCookie(c, token);
  return c.json({ token, user: await fullUser(user) }, 201);
});

authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const { login, password } = c.req.valid("json");

  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.username, login), eq(users.email, login)))
    .limit(1);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return c.json({ error: "Неверный логин или пароль" }, 401);
  }

  const token = await signToken({ sub: user.id, username: user.username });
  setAuthCookie(c, token);
  return c.json({ token, user: await fullUser(user) });
});

authRoutes.post("/logout", (c) => {
  setCookie(c, "token", "", { path: "/", maxAge: 0 });
  return c.json({ ok: true });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return c.json({ error: "Пользователь не найден" }, 404);
  return c.json({ user: await fullUser(user) });
});
