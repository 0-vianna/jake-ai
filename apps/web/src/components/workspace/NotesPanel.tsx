"use client";

import { Palette, Pin, PinOff, StickyNote } from "lucide-react";

const NOTE_COLORS = ["#fff4c7", "#fde8dc", "#fee2e2", "#dcfce7", "#dbeafe"];

export function NotesPanel({
  title,
  note,
  color,
  pinned,
  onChange
}: {
  title: string;
  note: string;
  color: string;
  pinned: boolean;
  onChange: (patch: { title?: string; note?: string; color?: string; pinned?: boolean }) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-accent">
          <StickyNote className="h-3.5 w-3.5" />
          Nota rapida
        </div>
        <button
          onClick={() => onChange({ pinned: !pinned })}
          className="rounded-panel border border-line px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent dark:border-stone-700"
          title={pinned ? "Desafixar" : "Fixar"}
        >
          {pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
        </button>
      </div>
      <input
        value={title}
        onChange={(event) => onChange({ title: event.target.value })}
        className="mb-2 h-10 rounded-panel border border-line bg-paper px-3 text-sm font-medium outline-none focus:border-accent dark:border-stone-700 dark:bg-night-panel"
        placeholder="Titulo da nota"
      />
      <textarea
        value={note}
        onChange={(event) => onChange({ note: event.target.value })}
        className="min-h-0 flex-1 resize-none rounded-panel border border-line bg-paper px-3 py-3 text-sm leading-6 outline-none focus:border-accent dark:border-stone-700 dark:bg-night-panel"
        placeholder="Escreva ideias, tarefas, pensamentos ou rascunhos aqui..."
        style={{ backgroundColor: color }}
      />
      <div className="mt-3 flex items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-muted dark:text-stone-400">
          <Palette className="h-3.5 w-3.5" />
          Cor
        </span>
        <div className="flex gap-2">
          {NOTE_COLORS.map((item) => (
            <button
              key={item}
              onClick={() => onChange({ color: item })}
              className={`h-5 w-5 rounded-full border ${color === item ? "border-accent ring-2 ring-accent/25" : "border-white/40"}`}
              style={{ backgroundColor: item }}
              title="Trocar cor"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
