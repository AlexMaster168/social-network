"use client";

import { fileUrl } from "@/lib/api";
import type { Attachment } from "@/lib/types";

/** Универсальный рендер вложения по типу. compact=true для чата. */
export function AttachmentView({ a, compact = false }: { a: Attachment; compact?: boolean }) {
  const url = fileUrl(a.url)!;

  if (a.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={a.name ?? ""} className={`rounded-xl object-cover ${compact ? "max-h-72" : "max-h-[520px] w-full"}`} />;
  }

  if (a.kind === "video") {
    return <video controls src={url} className={`rounded-xl ${compact ? "max-h-72" : "max-h-[520px] w-full"}`} />;
  }

  if (a.kind === "video_note") {
    // видеосообщение-«кружок»
    return (
      <video
        controls
        src={url}
        className="h-48 w-48 rounded-full object-cover"
      />
    );
  }

  if (a.kind === "voice") {
    // eslint-disable-next-line jsx-a11y/media-has-caption
    return <audio controls src={url} className="h-9 max-w-[240px]" preload="none" />;
  }

  if (a.kind === "audio") {
    return (
      <div className="flex flex-col gap-1">
        {a.name && <span className="text-xs text-muted">🎵 {a.name}</span>}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio controls src={url} className="h-9 w-full max-w-xs" preload="none" />
      </div>
    );
  }

  // произвольный файл — ссылка на скачивание
  return (
    <a
      href={url}
      download={a.name ?? true}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg bg-surface-3 px-3 py-2 text-sm hover:opacity-80"
    >
      <span className="text-lg">📎</span>
      <span className="truncate">{a.name ?? "Файл"}</span>
    </a>
  );
}
