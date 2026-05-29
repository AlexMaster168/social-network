"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Avatar } from "./Avatar";
import { ChannelIcon, ChatIcon, GameIcon, HomeIcon, LogoutIcon, UsersIcon } from "./icons";

const nav = [
  { href: "/", label: "Лента", Icon: HomeIcon },
  { href: "/friends", label: "Друзья", Icon: UsersIcon },
  { href: "/messages", label: "Сообщения", Icon: ChatIcon },
  { href: "/channels", label: "Каналы", Icon: ChannelIcon },
  { href: "/games", label: "Игры", Icon: GameIcon },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!user) return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* ===== Десктоп: вертикальный сайдбар ===== */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r p-4 md:flex"
        style={{ borderColor: "var(--color-border)" }}>
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl font-extrabold text-white"
            style={{ background: "linear-gradient(135deg, #6d8cff, #5675f0)" }}
          >
            S
          </span>
          <span className="text-xl font-bold">SocialNet</span>
        </Link>

        <nav className="flex flex-col gap-1">
          {nav.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors"
                style={{
                  background: active ? "var(--color-surface-2)" : "transparent",
                  color: active ? "var(--color-brand)" : "var(--color-muted)",
                }}
              >
                <Icon size={22} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <Link
            href={`/profile/${user.username}`}
            className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--color-surface-2)]"
          >
            <Avatar url={user.avatarUrl} name={user.displayName} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{user.displayName}</div>
              <div className="truncate text-xs" style={{ color: "var(--color-faint)" }}>
                @{user.username}
              </div>
            </div>
          </Link>
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--color-surface-2)]"
            style={{ color: "var(--color-muted)" }}
          >
            <LogoutIcon size={20} />
            Выйти
          </button>
        </div>
      </aside>

      {/* ===== Мобайл: нижний таб-бар ===== */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t py-2 backdrop-blur md:hidden"
        style={{ borderColor: "var(--color-border)", background: "rgba(10,11,16,0.9)" }}
      >
        {nav.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-3 py-1 text-[10px]"
              style={{ color: active ? "var(--color-brand)" : "var(--color-muted)" }}
            >
              <Icon size={22} />
              {label}
            </Link>
          );
        })}
        <Link
          href={`/profile/${user.username}`}
          className="flex flex-col items-center gap-0.5 px-3 py-1 text-[10px]"
          style={{ color: pathname.startsWith("/profile") ? "var(--color-brand)" : "var(--color-muted)" }}
        >
          <Avatar url={user.avatarUrl} name={user.displayName} size={22} />
          Профиль
        </Link>
      </nav>
    </>
  );
}
