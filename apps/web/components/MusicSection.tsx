"use client";

import { useRef, useState } from "react";
import { api, fileUrl } from "@/lib/api";
import type { Track } from "@/lib/types";

interface MusicSectionProps {
  tracks: Track[];
  isMe: boolean;
  onChange: () => void; // перезагрузить профиль
}

export function MusicSection({ tracks, isMe, onChange }: MusicSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("audio", file);
        form.append("title", file.name.replace(/\.[^.]+$/, ""));
        await api("/api/users/me/tracks", { form });
      }
      if (fileRef.current) fileRef.current.value = "";
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Удалить трек?")) return;
    await api(`/api/users/me/tracks/${id}`, { method: "DELETE" });
    onChange();
  }

  if (!isMe && tracks.length === 0) return null;

  return (
    <div className="card mt-4 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">🎵 Музыка</h2>
        {isMe && (
          <label className="btn btn-ghost cursor-pointer text-sm">
            {uploading ? "Загрузка…" : "Добавить трек"}
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={(e) => upload(e.target.files)}
            />
          </label>
        )}
      </div>
      {error && <div className="mb-2 text-sm text-dislike">{error}</div>}
      {tracks.length === 0 ? (
        <p className="text-sm text-faint">Пока нет треков.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {tracks.map((t) => (
            <div key={t.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 truncate text-sm font-medium">{t.title}</div>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio controls src={fileUrl(t.url)!} className="h-9 w-full" preload="none" />
              </div>
              {isMe && (
                <button onClick={() => remove(t.id)} className="text-sm text-faint hover:text-dislike">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
