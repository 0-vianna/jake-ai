"use client";

import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, LayoutGrid, Loader2, Mic, Save } from "lucide-react";

import {
  createWorkspaceLayout,
  deleteWorkspaceLayout,
  getDefaultWorkspaceLayout,
  listWorkspaceLayouts,
  recordWorkspaceAction,
  updateWorkspaceLayout,
  type WorkspaceLayoutRecord
} from "@/lib/api";

import { WorkspaceCanvas } from "./WorkspaceCanvas";
import { WorkspaceCommandMenu, type WorkspaceCommandItem } from "./WorkspaceCommandMenu";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import type { WorkspacePanelRecord, WorkspacePanelType, WorkspaceStateRecord } from "./types";

const LOCAL_FALLBACK_KEY = "jake-workspace-fallback-v1";

export function WorkspacePage({
  token,
  onOpenModule,
  onOpenCommand
}: {
  token: string;
  onOpenModule: (module: string) => void;
  onOpenCommand: () => void;
}) {
  const [layouts, setLayouts] = useState<WorkspaceLayoutRecord[]>([]);
  const [activeLayoutId, setActiveLayoutId] = useState<number | null>(null);
  const [layoutName, setLayoutName] = useState("");
  const [state, setState] = useState<WorkspaceStateRecord>(createDefaultWorkspaceState());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");

  useEffect(() => {
    void loadWorkspace();
  }, [token]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveLayout();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        addPanel("file");
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "i") {
        event.preventDefault();
        addPanel("image");
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        addPanel("camera");
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "h") {
        event.preventDefault();
        toggleHologram();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "0") {
        event.preventDefault();
        syncState({ ...state, zoom: 100 });
        return;
      }
      if (event.key === "Delete" && state.selectedPanelId) {
        event.preventDefault();
        closePanel(state.selectedPanelId);
        return;
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state, token]);

  async function loadWorkspace() {
    setLoading(true);
    try {
      const [allLayouts, defaultLayout] = await Promise.all([listWorkspaceLayouts(token), getDefaultWorkspaceLayout(token)]);
      setLayouts(allLayouts);
      if (defaultLayout) {
        applyLayout(defaultLayout);
        return;
      }

      const fallback = localStorage.getItem(LOCAL_FALLBACK_KEY);
      if (fallback) {
        syncState(ensureStarterPanels(parseWorkspaceState(fallback)));
        setLayoutName("rascunho local");
        return;
      }

      syncState(createDefaultWorkspaceState());
      setLayoutName("rascunho local");
    } finally {
      setLoading(false);
    }
  }

  function applyLayout(layout: WorkspaceLayoutRecord) {
    setActiveLayoutId(layout.id);
    setLayoutName(layout.name);
    syncState(ensureStarterPanels(parseWorkspaceState(layout.state_json)));
  }

  function syncState(next: WorkspaceStateRecord) {
    setState(next);
    localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(next));
  }

  function addPanel(type: WorkspacePanelType, patch?: Partial<WorkspacePanelRecord>) {
    const nextPanel = { ...buildPanel(type, state.panels.length + 1, nextZIndex(state.panels)), ...patch };
    syncState({
      ...state,
      selectedPanelId: nextPanel.id,
      lastUserIntent: `open_${type}`,
      panels: [...state.panels, nextPanel]
    });
    void recordWorkspaceAction(token, { action_type: "open_panel", payload_json: JSON.stringify({ type }) });
  }

  function updatePanel(id: string, patch: Partial<WorkspacePanelRecord>) {
    const currentMaxZ = nextZIndex(state.panels);
    syncState({
      ...state,
      selectedPanelId: id,
      panels: state.panels.map((panel) => (panel.id === id ? { ...panel, ...patch, zIndex: patch.zIndex ?? currentMaxZ } : panel))
    });
  }

  function selectPanel(id: string) {
    syncState({
      ...state,
      selectedPanelId: id,
      panels: state.panels.map((panel) => (panel.id === id ? { ...panel, zIndex: nextZIndex(state.panels) } : panel))
    });
  }

  function closePanel(id: string) {
    syncState({
      ...state,
      selectedPanelId: state.selectedPanelId === id ? null : state.selectedPanelId,
      panels: state.panels.filter((panel) => panel.id !== id),
      connections: state.connections.filter((item) => item.sourcePanelId !== id && item.targetPanelId !== id)
    });
  }

  function duplicatePanel(id: string) {
    const target = state.panels.find((panel) => panel.id === id);
    if (!target) return;
    const duplicate = {
      ...target,
      id: `panel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `${target.title} copia`,
      x: target.x + 28,
      y: target.y + 28,
      zIndex: nextZIndex(state.panels)
    };
    syncState({ ...state, selectedPanelId: duplicate.id, panels: [...state.panels, duplicate] });
  }

  function clearWorkspace() {
    const confirmed = window.confirm("Limpar os paineis do Workspace Livre?");
    if (!confirmed) return;
    syncState({ ...createDefaultWorkspaceState(), hologramMode: state.hologramMode, zoom: state.zoom });
  }

  function toggleHologram() {
    syncState({ ...state, hologramMode: !state.hologramMode });
  }

  function ensurePanel(type: WorkspacePanelType) {
    const existing = state.panels.find((panel) => panel.type === type);
    if (existing) return existing;
    return buildPanel(type, state.panels.length + 1, nextZIndex(state.panels));
  }

  function organizeWorkspace(mode: "grid" | "programming" | "finance" | "camera-chat") {
    let panels = [...state.panels];
    let organizedIds = new Set<string>();

    if (mode === "programming") {
      const required = ["code", "terminal", "file", "chat"] as const;
      panels = required.map((type) => panels.find((panel) => panel.type === type) ?? ensurePanel(type));
      panels = panels.map((panel, index) => ({
        ...panel,
        minimized: false,
        maximized: false,
        zIndex: index + 1,
        ...(panel.type === "file" ? { x: 30, y: 30, width: 280, height: 640 } : {}),
        ...(panel.type === "code" ? { x: 330, y: 30, width: 640, height: 430 } : {}),
        ...(panel.type === "terminal" ? { x: 330, y: 480, width: 640, height: 190 } : {}),
        ...(panel.type === "chat" ? { x: 990, y: 30, width: 340, height: 640 } : {})
      }));
      organizedIds = new Set(panels.map((panel) => panel.id));
    } else if (mode === "finance") {
      const required = ["finance", "chat", "memory"] as const;
      panels = required.map((type) => panels.find((panel) => panel.type === type) ?? ensurePanel(type));
      panels = panels.map((panel, index) => ({
        ...panel,
        minimized: false,
        maximized: false,
        zIndex: index + 1,
        ...(panel.type === "finance" ? { x: 30, y: 30, width: 620, height: 600 } : {}),
        ...(panel.type === "chat" ? { x: 680, y: 30, width: 360, height: 600 } : {}),
        ...(panel.type === "memory" ? { x: 1060, y: 30, width: 280, height: 600 } : {})
      }));
      organizedIds = new Set(panels.map((panel) => panel.id));
    } else if (mode === "camera-chat") {
      const required = ["camera", "chat", "note"] as const;
      panels = required.map((type) => panels.find((panel) => panel.type === type) ?? ensurePanel(type));
      panels = panels.map((panel, index) => ({
        ...panel,
        minimized: false,
        maximized: false,
        zIndex: index + 1,
        ...(panel.type === "camera" ? { x: 30, y: 30, width: 760, height: 560 } : {}),
        ...(panel.type === "chat" ? { x: 820, y: 30, width: 520, height: 420 } : {}),
        ...(panel.type === "note" ? { x: 820, y: 470, width: 520, height: 120 } : {})
      }));
      organizedIds = new Set(panels.map((panel) => panel.id));
    } else {
      panels = panels.map((panel, index) => ({
        ...panel,
        minimized: false,
        maximized: false,
        x: 28 + (index % 3) * 360,
        y: 28 + Math.floor(index / 3) * 250,
        width: panel.type === "chat" ? 420 : Math.min(panel.width, 340),
        height: panel.type === "chat" ? 340 : Math.min(panel.height, 220),
        zIndex: index + 1
      }));
      organizedIds = new Set(panels.map((panel) => panel.id));
    }

    if (mode !== "grid") {
      const extras = state.panels
        .filter((panel) => !organizedIds.has(panel.id))
        .map((panel, index) => ({
          ...panel,
          minimized: true,
          maximized: false,
          x: 30 + (index % 4) * 220,
          y: 700 + Math.floor(index / 4) * 90,
          width: Math.min(panel.width, 220),
          height: 70,
          zIndex: panels.length + index + 1
        }));
      panels = [...panels, ...extras];
    }

    syncState({ ...state, panels, selectedPanelId: panels[0]?.id ?? null, lastUserIntent: `organize_${mode}` });
    void recordWorkspaceAction(token, { action_type: "organize_workspace", payload_json: JSON.stringify({ mode }) });
  }

  async function saveLayout() {
    setSaving(true);
    try {
      const suggested = layoutName && layoutName !== "rascunho local" ? layoutName : "Meu workspace";
      const name = window.prompt("Nome do layout", suggested)?.trim();
      if (!name) return;
      const payload = {
        name,
        description: "Layout salvo pelo Workspace Livre",
        state_json: JSON.stringify(state),
        is_default: true
      };
      const saved = activeLayoutId
        ? await updateWorkspaceLayout(token, activeLayoutId, payload)
        : await createWorkspaceLayout(token, payload);
      setActiveLayoutId(saved.id);
      setLayoutName(saved.name);
      setLayouts(await listWorkspaceLayouts(token));
      void recordWorkspaceAction(token, { action_type: "save_layout", payload_json: JSON.stringify({ layoutId: saved.id }) });
    } finally {
      setSaving(false);
    }
  }

  async function removeLayout(id: number) {
    const confirmed = window.confirm("Apagar este layout salvo?");
    if (!confirmed) return;
    await deleteWorkspaceLayout(token, id);
    const nextLayouts = await listWorkspaceLayouts(token);
    setLayouts(nextLayouts);
    if (activeLayoutId === id) {
      setActiveLayoutId(null);
      setLayoutName("rascunho local");
      syncState(createDefaultWorkspaceState());
    }
  }

  function executeCommand(id: string) {
    setCommandOpen(false);
    setCommandQuery("");
    switch (id) {
      case "open-note":
        addPanel("note");
        return;
      case "open-chat":
        addPanel("chat");
        return;
      case "open-image":
        addPanel("image");
        return;
      case "open-file":
        addPanel("file");
        return;
      case "open-project":
        addPanel("project");
        return;
      case "open-camera":
        addPanel("camera");
        return;
      case "open-screen":
        addPanel("screen");
        return;
      case "open-finance":
        addPanel("finance");
        return;
      case "open-memory":
        addPanel("memory");
        return;
      case "open-code":
        addPanel("code");
        return;
      case "open-terminal":
        addPanel("terminal");
        return;
      case "toggle-hologram":
        toggleHologram();
        return;
      case "save-layout":
        void saveLayout();
        return;
      case "clear-workspace":
        clearWorkspace();
        return;
      case "organize-grid":
        organizeWorkspace("grid");
        return;
      case "organize-programming":
        organizeWorkspace("programming");
        return;
      case "organize-finance":
        organizeWorkspace("finance");
        return;
      case "organize-camera-chat":
        organizeWorkspace("camera-chat");
        return;
      case "global-command":
        onOpenCommand();
        return;
      default:
        return;
    }
  }

  const selectedLayout = useMemo(() => layouts.find((item) => item.id === activeLayoutId) ?? null, [layouts, activeLayoutId]);

  const commandItems = useMemo(() => {
    const items: WorkspaceCommandItem[] = [
      { id: "open-note", label: "Criar nota", hint: "Painel", group: "Abrir" },
      { id: "open-chat", label: "Abrir chat", hint: "Painel", group: "Abrir" },
      { id: "open-image", label: "Abrir imagem", hint: "Painel", group: "Abrir" },
      { id: "open-file", label: "Abrir arquivo", hint: "Painel", group: "Abrir" },
      { id: "open-project", label: "Abrir projeto", hint: "Painel", group: "Abrir" },
      { id: "open-camera", label: "Abrir camera", hint: "Painel", group: "Abrir" },
      { id: "open-screen", label: "Abrir tela do PC", hint: "Painel", group: "Abrir" },
      { id: "open-finance", label: "Abrir financeiro", hint: "Painel", group: "Abrir" },
      { id: "open-memory", label: "Abrir memoria", hint: "Painel", group: "Abrir" },
      { id: "open-code", label: "Abrir editor de codigo", hint: "Painel", group: "Abrir" },
      { id: "open-terminal", label: "Abrir terminal", hint: "Painel", group: "Abrir" },
      { id: "organize-grid", label: "Organizar em grade", hint: "Workspace", group: "Organizar" },
      { id: "organize-programming", label: "Organizar para programacao", hint: "Workspace", group: "Organizar" },
      { id: "organize-finance", label: "Organizar para financeiro", hint: "Workspace", group: "Organizar" },
      { id: "organize-camera-chat", label: "Organizar camera + chat", hint: "Workspace", group: "Organizar" },
      { id: "toggle-hologram", label: state.hologramMode ? "Desligar modo holograma" : "Ativar modo holograma", hint: "Visual", group: "Visual" },
      { id: "save-layout", label: "Salvar layout", hint: "Ctrl+S", group: "Salvar" },
      { id: "clear-workspace", label: "Limpar workspace", hint: "Acao", group: "Salvar" },
      { id: "global-command", label: "Abrir comando rapido global", hint: "Jake", group: "Jake" }
    ];
    const normalized = commandQuery.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => `${item.label} ${item.group} ${item.hint ?? ""}`.toLowerCase().includes(normalized));
  }, [commandQuery, state.hologramMode]);

  return (
    <>
      <div className="grid h-full gap-4 xl:grid-cols-[1fr_320px]">
        <section className="flex min-h-0 flex-col gap-4">
          <WorkspaceToolbar
            hologramMode={state.hologramMode}
            zoom={state.zoom}
            layoutName={layoutName}
            onAddPanel={addPanel}
            onSave={() => void saveLayout()}
            onClear={clearWorkspace}
            onToggleHologram={toggleHologram}
            onZoomChange={(value) => syncState({ ...state, zoom: value })}
            onOpenVoice={() => addPanel("chat")}
            onCommand={() => setCommandOpen(true)}
            onOrganize={() => organizeWorkspace("grid")}
          />
          <WorkspaceCanvas
            token={token}
            panels={state.panels}
            selectedPanelId={state.selectedPanelId}
            hologramMode={state.hologramMode}
            zoom={state.zoom}
            onOpenModule={onOpenModule}
            onSelectPanel={selectPanel}
            onUpdatePanel={updatePanel}
            onClosePanel={closePanel}
            onDuplicatePanel={duplicatePanel}
          />
        </section>

        <aside className="space-y-4">
          <section className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
            <div className="mb-3 flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold">Layouts salvos</h2>
              {loading || saving ? <Loader2 className="ml-auto h-4 w-4 animate-spin text-accent" /> : null}
            </div>
            <div className="space-y-2">
              {layouts.map((layout) => (
                <div key={layout.id} className={`rounded-panel border p-3 ${layout.id === activeLayoutId ? "border-accent bg-accent-soft/40" : "border-line bg-cream dark:border-stone-700 dark:bg-night"}`}>
                  <button onClick={() => applyLayout(layout)} className="w-full text-left">
                    <p className="font-medium">{layout.name}</p>
                    <p className="mt-1 text-xs text-muted dark:text-stone-400">{layout.description || "sem descricao"}</p>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => applyLayout(layout)} className="rounded-panel border border-line px-2 py-1 text-xs hover:border-accent hover:text-accent dark:border-stone-700">Carregar</button>
                    <button onClick={() => void removeLayout(layout.id)} className="rounded-panel border border-line px-2 py-1 text-xs hover:border-red-500 hover:text-red-600 dark:border-stone-700">Apagar</button>
                  </div>
                </div>
              ))}
              {!layouts.length ? <p className="text-sm text-muted dark:text-stone-400">Nenhum layout salvo ainda. Monte sua mesa e clique em salvar layout.</p> : null}
            </div>
          </section>

          <section className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
            <div className="mb-3 flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold">Jake no workspace</h2>
            </div>
            <p className="text-sm leading-6 text-muted dark:text-stone-400">
              Etapa 1 esta viva: canvas livre, paineis moveis, notas, chat embutido, layouts por usuario e comando rapido proprio. Tambem deixei modos iniciais de organizacao para programacao, financeiro e camera com chat.
            </p>
            <div className="mt-4 grid gap-2">
              <button onClick={() => addPanel("chat")} className="rounded-panel border border-line bg-cream px-3 py-2 text-left text-sm hover:border-accent hover:text-accent dark:border-stone-700 dark:bg-night">
                Abrir chat aqui dentro
              </button>
              <button onClick={() => addPanel("note")} className="rounded-panel border border-line bg-cream px-3 py-2 text-left text-sm hover:border-accent hover:text-accent dark:border-stone-700 dark:bg-night">
                Criar nota rapida
              </button>
              <button onClick={() => organizeWorkspace("programming")} className="rounded-panel border border-line bg-cream px-3 py-2 text-left text-sm hover:border-accent hover:text-accent dark:border-stone-700 dark:bg-night">
                Organizar em modo programacao
              </button>
              <button onClick={() => onOpenModule("camera")} className="rounded-panel border border-line bg-cream px-3 py-2 text-left text-sm hover:border-accent hover:text-accent dark:border-stone-700 dark:bg-night">
                Abrir modulo de camera completo
              </button>
            </div>
          </section>

          <section className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
            <div className="mb-3 flex items-center gap-2">
              <Mic className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold">Estado interno</h2>
            </div>
            <div className="space-y-2 text-sm text-muted dark:text-stone-400">
              <p>Paineis abertos: {state.panels.length}</p>
              <p>Selecionado: {state.selectedPanelId || "nenhum"}</p>
              <p>Holograma: {state.hologramMode ? "ativo" : "desligado"}</p>
              <p>Zoom: {state.zoom}%</p>
              <p>Ultimo gesto: {state.lastGesture || "pendente"}</p>
              <p>Ultimo comando de voz: {state.lastVoiceCommand || "pendente"}</p>
              <p>Ultima intencao: {state.lastUserIntent || "pendente"}</p>
            </div>
            {selectedLayout ? (
              <button onClick={() => void saveLayout()} className="mt-4 inline-flex items-center gap-2 rounded-panel bg-accent px-3 py-2 text-sm text-white">
                <Save className="h-4 w-4" />
                Atualizar {selectedLayout.name}
              </button>
            ) : null}
          </section>
        </aside>
      </div>

      <WorkspaceCommandMenu
        open={commandOpen}
        query={commandQuery}
        items={commandItems}
        onQueryChange={setCommandQuery}
        onClose={() => {
          setCommandOpen(false);
          setCommandQuery("");
        }}
        onSelect={executeCommand}
      />
    </>
  );
}

function createDefaultWorkspaceState(): WorkspaceStateRecord {
  const first = buildPanel("note", 1, 1);
  const second = buildPanel("chat", 2, 2);
  return {
    version: 1,
    hologramMode: false,
    zoom: 100,
    selectedPanelId: second.id,
    hoveredPanelId: null,
    pointedPanelId: null,
    lastGesture: null,
    lastVoiceCommand: null,
    lastUserIntent: null,
    panels: [
      { ...first, title: "Boas-vindas", data: { note: "Monte sua mesa do jeito que preferir. O Jake vai aprender a operar dentro dela.", color: "#fff4c7" } },
      second
    ],
    connections: []
  };
}

function buildPanel(type: WorkspacePanelType, index: number, zIndex: number): WorkspacePanelRecord {
  const map: Record<WorkspacePanelType, { title: string; width: number; height: number; data: Record<string, unknown> }> = {
    note: { title: "Nova nota", width: 360, height: 320, data: { note: "", color: "#fff4c7" } },
    chat: { title: "Chat com Jake", width: 420, height: 440, data: { conversationId: null, messages: [] } },
    image: { title: "Imagem", width: 420, height: 360, data: {} },
    file: { title: "Arquivo", width: 420, height: 360, data: {} },
    project: { title: "Projeto", width: 420, height: 360, data: {} },
    code: { title: "Codigo", width: 520, height: 380, data: {} },
    terminal: { title: "Terminal", width: 520, height: 300, data: {} },
    finance: { title: "Financeiro", width: 460, height: 360, data: {} },
    memory: { title: "Memoria", width: 420, height: 340, data: {} },
    screen: { title: "Tela do PC", width: 440, height: 320, data: {} },
    camera: { title: "Camera", width: 440, height: 340, data: {} },
    automation: { title: "Automacao", width: 420, height: 320, data: {} },
    whatsapp: { title: "WhatsApp", width: 420, height: 320, data: {} },
    browser: { title: "Navegador interno", width: 540, height: 360, data: {} },
    preview: { title: "Preview", width: 520, height: 360, data: {} },
    whiteboard: { title: "Quadro branco", width: 520, height: 360, data: {} }
  };

  const base = map[type];
  return {
    id: `panel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    title: base.title,
    x: 40 + (index % 4) * 36,
    y: 40 + (index % 5) * 30,
    width: base.width,
    height: base.height,
    zIndex,
    minimized: false,
    maximized: false,
    pinned: false,
    transparency: 1,
    data: base.data
  };
}

function parseWorkspaceState(raw: string): WorkspaceStateRecord {
  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceStateRecord>;
    return {
      version: 1,
      hologramMode: Boolean(parsed.hologramMode),
      zoom: typeof parsed.zoom === "number" ? parsed.zoom : 100,
      selectedPanelId: parsed.selectedPanelId ?? null,
      hoveredPanelId: parsed.hoveredPanelId ?? null,
      pointedPanelId: parsed.pointedPanelId ?? null,
      lastGesture: parsed.lastGesture ?? null,
      lastVoiceCommand: parsed.lastVoiceCommand ?? null,
      lastUserIntent: parsed.lastUserIntent ?? null,
      panels: Array.isArray(parsed.panels) ? parsed.panels : [],
      connections: Array.isArray(parsed.connections) ? parsed.connections : []
    };
  } catch {
    return createDefaultWorkspaceState();
  }
}

function ensureStarterPanels(state: WorkspaceStateRecord): WorkspaceStateRecord {
  if (state.panels.length) return state;
  return createDefaultWorkspaceState();
}

function nextZIndex(panels: WorkspacePanelRecord[]) {
  return panels.reduce((highest, panel) => Math.max(highest, panel.zIndex), 0) + 1;
}
