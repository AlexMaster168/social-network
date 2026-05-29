"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ChannelAvatar } from "@/components/ChannelAvatar";
import { ChannelMembers } from "@/components/ChannelMembers";
import { CreatePost } from "@/components/CreatePost";
import { PostCard } from "@/components/PostCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Channel, Post } from "@/lib/types";

export default function ChannelPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const imgRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { channel } = await api<{ channel: Channel }>(`/api/channels/${slug}`);
      setChannel(channel);
      const { posts } = await api<{ posts: Post[] }>(`/api/channels/${slug}/posts`);
      setPosts(posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Канал не найден");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function toggleSub() {
    if (!channel) return;
    await api(`/api/channels/${channel.id}/subscribe`, {
      method: channel.isSubscribed ? "DELETE" : "POST",
    });
    load();
  }

  function startEdit() {
    if (!channel) return;
    setForm({ name: channel.name, description: channel.description ?? "" });
    setEditing(true);
  }
  async function saveEdit() {
    if (!channel) return;
    await api(`/api/channels/${channel.id}`, {
      method: "PATCH",
      body: { name: form.name.trim(), description: form.description.trim() || null },
    });
    setEditing(false);
    load();
  }
  async function uploadImage(file: File | null) {
    if (!file || !channel) return;
    const fd = new FormData();
    fd.append("image", file);
    await api(`/api/channels/${channel.id}/image`, { form: fd });
    if (imgRef.current) imgRef.current.value = "";
    load();
  }

  async function removeChannel() {
    if (!channel || !confirm("Удалить канал со всеми постами?")) return;
    await api(`/api/channels/${channel.id}`, { method: "DELETE" });
    router.push("/channels");
  }

  const onChange = (u: Post) => setPosts((ps) => ps.map((p) => (p.id === u.id ? u : p)));
  const onDelete = (id: string) => setPosts((ps) => ps.filter((p) => p.id !== id));

  if (loading)
    return (
      <AppShell>
        <p className="text-muted">Загрузка…</p>
      </AppShell>
    );
  if (error || !channel)
    return (
      <AppShell>
        <p className="text-dislike">{error ?? "Канал не найден"}</p>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <ChannelAvatar imageUrl={channel.imageUrl} name={channel.name} size={64} rounded="rounded-2xl" />
          <div className="flex-1">
            {editing ? (
              <div className="flex flex-col gap-2">
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <textarea className="input min-h-16 resize-y" placeholder="Описание" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="btn btn-primary">Сохранить</button>
                  <button onClick={() => setEditing(false)} className="btn btn-ghost">Отмена</button>
                  <label className="btn btn-ghost cursor-pointer">
                    Сменить картинку
                    <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold">{channel.name}</h1>
                <div className="text-sm text-faint">
                  {channel.subscribers} подписчиков · автор @{channel.owner.username}
                </div>
                {channel.description && <p className="mt-2 text-sm">{channel.description}</p>}
              </>
            )}
          </div>
        </div>
        {!editing && (
          <div className="mt-4 flex gap-2">
            {channel.canManage && (
              <button onClick={startEdit} className="btn btn-ghost">Редактировать</button>
            )}
            {channel.isOwner ? (
              <button onClick={removeChannel} className="btn btn-ghost">Удалить канал</button>
            ) : (
              <button onClick={toggleSub} className={`btn ${channel.isSubscribed ? "btn-ghost" : "btn-primary"}`}>
                {channel.isSubscribed ? "Отписаться" : "Подписаться"}
              </button>
            )}
          </div>
        )}
      </div>

      {channel.canPost && (
        <div className="mt-4">
          <CreatePost
            endpoint={`/api/channels/${channel.id}/posts`}
            placeholder="Новый пост в канал…"
            onCreated={(post) => setPosts((ps) => [post, ...ps])}
          />
        </div>
      )}

      {/* участники видны всем участникам канала */}
      {channel.myRole && <ChannelMembers channelId={channel.id} myRole={channel.myRole} />}

      <div className="mt-4 flex flex-col gap-4">
        {posts.length === 0 ? (
          <div className="card p-6 text-center text-muted">В канале пока нет постов.</div>
        ) : (
          posts.map((p) => (
            <PostCard key={p.id} post={p} onChange={onChange} onDelete={onDelete} />
          ))
        )}
      </div>
    </AppShell>
  );
}
