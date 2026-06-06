"use client";

import { useEffect, useRef, useState } from "react";

import { FloatingPanel } from "./FloatingPanel";
import { PanelRenderer } from "./PanelRenderer";
import type { WorkspacePanelRecord } from "./types";

export function WorkspaceCanvas({
  token,
  panels,
  selectedPanelId,
  hologramMode,
  zoom,
  onOpenModule,
  onSelectPanel,
  onUpdatePanel,
  onClosePanel,
  onDuplicatePanel
}: {
  token: string;
  panels: WorkspacePanelRecord[];
  selectedPanelId: string | null;
  hologramMode: boolean;
  zoom: number;
  onOpenModule: (module: string) => void;
  onSelectPanel: (id: string) => void;
  onUpdatePanel: (id: string, patch: Partial<WorkspacePanelRecord>) => void;
  onClosePanel: (id: string) => void;
  onDuplicatePanel: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1200, height: 820 });

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({
        width: Math.max(900, entry.contentRect.width * (100 / zoom)),
        height: Math.max(700, entry.contentRect.height * (100 / zoom))
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [zoom]);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-panel border border-line bg-paper shadow-soft dark:border-stone-800 dark:bg-night-panel">
      <div
        ref={canvasRef}
        className={`relative h-full min-h-[680px] overflow-auto ${hologramMode ? "bg-[radial-gradient(circle_at_top,_rgba(217,119,50,0.08),_transparent_28%),linear-gradient(rgba(217,119,50,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(217,119,50,0.08)_1px,transparent_1px)] bg-[size:100%_100%,28px_28px,28px_28px]" : "bg-[linear-gradient(rgba(217,119,50,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(217,119,50,0.05)_1px,transparent_1px)] bg-[size:28px_28px]"}`}
      >
        <div
          className="relative origin-top-left"
          style={{
            width: `${size.width}px`,
            height: `${size.height}px`,
            transform: `scale(${zoom / 100})`
          }}
        >
          {panels.map((panel) => (
            <FloatingPanel
              key={panel.id}
              panel={panel}
              canvasSize={size}
              selected={selectedPanelId === panel.id}
              hologramMode={hologramMode}
              onSelect={() => onSelectPanel(panel.id)}
              onChange={(patch) => onUpdatePanel(panel.id, patch)}
              onClose={() => onClosePanel(panel.id)}
              onDuplicate={() => onDuplicatePanel(panel.id)}
            >
              <PanelRenderer token={token} panel={panel} onOpenModule={onOpenModule} onChange={(patch) => onUpdatePanel(panel.id, patch)} />
            </FloatingPanel>
          ))}
          {!panels.length ? (
            <div className="grid h-full place-items-center p-8 text-center">
              <div className="max-w-xl rounded-panel border border-line bg-paper/90 p-8 shadow-soft dark:border-stone-800 dark:bg-night-panel/90">
                <p className="text-2xl font-semibold">Workspace Livre</p>
                <p className="mt-3 text-sm leading-7 text-muted dark:text-stone-400">
                  Esta e a mesa digital do Jake. Abra notas, chats e paineis internos aqui, mova tudo livremente e salve layouts por usuario.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
