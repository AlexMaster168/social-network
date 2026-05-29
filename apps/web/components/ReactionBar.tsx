"use client";

import { useState } from "react";
import type { Reaction } from "@/lib/types";

export const EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

interface ReactionBarProps {
  reactions: Reaction[];
  myReaction: string | null;
  onReact: (emoji: string) => void;
}

export function ReactionBar({ reactions, myReaction, onReact }: ReactionBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => onReact(r.emoji)}
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors"
          style={{
            background: r.emoji === myReaction ? "rgba(109,140,255,0.2)" : "var(--color-surface-3)",
            outline: r.emoji === myReaction ? "1px solid var(--color-brand)" : "none",
          }}
        >
          <span>{r.emoji}</span>
          <span className="text-muted">{r.count}</span>
        </button>
      ))}

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-3 hover:text-ink"
          title="Поставить реакцию"
        >
          ☺
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="card absolute bottom-7 left-0 z-20 flex gap-1 p-1.5">
              {EMOJI.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    onReact(e);
                    setOpen(false);
                  }}
                  className="rounded-md px-1.5 py-1 text-lg transition-transform hover:scale-125"
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
