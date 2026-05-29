"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

type Grid = number[][];
const SIZE = 4;

function empty(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function addRandom(g: Grid): Grid {
  const free: [number, number][] = [];
  g.forEach((row, r) => row.forEach((v, c) => v === 0 && free.push([r, c])));
  if (free.length === 0) return g;
  const idx = Math.floor((Date.now() % free.length));
  const [r, c] = free[idx % free.length];
  const ng = g.map((row) => [...row]);
  ng[r][c] = Math.random() < 0.9 ? 2 : 4;
  return ng;
}

function slide(row: number[]): { row: number[]; gained: number } {
  const nums = row.filter((v) => v !== 0);
  let gained = 0;
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i] === nums[i + 1]) {
      nums[i] *= 2;
      gained += nums[i];
      nums.splice(i + 1, 1);
    }
  }
  while (nums.length < SIZE) nums.push(0);
  return { row: nums, gained };
}

function rotate(g: Grid): Grid {
  const ng = empty();
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) ng[c][SIZE - 1 - r] = g[r][c];
  return ng;
}

function move(g: Grid, dir: "left" | "right" | "up" | "down") {
  let grid = g.map((row) => [...row]);
  let rotations = { left: 0, up: 1, right: 2, down: 3 }[dir];
  for (let i = 0; i < rotations; i++) grid = rotate(grid);
  let gained = 0;
  grid = grid.map((row) => {
    const res = slide(row);
    gained += res.gained;
    return res.row;
  });
  for (let i = 0; i < (4 - rotations) % 4; i++) grid = rotate(grid);
  return { grid, gained };
}

function equal(a: Grid, b: Grid) {
  return a.every((row, r) => row.every((v, c) => v === b[r][c]));
}

function canMove(g: Grid): boolean {
  for (const dir of ["left", "right", "up", "down"] as const) {
    if (!equal(g, move(g, dir).grid)) return true;
  }
  return false;
}

const COLORS: Record<number, string> = {
  2: "#3a3f52", 4: "#45506b", 8: "#5675f0", 16: "#6d8cff",
  32: "#7a5cff", 64: "#a14bff", 128: "#f7b733", 256: "#fc8a1a",
  512: "#fc4a1a", 1024: "#11998e", 2048: "#38ef7d",
};

export default function Game2048() {
  const [grid, setGrid] = useState<Grid>(empty);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);

  const reset = useCallback(() => {
    let g = addRandom(addRandom(empty()));
    setGrid(g);
    setScore(0);
    setOver(false);
    setWon(false);
  }, []);

  useEffect(() => {
    reset();
  }, [reset]);

  const handle = useCallback(
    (dir: "left" | "right" | "up" | "down") => {
      setGrid((cur) => {
        if (over) return cur;
        const { grid: moved, gained } = move(cur, dir);
        if (equal(cur, moved)) return cur;
        const next = addRandom(moved);
        setScore((s) => s + gained);
        if (next.some((row) => row.includes(2048))) setWon(true);
        if (!canMove(next)) setOver(true);
        return next;
      });
    },
    [over],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, "left" | "right" | "up" | "down"> = {
        ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        handle(dir);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handle]);

  return (
    <AppShell>
      <Link href="/games" className="text-sm text-muted hover:text-brand">← Все игры</Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">2048</h1>
        <div className="card px-4 py-2 text-center">
          <div className="text-xs text-muted">Счёт</div>
          <div className="text-xl font-bold">{score}</div>
        </div>
      </div>
      <p className="mb-4 mt-1 text-sm text-muted">Стрелки на клавиатуре или кнопки ниже.</p>

      <div className="card mx-auto w-fit p-3">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
          {grid.flatMap((row, r) =>
            row.map((v, c) => (
              <div
                key={`${r}-${c}`}
                className="flex h-16 w-16 items-center justify-center rounded-lg text-xl font-bold sm:h-20 sm:w-20"
                style={{
                  background: v ? COLORS[v] ?? "#38ef7d" : "var(--color-surface-2)",
                  color: v <= 4 ? "var(--color-ink)" : "#fff",
                }}
              >
                {v || ""}
              </div>
            )),
          )}
        </div>
      </div>

      {(over || won) && (
        <div className="mt-4 text-center">
          <p className="text-lg font-semibold">
            {won ? "🎉 Ты собрал 2048!" : "💀 Игра окончена"}
          </p>
        </div>
      )}

      {/* Кнопки управления (для мобилы/мыши) */}
      <div className="mx-auto mt-4 grid w-44 grid-cols-3 gap-2">
        <span />
        <button onClick={() => handle("up")} className="btn btn-ghost">↑</button>
        <span />
        <button onClick={() => handle("left")} className="btn btn-ghost">←</button>
        <button onClick={reset} className="btn btn-primary text-xs">↺</button>
        <button onClick={() => handle("right")} className="btn btn-ghost">→</button>
        <span />
        <button onClick={() => handle("down")} className="btn btn-ghost">↓</button>
        <span />
      </div>
    </AppShell>
  );
}
