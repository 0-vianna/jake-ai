"use client";

import { Bot, Camera, Home, MessageSquare, Settings, Wallet } from "lucide-react";
import clsx from "clsx";

import type { ModuleId, NavItem } from "@/lib/types";

const mobileItems: NavItem[] = [
  { id: "home", label: "Inicio", icon: Home },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "finance", label: "Financas", icon: Wallet },
  { id: "camera", label: "Gestos", icon: Camera },
  { id: "models", label: "IA", icon: Bot },
  { id: "settings", label: "Config", icon: Settings }
];

type MobileNavProps = {
  active: ModuleId;
  onChange: (id: ModuleId) => void;
};

export function MobileNav({ active, onChange }: MobileNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-line bg-paper/95 px-2 py-2 backdrop-blur md:hidden dark:border-stone-800 dark:bg-night-panel/95">
      {mobileItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={clsx(
            "flex min-h-12 flex-col items-center justify-center gap-1 rounded-panel text-[11px] transition",
            active === item.id ? "bg-accent-soft text-accent dark:bg-orange-950/40" : "text-muted dark:text-stone-300"
          )}
        >
          <item.icon className="h-4 w-4" />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
