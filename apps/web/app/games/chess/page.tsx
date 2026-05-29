"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  bestMove,
  colorOf,
  gameResult,
  inCheck,
  initBoard,
  legalMovesFrom,
  makeMove,
  type Board,
} from "@/lib/chess";

const FILLED: Record<string, string> = {
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

export default function ChessGame() {
  const [board, setBoard] = useState<Board>(initBoard);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [turn, setTurn] = useState<"w" | "b">("w");
  const [over, setOver] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  const reset = useCallback(() => {
    setBoard(initBoard());
    setSelected(null);
    setTurn("w");
    setOver(null);
    setThinking(false);
  }, []);

  const botMove = useCallback((b: Board) => {
    setThinking(true);
    setTimeout(() => {
      const m = bestMove(b, 3);
      if (!m) {
        setThinking(false);
        return;
      }
      const nb = makeMove(b, m);
      setBoard(nb);
      setThinking(false);
      const res = gameResult(nb, "w");
      if (res === "checkmate") setOver("Мат! 🤖 Бот победил");
      else if (res === "stalemate") setOver("Пат — ничья");
      else setTurn("w");
    }, 300);
  }, []);

  function handleCell(r: number, c: number) {
    if (turn !== "w" || over || thinking) return;
    const cell = board[r][c];

    if (selected) {
      const targets = legalMovesFrom(board, selected[0], selected[1]);
      if (targets.some(([tr, tc]) => tr === r && tc === c)) {
        const nb = makeMove(board, { from: selected, to: [r, c] });
        setBoard(nb);
        setSelected(null);
        const res = gameResult(nb, "b");
        if (res === "checkmate") setOver("Мат! 🎉 Ты победил");
        else if (res === "stalemate") setOver("Пат — ничья");
        else {
          setTurn("b");
          botMove(nb);
        }
        return;
      }
    }
    setSelected(colorOf(cell) === "w" ? [r, c] : null);
  }

  const highlight =
    selected !== null ? legalMovesFrom(board, selected[0], selected[1]) : [];
  const checkColor = inCheck(board, turn) && !over ? turn : null;

  const status = over
    ? over
    : thinking
      ? "Бот думает…"
      : checkColor === "w"
        ? "Тебе шах!"
        : "Твой ход (белые)";

  return (
    <AppShell>
      <Link href="/games" className="text-sm text-muted hover:text-brand">← Все игры</Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">Шахматы</h1>
      <p className="mb-1 text-sm text-muted">{status}</p>
      <p className="mb-4 text-xs text-faint">Упрощённые правила: без рокировки и взятия на проходе.</p>

      <div className="card mx-auto w-fit p-3">
        <div className="grid grid-cols-8 overflow-hidden rounded-lg">
          {board.map((row, r) =>
            row.map((cell, c) => {
              const dark = (r + c) % 2 === 1;
              const isSel = selected && selected[0] === r && selected[1] === c;
              const isTarget = highlight.some(([tr, tc]) => tr === r && tc === c);
              const color = colorOf(cell);
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => handleCell(r, c)}
                  className="relative flex h-11 w-11 items-center justify-center text-3xl sm:h-14 sm:w-14 sm:text-4xl"
                  style={{ background: dark ? "#a87b54" : "#ebd6b0" }}
                >
                  {isSel && <span className="absolute inset-0 bg-blue-400/40" />}
                  {isTarget && (
                    <span
                      className={`absolute rounded-full bg-blue-500/60 ${cell ? "inset-1 bg-blue-500/30" : "h-3 w-3"}`}
                    />
                  )}
                  {cell && (
                    <span
                      className="relative z-10 leading-none"
                      style={{
                        color: color === "w" ? "#fafafa" : "#1a1a1a",
                        textShadow: color === "w" ? "0 1px 2px rgba(0,0,0,0.6)" : "0 1px 1px rgba(255,255,255,0.3)",
                      }}
                    >
                      {FILLED[cell.toLowerCase()]}
                    </span>
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <button onClick={reset} className="btn btn-primary">Новая игра</button>
      </div>
    </AppShell>
  );
}
