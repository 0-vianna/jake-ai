"use client";

import { Command, LogOut, Moon, Search, Sun } from "lucide-react";

import type { User } from "@/lib/types";

type TopBarProps = {
  user: User;
  dark: boolean;
  onToggleTheme: () => void;
  onCommand: () => void;
  onLogout: () => void;
};

export function TopBar({ user, dark, onToggleTheme, onCommand, onLogout }: TopBarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-line bg-cream/80 px-4 backdrop-blur dark:border-stone-800 dark:bg-night/80">
      <button
        onClick={onCommand}
        className="hidden h-10 min-w-[320px] items-center gap-3 rounded-panel border border-line bg-paper px-3 text-sm text-muted shadow-soft transition hover:border-accent dark:border-stone-700 dark:bg-night-panel dark:text-stone-300 md:flex"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Abrir comando rápido</span>
        <span className="flex items-center gap-1 rounded bg-cream px-2 py-1 text-xs dark:bg-night">
          <Command className="h-3 w-3" /> K
        </span>
      </button>
      <div className="flex flex-1 items-center justify-end gap-2">
        <button
          onClick={onCommand}
          className="flex h-10 w-10 items-center justify-center rounded-panel border border-line bg-paper text-muted shadow-soft transition hover:border-accent hover:text-accent dark:border-stone-700 dark:bg-night-panel dark:text-stone-300 md:hidden"
          title="Comando rápido"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          onClick={onToggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-panel border border-line bg-paper text-muted shadow-soft transition hover:border-accent hover:text-accent dark:border-stone-700 dark:bg-night-panel dark:text-stone-300"
          title={dark ? "Modo claro" : "Modo escuro"}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <div className="hidden min-w-0 px-2 text-right sm:block">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted dark:text-stone-400">{user.role}</p>
        </div>
        <button
          onClick={onLogout}
          className="flex h-10 w-10 items-center justify-center rounded-panel border border-line bg-paper text-muted shadow-soft transition hover:border-accent hover:text-accent dark:border-stone-700 dark:bg-night-panel dark:text-stone-300"
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

