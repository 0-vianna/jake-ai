"use client";

import { Bot, Camera, Code2, FolderKanban, ImageIcon, Monitor, Wallet, Workflow } from "lucide-react";

import { ChatPanel } from "./ChatPanel";
import { NotesPanel } from "./NotesPanel";
import type { WorkspacePanelRecord } from "./types";

export function PanelRenderer({
  token,
  panel,
  onOpenModule,
  onChange
}: {
  token: string;
  panel: WorkspacePanelRecord;
  onOpenModule: (module: string) => void;
  onChange: (patch: Partial<WorkspacePanelRecord>) => void;
}) {
  if (panel.type === "note") {
    return (
      <NotesPanel
        title={panel.title}
        note={String(panel.data.note ?? "")}
        color={String(panel.data.color ?? "#fff4c7")}
        pinned={Boolean(panel.pinned)}
        onChange={(patch) =>
          onChange({
            title: patch.title ?? panel.title,
            pinned: patch.pinned ?? panel.pinned,
            data: {
              ...panel.data,
              note: patch.note ?? panel.data.note ?? "",
              color: patch.color ?? panel.data.color ?? "#fff4c7"
            }
          })
        }
      />
    );
  }

  if (panel.type === "chat") {
    return (
      <ChatPanel
        token={token}
        conversationId={(panel.data.conversationId as number | null) ?? null}
        messages={(panel.data.messages as Array<{ id: string; role: "user" | "assistant"; content: string }>) ?? []}
        onChange={(patch) =>
          onChange({
            title: patch.title ?? panel.title,
            data: {
              ...panel.data,
              conversationId: patch.conversationId ?? panel.data.conversationId ?? null,
              messages: patch.messages ?? panel.data.messages ?? []
            }
          })
        }
      />
    );
  }

  return <PlaceholderPanel type={panel.type} onOpenModule={onOpenModule} />;
}

function PlaceholderPanel({ type, onOpenModule }: { type: WorkspacePanelRecord["type"]; onOpenModule: (module: string) => void }) {
  const config = {
    image: { icon: ImageIcon, title: "Imagem", detail: "Preparado para abrir imagens em paineis com zoom, comparacao e analise." },
    file: { icon: FolderKanban, title: "Arquivo", detail: "Etapa 2 vai abrir PDFs, textos e anexos internos aqui." },
    project: { icon: FolderKanban, title: "Projeto", detail: "Painel de projeto com resumo, arquivos, tarefas e conversas relacionadas." },
    code: { icon: Code2, title: "Codigo", detail: "Vai encaixar leitura de arquivos e editor do Code Workspace dentro da mesa." },
    terminal: { icon: Code2, title: "Terminal", detail: "Reservado para terminal integrado e checkpoints do projeto." },
    finance: { icon: Wallet, title: "Financeiro", detail: "Abrira mini-painel financeiro lado a lado com outros modulos." },
    memory: { icon: Bot, title: "Memoria", detail: "Vai mostrar memorias e permitir salvar contexto visual do workspace." },
    screen: { icon: Monitor, title: "Tela", detail: "Preparado para preview da tela e analise visual pela Jake." },
    camera: { icon: Camera, title: "Camera", detail: "Entrara como painel com preview, voz e gestos dentro do workspace." },
    automation: { icon: Workflow, title: "Automacao", detail: "Vai listar e acionar fluxos locais dentro desta area livre." },
    whatsapp: { icon: Workflow, title: "WhatsApp", detail: "Painel reservado para sessao remota e whitelist." },
    browser: { icon: Monitor, title: "Navegador interno", detail: "Estrutura preparada para preview e navegacao embutida." },
    preview: { icon: Monitor, title: "Preview", detail: "Vai servir para sites, telas e comparacoes visuais." },
    whiteboard: { icon: ImageIcon, title: "Quadro branco", detail: "Preparado para desenho, post-its e escrita solta nas proximas etapas." }
  } as const;

  const moduleByType: Partial<Record<WorkspacePanelRecord["type"], string>> = {
    finance: "finance",
    memory: "memory",
    camera: "camera",
    screen: "screen",
    whatsapp: "whatsapp",
    code: "code",
    project: "projects",
    file: "files",
    automation: "automations"
  };

  const item = config[type as Exclude<WorkspacePanelRecord["type"], "note" | "chat">];
  const Icon = item.icon;
  const targetModule = moduleByType[type];

  return (
    <div className="grid h-full place-items-center rounded-panel border border-dashed border-line bg-cream/70 p-6 text-center dark:border-stone-700 dark:bg-night/70">
      <div className="max-w-sm">
        <Icon className="mx-auto mb-4 h-8 w-8 text-accent" />
        <p className="text-base font-semibold">{item.title}</p>
        <p className="mt-2 text-sm leading-6 text-muted dark:text-stone-400">{item.detail}</p>
        {targetModule ? (
          <button
            onClick={() => onOpenModule(targetModule)}
            className="mt-4 rounded-panel border border-line bg-paper px-3 py-2 text-sm hover:border-accent hover:text-accent dark:border-stone-700 dark:bg-night-panel"
          >
            Abrir modulo completo
          </button>
        ) : null}
      </div>
    </div>
  );
}
