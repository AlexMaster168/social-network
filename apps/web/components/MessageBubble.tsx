"use client";

import { useState } from "react";
import { timeAgo } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";
import { AttachmentView } from "./AttachmentView";
import { ReactionBar } from "./ReactionBar";

interface MessageBubbleProps {
  message: ChatMessage;
  mine: boolean;
  onReact: (emoji: string) => void;
  onEdit: (content: string) => Promise<void>;
  onDelete: () => void;
}

export function MessageBubble({ message, mine, onReact, onEdit, onDelete }: MessageBubbleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  async function save() {
    const text = draft.trim();
    if (!text || text === message.content) {
      setEditing(false);
      return;
    }
    await onEdit(text);
    setEditing(false);
  }

  return (
    <div className={`group flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className="flex items-end gap-1">
        {/* действия слева для своих сообщений */}
        {mine && !editing && (
          <div className="flex gap-1 self-center opacity-0 transition-opacity group-hover:opacity-100">
            {!message.attachment && (
              <button
                onClick={() => { setDraft(message.content); setEditing(true); }}
                className="text-xs text-faint hover:text-brand"
                title="Редактировать"
              >
                ✎
              </button>
            )}
            <button onClick={onDelete} className="text-xs text-faint hover:text-dislike" title="Удалить">
              🗑
            </button>
          </div>
        )}

        <div
          className="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm"
          style={{
            background: mine ? "var(--color-brand)" : "var(--color-surface-2)",
            color: mine ? "#fff" : "var(--color-ink)",
          }}
        >
          {editing ? (
            <div className="flex flex-col gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") setEditing(false);
                }}
                autoFocus
                className="rounded-md bg-black/20 px-2 py-1 text-white outline-none"
              />
              <div className="flex gap-2 text-xs">
                <button onClick={save} className="font-semibold">Сохранить</button>
                <button onClick={() => setEditing(false)} className="opacity-80">Отмена</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {message.attachment && <AttachmentView a={message.attachment} compact />}
              {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
            </div>
          )}

          <div
            className="mt-1 text-right text-[10px]"
            style={{ color: mine ? "rgba(255,255,255,0.7)" : "var(--color-faint)" }}
          >
            {timeAgo(message.createdAt)}
            {message.editedAt && " · изм."}
          </div>
        </div>
      </div>

      <div className="mt-1">
        <ReactionBar reactions={message.reactions} myReaction={message.myReaction} onReact={onReact} />
      </div>
    </div>
  );
}
