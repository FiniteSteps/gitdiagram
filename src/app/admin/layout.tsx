"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "~/components/theme-toggle";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
  { href: "/admin/prompts", label: "Prompts", icon: "📝" },
  { href: "/admin/cache", label: "Cache", icon: "🗄️" },
  { href: "/admin/audit", label: "Audit Log", icon: "📋" },
];

function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {crumb.href !== "/" + segments[0] && (
            <span className="text-gray-400 dark:text-neutral-600">/</span>
          )}
          {crumb.isLast ? (
            <span className="font-medium text-black dark:text-white">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="text-gray-500 hover:text-purple-600 dark:text-neutral-500 dark:hover:text-[hsl(var(--neo-button))]"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export default function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-white dark:bg-neutral-950">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r-[3px] border-black dark:border-neutral-800">
        {/* Logo */}
        <div className="flex h-16 items-center border-b-[3px] border-black px-4 dark:border-neutral-800">
          <Link href="/admin" className="text-lg font-semibold">
            <span className="text-black dark:text-white">Git</span>
            <span className="text-purple-600 dark:text-[hsl(var(--neo-button))]">
              Diagram
            </span>
            <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700 dark:bg-red-900 dark:text-red-300">
              Admin
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "border-2 border-black bg-purple-50 text-purple-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:border-neutral-600 dark:bg-purple-950 dark:text-purple-300"
                    : "text-gray-600 hover:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className="border-t-2 border-black p-3 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <ThemeToggle />
            <Link
              href="/"
              className="text-xs text-gray-500 hover:text-purple-600 dark:text-neutral-500 dark:hover:text-[hsl(var(--neo-button))]"
            >
              ← Back to site
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar with breadcrumbs */}
        <header className="flex h-16 items-center border-b-[3px] border-black px-6 dark:border-neutral-800">
          <Breadcrumbs />
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
