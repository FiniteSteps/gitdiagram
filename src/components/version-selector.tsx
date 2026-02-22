"use client";

import { ChevronDown, History, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { DiagramVersion } from "~/app/_actions/cache";

interface VersionSelectorProps {
  versions: DiagramVersion[];
  currentVersion: number | null;
  totalVersions: number;
  loading: boolean;
  onSelectVersion: (version: number) => void;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function VersionSelector({
  versions,
  currentVersion,
  totalVersions,
  loading,
  onSelectVersion,
}: Readonly<VersionSelectorProps>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (totalVersions === 0 || currentVersion === null) {
    return null;
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-md border-[3px] border-black bg-purple-300 px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-purple-400 dark:border-[#2d1d4e] dark:bg-[hsl(var(--neo-subtle-muted))] dark:text-[hsl(var(--foreground))] dark:hover:bg-[hsl(var(--neo-subtle))]"
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <History size={14} />
        )}
        <span>
          v{currentVersion} of {totalVersions}
        </span>
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && versions.length > 0 && (
        <div className="absolute left-0 z-50 mt-1 max-h-64 w-64 overflow-y-auto rounded-md border-[3px] border-black bg-white shadow-lg dark:border-[#2d1d4e] dark:bg-[hsl(var(--neo-panel))]">
          {versions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                onSelectVersion(v.version);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                v.version === currentVersion
                  ? "bg-purple-200 font-semibold dark:bg-[hsl(var(--neo-subtle))]"
                  : "hover:bg-purple-100 dark:hover:bg-[hsl(var(--neo-subtle-muted))]"
              }`}
            >
              <span className="text-black dark:text-[hsl(var(--foreground))]">
                Version {v.version}
              </span>
              <span className="text-xs text-gray-500 dark:text-neutral-400">
                {formatDate(v.createdAt)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
