"use client";

import { useEffect, useRef, useState } from "react";
import { getToken, WS_URL } from "./api";
import type { ChatMessage } from "./types";

export interface SignalEvent {
  from: string;
  payload: unknown;
}

interface Handlers {
  onMessage?: (m: ChatMessage) => void;
  onMessageUpdate?: (m: ChatMessage) => void;
  onMessageDelete?: (info: { messageId: string; conversationId: string }) => void;
  onSignal?: (e: SignalEvent) => void;
}

/**
 * Единое WebSocket-соединение: текстовые сообщения чата + WebRTC-сигналинг.
 * Хендлеры хранятся в ref, чтобы их смена не пересоздавала сокет.
 */
export function useChatSocket(handlers: Handlers) {
  const wsRef = useRef<WebSocket | null>(null);
  const cbRef = useRef(handlers);
  const [ready, setReady] = useState(false);

  cbRef.current = handlers;

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const ws = new WebSocket(`${WS_URL}/ws?token=${encodeURIComponent(token!)}`);
      wsRef.current = ws;

      ws.onopen = () => setReady(true);
      ws.onclose = () => {
        setReady(false);
        if (!closed) reconnectTimer = setTimeout(connect, 1500);
      };
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(String(e.data));
          if (data.type === "message") cbRef.current.onMessage?.(data.message as ChatMessage);
          else if (data.type === "message:update")
            cbRef.current.onMessageUpdate?.(data.message as ChatMessage);
          else if (data.type === "message:delete")
            cbRef.current.onMessageDelete?.({
              messageId: data.messageId,
              conversationId: data.conversationId,
            });
          else if (data.type === "rtc")
            cbRef.current.onSignal?.({ from: data.from, payload: data.payload });
        } catch {
          /* игнор битых пакетов */
        }
      };
    }

    connect();
    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  function send(conversationId: string, content: string): boolean {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "message", conversationId, content }));
      return true;
    }
    return false;
  }

  function sendSignal(to: string, payload: unknown): boolean {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "rtc", to, payload }));
      return true;
    }
    return false;
  }

  return { ready, send, sendSignal };
}
