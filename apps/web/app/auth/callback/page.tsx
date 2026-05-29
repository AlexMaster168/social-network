"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { setToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function CallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { refresh } = useAuth();

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      router.replace("/login?error=google_failed");
      return;
    }
    setToken(token);
    refresh().then(() => router.replace("/"));
  }, [params, refresh, router]);

  return <p className="text-muted">Завершаем вход…</p>;
}

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Suspense fallback={<p className="text-muted">Загрузка…</p>}>
        <CallbackInner />
      </Suspense>
    </div>
  );
}
