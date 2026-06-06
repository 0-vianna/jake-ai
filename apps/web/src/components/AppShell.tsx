"use client";

import { useEffect, useState } from "react";
import { Bell, Bot, Camera, Mic, MonitorUp, X, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ChatView } from "./ChatView";
import { CameraView } from "./CameraView";
import { CodeWorkspaceView } from "./CodeWorkspaceView";
import { CommandPalette } from "./CommandPalette";
import { AutomationsView, LogsView, MemoryView, ProjectsView, UsersView } from "./DataViews";
import { FilesView } from "./FilesView";
import { FinanceView } from "./FinanceView";
import { HomeDashboard } from "./HomeDashboard";
import { LoginScreen } from "./LoginScreen";
import { MobileNav } from "./MobileNav";
import { ModuleView } from "./ModuleView";
import { ScreenView } from "./ScreenView";
import { SettingsView } from "./SettingsView";
import { navItems, Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { WhatsAppView } from "./WhatsAppView";
import { WorkspacePage } from "./workspace/WorkspacePage";
import type { AuthState, ModuleId } from "@/lib/types";

const STORAGE_KEY = "jake-auth-v1";
const PREF_KEY = "jake-ui-prefs-v2";

type Indicators = {
  voice: boolean;
  camera: boolean;
  screen: boolean;
  thinking: boolean;
};

type NotificationItem = {
  id: string;
  title: string;
  body: string;
};

export function AppShell() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [active, setActive] = useState<ModuleId>("home");
  const [collapsed, setCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandDraft, setCommandDraft] = useState("");
  const [dark, setDark] = useState(false);
  const [compact, setCompact] = useState(false);
  const [focus, setFocus] = useState(false);
  const [accent, setAccent] = useState("#d97732");
  const [mode, setMode] = useState("balanced");
  const [indicators, setIndicators] = useState<Indicators>({ voice: false, camera: false, screen: false, thinking: false });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setAuth(JSON.parse(saved) as AuthState);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    const savedTheme = localStorage.getItem("jake-theme");
    setDark(savedTheme === "dark");
    const savedPrefs = localStorage.getItem(PREF_KEY);
    if (savedPrefs) {
      try {
        const prefs = JSON.parse(savedPrefs) as Partial<{ accent: string; compact: boolean; focus: boolean; mode: string }>;
        if (prefs.accent) setAccent(prefs.accent);
        if (typeof prefs.compact === "boolean") setCompact(prefs.compact);
        if (typeof prefs.focus === "boolean") setFocus(prefs.focus);
        if (prefs.mode) setMode(prefs.mode);
      } catch {
        localStorage.removeItem(PREF_KEY);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("jake-compact", compact);
    document.documentElement.style.setProperty("--jake-accent", accent);
    document.documentElement.style.setProperty("--jake-accent-soft", tintAccent(accent));
    if (hydrated) localStorage.setItem("jake-theme", dark ? "dark" : "light");
    if (hydrated) localStorage.setItem(PREF_KEY, JSON.stringify({ accent, compact, focus, mode }));
  }, [dark, compact, focus, accent, mode, hydrated]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") setCommandOpen(false);
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setActive("finance");
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setActive("screen");
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        setActive("camera");
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        setActive("memory");
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "w") {
        event.preventDefault();
        setActive("whatsapp");
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setDark((value) => !value);
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        setFocus((value) => !value);
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "x") {
        event.preventDefault();
        setCompact((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onIndicator(event: Event) {
      const detail = (event as CustomEvent<Partial<Indicators>>).detail;
      setIndicators((current) => ({ ...current, ...detail }));
    }
    function onNotify(event: Event) {
      const detail = (event as CustomEvent<{ title?: string; body?: string }>).detail;
      const next = {
        id: `${Date.now()}-${Math.random()}`,
        title: detail.title || "Jake",
        body: detail.body || "Acao registrada."
      };
      setNotifications((current) => [next, ...current].slice(0, 8));
    }
    function onCommand() {
      setCommandOpen(true);
    }
    function onOpenModule(event: Event) {
      const module = (event as CustomEvent<{ module?: ModuleId }>).detail.module;
      if (module) setActive(module);
    }
    function onNavigate(event: Event) {
      const direction = (event as CustomEvent<{ direction: "next" | "previous" }>).detail.direction;
      setActive((current) => {
        const index = navItems.findIndex((item) => item.id === current);
        const nextIndex = direction === "next" ? index + 1 : index - 1;
        const safeIndex = (nextIndex + navItems.length) % navItems.length;
        return navItems[safeIndex].id;
      });
    }
    window.addEventListener("jake:indicator", onIndicator);
    window.addEventListener("jake:notify", onNotify);
    window.addEventListener("jake:command", onCommand);
    window.addEventListener("jake:open-module", onOpenModule);
    window.addEventListener("jake:navigate", onNavigate);
    return () => {
      window.removeEventListener("jake:indicator", onIndicator);
      window.removeEventListener("jake:notify", onNotify);
      window.removeEventListener("jake:command", onCommand);
      window.removeEventListener("jake:open-module", onOpenModule);
      window.removeEventListener("jake:navigate", onNavigate);
    };
  }, []);

  function handleLogin(nextAuth: AuthState) {
    setAuth(nextAuth);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAuth));
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }

  if (!hydrated) {
    return <div className="grid min-h-screen place-items-center bg-cream text-ink dark:bg-night dark:text-stone-100">Carregando Jake...</div>;
  }

  if (!auth) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="flex h-screen overflow-hidden bg-cream text-ink dark:bg-night dark:text-stone-100">
      {!focus ? <Sidebar active={active} onChange={setActive} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} /> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {!focus ? (
          <TopBar
            user={auth.user}
            dark={dark}
            onToggleTheme={() => setDark((value) => !value)}
            onCommand={() => setCommandOpen(true)}
            onLogout={logout}
          />
        ) : null}
        <main data-scrollable="true" className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 pb-20 md:p-4">
          {active === "home" ? <HomeDashboard user={auth.user} token={auth.token} onOpen={setActive} mode={mode} onModeChange={setMode} onCommand={() => setCommandOpen(true)} /> : null}
          {active === "chat" ? <ChatView token={auth.token} initialMessage={commandDraft} initialMode={mode} onModeChange={setMode} /> : null}
          {active === "workspace" ? <WorkspacePage token={auth.token} onOpenModule={(module) => setActive(module as ModuleId)} onOpenCommand={() => setCommandOpen(true)} /> : null}
          {active === "code" ? <CodeWorkspaceView token={auth.token} /> : null}
          {active === "files" ? <FilesView token={auth.token} /> : null}
          {active === "projects" ? <ProjectsView token={auth.token} /> : null}
          {active === "memory" ? <MemoryView token={auth.token} /> : null}
          {active === "users" ? <UsersView token={auth.token} currentUser={auth.user} onLogout={logout} /> : null}
          {active === "logs" ? <LogsView token={auth.token} /> : null}
          {active === "automations" ? <AutomationsView token={auth.token} /> : null}
          {active === "whatsapp" ? <WhatsAppView token={auth.token} /> : null}
          {active === "screen" ? <ScreenView token={auth.token} /> : null}
          {active === "camera" ? <CameraView token={auth.token} /> : null}
          {active === "finance" ? <FinanceView token={auth.token} /> : null}
          {active === "settings" || active === "models" ? (
            <SettingsView
              token={auth.token}
              accent={accent}
              onAccentChange={setAccent}
              compact={compact}
              onCompactChange={setCompact}
              focus={focus}
              onFocusChange={setFocus}
            />
          ) : null}
          {!["home", "chat", "workspace", "code", "files", "projects", "memory", "users", "logs", "automations", "whatsapp", "screen", "camera", "finance", "settings", "models"].includes(active) ? <ModuleView id={active} token={auth.token} /> : null}
        </main>
      </div>
      {!focus ? <MobileNav active={active} onChange={setActive} /> : null}
      <FloatingJakePanel
        indicators={indicators}
        notifications={notifications}
        onClearNotification={(id) => setNotifications((current) => current.filter((item) => item.id !== id))}
        onCommand={() => setCommandOpen(true)}
      />
      <CommandPalette
        open={commandOpen}
        token={auth.token}
        onClose={() => setCommandOpen(false)}
        onPick={setActive}
        onAskJake={(text) => {
          setCommandDraft(text);
          setActive("chat");
        }}
      />
    </div>
  );
}

