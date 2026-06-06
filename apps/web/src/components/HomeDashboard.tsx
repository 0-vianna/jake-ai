"use client";

import {
  Activity,
  Bot,
  Camera,
  Code2,
  Database,
  Gauge,
  Globe2,
  LayoutDashboard,
  MessageCircle,
  MonitorUp,
  PenLine,
  Power,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  Wifi
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { connectWhatsApp, getSettings } from "@/lib/api";
import { greetingFor } from "@/lib/time";
import type { ModuleId, User } from "@/lib/types";

type HomeDashboardProps = {
  user: User;
  token: string;
  onOpen: (id: ModuleId) => void;
  mode: string;
  onModeChange: (mode: string) => void;
  onCommand: () => void;
};

type ApiUsageMonth = {
  month?: string;
  calls?: number;
  total_tokens?: number;
  estimated_cost?: number;
  monthly_limit_usd?: number;
  percent?: number;
};

type RuntimeSettings = {
  openai_configured?: boolean;
  whatsapp_enabled?: boolean;
  vision_enabled?: boolean;
  voice_enabled?: boolean;
  screen_control_enabled?: boolean;
  api_usage_month?: ApiUsageMonth;
};

const quickCards: Array<{ label: string; detail: string; icon: LucideIcon; target: ModuleId }> = [
  { label: "Codigo", detail: "Projetos, bugs e terminal", icon: Code2, target: "code" },
  { label: "Chat", detail: "OpenAI, web e memoria", icon: MessageCircle, target: "chat" },
  { label: "Arquivos", detail: "Ler, buscar e resumir", icon: PenLine, target: "files" },
  { label: "Tela", detail: "Print e analise visual", icon: MonitorUp, target: "screen" },
  { label: "Camera", detail: "Gestos com MediaPipe", icon: Camera, target: "camera" },
  { label: "Financeiro", detail: "Receitas, despesas e reset", icon: Wallet, target: "finance" },
  { label: "Automacoes", detail: "Fluxos locais seguros", icon: Power, target: "automations" },
  { label: "Memoria", detail: "Preferencias e fatos", icon: Database, target: "memory" },
  { label: "Internet", detail: "Perguntas atuais", icon: Globe2, target: "chat" }
];

const modes = [
  { id: "economic", label: "Economico", detail: "mais barato" },
  { id: "balanced", label: "Equilibrado", detail: "padrao diario" },
  { id: "maximum", label: "Maximo", detail: "mais contexto" }
];

const timeline = [
  { title: "Chat real ativo", detail: "OpenAI, memoria seletiva, anexos e busca web quando precisa." },
  { title: "Camera e gestos", detail: "Preview local, 21 landmarks, linhas verdes e acoes por gesto." },
  { title: "Financeiro diario", detail: "Lancamento rapido por texto, dashboard e botao de reset." },
  { title: "Seguranca local", detail: "JWT, senha criptografada, logs e rotas com usuario autenticado." }
];

export function HomeDashboard({ user, token, onOpen, mode, onModeChange, onCommand }: HomeDashboardProps) {
  return (
    <div className="grid h-full gap-4 xl:grid-cols-[1fr_340px]">
      <section className="min-w-0 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-panel border border-line bg-paper p-5 shadow-soft dark:border-stone-800 dark:bg-night-panel"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-accent-soft to-transparent opacity-70" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <button
                onClick={() => onOpen("logs")}
                className="mb-2 inline-flex items-center gap-2 rounded-panel border border-line bg-cream px-3 py-1.5 text-xs font-medium text-accent transition hover:border-accent dark:border-stone-700 dark:bg-night"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Jake pronto
              </button>
              <h1 className="text-3xl font-semibold leading-tight md:text-5xl">
                {greetingFor()}, {user.name}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted dark:text-stone-300">
                Abra um modulo, procure qualquer coisa com Ctrl + K ou peca para o Jake cuidar do proximo passo.
              </p>
            </div>

            <div className="min-w-[260px] rounded-panel border border-line bg-cream p-2 shadow-inner dark:border-stone-700 dark:bg-night">
              <div className="mb-2 flex items-center gap-2 px-2 pt-1 text-xs font-medium text-muted dark:text-stone-400">
                <Gauge className="h-3.5 w-3.5 text-accent" />
                Modo do Jake
              </div>
              <div className="grid grid-cols-3 gap-1">
                {modes.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onModeChange(item.id)}
                    className={`rounded px-2 py-2 text-left transition ${
                      mode === item.id ? "bg-accent text-white shadow-soft" : "text-muted hover:bg-paper hover:text-ink dark:text-stone-300 dark:hover:bg-night-panel dark:hover:text-white"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="block text-[11px] opacity-80">{item.detail}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={onCommand}
            className="relative mt-6 flex min-h-16 w-full items-center justify-between rounded-panel border border-line bg-cream px-4 text-left shadow-inner transition hover:border-accent hover:bg-accent-soft dark:border-stone-700 dark:bg-night"
          >
            <span>
              <span className="block text-sm font-medium">Comando rapido global</span>
              <span className="text-sm text-muted dark:text-stone-300">Busque conversas, arquivos, projetos, memorias e modulos.</span>
            </span>
            <span className="flex min-w-fit items-center gap-2 whitespace-nowrap rounded bg-paper px-3 py-1 text-xs text-muted dark:bg-night-panel dark:text-stone-300">
              <Search className="h-3.5 w-3.5" />
              Ctrl K
            </span>
          </button>
        </motion.div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickCards.map((card, index) => (
            <motion.button
              key={card.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.985 }}
              transition={{ delay: index * 0.025 }}
              onClick={() => onOpen(card.target)}
              className="group min-h-[126px] rounded-panel border border-line bg-paper p-4 text-left shadow-soft transition hover:border-accent dark:border-stone-800 dark:bg-night-panel"
            >
              <span className="mb-4 grid h-9 w-9 place-items-center rounded-panel bg-accent-soft text-accent transition group-hover:bg-accent group-hover:text-white">
                <card.icon className="h-5 w-5" />
              </span>
              <p className="font-medium">{card.label}</p>
              <p className="mt-2 text-sm leading-5 text-muted dark:text-stone-400">{card.detail}</p>
            </motion.button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <FloatingPanel
            title="Code Workspace"
            meta="Editor, leitura de arquivos e busca no projeto. Terminal e checkpoints ficam preparados para evoluir com seguranca."
            icon={Code2}
            onClick={() => onOpen("code")}
          />
          <FloatingPanel
            title="Memoria inteligente"
            meta="Memoria curta na conversa, memoria longa por usuario e busca seletiva para economizar tokens."
            icon={Database}
            onClick={() => onOpen("memory")}
          />
        </div>
      </section>

      <aside className="space-y-4">
        <StatusPanel token={token} onOpen={onOpen} />
        <div className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Atividade recente</h2>
            <Activity className="h-4 w-4 text-accent" />
          </div>
          <div className="space-y-0">
            {timeline.map((item, index) => (
              <div key={item.title} className="grid grid-cols-[18px_1fr] gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1 h-3 w-3 rounded-full border-2 border-accent bg-paper dark:bg-night-panel" />
                  {index < timeline.length - 1 ? <span className="h-full min-h-10 w-px bg-line dark:bg-stone-800" /> : null}
                </div>
                <div className="pb-4">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted dark:text-stone-400">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function StatusPanel({ token, onOpen }: { token: string; onOpen: (id: ModuleId) => void }) {
  const [runtime, setRuntime] = useState<RuntimeSettings | null>(null);
  const [selected, setSelected] = useState("Jake");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSettings(token)
      .then((settings) => setRuntime(settings.runtime as RuntimeSettings))
      .catch(() => setRuntime(null));
  }, [token]);

  async function connectQr() {
    setBusy(true);
    try {
      await connectWhatsApp(token);
      window.dispatchEvent(new CustomEvent("jake:notify", { detail: { title: "WhatsApp", body: "Sessao QR preparada." } }));
      onOpen("whatsapp");
    } finally {
      setBusy(false);
    }
  }

  const usage = runtime?.api_usage_month ?? {};
  const statuses = [
    {
      label: "Jake",
      value: "operacional",
      detail: "Interface, memoria, chat, voz, tela, camera e automacoes conectados por eventos locais.",
      icon: Bot,
      tone: "ok",
      onClick: () => setSelected("Jake")
    },
    {
      label: "API",
      value: runtime?.openai_configured ? "configurada" : runtime?.openai_configured === false ? "sem chave" : "checando",
      detail: `${usage.calls ?? 0} chamada(s), ${usage.total_tokens ?? 0} tokens, US$ ${(usage.estimated_cost ?? 0).toFixed(4)} de US$ ${usage.monthly_limit_usd ?? 10}.`,
      icon: Wifi,
      tone: runtime?.openai_configured ? "ok" : "warn",
      onClick: () => onOpen("settings")
    },
    {
      label: "WhatsApp",
      value: "QR remoto",
      detail: "Clique para preparar a sessao e abrir a tela com whitelist e bridge local.",
      icon: MessageCircle,
      tone: "warn",
      onClick: connectQr
    },
    {
      label: "PC",
      value: runtime?.screen_control_enabled ? "agente local" : "restrito",
      detail: "Comandos seguros, tela e automacoes locais ficam bloqueados fora das rotas permitidas.",
      icon: Power,
      tone: runtime?.screen_control_enabled ? "ok" : "warn",
      onClick: () => onOpen("automations")
    },
    {
      label: "Memoria",
      value: "ativa",
      detail: "Abra para editar, apagar, buscar e salvar fatos importantes por usuario.",
      icon: Database,
      tone: "accent",
      onClick: () => onOpen("memory")
    }
  ];
  const active = statuses.find((item) => item.label === selected) ?? statuses[0];

  return (
    <div className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Status do Jake</h2>
        <LayoutDashboard className="h-4 w-4 text-accent" />
      </div>
      <div className="space-y-2">
        {statuses.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              setSelected(item.label);
              void item.onClick();
            }}
            disabled={busy && item.label === "WhatsApp"}
            className="flex w-full items-center justify-between gap-3 rounded-panel border border-transparent px-2 py-2 text-left text-sm transition hover:border-accent hover:bg-cream dark:hover:bg-night"
          >
            <span className="flex items-center gap-2 text-muted dark:text-stone-400">
              <item.icon className="h-4 w-4 text-accent" />
              {item.label}
            </span>
            <span className={`rounded px-2 py-1 text-xs ${toneClass(item.tone)}`}>{busy && item.label === "WhatsApp" ? "abrindo" : item.value}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-panel border border-line bg-cream p-3 dark:border-stone-700 dark:bg-night">
        <p className="text-sm font-medium">{active.label}</p>
        <p className="mt-1 text-xs leading-5 text-muted dark:text-stone-400">{active.detail}</p>
        {active.label === "API" ? (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper dark:bg-night-panel">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, usage.percent ?? 0)}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function toneClass(tone: string) {
  if (tone === "ok") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
  if (tone === "warn") return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  return "bg-accent-soft text-accent";
}

function FloatingPanel({ title, meta, icon: Icon, onClick }: { title: string; meta: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <button onClick={onClick} className="glass-panel group rounded-panel p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-accent">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-1.5 w-16 rounded-full bg-accent/60" />
        <Icon className="h-4 w-4 text-accent transition group-hover:scale-110" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted dark:text-stone-400">{meta}</p>
    </button>
  );
}
