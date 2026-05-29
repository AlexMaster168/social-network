"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { GoogleButton } from "@/components/GoogleButton";
import { useAuth } from "@/lib/auth";

function LoginInner() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ login: "", password: "" });
  const [error, setError] = useState<string | null>(() => {
    const e = searchParams.get("error");
    if (e === "google_not_configured") return "Google-вход не настроен на сервере (нужны GOOGLE_CLIENT_ID/SECRET)";
    if (e === "google_failed") return "Не удалось войти через Google. Попробуй ещё раз.";
    return null;
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(form.login, form.password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm p-7">
        <div className="mb-6 flex items-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl font-extrabold text-white"
            style={{ background: "linear-gradient(135deg, #6d8cff, #5675f0)" }}
          >
            S
          </span>
          <h1 className="text-2xl font-bold">SocialNet</h1>
        </div>
        <p className="mb-6 text-sm text-muted">С возвращением! Войди в аккаунт.</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-dislike">{error}</div>
        )}

        <label className="mb-1 block text-sm text-muted">Логин или email</label>
        <input
          className="input mb-4"
          value={form.login}
          onChange={(e) => setForm({ ...form, login: e.target.value })}
          autoComplete="username"
        />

        <label className="mb-1 block text-sm text-muted">Пароль</label>
        <input
          type="password"
          className="input mb-6"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          autoComplete="current-password"
        />

        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting ? "Входим…" : "Войти"}
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-faint">
          <span className="h-px flex-1 bg-border" />
          или
          <span className="h-px flex-1 bg-border" />
        </div>
        <GoogleButton />

        <p className="mt-5 text-center text-sm text-muted">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-brand hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
