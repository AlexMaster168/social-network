"use client";

import Link from "next/link";
import { useState } from "react";
import { timeAgo } from "@/lib/format";
import type { Comment } from "@/lib/types";
import { Avatar } from "./Avatar";
import { ReactionBar } from "./ReactionBar";

interface CommentItemProps {
  comment: Comment;
  isOwn: boolean;
  onReact: (emoji: string) => void;
  onEdit: (content: string) => Promise<void>;
  onDelete: () => void;
}

export function CommentItem({ comment, isOwn, onReact, onEdit, onDelete }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);

  async function save() {
    const text = draft.trim();
    if (!text || text === comment.content) {
      setEditing(false);
      return;
    }
    await onEdit(text);
    setEditing(false);
  }

  return (
    <div className="group flex gap-2">
      <Avatar url={comment.author.avatarUrl} name={comment.author.displayName} size={32} />
      <div className="flex-1">
        <div className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <Link href={`/profile/${comment.author.username}`} className="font-medium hover:underline">
              {comment.author.displayName}
            </Link>
            <span className="text-xs text-faint">
              {timeAgo(comment.createdAt)}
              {comment.editedAt && " · изменено"}
            </span>
            {isOwn && !editing && (
              <span className="ml-auto flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button onClick={() => { setDraft(comment.content); setEditing(true); }} className="text-xs text-faint hover:text-brand">
                  ред.
                </button>
                <button onClick={onDelete} className="text-xs text-faint hover:text-dislike">
                  удал.
                </button>
              </span>
            )}
          </div>

          {editing ? (
            <div className="mt-2 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") setEditing(false);
                }}
                autoFocus
                className="input py-1.5 text-sm"
              />
              <button onClick={save} className="btn btn-primary px-3 py-1.5 text-xs">
                ОК
              </button>
              <button onClick={() => setEditing(false)} className="btn btn-ghost px-3 py-1.5 text-xs">
                Отмена
              </button>
            </div>
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap">{comment.content}</p>
          )}
        </div>

        <div className="mt-1 pl-1">
          <ReactionBar reactions={comment.reactions} myReaction={comment.myReaction} onReact={onReact} />
        </div>
      </div>
    </div>
  );
}
