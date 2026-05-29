"use client";

import type { ReactNode } from "react";
import { AuthGuard } from "./AuthGuard";
import { Sidebar } from "./Sidebar";

/** Каркас авторизованной части: защита + сайдбар + контентная колонка. */
export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <AuthGuard>
      <div className="mx-auto flex w-full max-w-6xl">
        <Sidebar />
        <main className={`min-w-0 flex-1 px-4 pb-24 pt-6 md:pb-8 ${wide ? "" : "md:px-8"}`}>
          <div className={wide ? "" : "mx-auto max-w-2xl"}>{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
