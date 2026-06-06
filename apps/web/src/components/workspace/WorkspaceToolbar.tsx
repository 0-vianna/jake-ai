"use client";

import { Bot, Camera, Code2, FolderOpen, Grid3X3, Layers3, MemoryStick, Monitor, Plus, Save, Sparkles, Trash2, Wallet } from "lucide-react";

import type { WorkspacePanelType } from "./types";

const PANEL_OPTIONS: Array<{ type: WorkspacePanelType; label: string }> = [
  { type: "note", label: "Notas" },
  { type: "chat", label: "Chat" },
  { type: "image", label: "Imagem" },
  { type: "file", label: "Arquivo" },
  { type: "project", label: "Projeto" },
  { type: "code", label: "Codigo" },
  { type: "terminal", label: "Terminal" },
  { type: "finance", label: "Financeiro" },
  { type: "memory", label: "Memoria" },
  { type: "screen", label: "Tela" },
  { type: "camera", label: "Camera" },
  { type: "automation", label: "Automacao" },
  { type: "whatsapp", label: "WhatsApp" },
  { type: "browser", label: "Navegador interno" },
  { type: "preview", label: "Preview" },
  { type: "whiteboard", label: "Quadro branco" }
];

export function WorkspaceToolbar({
  hologramMode,
  zoom,
  layoutName,
  onAddPanel,
  onSave,
  onClear,
  onToggleHologram,
  onZoomChange,
  onOpenVoice,
  onCommand,
  onOrganize
}: {
  hologramMode: boolean;
  zoom: number;
  layoutName: string;
  onAddPanel: (type: WorkspacePanelType) => void;
  onSave: () => void;
  onClear: () => void;
  onToggleHologram: () => void;
  onZoomChange: (value: number) => void;
  onOpenVoice: () => void;
  onCommand: () => void;
  onOrganize: () => void;
}) {
  return (
    <div className="rounded-panel border border-line bg-paper p-3 shadow-soft dark:border-stone-800 dark:bg-night-panel">
      <div className="flex flex-wrap items-center gap-2">
        <ToolButton icon={Plus} label="Adicionar painel" onClick={() => onAddPanel("note")} />
        <ToolButton icon={FolderOpen} label="Abrir arquivo" onClick={() => onAddPanel("file")} />
        <ToolButton icon={Layers3} label="Abrir projeto" onClick={() => onAddPanel("project")} />
        <ToolButton icon={Bot} label="Abrir chat" onClick={() => onAddPanel("chat")} />
        <ToolButton icon={Camera} label="Abrir camera" onClick={() => onAddPanel("camera")} />
        <ToolButton icon={Monitor} label="Abrir tela" onClick={() => onAddPanel("screen")} />
        <ToolButton icon={Code2} label="Abrir codigo" onClick={() => onAddPanel("code")} />
        <ToolButton icon={Wallet} label="Financeiro" onClick={() => onAddPanel("finance")} />
        <ToolButton icon={MemoryStick} label="Memoria" onClick={() => onAddPanel("memory")} />
        <ToolButton icon={Save} label="Salvar layout" onClick={onSave} />
        <ToolButton icon={Trash2} label="Limpar" onClick={onClear} />
        <ToolButton icon={Grid3X3} label="Organizar" onClick={onOrganize} />
        <ToolButton icon={Sparkles} label={hologramMode ? "Desligar holograma" : "Modo holograma"} onClick={onToggleHologram} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select
          onChange={(event) => {
            if (event.target.value) {
              onAddPanel(event.target.value as WorkspacePanelType);
              event.target.value = "";
            }
          }}
          defaultValue=""
          className="h-10 rounded-panel border border-line bg-cream px-3 text-sm outline-none focus:border-accent dark:border-stone-700 dark:bg-night"
        >
          <option value="" disabled>
            + Adicionar painel
          </option>
          {PANEL_OPTIONS.map((item) => (
            <option key={item.type} value={item.type}>
              {item.label}
            </option>
          ))}
        </select>
        <div className="rounded-panel border border-line bg-cream px-3 py-2 text-sm text-muted dark:border-stone-700 dark:bg-night dark:text-stone-300">
          Layout atual: <span className="font-medium text-ink dark:text-stone-100">{layoutName || "nao salvo"}</span>
        </div>
        <label className="flex items-center gap-2 rounded-panel border border-line bg-cream px-3 py-2 text-sm dark:border-stone-700 dark:bg-night">
          Zoom
          <input type="range" min={60} max={140} value={zoom} onChange={(event) => onZoomChange(Number(event.target.value))} />
          <span className="w-10 text-right text-xs text-muted dark:text-stone-400">{zoom}%</span>
        </label>
        <button onClick={onOpenVoice} className="rounded-panel border border-line bg-cream px-3 py-2 text-sm hover:border-accent hover:text-accent dark:border-stone-700 dark:bg-night">
          Falar com Jake
        </button>
        <button onClick={onCommand} className="rounded-panel border border-line bg-cream px-3 py-2 text-sm hover:border-accent hover:text-accent dark:border-stone-700 dark:bg-night">
          Comando rapido
        </button>
      </div>
    </div>
  );
}

function ToolButton({ icon: Icon, label, onClick }: { icon: typeof Plus; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-panel border border-line bg-cream px-3 text-sm text-muted transition hover:border-accent hover:text-accent dark:border-stone-700 dark:bg-night dark:text-stone-300"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