function FloatingJakePanel({
  indicators,
  notifications,
  onClearNotification,
  onCommand
}: {
  indicators: Indicators;
  notifications: NotificationItem[];
  onClearNotification: (id: string) => void;
  onCommand: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = Object.values(indicators).filter(Boolean).length;
  const shouldExpand = expanded || activeCount > 0 || notifications.length > 0;

  if (!shouldExpand) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-4 right-4 z-30 hidden items-center gap-3 rounded-panel border border-line bg-paper/95 p-3 shadow-panel backdrop-blur transition hover:border-accent md:flex dark:border-stone-800 dark:bg-night-panel/95"
      >
        <span className="grid h-9 w-9 place-items-center rounded-panel bg-accent text-white">
          <Bot className="h-4 w-4" />
        </span>
        <span className="text-left">
          <span className="block text-sm font-semibold">Jake ao vivo</span>
          <span className="block text-xs text-muted dark:text-stone-400">pronto</span>
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-30 hidden w-72 rounded-panel border border-line bg-paper/95 p-3 shadow-panel backdrop-blur md:block dark:border-stone-800 dark:bg-night-panel/95">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-panel bg-accent text-white">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Jake ao vivo</p>
            <p className="text-xs text-muted dark:text-stone-400">{activeCount ? `${activeCount} sinal(is) ativo(s)` : "pronto"}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onCommand} className="grid h-8 w-8 place-items-center rounded-panel border border-line text-muted hover:border-accent hover:text-accent dark:border-stone-700" title="Ctrl + K">
            <Zap className="h-4 w-4" />
          </button>
          <button onClick={() => setExpanded(false)} className="grid h-8 w-8 place-items-center rounded-panel border border-line text-muted hover:border-accent hover:text-accent dark:border-stone-700" title="Recolher painel">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
        <Indicator label="IA" active={indicators.thinking} icon={Bot} />
        <Indicator label="Voz" active={indicators.voice} icon={Mic} />
        <Indicator label="Camera" active={indicators.camera} icon={Camera} />
        <Indicator label="Tela" active={indicators.screen} icon={MonitorUp} />
      </div>
      <div className="mt-3 border-t border-line pt-3 dark:border-stone-800">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
          <Bell className="h-3.5 w-3.5 text-accent" />
          Notificacoes
        </div>
        <div className="max-h-40 space-y-2 overflow-y-auto">
          {notifications.map((item) => (
            <div key={item.id} className="rounded bg-cream px-2 py-1.5 text-xs dark:bg-night">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{item.title}</span>
                <button onClick={() => onClearNotification(item.id)} title="Fechar">
                  <X className="h-3 w-3 text-muted" />
                </button>
              </div>
              <p className="mt-1 text-muted dark:text-stone-400">{item.body}</p>
            </div>
          ))}
          {!notifications.length ? <p className="text-xs text-muted dark:text-stone-400">Sem notificacoes recentes.</p> : null}
        </div>
      </div>
    </div>
  );
}

function Indicator({ label, active, icon: Icon }: { label: string; active: boolean; icon: LucideIcon }) {
  return (
    <div className={`rounded-panel border px-2 py-2 ${active ? "border-accent bg-accent-soft text-accent" : "border-line text-muted dark:border-stone-700 dark:text-stone-400"}`}>
      <Icon className="mb-1 h-3.5 w-3.5" />
      {label}
    </div>
  );
}

function tintAccent(hex: string) {
  const clean = hex.replace("#", "");
  const value = clean.length === 3 ? clean.split("").map((item) => item + item).join("") : clean;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * 0.82);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
