export type WorkspacePanelType =
  | "note"
  | "chat"
  | "image"
  | "file"
  | "project"
  | "code"
  | "terminal"
  | "finance"
  | "memory"
  | "screen"
  | "camera"
  | "automation"
  | "whatsapp"
  | "browser"
  | "preview"
  | "whiteboard";

export type WorkspacePanelRecord = {
  id: string;
  type: WorkspacePanelType;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  pinned: boolean;
  transparency: number;
  data: Record<string, unknown>;
};

export type WorkspaceConnectionRecord = {
  id: string;
  sourcePanelId: string;
  targetPanelId: string;
  label: string;
};

export type WorkspaceStateRecord = {
  version: 1;
  hologramMode: boolean;
  zoom: number;
  selectedPanelId: string | null;
  hoveredPanelId: string | null;
  pointedPanelId: string | null;
  lastGesture: string | null;
  lastVoiceCommand: string | null;
  lastUserIntent: string | null;
  panels: WorkspacePanelRecord[];
  connections: WorkspaceConnectionRecord[];
};
