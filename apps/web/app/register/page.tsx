"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GoogleButton } from "@/components/GoogleButton";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { register, user, loading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ displayName: "", username: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(form);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
    } finally {
      setSubmitting(false);
    }
  }

  const field = (
    label: string,
    key: keyof typeof form,
    type = "text",
    autoComplete?: string,
  ) => (
    <>
      <label className="mb-1 block text-sm text-muted">{label}</label>
      <input
        type={type}
        autoComplete={autoComplete}
        className="input mb-4"
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </>
  );

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
        <p className="mb-6 text-sm text-muted">Создай аккаунт за минуту.</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-dislike">{error}</div>
        )}

        {field("Имя", "displayName")}
        {field("Username (латиница)", "username")}
        {field("Email", "email", "email", "email")}
        {field("Пароль", "password", "password", "new-password")}

        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting ? "Создаём…" : "Зарегистрироваться"}
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-faint">
          <span className="h-px flex-1 bg-border" />
          или
          <span className="h-px flex-1 bg-border" />
        </div>
        <GoogleButton />

        <p className="mt-5 text-center text-sm text-muted">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-brand hover:underline">
            Войти
          </Link>
        </p>
      </form>
    </div>
  );
}
