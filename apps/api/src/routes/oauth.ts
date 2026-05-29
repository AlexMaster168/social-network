import { db, users } from "@sn/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { env, googleOAuthEnabled } from "../env.js";
import { signToken } from "../lib/jwt.js";
import { hashPassword } from "../lib/password.js";
import type { AppEnv } from "../lib/types.js";

export const oauthRoutes = new Hono<AppEnv>();

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";

/** Шаг 1: редирект на согласие Google. */
oauthRoutes.get("/google", (c) => {
  if (!googleOAuthEnabled) {
    return c.redirect(`${env.CORS_ORIGIN}/login?error=google_not_configured`);
  }
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
  });
  return c.redirect(`${GOOGLE_AUTH}?${params.toString()}`);
});

/** Шаг 2: callback — обмен кода на профиль, логин/регистрация, редирект на фронт с токеном. */
oauthRoutes.get("/google/callback", async (c) => {
  if (!googleOAuthEnabled) {
    return c.redirect(`${env.CORS_ORIGIN}/login?error=google_not_configured`);
  }
  const code = c.req.query("code");
  if (!code) return c.redirect(`${env.CORS_ORIGIN}/login?error=google_failed`);

  try {
    // обмен code на access_token
    const tokenRes = await fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) throw new Error("no access_token");

    // профиль пользователя
    const profileRes = await fetch(GOOGLE_USERINFO, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = (await profileRes.json()) as {
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!profile.email) throw new Error("no email");

    // ищем по email или создаём нового
    let [user] = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
    if (!user) {
      const base = profile.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24) || "user";
      let username = base;
      // гарантируем уникальность username
      while ((await db.select({ id: users.id }).from(users).where(eq(users.username, username))).length) {
        username = `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
      }
      const passwordHash = await hashPassword(randomUUID());
      [user] = await db
        .insert(users)
        .values({
          username,
          email: profile.email,
          passwordHash,
          displayName: profile.name || username,
        })
        .returning();
    }

    const token = await signToken({ sub: user.id, username: user.username });
    return c.redirect(`${env.CORS_ORIGIN}/auth/callback?token=${encodeURIComponent(token)}`);
  } catch {
    return c.redirect(`${env.CORS_ORIGIN}/login?error=google_failed`);
  }
});
