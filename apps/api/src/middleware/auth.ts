import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verifyToken } from "../lib/jwt.js";
import type { AppEnv } from "../lib/types.js";

/**
 * Достаёт токен из заголовка Authorization: Bearer <token>
 * либо из cookie `token`. Кладёт userId/username в контекст.
 */
export async function requireAuth(c: Context<AppEnv>, next: Next) {
  let token: string | undefined;

  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }
  if (!token) {
    token = getCookie(c, "token");
  }

  if (!token) {
    return c.json({ error: "Не авторизован" }, 401);
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({ error: "Неверный или истёкший токен" }, 401);
  }

  c.set("userId", payload.sub);
  c.set("username", payload.username);
  await next();
}
