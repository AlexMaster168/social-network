"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ChannelAvatar } from "@/components/ChannelAvatar";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Channel } from "@/lib/types";

export default function ChannelsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { channels } = await api<{ channels: Channel[] }>("/api/channels");
    setChannels(channels);
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function create() {
    if (form.name.trim().length < 2) {
      setError("Название минимум 2 символа");
      return;
    }
    try {
      const { channel } = await api<{ channel: { slug: string } }>("/api/channels", {
        body: { name: form.name.trim(), description: form.description.trim() || undefined },
      });
      router.push(`/channels/${channel.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать");
    }
  }

  async function toggleSub(ch: Channel) {
    await api(`/api/channels/${ch.id}/subscribe`, { method: ch.isSubscribed ? "DELETE" : "POST" });
    load();
  }

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Каналы</h1>
        <button onClick={() => setCreating((v) => !v)} className="btn btn-primary">
          {creating ? "Закрыть" : "Создать канал"}
        </button>
      </div>

      {creating && (
        <div className="card mb-4 p-4">
          {error && <div className="mb-2 text-sm text-dislike">{error}</div>}
          <label className="mb-1 block text-sm text-muted">Название</label>
          <input
            className="input mb-3"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <label className="mb-1 block text-sm text-muted">Описание</label>
          <textarea
            className="input mb-3 min-h-20 resize-y"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <button onClick={create} className="btn btn-primary">
            Создать
          </button>
        </div>
      )}

      {channels.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          Каналов пока нет. Создай первый!
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {channels.map((ch) => (
            <div key={ch.id} className="card flex items-center gap-3 p-4">
              <ChannelAvatar imageUrl={ch.imageUrl} name={ch.name} size={48} />
              <div className="min-w-0 flex-1">
                <Link href={`/channels/${ch.slug}`} className="font-semibold hover:underline">
                  {ch.name}
                </Link>
                <div className="truncate text-xs text-faint">
                  {ch.subscribers} подписчиков · @{ch.owner.username}
                  {ch.isOwner && " · твой"}
                </div>
              </div>
              {!ch.isOwner && (
                <button
                  onClick={() => toggleSub(ch)}
                  className={`btn ${ch.isSubscribed ? "btn-ghost" : "btn-primary"}`}
                >
                  {ch.isSubscribed ? "Отписаться" : "Подписаться"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
