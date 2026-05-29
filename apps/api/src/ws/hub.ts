import type { WSContext } from "hono/ws";
import type { ChatMessage } from "../lib/messaging.js";

/**
 * Простой in-memory реестр WebSocket-соединений по userId.
 * Для одного инстанса сервера этого достаточно. Для горизонтального
 * масштабирования сюда позже встанет Redis pub/sub.
 */
const connections = new Map<string, Set<WSContext>>();

export function addConnection(userId: string, ws: WSContext) {
  let set = connections.get(userId);
  if (!set) {
    set = new Set();
    connections.set(userId, set);
  }
  set.add(ws);
}

export function removeConnection(userId: string, ws: WSContext) {
  const set = connections.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) connections.delete(userId);
}

/** Отправляет событие конкретному пользователю на все его вкладки/устройства. */
export function sendToUser(userId: string, event: unknown) {
  const set = connections.get(userId);
  if (!set) return;
  const payload = JSON.stringify(event);
  for (const ws of set) {
    try {
      ws.send(payload);
    } catch {
      // битое соединение — игнорируем, оно закроется по onClose
    }
  }
}

/** Рассылает новое сообщение всем участникам диалога. */
export function broadcastMessage(participantIds: string[], message: ChatMessage) {
  const event = { type: "message", message };
  for (const userId of participantIds) {
    sendToUser(userId, event);
  }
}

/** Рассылает произвольное событие участникам диалога. */
export function broadcastToParticipants(participantIds: string[], event: unknown) {
  for (const userId of participantIds) {
    sendToUser(userId, event);
  }
}
