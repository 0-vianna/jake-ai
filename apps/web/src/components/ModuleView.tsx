"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Camera,
  Code2,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  MemoryStick,
  Play,
  Shield,
  Smartphone,
  Users,
  Workflow
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { getModuleStatus } from "@/lib/api";
import type { ModuleId } from "@/lib/types";

type ModuleViewProps = {
  id: ModuleId;
  token: string;
};

const copy: Record<string, { title: string; icon: LucideIcon; bullets: string[] }> = {
  projects: {
    title: "Projetos",
    icon: FolderKanban,
    bullets: ["Conversas relacionadas", "Arquivos e decisões", "Memórias por projeto", "Status e anotações"]
  },
  files: {
    title: "Arquivos",
    icon: FileText,
    bullets: ["Pastas permitidas", "Resumo de documentos", "Backups antes de editar", "Proteção contra caminhos críticos"]
  },
  code: {
    title: "Code Workspace",
    icon: Code2,
    bullets: ["Explorador de arquivos", "Terminal integrado planejado", "Checkpoints e backups", "Logs de ações da IA"]
  },
  screen: {
    title: "Tela",
    icon: LayoutDashboard,
    bullets: ["Captura de tela", "Análise visual", "Clique assistido", "Histórico de prints"]
  },
  camera: {
    title: "Câmera",
    icon: Camera,
    bullets: ["MediaPipe Hands", "Gestos padrão", "Reconhecimento de objetos", "Sensibilidade configurável"]
  },
  automations: {
    title: "Automações",
    icon: Workflow,
    bullets: ["Gatilhos por horário", "Fluxos por texto", "Logs", "Ativar e desativar tarefas"]
  },
  whatsapp: {
    title: "WhatsApp",
    icon: Smartphone,
    bullets: ["QR Code", "Whitelist", "Áudios transcritos", "Comandos remotos com segurança"]
  },
  memory: {
    title: "Memória",
    icon: MemoryStick,
    bullets: ["Memória curta", "Memória longa", "Tags", "Botão esquecer isso"]
  },
  users: {
    title: "Usuários",
    icon: Users,
    bullets: ["Admin e usuário comum", "Permissões", "Perfil separado", "Memória isolada"]
  },
  logs: {
    title: "Logs",
    icon: Shield,
    bullets: ["Login", "Comandos", "Arquivos alterados", "Chamadas de API"]
  },
  models: {
    title: "Modelos de IA",
    icon: Bot,
    bullets: ["Modo econômico", "Modo equilibrado", "Modo máximo", "Uso estimado"]
  }
};

export function ModuleView({ id, token }: ModuleViewProps) {
  const item = copy[id] ?? copy.projects;
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!["screen", "camera", "whatsapp"].includes(id)) return;
    setLoading(true);
    getModuleStatus(token, id as "screen" | "camera" | "whatsapp")
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, [id, token]);

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[1fr_340px]">
      <section className="rounded-panel border border-line bg-paper p-5 shadow-soft dark:border-stone-800 dark:bg-night-panel">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-panel bg-accent-soft text-accent dark:bg-orange-950/40">
            <item.icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{item.title}</h1>
            <p className="text-sm text-muted dark:text-stone-400">Módulo preparado para expansão profissional.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {item.bullets.map((bullet) => (
            <div key={bullet} className="rounded-panel border border-line bg-cream p-4 dark:border-stone-700 dark:bg-night">
              <p className="font-medium">{bullet}</p>
              <p className="mt-2 text-sm leading-6 text-muted dark:text-stone-400">
                Estrutura criada no backend e no painel para ativar a implementação completa depois.
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-panel border border-dashed border-accent/40 bg-accent-soft p-4 text-sm leading-6 text-orange-900 dark:bg-orange-950/30 dark:text-orange-200">
          Esta primeira versão já separa o módulo, permissões e status. Funções como clicar na tela, ler câmera e WhatsApp ficam em serviços próprios para não misturar risco com o chat.
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Status técnico</h2>
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <Play className="h-4 w-4 text-accent" />}
          </div>
          <pre className="mt-4 overflow-auto rounded-panel bg-cream p-3 text-xs leading-5 text-muted dark:bg-night dark:text-stone-300">
            {JSON.stringify(status ?? { status: "ready", module: id }, null, 2)}
          </pre>
        </div>
        <div className="glass-panel rounded-panel p-4 shadow-soft">
          <h2 className="text-sm font-semibold">Próximo passo natural</h2>
          <p className="mt-3 text-sm leading-6 text-muted dark:text-stone-400">
            Conectar o agente local desse módulo e registrar cada ação no audit log antes de liberar automações sensíveis.
          </p>
        </div>
      </aside>
    </div>
  );
}
