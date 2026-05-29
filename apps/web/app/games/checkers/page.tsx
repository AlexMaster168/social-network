"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  applyStep,
  bestMove,
  capturesFrom,
  initBoard,
  quietFrom,
  sideHasCapture,
  sideOf,
  winner,
  type Board,
} from "@/lib/checkers";

export default function CheckersGame() {
  const [board, setBoard] = useState<Board>(initBoard);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [turn, setTurn] = useState<"w" | "b">("w");
  const [chainFrom, setChainFrom] = useState<[number, number] | null>(null);
  const [result, setResult] = useState<"w" | "b" | null>(null);
  const [thinking, setThinking] = useState(false);

  const reset = useCallback(() => {
    setBoard(initBoard());
    setSelected(null);
    setTurn("w");
    setChainFrom(null);
    setResult(null);
    setThinking(false);
  }, []);

  // целевые клетки для выбранной шашки
  function targetsFor(b: Board, r: number, c: number, forceCapture: boolean): [number, number][] {
    if (forceCapture) return capturesFrom(b, r, c).map((x) => x.to);
    return sideHasCapture(b, "w")
      ? capturesFrom(b, r, c).map((x) => x.to)
      : quietFrom(b, r, c);
  }

  // ход бота
  const botMove = useCallback((b: Board) => {
    setThinking(true);
    setTimeout(() => {
      const move = bestMove(b, 5);
      if (!move) {
        setResult("w");
        setThinking(false);
        return;
      }
      setBoard(move.result);
      setThinking(false);
      const w = winner(move.result);
      if (w) setResult(w);
      else setTurn("w");
    }, 250);
  }, []);

  function handleCell(r: number, c: number) {
    if (turn !== "w" || result || thinking) return;
    const cell = board[r][c];

    // продолжение цепочки боя — выбран фиксирован
    if (chainFrom) {
      const [sr, sc] = chainFrom;
      const targets = targetsFor(board, sr, sc, true);
      if (targets.some(([tr, tc]) => tr === r && tc === c)) {
        const { board: nb, canContinue } = applyStep(board, chainFrom, [r, c]);
        setBoard(nb);
        if (canContinue) {
          setChainFrom([r, c]);
          setSelected([r, c]);
        } else {
          setSelected(null);
          setChainFrom(null);
          const w = winner(nb);
          if (w) setResult(w);
          else {
            setTurn("b");
            botMove(nb);
          }
        }
      }
      return;
    }

    // выбор своей шашки
    if (sideOf(cell) === "w") {
      const targets = targetsFor(board, r, c, false);
      setSelected(targets.length ? [r, c] : null);
      return;
    }

    // ход выбранной шашкой
    if (selected) {
      const [sr, sc] = selected;
      const targets = targetsFor(board, sr, sc, false);
      if (targets.some(([tr, tc]) => tr === r && tc === c)) {
        const { board: nb, captured, canContinue } = applyStep(board, selected, [r, c]);
        setBoard(nb);
        if (captured && canContinue) {
          setChainFrom([r, c]);
          setSelected([r, c]);
        } else {
          setSelected(null);
          const w = winner(nb);
          if (w) setResult(w);
          else {
            setTurn("b");
            botMove(nb);
          }
        }
      } else {
        setSelected(null);
      }
    }
  }

  const highlight =
    selected !== null
      ? targetsFor(board, selected[0], selected[1], chainFrom !== null)
      : [];

  const status = result
    ? result === "w"
      ? "🎉 Ты победил!"
      : "🤖 Бот победил"
    : thinking
      ? "Бот думает…"
      : chainFrom
        ? "Продолжай бой!"
        : "Твой ход (белые)";

  return (
    <AppShell>
      <Link href="/games" className="text-sm text-muted hover:text-brand">← Все игры</Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">Шашки</h1>
      <p className="mb-4 text-sm text-muted">{status}</p>

      <div className="card mx-auto w-fit p-3">
        <div className="grid grid-cols-8 overflow-hidden rounded-lg">
          {board.map((row, r) =>
            row.map((cell, c) => {
              const dark = (r + c) % 2 === 1;
              const isSel = selected && selected[0] === r && selected[1] === c;
              const isTarget = highlight.some(([tr, tc]) => tr === r && tc === c);
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => handleCell(r, c)}
                  className="relative flex h-11 w-11 items-center justify-center sm:h-14 sm:w-14"
                  style={{ background: dark ? "#6b4f2e" : "#d9b88f" }}
                >
                  {isSel && <span className="absolute inset-0 bg-blue-400/40" />}
                  {isTarget && (
                    <span className="absolute h-3 w-3 rounded-full bg-blue-400/70" />
                  )}
                  {cell && (
                    <span
                      className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full sm:h-10 sm:w-10"
                      style={{
                        background: sideOf(cell) === "w"
                          ? "radial-gradient(circle at 35% 30%, #fff, #cfd3da)"
                          : "radial-gradient(circle at 35% 30%, #555, #1b1b1b)",
                        border: "2px solid rgba(0,0,0,0.3)",
                        color: "#f7b733",
                        fontSize: "1.1rem",
                      }}
                    >
                      {(cell === "W" || cell === "B") && "♛"}
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
