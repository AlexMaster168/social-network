"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CreatePost } from "@/components/CreatePost";
import { PostCard } from "@/components/PostCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Post } from "@/lib/types";

export default function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { posts } = await api<{ posts: Post[] }>("/api/posts");
      setPosts(posts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const onChange = (updated: Post) =>
    setPosts((ps) => ps.map((p) => (p.id === updated.id ? updated : p)));
  const onDelete = (id: string) => setPosts((ps) => ps.filter((p) => p.id !== id));

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-bold">Лента</h1>
      <div className="flex flex-col gap-4">
        <CreatePost onCreated={(post) => setPosts((ps) => [post, ...ps])} />
        {loading ? (
          <p className="text-muted">Загрузка ленты…</p>
        ) : posts.length === 0 ? (
          <div className="card p-8 text-center text-muted">
            Пока пусто. Опубликуй первый пост или найди друзей!
          </div>
        ) : (
          posts.map((p) => (
            <PostCard key={p.id} post={p} onChange={onChange} onDelete={onDelete} />
          ))
        )}
      </div>
    </AppShell>
  );
}
