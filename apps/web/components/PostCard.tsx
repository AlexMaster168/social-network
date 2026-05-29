"use client";

import Link from "next/link";
import { useState } from "react";
import { api, fileUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import type { Comment, Post, Reaction } from "@/lib/types";
import { AttachmentView } from "./AttachmentView";
import { Avatar } from "./Avatar";
import { CommentItem } from "./CommentItem";

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  owner: { label: "Владелец", color: "#f7b733" },
  admin: { label: "Админ", color: "var(--color-brand)" },
};

interface PostCardProps {
  post: Post;
  onChange: (post: Post) => void;
  onDelete: (id: string) => void;
}

export function PostCard({ post, onChange, onDelete }: PostCardProps) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function react(type: "like" | "dislike") {
    try {
      const { post: updated } = await api<{ post: Post }>(`/api/posts/${post.id}/reaction`, {
        method: "PUT",
        body: { type },
      });
      onChange(updated);
    } catch {
      /* не ломаем UI */
    }
  }

  async function toggleComments() {
    const next = !showComments;
    setShowComments(next);
    if (next && !commentsLoaded) {
      const { comments } = await api<{ comments: Comment[] }>(`/api/posts/${post.id}/comments`);
      setComments(comments);
      setCommentsLoaded(true);
    }
  }

  async function addComment() {
    if (!newComment.trim()) return;
    setBusy(true);
    try {
      const { comment } = await api<{ comment: Comment }>(`/api/posts/${post.id}/comments`, {
        body: { content: newComment.trim() },
      });
      setComments((c) => [...c, comment]);
      setNewComment("");
      onChange({ ...post, commentCount: post.commentCount + 1 });
    } finally {
      setBusy(false);
    }
  }

  async function reactComment(commentId: string, emoji: string) {
    const res = await api<{ reactions: Reaction[]; myReaction: string | null }>(
      `/api/posts/comments/${commentId}/reaction`,
      { method: "PUT", body: { emoji } },
    );
    setComments((cs) =>
      cs.map((c) =>
        c.id === commentId ? { ...c, reactions: res.reactions, myReaction: res.myReaction } : c,
      ),
    );
  }

  async function editComment(commentId: string, content: string) {
    const res = await api<{ content: string; editedAt: string }>(
      `/api/posts/comments/${commentId}`,
      { method: "PATCH", body: { content } },
    );
    setComments((cs) =>
      cs.map((c) => (c.id === commentId ? { ...c, content: res.content, editedAt: res.editedAt } : c)),
    );
  }

  async function deleteComment(commentId: string) {
    if (!confirm("Удалить комментарий?")) return;
    await api(`/api/posts/comments/${commentId}`, { method: "DELETE" });
    setComments((cs) => cs.filter((c) => c.id !== commentId));
    onChange({ ...post, commentCount: Math.max(0, post.commentCount - 1) });
  }

  async function removePost() {
    if (!confirm("Удалить пост?")) return;
    await api(`/api/posts/${post.id}`, { method: "DELETE" });
    onDelete(post.id);
  }

  const img = fileUrl(post.imageUrl);

  return (
    <article className="card p-4">
      <div className="flex items-center gap-3">
        <Link href={`/profile/${post.author.username}`}>
          <Avatar url={post.author.avatarUrl} name={post.author.displayName} size={44} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Link href={`/profile/${post.author.username}`} className="font-semibold hover:underline">
              {post.author.displayName}
            </Link>
            {post.author.role && ROLE_BADGE[post.author.role] && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                style={{ background: "var(--color-surface-3)", color: ROLE_BADGE[post.author.role].color }}
              >
                {ROLE_BADGE[post.author.role].label}
              </span>
            )}
          </div>
          <div className="text-xs text-faint">
            @{post.author.username} · {timeAgo(post.createdAt)}
          </div>
        </div>
        {user?.id === post.author.id && (
          <button onClick={removePost} className="text-sm text-faint hover:text-dislike">
            Удалить
          </button>
        )}
      </div>

      {post.content && <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">{post.content}</p>}
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="mt-3 max-h-[520px] w-full rounded-xl object-cover" />
      )}
      {post.attachments.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {post.attachments.map((a, i) => (
            <AttachmentView key={i} a={a} />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-sm">
        <button
          onClick={() => react("like")}
          className="btn"
          style={{
            background: post.myReaction === "like" ? "rgba(74,222,128,0.15)" : "var(--color-surface-2)",
            color: post.myReaction === "like" ? "var(--color-like)" : "var(--color-ink)",
          }}
        >
          👍 {post.likeCount}
        </button>
        <button
          onClick={() => react("dislike")}
          className="btn"
          style={{
            background: post.myReaction === "dislike" ? "rgba(248,113,113,0.15)" : "var(--color-surface-2)",
            color: post.myReaction === "dislike" ? "var(--color-dislike)" : "var(--color-ink)",
          }}
        >
          👎 {post.dislikeCount}
        </button>
        <button onClick={toggleComments} className="btn btn-ghost">
          💬 {post.commentCount}
        </button>
      </div>

      {showComments && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex flex-col gap-3">
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                isOwn={c.author.id === user?.id}
                onReact={(emoji) => reactComment(c.id, emoji)}
                onEdit={(content) => editComment(c.id, content)}
                onDelete={() => deleteComment(c.id)}
              />
            ))}
            {commentsLoaded && comments.length === 0 && (
              <p className="text-sm text-faint">Пока нет комментариев — будь первым.</p>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addComment()}
              placeholder="Написать комментарий…"
              className="input"
            />
            <button onClick={addComment} disabled={busy || !newComment.trim()} className="btn btn-primary">
              Отпр.
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
