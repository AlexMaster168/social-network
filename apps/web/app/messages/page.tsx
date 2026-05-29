"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { CallPanel } from "@/components/CallPanel";
import { MessageBubble } from "@/components/MessageBubble";
import { MicIcon, PhoneIcon, VideoIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ChatMessage, ConversationListItem } from "@/lib/types";
import { useChatSocket } from "@/lib/useChatSocket";
import { useVideoRecorder } from "@/lib/useVideoRecorder";
import { useVoiceRecorder } from "@/lib/useVoiceRecorder";
import { useWebRTC } from "@/lib/useWebRTC";

function MessagesInner() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const activeId = params.get("c");

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const { conversations } = await api<{ conversations: ConversationListItem[] }>(
      "/api/conversations",
    );
    setConversations(conversations);
  }, []);

  useEffect(() => {
    if (user) loadConversations();
  }, [user, loadConversations]);

  useEffect(() => {
    if (!user) return;
    if (!activeId) {
      setMessages([]);
      return;
    }
    api<{ messages: ChatMessage[] }>(`/api/conversations/${activeId}/messages`).then((r) =>
      setMessages(r.messages),
    );
  }, [user, activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onIncoming = useCallback(
    (m: ChatMessage) => {
      if (m.conversationId === activeId) {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      }
      setConversations((prev) => {
        const exists = prev.find((c) => c.conversationId === m.conversationId);
        if (!exists) {
          loadConversations();
          return prev;
        }
        return prev
          .map((c) =>
            c.conversationId === m.conversationId
              ? { ...c, lastMessage: { content: m.content, createdAt: m.createdAt, senderId: m.sender.id } }
              : c,
          )
          .sort((a, b) => {
            const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return tb - ta;
          });
      });
    },
    [activeId, loadConversations],
  );

  // применить изменение от своего действия (REST-ответ) — myReaction перезаписываем
  const applyOwn = useCallback((m: ChatMessage) => {
    setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
  }, []);

  // обновление по WS (чужое) — сохраняем свой myReaction, если в событии его нет
  const onWsUpdate = useCallback((m: ChatMessage) => {
    setMessages((prev) =>
      prev.map((x) => (x.id === m.id ? { ...m, myReaction: m.myReaction ?? x.myReaction } : x)),
    );
  }, []);

  const onWsDelete = useCallback(
    ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
      setMessages((prev) => prev.filter((x) => x.id !== messageId));
      if (conversationId) loadConversations();
    },
    [loadConversations],
  );

  // связка сокета и WebRTC через ref (избегаем циклической зависимости)
  const rtcRef = useRef<ReturnType<typeof useWebRTC> | null>(null);
  const { ready, send, sendSignal } = useChatSocket({
    onMessage: onIncoming,
    onMessageUpdate: onWsUpdate,
    onMessageDelete: onWsDelete,
    onSignal: (e) => rtcRef.current?.handleSignal(e.from, e.payload),
  });
  const rtc = useWebRTC({ sendSignal });
  rtcRef.current = rtc;

  async function reactMessage(messageId: string, emoji: string) {
    const { message } = await api<{ message: ChatMessage }>(
      `/api/conversations/messages/${messageId}/reaction`,
      { method: "PUT", body: { emoji } },
    );
    applyOwn(message);
  }

  async function editMessage(messageId: string, content: string) {
    const { message } = await api<{ message: ChatMessage }>(
      `/api/conversations/messages/${messageId}`,
      { method: "PATCH", body: { content } },
    );
    applyOwn(message);
  }

  async function deleteMessage(messageId: string) {
    if (!confirm("Удалить сообщение?")) return;
    await api(`/api/conversations/messages/${messageId}`, { method: "DELETE" });
    setMessages((prev) => prev.filter((x) => x.id !== messageId));
  }

  const recorder = useVoiceRecorder();
  const videoRecorder = useVideoRecorder();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // превью камеры при записи видеосообщения
  useEffect(() => {
    if (localVideoRef.current && videoRecorder.stream) {
      localVideoRef.current.srcObject = videoRecorder.stream;
    }
  }, [videoRecorder.stream]);

  async function handleSend() {
    const content = text.trim();
    if (!content || !activeId) return;
    setText("");
    const viaWs = send(activeId, content);
    if (!viaWs) {
      const { message } = await api<{ message: ChatMessage }>(
        `/api/conversations/${activeId}/messages`,
        { body: { content } },
      );
      onIncoming(message);
    }
  }

  async function sendAttachment(file: File, kind?: string) {
    if (!activeId) return;
    const form = new FormData();
    form.append("file", file);
    if (kind) form.append("kind", kind);
    const { message } = await api<{ message: ChatMessage }>(
      `/api/conversations/${activeId}/attachment`,
      { form },
    );
    onIncoming(message);
  }

  async function stopAndSendVoice() {
    const blob = await recorder.stop();
    if (!blob || !activeId) return;
    await sendAttachment(new File([blob], "voice.webm", { type: blob.type }), "voice");
  }

  async function stopAndSendVideo() {
    const blob = await videoRecorder.stop();
    if (!blob || !activeId) return;
    await sendAttachment(new File([blob], "video-note.webm", { type: blob.type }), "video_note");
  }

  const active = conversations.find((c) => c.conversationId === activeId);
  const peerName =
    conversations.find((c) => c.other?.id === rtc.peerId)?.other?.displayName ?? "Собеседник";

  return (
    <>
      <CallPanel
        callState={rtc.callState}
        isVideo={rtc.isVideo}
        micOn={rtc.micOn}
        camOn={rtc.camOn}
        localStream={rtc.localStream}
        remoteStream={rtc.remoteStream}
        peerName={peerName}
        onAccept={rtc.acceptCall}
        onHangup={rtc.hangup}
        onToggleMic={rtc.toggleMic}
        onToggleCam={rtc.toggleCam}
      />

      <div className="card flex h-[calc(100vh-140px)] overflow-hidden md:h-[calc(100vh-90px)]">
        {/* Список диалогов */}
        <aside
          className={`w-full shrink-0 overflow-y-auto border-r border-border md:max-w-[300px] ${
            activeId ? "hidden md:block" : "block"
          }`}
        >
          <div className="flex items-center gap-2 p-4 text-sm font-semibold">
            Диалоги
            <span className={`h-2 w-2 rounded-full ${ready ? "bg-like" : "bg-faint"}`} />
          </div>
          {conversations.length === 0 && (
            <p className="px-4 text-sm text-muted">
              Нет диалогов. Напиши кому-нибудь из профиля или раздела «Друзья».
            </p>
          )}
          {conversations.map((c) => (
            <button
              key={c.conversationId}
              onClick={() => router.push(`/messages?c=${c.conversationId}`)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
              style={{ background: c.conversationId === activeId ? "var(--color-surface-2)" : "transparent" }}
            >
              <Avatar url={c.other?.avatarUrl ?? null} name={c.other?.displayName ?? "?"} size={42} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.other?.displayName ?? "Диалог"}</div>
                <div className="truncate text-xs text-faint">
                  {c.lastMessage?.content ?? "Нет сообщений"}
                </div>
              </div>
            </button>
          ))}
        </aside>

        {/* Активный чат */}
        <section className={`flex flex-1 flex-col ${activeId ? "flex" : "hidden md:flex"}`}>
          {!activeId ? (
            <div className="flex flex-1 items-center justify-center text-muted">Выбери диалог</div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                <button onClick={() => router.push("/messages")} className="text-muted md:hidden">←</button>
                <Avatar url={active?.other?.avatarUrl ?? null} name={active?.other?.displayName ?? "?"} size={38} />
                <div className="flex-1 font-medium">{active?.other?.displayName ?? "Диалог"}</div>
                {active?.other && rtc.callState === "idle" && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => rtc.startCall(active.other!.id, false)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-brand"
                      title="Аудиозвонок"
                    >
                      <PhoneIcon size={18} />
                    </button>
                    <button
                      onClick={() => rtc.startCall(active.other!.id, true)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-brand"
                      title="Видеозвонок"
                    >
                      <VideoIcon size={18} />
                    </button>
                  </div>
                )}
              </header>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    mine={m.sender.id === user?.id}
                    onReact={(emoji) => reactMessage(m.id, emoji)}
                    onEdit={(content) => editMessage(m.id, content)}
                    onDelete={() => deleteMessage(m.id)}
                  />
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="flex items-center gap-2 border-t border-border p-3">
                {recorder.recording ? (
                  <>
                    <div className="flex flex-1 items-center gap-2 text-sm text-dislike">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
                      🎤 Запись… {Math.floor(recorder.seconds / 60)}:
                      {String(recorder.seconds % 60).padStart(2, "0")}
                    </div>
                    <button onClick={recorder.cancel} className="btn btn-ghost">Отмена</button>
                    <button onClick={stopAndSendVoice} className="btn btn-primary">Отправить</button>
                  </>
                ) : videoRecorder.recording ? (
                  <>
                    <video ref={localVideoRef} autoPlay muted playsInline className="h-12 w-12 rounded-full object-cover" />
                    <div className="flex flex-1 items-center gap-2 text-sm text-dislike">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
                      🎬 {Math.floor(videoRecorder.seconds / 60)}:
                      {String(videoRecorder.seconds % 60).padStart(2, "0")}
                    </div>
                    <button onClick={videoRecorder.cancel} className="btn btn-ghost">Отмена</button>
                    <button onClick={stopAndSendVideo} className="btn btn-primary">Отправить</button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-brand"
                      title="Прикрепить файл"
                    >
                      📎
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) sendAttachment(f);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    />
                    <button
                      onClick={() => recorder.start()}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-brand"
                      title="Голосовое сообщение"
                    >
                      <MicIcon size={20} />
                    </button>
                    <button
                      onClick={() => videoRecorder.start()}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-brand"
                      title="Видеосообщение"
                    >
                      <VideoIcon size={18} />
                    </button>
                    <input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      placeholder="Написать сообщение…"
                      className="input"
                    />
                    <button onClick={handleSend} disabled={!text.trim()} className="btn btn-primary">
                      Отправить
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

export default function MessagesPage() {
  return (
    <AppShell wide>
      <Suspense fallback={<p className="text-muted">Загрузка…</p>}>
        <MessagesInner />
      </Suspense>
    </AppShell>
  );
}
