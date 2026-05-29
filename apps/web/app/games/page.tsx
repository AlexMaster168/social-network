"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";

const games = [
  {
    href: "/games/tic-tac-toe",
    title: "Крестики-нолики",
    desc: "Сыграй против бота. Попробуй обыграть — он не промах.",
    emoji: "❌⭕",
    bg: "linear-gradient(135deg, #6d8cff, #5675f0)",
  },
  {
    href: "/games/2048",
    title: "2048",
    desc: "Двигай плитки, складывай числа, дойди до 2048.",
    emoji: "🔢",
    bg: "linear-gradient(135deg, #f7b733, #fc4a1a)",
  },
  {
    href: "/games/snake",
    title: "Змейка",
    desc: "Классика. Собирай еду, расти и не врежься в себя.",
    emoji: "🐍",
    bg: "linear-gradient(135deg, #11998e, #38ef7d)",
  },
  {
    href: "/games/checkers",
    title: "Шашки",
    desc: "Русские шашки против бота. Обязательный бой, дамки.",
    emoji: "⛀",
    bg: "linear-gradient(135deg, #8e44ad, #c0392b)",
  },
  {
    href: "/games/chess",
    title: "Шахматы",
    desc: "Сыграй партию против бота. Мат — и победа твоя.",
    emoji: "♟️",
    bg: "linear-gradient(135deg, #2c3e50, #4ca1af)",
  },
];

export default function GamesPage() {
  return (
    <AppShell>
      <h1 className="mb-1 text-2xl font-bold">Игры</h1>
      <p className="mb-5 text-sm text-muted">Мини-игры прямо в соцсети. Жми и играй.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {games.map((g) => (
          <Link key={g.href} href={g.href} className="card overflow-hidden transition-transform hover:-translate-y-1">
            <div className="flex h-28 items-center justify-center text-4xl" style={{ background: g.bg }}>
              {g.emoji}
            </div>
            <div className="p-4">
              <div className="font-semibold">{g.title}</div>
              <div className="mt-1 text-sm text-muted">{g.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
