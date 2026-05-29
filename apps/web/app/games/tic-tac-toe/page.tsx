"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";

type Cell = "X" | "O" | null;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winner(b: Cell[]): Cell | "draw" | null {
  for (const [a, c, d] of LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return b.every(Boolean) ? "draw" : null;
}

// минимакс: бот играет за O, человек за X
function minimax(b: Cell[], isBot: boolean): number {
  const w = winner(b);
  if (w === "O") return 10;
  if (w === "X") return -10;
  if (w === "draw") return 0;

  const scores: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (!b[i]) {
      const next = [...b];
      next[i] = isBot ? "O" : "X";
      scores.push(minimax(next, !isBot));
    }
  }
  return isBot ? Math.max(...scores) : Math.min(...scores);
}

function bestMove(b: Cell[]): number {
  let best = -Infinity;
  let move = -1;
  for (let i = 0; i < 9; i++) {
    if (!b[i]) {
      const next = [...b];
      next[i] = "O";
      const score = minimax(next, false);
      if (score > best) {
        best = score;
        move = i;
      }
    }
  }
  return move;
}

export default function TicTacToe() {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState({ win: 0, lose: 0, draw: 0 });

  const result = winner(board);

  function play(i: number) {
    if (board[i] || result || busy) return;
    const afterPlayer = [...board];
    afterPlayer[i] = "X";
    setBoard(afterPlayer);

    const pw = winner(afterPlayer);
    if (pw) {
      finish(pw);
      return;
    }
    setBusy(true);
    setTimeout(() => {
      const move = bestMove(afterPlayer);
      const afterBot = [...afterPlayer];
      if (move >= 0) afterBot[move] = "O";
      setBoard(afterBot);
      const bw = winner(afterBot);
      if (bw) finish(bw);
      setBusy(false);
    }, 300);
  }

  function finish(w: Cell | "draw") {
    if (w === "X") setScore((s) => ({ ...s, win: s.win + 1 }));
    else if (w === "O") setScore((s) => ({ ...s, lose: s.lose + 1 }));
    else setScore((s) => ({ ...s, draw: s.draw + 1 }));
  }

  function reset() {
    setBoard(Array(9).fill(null));
    setBusy(false);
  }

  const statusText =
    result === "X" ? "🎉 Ты выиграл!" :
    result === "O" ? "🤖 Бот победил" :
    result === "draw" ? "🤝 Ничья" :
    busy ? "Бот думает…" : "Твой ход (ты — ❌)";

  return (
    <AppShell>
      <Link href="/games" className="text-sm text-muted hover:text-brand">← Все игры</Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">Крестики-нолики</h1>
      <p className="mb-4 text-sm text-muted">{statusText}</p>

      <div className="card mx-auto w-fit p-4">
        <div className="grid grid-cols-3 gap-2">
          {board.map((cell, i) => (
            <button
              key={i}
              onClick={() => play(i)}
              disabled={!!cell || !!result || busy}
              className="flex h-24 w-24 items-center justify-center rounded-xl bg-surface-2 text-4xl font-bold transition-colors hover:bg-surface-3 disabled:cursor-default"
              style={{ color: cell === "X" ? "var(--color-brand)" : "var(--color-like)" }}
            >
              {cell}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button onClick={reset} className="btn btn-primary">Новая игра</button>
        <div className="text-sm text-muted">
          Победы: <b className="text-like">{score.win}</b> · Поражения:{" "}
          <b className="text-dislike">{score.lose}</b> · Ничьи: <b>{score.draw}</b>
        </div>
      </div>
    </AppShell>
  );
}
