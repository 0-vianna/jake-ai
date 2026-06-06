"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, FolderKanban, MessageSquare, Search, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { navItems } from "./Sidebar";
import { listConversations, listMemories, listProjects, searchCodeWorkspace } from "@/lib/api";
import type { ModuleId } from "@/lib/types";

type CommandPaletteProps = {
  open: boolean;
  token: string;
  onClose: () => void;
  onPick: (id: ModuleId) => void;
  onAskJake?: (text: string) => void;
};

type Result = {
  id: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  target: ModuleId;
  action?: () => void;
};

export function CommandPalette({ open, token, onClose, onPick, onAskJake }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const results = useMemo(() => {
    const normalized = query.toLowerCase();
    const moduleResults: Result[] = navItems
      .filter((item) => !normalized || item.label.toLowerCase().includes(normalized) || item.id.includes(normalized))
      .map((item) => ({
        id: `module-${item.id}`,
        label: item.label,
        detail: "Abrir modulo",
        icon: item.icon,
        target: item.id
      }));
    const askResult: Result[] =
      normalized.length > 2
        ? [
            {
              id: "ask-jake",
              label: `Perguntar ao Jake: "${query}"`,
              detail: "Abrir chat com esse texto",
              icon: Sparkles,
              target: "chat",
              action: () => onAskJake?.(query)
            }
          ]
        : [];
    return [...askResult, ...moduleResults, ...remote].slice(0, 14);
  }, [query, remote, onAskJake]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setRemote([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    Promise.allSettled([
      listConversations(token),
      listProjects(token),
      listMemories(token),
      searchCodeWorkspace(token, query.trim())
    ])
      .then(([conversations, projects, memories, files]) => {
        if (controller.signal.aborted) return;
        const normalized = query.toLowerCase();
        const next: Result[] = [];
        if (conversations.status === "fulfilled") {
          next.push(
            ...conversations.value
              .filter((item) => item.title.toLowerCase().includes(normalized))
              .slice(0, 4)
              .map((item) => ({
                id: `conversation-${item.id}`,
                label: item.title,
                detail: "Conversa",
                icon: MessageSquare,
                target: "chat" as ModuleId
              }))
          );
        }
        if (projects.status === "fulfilled") {
          next.push(
            ...projects.value
              .filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(normalized))
              .slice(0, 4)
              .map((item) => ({
                id: `project-${item.id}`,
                label: item.name,
                detail: item.description || "Projeto",
                icon: FolderKanban,
                target: "projects" as ModuleId
              }))
          );
        }
        if (memories.status === "fulfilled") {
          next.push(
            ...memories.value
              .filter((item) => `${item.content} ${item.summary ?? ""} ${item.tags}`.toLowerCase().includes(normalized))
              .slice(0, 4)
              .map((item) => ({
                id: `memory-${item.id}`,
                label: item.summary || item.content,
                detail: item.tags || "Memoria",
                icon: Sparkles,
                target: "memory" as ModuleId
              }))
          );
        }
        if (files.status === "fulfilled") {
          next.push(
            ...files.value.items.slice(0, 5).map((item) => ({
              id: `file-${item.path}`,
              label: item.name,
              detail: item.snippet || item.path,
              icon: FileText,
              target: "code" as ModuleId
            }))
          );
        }
        setRemote(next);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, query, token]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/20 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 20, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 20, scale: 0.98 }}
            className="mx-auto mt-20 max-w-xl rounded-panel border border-line bg-paper p-3 shadow-panel dark:border-stone-700 dark:bg-night-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-11 items-center gap-3 border-b border-line px-2 dark:border-stone-700">
              <Search className="h-4 w-4 text-accent" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="abrir financeiro, nova conversa, analisar tela..."
                className="h-full flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="mt-2 max-h-80 overflow-y-auto">
              {loading ? <p className="px-3 py-2 text-xs text-muted dark:text-stone-400">Buscando...</p> : null}
              {results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    item.action?.();
                    onPick(item.target);
                    onClose();
                  }}
                  className="flex h-11 w-full items-center gap-3 rounded-panel px-3 text-left text-sm transition hover:bg-cream dark:hover:bg-night"
                >
                  <item.icon className="h-4 w-4 text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.label}</span>
                    <span className="block truncate text-xs text-muted dark:text-stone-400">{item.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
