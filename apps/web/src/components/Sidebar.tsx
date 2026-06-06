"use client";

import {
  Activity,
  Bot,
  Camera,
  Code2,
  Files,
  FolderKanban,
  Home,
  LayoutDashboard,
  Layers3,
  MemoryStick,
  MessageSquare,
  PanelLeft,
  Settings,
  Shield,
  Smartphone,
  Users,
  Wallet,
  Workflow
} from "lucide-react";
import clsx from "clsx";

import type { ModuleId, NavItem } from "@/lib/types";

export const navItems: NavItem[] = [
  { id: "home", label: "Inicio", icon: Home },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "workspace", label: "Workspace Livre", icon: Layers3 },
  { id: "projects", label: "Projetos", icon: FolderKanban },
  { id: "files", label: "Arquivos", icon: Files },
  { id: "code", label: "Code Workspace", icon: Code2 },
  { id: "screen", label: "Tela", icon: LayoutDashboard },
  { id: "camera", label: "Camera", icon: Camera },
  { id: "automations", label: "Automacoes", icon: Workflow },
  { id: "whatsapp", label: "WhatsApp", icon: Smartphone },
  { id: "finance", label: "Financeiro", icon: Wallet },
  { id: "memory", label: "Memoria", icon: MemoryStick },
  { id: "settings", label: "Configuracoes", icon: Settings },
  { id: "users", label: "Usuarios", icon: Users },
  { id: "logs", label: "Logs", icon: Activity },
  { id: "models", label: "Modelos de IA", icon: Bot }
];

type SidebarProps = {
  active: ModuleId;
  onChange: (id: ModuleId) => void;
  collapsed: boolean;
  onToggle: () => void;
};

export function Sidebar({ active, onChange, collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={clsx(
        "hidden h-full flex-col border-r border-line bg-paper transition-all md:flex dark:border-stone-800 dark:bg-night-panel",
        collapsed ? "w-[76px]" : "w-[256px]"
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-line px-4 dark:border-stone-800">
        <button
          onClick={onToggle}
          className="flex h-9 w-9 items-center justify-center rounded-panel border border-line text-muted transition hover:border-accent hover:text-accent dark:border-stone-700 dark:text-stone-300"
          title="Alternar sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        {!collapsed ? (
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-semibold">
              <Shield className="h-4 w-4 text-accent" />
              Jake
            </div>
            <p className="truncate text-xs text-muted dark:text-stone-400">central pessoal</p>
          </div>
        ) : null}
      </div>
      <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={clsx(
              "flex h-10 w-full items-center gap-3 rounded-panel px-3 text-sm transition",
              active === item.id
                ? "bg-accent-soft text-accent dark:bg-orange-950/40 dark:text-orange-300"
                : "text-muted hover:bg-cream hover:text-ink dark:text-stone-300 dark:hover:bg-night dark:hover:text-stone-100",
              collapsed && "justify-center px-0"
            )}
            title={item.label}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed ? <span className="truncate">{item.label}</span> : null}
          </button>
        ))}
      </nav>
    </aside>
  );
}
