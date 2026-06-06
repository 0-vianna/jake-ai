"use client";

import { Copy, Expand, Minimize2, Pin, PinOff, Square, X } from "lucide-react";
import { useRef } from "react";

import type { WorkspacePanelRecord } from "./types";

export function FloatingPanel({
  panel,
  selected,
  hologramMode,
  canvasSize,
  onSelect,
  onChange,
  onClose,
  onDuplicate,
  children
}: {
  panel: WorkspacePanelRecord;
  selected: boolean;
  hologramMode: boolean;
  canvasSize: { width: number; height: number };
  onSelect: () => void;
  onChange: (patch: Partial<WorkspacePanelRecord>) => void;
  onClose: () => void;
  onDuplicate: () => void;
  children: React.ReactNode;
}) {
  const dragRef = useRef<{
    originX: number;
    originY: number;
    originWidth: number;
    originHeight: number;
    startX: number;
    startY: number;
    mode: "drag" | "resize";
  } | null>(null);

  function beginPointerMove(event: React.PointerEvent<HTMLDivElement>, mode: "drag" | "resize") {
    if (panel.pinned && mode === "drag") return;
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    dragRef.current = {
      originX: panel.x,
      originY: panel.y,
      originWidth: panel.width,
      originHeight: panel.height,
      startX: event.clientX,
      startY: event.clientY,
      mode
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (drag.mode === "drag") {
      onChange({
        x: clamp(drag.originX + dx, 0, Math.max(0, canvasSize.width - panel.width)),
        y: clamp(drag.originY + dy, 0, Math.max(0, canvasSize.height - panel.height))
      });
      return;
    }
    onChange({
      width: clamp(drag.originWidth + dx, 260, Math.max(320, canvasSize.width - panel.x)),
      height: clamp(drag.originHeight + dy, 180, Math.max(220, canvasSize.height - panel.y))
    });
  }

  function endPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const style = panel.maximized
    ? { left: 12, top: 12, width: Math.max(420, canvasSize.width - 24), height: Math.max(280, canvasSize.height - 24), zIndex: panel.zIndex }
    : { left: panel.x, top: panel.y, width: panel.width, height: panel.height, zIndex: panel.zIndex };

  return (
    <div
      onMouseDown={onSelect}
      className={`absolute overflow-hidden rounded-panel border shadow-panel transition ${
        hologramMode
          ? "border-accent/70 bg-paper/78 backdrop-blur-md dark:bg-night-panel/78"
          : "border-line bg-paper dark:border-stone-800 dark:bg-night-panel"
      } ${selected ? "ring-2 ring-accent/25" : ""}`}
      style={{ ...style, opacity: panel.transparency }}
    >
      <div
        className="flex h-11 items-center justify-between gap-3 border-b border-line bg-cream/80 px-3 dark:border-stone-800 dark:bg-night/80"
        onPointerDown={(event) => beginPointerMove(event, "drag")}
        onPointerMove={onPointerMove}
        onPointerUp={endPointerMove}
      >
        <input
          value={panel.title}
          onChange={(event) => onChange({ title: event.target.value })}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
        />
        <div className="flex items-center gap-1">
          <button onClick={() => onChange({ pinned: !panel.pinned })} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-paper hover:text-accent dark:hover:bg-night-panel" title={panel.pinned ? "Desafixar" : "Fixar"}>
            {panel.pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onDuplicate} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-paper hover:text-accent dark:hover:bg-night-panel" title="Duplicar">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onChange({ minimized: !panel.minimized })} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-paper hover:text-accent dark:hover:bg-night-panel" title="Minimizar">
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onChange({ maximized: !panel.maximized })} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-paper hover:text-accent dark:hover:bg-night-panel" title="Maximizar">
            {panel.maximized ? <Square className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" title="Fechar">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {!panel.minimized ? (
        <div className="relative h-[calc(100%-44px)] p-3">
          {children}
          {!panel.maximized ? (
            <div
              className="absolute bottom-0 right-0 h-5 w-5 cursor-se-resize rounded-tl-lg border-l border-t border-line bg-accent-soft/60 dark:border-stone-700"
              onPointerDown={(event) => beginPointerMove(event, "resize")}
              onPointerMove={onPointerMove}
              onPointerUp={endPointerMove}
            />
          ) : null}
        </div>
      ) : (
        <div className="grid h-16 place-items-center text-xs text-muted dark:text-stone-400">Painel minimizado</div>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
