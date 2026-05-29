"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";

const CELLS = 20;
const CELL = 18;
const SIZE = CELLS * CELL;

type P = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";

export default function Snake() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [running, setRunning] = useState(false);

  // изменяемое состояние игры держим в ref, чтобы цикл не пересоздавался
  const game = useRef({
    snake: [{ x: 10, y: 10 }] as P[],
    dir: "right" as Dir,
    nextDir: "right" as Dir,
    food: { x: 15, y: 10 } as P,
  });

  const placeFood = useCallback(() => {
    const g = game.current;
    let f: P;
    do {
      f = { x: Math.floor(Math.random() * CELLS), y: Math.floor(Math.random() * CELLS) };
    } while (g.snake.some((s) => s.x === f.x && s.y === f.y));
    g.food = f;
  }, []);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const g = game.current;
    ctx.fillStyle = "#14161f";
    ctx.fillRect(0, 0, SIZE, SIZE);
    // еда
    ctx.fillStyle = "#f87171";
    ctx.beginPath();
    ctx.arc(g.food.x * CELL + CELL / 2, g.food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    // змея
    g.snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? "#38ef7d" : "#11998e";
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }, []);

  const reset = useCallback(() => {
    game.current = {
      snake: [{ x: 10, y: 10 }],
      dir: "right",
      nextDir: "right",
      food: { x: 15, y: 10 },
    };
    setScore(0);
    setOver(false);
    setRunning(true);
    placeFood();
    draw();
  }, [placeFood, draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  // игровой цикл
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      const g = game.current;
      g.dir = g.nextDir;
      const head = { ...g.snake[0] };
      if (g.dir === "up") head.y--;
      if (g.dir === "down") head.y++;
      if (g.dir === "left") head.x--;
      if (g.dir === "right") head.x++;

      // столкновение со стеной или собой
      if (
        head.x < 0 || head.x >= CELLS || head.y < 0 || head.y >= CELLS ||
        g.snake.some((s) => s.x === head.x && s.y === head.y)
      ) {
        setRunning(false);
        setOver(true);
        return;
      }

      g.snake.unshift(head);
      if (head.x === g.food.x && head.y === g.food.y) {
        setScore((s) => s + 1);
        placeFood();
      } else {
        g.snake.pop();
      }
      draw();
    }, 110);
    return () => clearInterval(tick);
  }, [running, placeFood, draw]);

  // управление
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = game.current;
      const opposite: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
      const map: Record<string, Dir> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
      };
      const d = map[e.key];
      if (d) {
        e.preventDefault();
        if (d !== opposite[g.dir]) g.nextDir = d;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const turn = (d: Dir) => {
    const g = game.current;
    const opposite: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
    if (d !== opposite[g.dir]) g.nextDir = d;
  };

  return (
    <AppShell>
      <Link href="/games" className="text-sm text-muted hover:text-brand">← Все игры</Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Змейка</h1>
        <div className="card px-4 py-2 text-center">
          <div className="text-xs text-muted">Счёт</div>
          <div className="text-xl font-bold">{score}</div>
        </div>
      </div>
      <p className="mb-4 mt-1 text-sm text-muted">Управление стрелками или кнопками.</p>

      <div className="card mx-auto w-fit p-3">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className="rounded-lg"
          style={{ display: "block" }}
        />
      </div>

      {over && <p className="mt-4 text-center text-lg font-semibold">💀 Игра окончена! Счёт: {score}</p>}

      <div className="mt-4 flex flex-col items-center gap-3">
        <button onClick={reset} className="btn btn-primary">
          {running ? "Заново" : "Старт"}
        </button>
        <div className="grid w-44 grid-cols-3 gap-2">
          <span />
          <button onClick={() => turn("up")} className="btn btn-ghost">↑</button>
          <span />
          <button onClick={() => turn("left")} className="btn btn-ghost">←</button>
          <span />
          <button onClick={() => turn("right")} className="btn btn-ghost">→</button>
          <span />
          <button onClick={() => turn("down")} className="btn btn-ghost">↓</button>
          <span />
        </div>
      </div>
    </AppShell>
  );
}
