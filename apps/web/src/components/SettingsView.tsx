"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Camera,
  Check,
  Cpu,
  KeyRound,
  Loader2,
  Mic,
  Moon,
  Palette,
  Save,
  Shield,
  Smartphone,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { getSettings, saveSetting } from "@/lib/api";

type SettingsViewProps = {
  token: string;
  accent: string;
  onAccentChange: (value: string) => void;
  compact: boolean;
  onCompactChange: (value: boolean) => void;
  focus: boolean;
  onFocusChange: (value: boolean) => void;
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
  default_ai_mode?: string;
  economy_model?: string;
  balanced_model?: string;
  max_model?: string;
  whatsapp_enabled?: boolean;
  vision_enabled?: boolean;
  voice_enabled?: boolean;
  screen_control_enabled?: boolean;
  api_usage_month?: ApiUsageMonth;
};

const accentOptions = ["#d97732", "#c25b2a", "#b7791f", "#0f766e", "#2563eb", "#7c3aed"];

export function SettingsView({
  token,
  accent,
  onAccentChange,
  compact,
  onCompactChange,
  focus,
  onFocusChange
}: SettingsViewProps) {
  const [runtime, setRuntime] = useState<RuntimeSettings | null>(null);
  const [userSettings, setUserSettings] = useState<Record<string, string>>({});
  const [limit, setLimit] = useState("10");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    load();
  }, [token]);

  async function load() {
    setLoading(true);
    try {
      const result = await getSettings(token);
      setRuntime(result.runtime as RuntimeSettings);
      setUserSettings(result.user as Record<string, string>);
      const usage = (result.runtime as RuntimeSettings).api_usage_month;
      setLimit(String(usage?.monthly_limit_usd ?? result.user.monthly_limit_usd ?? "10"));
    } finally {
      setLoading(false);
    }
  }

  async function saveLimit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveSetting(token, "monthly_limit_usd", limit);
      setSaved("Limite mensal salvo.");
      await load();
    } finally {
      setSaving(false);
      window.setTimeout(() => setSaved(""), 1800);
    }
  }

  const usage = runtime?.api_usage_month ?? {};
  const rows: Array<{ label: string; value: string; icon: LucideIcon }> = useMemo(
    () => [
      { label: "API Key", value: runtime?.openai_configured ? "configurada" : "pendente", icon: KeyRound },
      { label: "Modo padrao", value: String(runtime?.default_ai_mode ?? userSettings.default_ai_mode ?? "balanced"), icon: Bot },
      { label: "Modelo economico", value: String(runtime?.economy_model ?? "gpt-4.1-mini"), icon: Cpu },
      { label: "Modelo equilibrado", value: String(runtime?.balanced_model ?? "gpt-4.1-mini"), icon: Cpu },
      { label: "Modelo maximo", value: String(runtime?.max_model ?? "gpt-4.1"), icon: Cpu },
      { label: "WhatsApp", value: runtime?.whatsapp_enabled ? "ativo" : "desativado", icon: Smartphone },
      { label: "Visao", value: runtime?.vision_enabled ? "ativa" : "desativada", icon: Camera },
      { label: "Voz", value: runtime?.voice_enabled ? "ativa" : "desativada", icon: Mic }
    ],
    [runtime, userSettings.default_ai_mode]
  );

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <div className="rounded-panel border border-line bg-paper p-5 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Configuracoes</h1>
              <p className="mt-1 text-sm text-muted dark:text-stone-400">Tema, modelos, limite de uso, integracoes e privacidade.</p>
            </div>
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-accent" /> : <Shield className="h-5 w-5 text-accent" />}
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {rows.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex min-h-16 items-center justify-between gap-3 rounded-panel border border-line bg-cream p-4 dark:border-stone-700 dark:bg-night">
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-accent" />
                  <span className="text-sm text-muted dark:text-stone-300">{label}</span>
                </div>
                <span className="text-right text-sm font-medium">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-panel border border-line bg-paper p-5 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Modelos de IA</h2>
              <p className="mt-1 text-sm text-muted dark:text-stone-400">Tres perfis para custo, velocidade e contexto.</p>
            </div>
            <Bot className="h-5 w-5 text-accent" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ModelCard title="Economico" model={String(runtime?.economy_model ?? "gpt-4.1-mini")} detail="Respostas rapidas, baixo custo." />
            <ModelCard title="Equilibrado" model={String(runtime?.balanced_model ?? "gpt-4.1-mini")} detail="Padrao recomendado para o dia a dia." />
            <ModelCard title="Maximo" model={String(runtime?.max_model ?? "gpt-4.1")} detail="Mais qualidade e contexto quando precisar." />
          </div>
        </div>

        <div className="rounded-panel border border-line bg-paper p-5 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Uso da API neste mes</h2>
              <p className="mt-1 text-sm text-muted dark:text-stone-400">Estimativa local baseada nos tokens registrados.</p>
            </div>
            <WalletCards className="h-5 w-5 text-accent" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric label="Chamadas" value={String(usage.calls ?? 0)} />
            <Metric label="Tokens" value={String(usage.total_tokens ?? 0)} />
            <Metric label="Custo estimado" value={`US$ ${(usage.estimated_cost ?? 0).toFixed(4)}`} />
          </div>
          <form onSubmit={saveLimit} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="min-w-48 flex-1 text-sm text-muted dark:text-stone-400">
              Limite mensal em dolar
              <input
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                inputMode="decimal"
                className="mt-2 h-10 w-full rounded-panel border border-line bg-cream px-3 text-sm outline-none focus:border-accent dark:border-stone-700 dark:bg-night"
              />
            </label>
            <button disabled={saving} className="flex h-10 items-center gap-2 rounded-panel bg-accent px-4 text-sm font-medium text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar limite
            </button>
          </form>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-cream dark:bg-night">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, usage.percent ?? 0)}%` }} />
          </div>
          {saved ? <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{saved}</p> : null}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Palette className="h-4 w-4 text-accent" />
            Aparencia
          </h2>
          <div className="mt-4 space-y-4">
            <label className="block text-sm text-muted dark:text-stone-400">
              Cor principal
              <input
                value={accent}
                onChange={(event) => onAccentChange(event.target.value)}
                type="color"
                className="mt-2 h-10 w-full rounded-panel border border-line bg-cream p-1 dark:border-stone-700 dark:bg-night"
              />
            </label>
            <div className="grid grid-cols-6 gap-2">
              {accentOptions.map((item) => (
                <button
                  key={item}
                  onClick={() => onAccentChange(item)}
                  className="grid h-9 place-items-center rounded-panel border border-line"
                  style={{ backgroundColor: item }}
                  title={item}
                >
                  {accent.toLowerCase() === item.toLowerCase() ? <Check className="h-4 w-4 text-white" /> : null}
                </button>
              ))}
            </div>
            <ToggleRow label="Modo compacto" checked={compact} onChange={onCompactChange} />
            <ToggleRow label="Modo foco" checked={focus} onChange={onFocusChange} />
          </div>
        </div>

        <div className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Moon className="h-4 w-4 text-accent" />
            Atalhos
          </h2>
          <div className="mt-3 space-y-2 text-sm text-muted dark:text-stone-400">
            <Shortcut keys="Ctrl + K" label="comando rapido global" />
            <Shortcut keys="Ctrl + Shift + C" label="camera e gestos" />
            <Shortcut keys="Ctrl + Shift + S" label="tela" />
            <Shortcut keys="Ctrl + Shift + F" label="financeiro" />
            <Shortcut keys="Ctrl + Shift + D" label="claro/escuro" />
            <Shortcut keys="Ctrl + Shift + L" label="modo foco" />
          </div>
        </div>

        <div className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <h2 className="text-sm font-semibold">Chave OpenAI</h2>
          <p className="mt-3 text-sm leading-6 text-muted dark:text-stone-400">
            O Jake le a chave do arquivo .env como OPENAI_API_KEY e nunca mostra a chave completa na interface.
          </p>
        </div>
      </aside>
    </div>
  );
}

function ModelCard({ title, model, detail }: { title: string; model: string; detail: string }) {
  return (
    <div className="rounded-panel border border-line bg-cream p-4 dark:border-stone-700 dark:bg-night">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 font-mono text-xs text-accent">{model}</p>
      <p className="mt-2 text-xs leading-5 text-muted dark:text-stone-400">{detail}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel border border-line bg-cream p-4 dark:border-stone-700 dark:bg-night">
      <p className="text-xs text-muted dark:text-stone-400">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-panel border border-line bg-cream px-3 py-2 text-sm dark:border-stone-700 dark:bg-night">
      <span className="text-muted dark:text-stone-300">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="rounded bg-cream px-2 py-1 font-mono text-xs dark:bg-night">{keys}</span>
    </div>
  );
}
