"use client";

import React from "react";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="border-b-[3px] border-black dark:border-black">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-8">
        <Link href="/" className="flex items-center">
          <span className="text-lg font-semibold sm:text-xl">
            <span className="text-black transition-colors duration-200 hover:text-gray-600 dark:text-white dark:hover:text-[hsl(var(--neo-button-hover))]">
              Git
            </span>
            <span className="text-purple-600 transition-colors duration-200 hover:text-purple-500 dark:text-[hsl(var(--neo-button))] dark:hover:text-[hsl(var(--neo-button-hover))]">
              Diagram
            </span>
          </span>
        </Link>
        <nav className="flex items-center">
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
