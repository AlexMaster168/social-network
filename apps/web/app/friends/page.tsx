"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { UserBrief } from "@/lib/types";

export default function FriendsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [friends, setFriends] = useState<UserBrief[]>([]);
  const [incoming, setIncoming] = useState<UserBrief[]>([]);
  const [outgoing, setOutgoing] = useState<UserBrief[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserBrief[]>([]);

  const load = useCallback(async () => {
    const [f, inc, out] = await Promise.all([
      api<{ friends: UserBrief[] }>("/api/friends"),
      api<{ requests: UserBrief[] }>("/api/friends/requests/incoming"),
      api<{ requests: UserBrief[] }>("/api/friends/requests/outgoing"),
    ]);
    setFriends(f.friends);
    setIncoming(inc.requests);
    setOutgoing(out.requests);
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // поиск с дебаунсом
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { users } = await api<{ users: UserBrief[] }>(
        `/api/users/search?q=${encodeURIComponent(q)}`,
      );
      setResults(users);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const addFriend = async (id: string) => {
    await api("/api/friends/request", { body: { userId: id } });
    await load();
  };
  const accept = async (id: string) => {
    await api("/api/friends/accept", { body: { userId: id } });
    await load();
  };
  const remove = async (id: string) => {
    await api(`/api/friends/${id}`, { method: "DELETE" });
    await load();
  };
  const startChat = async (id: string) => {
    const { conversationId } = await api<{ conversationId: string }>("/api/conversations/direct", {
      body: { userId: id },
    });
    router.push(`/messages?c=${conversationId}`);
  };

  const Row = ({ u, actions }: { u: UserBrief; actions: React.ReactNode }) => (
    <div className="card flex items-center gap-3 p-3">
      <Link href={`/profile/${u.username}`}>
        <Avatar url={u.avatarUrl} name={u.displayName} />
      </Link>
      <div className="flex-1">
        <Link href={`/profile/${u.username}`} className="font-medium hover:underline">
          {u.displayName}
        </Link>
        <div className="text-xs text-faint">@{u.username}</div>
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );

  const btn = (label: string, onClick: () => void, primary = false) => (
    <button onClick={onClick} className={`btn ${primary ? "btn-primary" : "btn-ghost"}`}>
      {label}
    </button>
  );

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Друзья</h1>
        <Link href="/people" className="text-sm text-brand hover:underline">
          Поиск с фильтрами →
        </Link>
      </div>

      {/* Быстрый поиск */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Найти людей по имени или username…"
        className="input mb-4"
      />
      {results.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {results.map((u) => (
            <Row key={u.id} u={u} actions={btn("Добавить", () => addFriend(u.id), true)} />
          ))}
        </div>
      )}

      {incoming.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-muted">
            Входящие заявки
          </h2>
          <div className="flex flex-col gap-2">
            {incoming.map((u) => (
              <Row
                key={u.id}
                u={u}
                actions={
                  <>
                    {btn("Принять", () => accept(u.id), true)}
                    {btn("Отклонить", () => remove(u.id))}
                  </>
                }
              />
            ))}
          </div>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-muted">
            Исходящие заявки
          </h2>
          <div className="flex flex-col gap-2">
            {outgoing.map((u) => (
              <Row key={u.id} u={u} actions={btn("Отменить", () => remove(u.id))} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">Мои друзья ({friends.length})</h2>
        {friends.length === 0 ? (
          <p className="text-muted">Пока никого. Найди людей через поиск выше.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {friends.map((u) => (
              <Row
                key={u.id}
                u={u}
                actions={
                  <>
                    {btn("Написать", () => startChat(u.id), true)}
                    {btn("Удалить", () => remove(u.id))}
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
