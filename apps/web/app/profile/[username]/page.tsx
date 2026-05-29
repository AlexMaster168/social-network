"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { MusicSection } from "@/components/MusicSection";
import { PostCard } from "@/components/PostCard";
import { api, fileUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatBirthday, relationshipLabels } from "@/lib/format";
import type { FriendState, Photo, Post, ProfileResponse, Relationship } from "@/lib/types";

const RELATIONSHIPS: Relationship[] = [
  "single",
  "in_relationship",
  "engaged",
  "married",
  "complicated",
];

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const { refresh, user: authUser } = useAuth();

  const [data, setData] = useState<ProfileResponse | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    status: "",
    city: "",
    birthday: "",
    relationship: "" as Relationship | "",
    bio: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await api<ProfileResponse>(`/api/users/${username}`);
      setData(profile);
      const { posts } = await api<{ posts: Post[] }>(`/api/posts?author=${username}`);
      setPosts(posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить профиль");
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (authUser) load();
  }, [authUser, load]);

  function startEdit() {
    if (!data) return;
    const u = data.user;
    setForm({
      displayName: u.displayName,
      status: u.status ?? "",
      city: u.city ?? "",
      birthday: u.birthday ?? "",
      relationship: u.relationship ?? "",
      bio: u.bio ?? "",
    });
    setEditing(true);
  }

  async function saveProfile() {
    await api("/api/users/me", {
      method: "PATCH",
      body: {
        displayName: form.displayName,
        status: form.status || null,
        city: form.city || null,
        birthday: form.birthday || null,
        relationship: form.relationship || null,
        bio: form.bio || null,
      },
    });
    setEditing(false);
    await load();
    await refresh();
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    await api("/api/users/me/photos", { form: fd });
    if (fileRef.current) fileRef.current.value = "";
    await load();
    await refresh();
  }

  async function setMain(photo: Photo) {
    await api("/api/users/me/avatar", { method: "PATCH", body: { photoId: photo.id } });
    await load();
    await refresh();
  }
  async function setCover(photo: Photo) {
    await api("/api/users/me/cover", { method: "PATCH", body: { photoId: photo.id } });
    await load();
  }
  async function deletePhoto(photo: Photo) {
    if (!confirm("Удалить фото?")) return;
    await api(`/api/users/me/photos/${photo.id}`, { method: "DELETE" });
    await load();
    await refresh();
  }

  async function friendAction(state: FriendState) {
    if (!data) return;
    const id = data.user.id;
    if (state === "none") await api("/api/friends/request", { body: { userId: id } });
    else if (state === "incoming") await api("/api/friends/accept", { body: { userId: id } });
    else await api(`/api/friends/${id}`, { method: "DELETE" });
    await load();
  }

  async function startChat() {
    if (!data) return;
    const { conversationId } = await api<{ conversationId: string }>("/api/conversations/direct", {
      body: { userId: data.user.id },
    });
    router.push(`/messages?c=${conversationId}`);
  }

  const onPostChange = (u: Post) => setPosts((ps) => ps.map((p) => (p.id === u.id ? u : p)));
  const onPostDelete = (id: string) => setPosts((ps) => ps.filter((p) => p.id !== id));

  if (loading)
    return (
      <AppShell wide>
        <p className="text-muted">Загрузка профиля…</p>
      </AppShell>
    );
  if (error || !data)
    return (
      <AppShell wide>
        <p className="text-dislike">{error ?? "Профиль не найден"}</p>
      </AppShell>
    );

  const { user, photos, tracks, friendState, isMe, counts } = data;
  const cover = fileUrl(user.coverUrl);

  const friendBtn: Record<FriendState, { label: string; primary: boolean }> = {
    none: { label: "Добавить в друзья", primary: true },
    outgoing: { label: "Отменить заявку", primary: false },
    incoming: { label: "Принять заявку", primary: true },
    friends: { label: "Удалить из друзей", primary: false },
  };

  const infoRows: { label: string; value: string | null }[] = [
    { label: "Город", value: user.city },
    { label: "День рождения", value: formatBirthday(user.birthday) },
    { label: "Семейное положение", value: user.relationship ? relationshipLabels[user.relationship] : null },
  ];

  return (
    <AppShell wide>
      <div className="mx-auto max-w-3xl">
        {/* ===== Шапка с обложкой ===== */}
        <div className="card overflow-hidden">
          <div
            className="h-40 w-full sm:h-56"
            style={{
              background: cover
                ? `center/cover no-repeat url(${cover})`
                : "linear-gradient(135deg, #2a3566, #1d2030)",
            }}
          />
          <div className="px-5 pb-5">
            <div className="-mt-12 flex items-end justify-between">
              <div className="rounded-full ring-4 ring-surface">
                <Avatar url={user.avatarUrl} name={user.displayName} size={96} />
              </div>
              <div className="flex gap-2">
                {isMe ? (
                  <>
                    <button onClick={startEdit} className="btn btn-ghost">
                      Редактировать
                    </button>
                    <label className="btn btn-primary cursor-pointer">
                      Загрузить фото
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => uploadPhotos(e.target.files)}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => friendAction(friendState)}
                      className={`btn ${friendBtn[friendState].primary ? "btn-primary" : "btn-ghost"}`}
                    >
                      {friendBtn[friendState].label}
                    </button>
                    <button onClick={startChat} className="btn btn-ghost">
                      Написать
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-3">
              <h1 className="text-2xl font-bold">{user.displayName}</h1>
              <div className="text-sm text-faint">@{user.username}</div>
              {user.status && <p className="mt-2 text-[15px]">{user.status}</p>}
            </div>

            {/* счётчики */}
            <div className="mt-4 flex gap-6 text-sm">
              <span>
                <b>{counts.posts}</b> <span className="text-muted">постов</span>
              </span>
              <span>
                <b>{counts.friends}</b> <span className="text-muted">друзей</span>
              </span>
            </div>
          </div>
        </div>

        {/* ===== Режим редактирования ===== */}
        {editing && (
          <div className="card mt-4 p-5">
            <h2 className="mb-3 font-semibold">Редактирование профиля</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-muted">Имя</label>
                <input
                  className="input"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Город</label>
                <input
                  className="input"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">День рождения</label>
                <input
                  type="date"
                  className="input"
                  value={form.birthday}
                  onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Семейное положение</label>
                <select
                  className="input"
                  value={form.relationship}
                  onChange={(e) =>
                    setForm({ ...form, relationship: e.target.value as Relationship | "" })
                  }
                >
                  <option value="">— не указано —</option>
                  {RELATIONSHIPS.map((r) => (
                    <option key={r} value={r}>
                      {relationshipLabels[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-muted">Статус</label>
                <input
                  className="input"
                  maxLength={140}
                  placeholder="Короткая строка под именем"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-muted">О себе</label>
                <textarea
                  className="input min-h-24 resize-y"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={saveProfile} className="btn btn-primary">
                Сохранить
              </button>
              <button onClick={() => setEditing(false)} className="btn btn-ghost">
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* ===== Информация ===== */}
        {!editing && (infoRows.some((r) => r.value) || user.bio) && (
          <div className="card mt-4 p-5">
            <h2 className="mb-3 font-semibold">Информация</h2>
            <div className="flex flex-col gap-2 text-sm">
              {infoRows
                .filter((r) => r.value)
                .map((r) => (
                  <div key={r.label} className="flex gap-2">
                    <span className="w-40 shrink-0 text-muted">{r.label}</span>
                    <span>{r.value}</span>
                  </div>
                ))}
              {user.bio && (
                <div className="flex gap-2">
                  <span className="w-40 shrink-0 text-muted">О себе</span>
                  <span className="whitespace-pre-wrap">{user.bio}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== Галерея фото ===== */}
        {photos.length > 0 && (
          <div className="card mt-4 p-5">
            <h2 className="mb-3 font-semibold">Фотографии</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fileUrl(photo.url)!}
                    alt=""
                    className="aspect-square w-full rounded-lg object-cover"
                    style={{
                      outline: photo.id === user.avatarPhotoId ? "2px solid var(--color-brand)" : "none",
                    }}
                  />
                  {isMe && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      {photo.id !== user.avatarPhotoId && (
                        <button onClick={() => setMain(photo)} className="text-xs text-white hover:text-brand">
                          На аватар
                        </button>
                      )}
                      <button onClick={() => setCover(photo)} className="text-xs text-white hover:text-brand">
                        В обложку
                      </button>
                      <button onClick={() => deletePhoto(photo)} className="text-xs text-dislike">
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== Музыка ===== */}
        <MusicSection tracks={tracks} isMe={isMe} onChange={load} />

        {/* ===== Посты ===== */}
        <div className="mt-6 flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Посты</h2>
          {posts.length === 0 ? (
            <div className="card p-6 text-center text-muted">Постов пока нет.</div>
          ) : (
            posts.map((p) => (
              <PostCard key={p.id} post={p} onChange={onPostChange} onDelete={onPostDelete} />
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
