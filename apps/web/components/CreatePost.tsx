"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Post } from "@/lib/types";
import { Avatar } from "./Avatar";

export function CreatePost({
  onCreated,
  endpoint = "/api/posts",
  placeholder = "Что у тебя нового?",
}: {
  onCreated: (post: Post) => void;
  endpoint?: string;
  placeholder?: string;
}) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    if (fileRef.current) fileRef.current.value = "";
  }
  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (!content.trim() && files.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("content", content);
      files.forEach((f) => form.append("files", f));
      const { post } = await api<{ post: Post }>(endpoint, { form });
      onCreated(post);
      setContent("");
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось опубликовать");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex gap-3">
        <Avatar url={user?.avatarUrl ?? null} name={user?.displayName ?? "?"} size={44} />
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            rows={2}
            className="w-full resize-none bg-transparent pt-2 text-[15px] outline-none placeholder:text-faint"
          />
          {files.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-surface-2 px-2 py-1 text-sm">
                  <span className="truncate">
                    {f.type.startsWith("image/") ? "🖼" : f.type.startsWith("video/") ? "🎬" : f.type.startsWith("audio/") ? "🎵" : "📎"}{" "}
                    {f.name}
                  </span>
                  <button onClick={() => removeFile(i)} className="ml-auto text-faint hover:text-dislike">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {error && <div className="mt-2 text-sm text-dislike">{error}</div>}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <label className="btn btn-ghost cursor-pointer">
              📎 Файлы
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>
            <button
              onClick={submit}
              disabled={submitting || (!content.trim() && files.length === 0)}
              className="btn btn-primary"
            >
              {submitting ? "Публикуем…" : "Опубликовать"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
