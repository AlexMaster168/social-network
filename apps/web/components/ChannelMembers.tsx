"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ChannelMember, ChannelRole, UserBrief } from "@/lib/types";
import { Avatar } from "./Avatar";

const ROLE_LABEL: Record<ChannelRole, string> = {
  owner: "Владелец",
  admin: "Админ",
  member: "Участник",
};

interface Props {
  channelId: string;
  myRole: ChannelRole | null;
}

export function ChannelMembers({ channelId, myRole }: Props) {
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserBrief[]>([]);

  const canManage = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";

  const load = useCallback(async () => {
    const { members } = await api<{ members: ChannelMember[] }>(`/api/channels/${channelId}/members`);
    setMembers(members);
  }, [channelId]);

  useEffect(() => {
    load();
  }, [load]);

  // поиск пользователей для добавления
  useEffect(() => {
    const q = query.trim();
    if (!q || !canManage) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { users } = await api<{ users: UserBrief[] }>(
        `/api/users/search?q=${encodeURIComponent(q)}`,
      );
      const memberIds = new Set(members.map((m) => m.id));
      setResults(users.filter((u) => !memberIds.has(u.id)));
    }, 300);
    return () => clearTimeout(t);
  }, [query, canManage, members]);

  async function addMember(userId: string, role: "member" | "admin" = "member") {
    await api(`/api/channels/${channelId}/members`, { body: { userId, role } });
    setQuery("");
    setResults([]);
    load();
  }
  async function changeRole(userId: string, role: "admin" | "member") {
    await api(`/api/channels/${channelId}/members/${userId}`, { method: "PATCH", body: { role } });
    load();
  }
  async function removeMember(userId: string) {
    if (!confirm("Удалить участника из канала?")) return;
    await api(`/api/channels/${channelId}/members/${userId}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="card mt-4 p-5">
      <h2 className="mb-3 font-semibold">Участники ({members.length})</h2>

      {canManage && (
        <div className="relative mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Добавить участника по имени/username…"
            className="input"
          />
          {results.length > 0 && (
            <div className="card absolute z-10 mt-1 w-full p-1">
              {results.map((u) => (
                <div key={u.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                  <Avatar url={u.avatarUrl} name={u.displayName} size={28} />
                  <span className="flex-1 truncate text-sm">{u.displayName}</span>
                  <button onClick={() => addMember(u.id, "member")} className="text-xs text-brand">
                    + участник
                  </button>
                  {isOwner && (
                    <button onClick={() => addMember(u.id, "admin")} className="text-xs text-brand">
                      + админ
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3">
            <Link href={`/profile/${m.username}`}>
              <Avatar url={m.avatarUrl} name={m.displayName} size={36} />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/profile/${m.username}`} className="text-sm font-medium hover:underline">
                {m.displayName}
              </Link>
              <div className="text-xs text-faint">@{m.username}</div>
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-xs"
              style={{
                background: m.role === "owner" ? "rgba(247,183,51,0.2)" : m.role === "admin" ? "rgba(109,140,255,0.2)" : "var(--color-surface-3)",
                color: m.role === "owner" ? "#f7b733" : m.role === "admin" ? "var(--color-brand)" : "var(--color-muted)",
              }}
            >
              {ROLE_LABEL[m.role]}
            </span>

            {/* управление: владелец меняет роли, owner/admin удаляют member */}
            {m.role !== "owner" && (
              <div className="flex gap-2">
                {isOwner && m.role === "member" && (
                  <button onClick={() => changeRole(m.id, "admin")} className="text-xs text-faint hover:text-brand">
                    ↑ админ
                  </button>
                )}
                {isOwner && m.role === "admin" && (
                  <button onClick={() => changeRole(m.id, "member")} className="text-xs text-faint hover:text-brand">
                    ↓ участник
                  </button>
                )}
                {canManage && !(myRole === "admin" && m.role === "admin") && (
                  <button onClick={() => removeMember(m.id)} className="text-xs text-faint hover:text-dislike">
                    удалить
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
