"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { relationshipLabels } from "@/lib/format";
import type { DiscoverUser, FriendState, Relationship } from "@/lib/types";

const RELATIONSHIPS: Relationship[] = [
  "single",
  "in_relationship",
  "engaged",
  "married",
  "complicated",
];

export default function PeoplePage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ q: "", city: "", relationship: "", ageMin: "", ageMax: "" });
  const [results, setResults] = useState<DiscoverUser[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.city.trim()) params.set("city", filters.city.trim());
      if (filters.relationship) params.set("relationship", filters.relationship);
      if (filters.ageMin) params.set("ageMin", filters.ageMin);
      if (filters.ageMax) params.set("ageMax", filters.ageMax);
      const { users } = await api<{ users: DiscoverUser[] }>(
        `/api/users/discover/search?${params.toString()}`,
      );
      setResults(users);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // автопоиск с дебаунсом при смене фильтров
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(search, 350);
    return () => clearTimeout(t);
  }, [user, search]);

  async function act(u: DiscoverUser) {
    if (u.friendState === "none") await api("/api/friends/request", { body: { userId: u.id } });
    else if (u.friendState === "incoming") await api("/api/friends/accept", { body: { userId: u.id } });
    else return;
    search();
  }

  const btnLabel: Record<FriendState, string> = {
    none: "Добавить",
    outgoing: "Заявка отправлена",
    incoming: "Принять заявку",
    friends: "В друзьях",
  };

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Поиск людей</h1>
        <Link href="/friends" className="text-sm text-brand hover:underline">
          ← Мои друзья
        </Link>
      </div>

      {/* фильтры */}
      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm text-muted">Имя или username</label>
          <input
            className="input"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">Город</label>
          <input
            className="input"
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">Семейное положение</label>
          <select
            className="input"
            value={filters.relationship}
            onChange={(e) => setFilters({ ...filters, relationship: e.target.value })}
          >
            <option value="">— любое —</option>
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {relationshipLabels[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">Возраст от</label>
          <input
            type="number"
            min={0}
            className="input"
            value={filters.ageMin}
            onChange={(e) => setFilters({ ...filters, ageMin: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">Возраст до</label>
          <input
            type="number"
            min={0}
            className="input"
            value={filters.ageMax}
            onChange={(e) => setFilters({ ...filters, ageMax: e.target.value })}
          />
        </div>
      </div>

      {/* результаты */}
      {loading ? (
        <p className="text-muted">Поиск…</p>
      ) : results.length === 0 ? (
        <div className="card p-8 text-center text-muted">Никого не нашлось. Поменяй фильтры.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {results.map((u) => (
            <div key={u.id} className="card flex items-center gap-3 p-3">
              <Link href={`/profile/${u.username}`}>
                <Avatar url={u.avatarUrl} name={u.displayName} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/profile/${u.username}`} className="font-medium hover:underline">
                  {u.displayName}
                </Link>
                <div className="truncate text-xs text-faint">
                  @{u.username}
                  {u.city && ` · ${u.city}`}
                  {u.relationship && ` · ${relationshipLabels[u.relationship]}`}
                </div>
              </div>
              <button
                onClick={() => act(u)}
                disabled={u.friendState === "outgoing" || u.friendState === "friends"}
                className={`btn ${u.friendState === "none" || u.friendState === "incoming" ? "btn-primary" : "btn-ghost"}`}
              >
                {btnLabel[u.friendState]}
              </button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
