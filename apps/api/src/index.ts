import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env.js";
import { verifyToken } from "./lib/jwt.js";
import {
  createMessage,
  getParticipantIds,
  isParticipant,
} from "./lib/messaging.js";
import type { AppEnv } from "./lib/types.js";
import { requireAuth } from "./middleware/auth.js";
import { authRoutes } from "./routes/auth.js";
import { conversationRoutes } from "./routes/conversations.js";
import { channelRoutes } from "./routes/channels.js";
import { friendRoutes } from "./routes/friends.js";
import { oauthRoutes } from "./routes/oauth.js";
import { postRoutes } from "./routes/posts.js";
import { userRoutes } from "./routes/users.js";
import { addConnection, broadcastMessage, removeConnection, sendToUser } from "./ws/hub.js";

const app = new Hono<AppEnv>();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use(
  "*",
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

// Отдача загруженных файлов
app.use("/uploads/*", serveStatic({ root: "./" }));

app.get("/health", (c) => c.json({ ok: true }));

// Публичные маршруты авторизации
app.route("/api/auth", authRoutes);
app.route("/api/auth", oauthRoutes);

// Защищённые маршруты
app.use("/api/users/*", requireAuth);
app.use("/api/posts/*", requireAuth);
app.use("/api/friends/*", requireAuth);
app.use("/api/conversations/*", requireAuth);
app.use("/api/channels/*", requireAuth);

app.route("/api/users", userRoutes);
app.route("/api/posts", postRoutes);
app.route("/api/friends", friendRoutes);
app.route("/api/conversations", conversationRoutes);
app.route("/api/channels", channelRoutes);

/* ============================================================
 *  WebSocket для realtime-чата.
 *  Подключение: ws://host/ws?token=<JWT>
 *  Входящее сообщение клиента: { type:"message", conversationId, content }
 *  Сервер рассылает участникам: { type:"message", message }
 * ========================================================== */
app.get(
  "/ws",
  upgradeWebSocket((c) => {
    const token = c.req.query("token");
    let userId: string | null = null;

    return {
      async onOpen(_event, ws) {
        const payload = token ? await verifyToken(token) : null;
        if (!payload) {
          ws.send(JSON.stringify({ type: "error", error: "Не авторизован" }));
          ws.close(1008, "unauthorized");
          return;
        }
        userId = payload.sub;
        addConnection(userId, ws);
        ws.send(JSON.stringify({ type: "ready" }));
      },

      async onMessage(event, ws) {
        if (!userId) return;
        let data: {
          type?: string;
          conversationId?: string;
          content?: string;
          to?: string;
          payload?: unknown;
        };
        try {
          data = JSON.parse(String(event.data));
        } catch {
          return;
        }

        // ---- WebRTC-сигналинг: просто реле другому пользователю ----
        if (data.type === "rtc" && data.to) {
          sendToUser(data.to, { type: "rtc", from: userId, payload: data.payload });
          return;
        }

        // ---- Текстовое сообщение чата ----
        if (data.type !== "message" || !data.conversationId || !data.content?.trim()) {
          return;
        }
        const allowed = await isParticipant(data.conversationId, userId);
        if (!allowed) {
          ws.send(JSON.stringify({ type: "error", error: "Нет доступа к диалогу" }));
          return;
        }
        const message = await createMessage(data.conversationId, userId, {
          content: data.content.trim(),
        });
        const participantIds = await getParticipantIds(data.conversationId);
        broadcastMessage(participantIds, message);
      },

      onClose(_event, ws) {
        if (userId) removeConnection(userId, ws);
      },
    };
  }),
);

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`🚀 API на http://localhost:${info.port}`);
  console.log(`🔌 WebSocket на ws://localhost:${info.port}/ws`);
});

injectWebSocket(server);
