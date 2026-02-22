import type { ReactNode } from "react";

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <header className="border-b-[3px] border-black dark:border-black">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
          <span className="text-lg font-semibold">
            <span className="text-black dark:text-white">Git</span>
            <span className="text-purple-600 dark:text-[hsl(var(--neo-button))]">
              Diagram
            </span>
            <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-bold uppercase text-red-700 dark:bg-red-900 dark:text-red-300">
              Admin
            </span>
          </span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
