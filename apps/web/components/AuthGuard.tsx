"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

/** Оборачивает защищённые страницы: редиректит неавторизованных на /login. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted">Загрузка…</div>
    );
  }
  if (!user) return null;
  return <>{children}</>;
}
