"use client";

import { Search } from "lucide-react";

export type WorkspaceCommandItem = {
  id: string;
  label: string;
  hint?: string;
  group: string;
};

export function WorkspaceCommandMenu({
  open,
  query,
  items,
  onQueryChange,
  onClose,
  onSelect
}: {
  open: boolean;
  query: string;
  items: WorkspaceCommandItem[];
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  if (!open) return null;

  const groups = items.reduce<Record<string, WorkspaceCommandItem[]>>((acc, item) => {
    acc[item.group] = [...(acc[item.group] ?? []), item];
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center bg-black/30 px-4 pt-24 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-panel border border-line bg-paper shadow-panel dark:border-stone-800 dark:bg-night-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 dark:border-stone-800">
          <Search className="h-4 w-4 text-accent" />
          <input
            autoFocus
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Abrir camera, salvar layout, organizar programacao..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <button onClick={onClose} className="rounded-panel border border-line px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent dark:border-stone-700">
            Esc
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {Object.entries(groups).map(([group, groupItems]) => (
            <div key={group} className="mb-4 last:mb-0">
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted dark:text-stone-500">{group}</p>
              <div className="space-y-1">
                {groupItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className="flex w-full items-start justify-between gap-4 rounded-panel px-3 py-2 text-left hover:bg-cream dark:hover:bg-night"
                  >
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.hint ? <span className="shrink-0 text-xs text-muted dark:text-stone-400">{item.hint}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!items.length ? <p className="px-2 py-6 text-sm text-muted dark:text-stone-400">Nenhum comando encontrado.</p> : null}
        </div>
      </div>
    </div>
  );
}
