"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  File,
  FileImage,
  Folder,
  HardDrive,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles
} from "lucide-react";

import {
  analyzePersonalFile,
  listPersonalFileRoots,
  listPersonalFiles,
  readPersonalFile,
  searchPersonalFiles,
  type PersonalFileContent,
  type PersonalFileItem,
  type PersonalFileRoot
} from "@/lib/api";

type FilesViewProps = {
  token: string;
};

type SearchResult = {
  name: string;
  path: string;
  size: number;
  modified_at: number;
  mime: string | null;
  snippet: string;
};

export function FilesView({ token }: FilesViewProps) {
  const [roots, setRoots] = useState<PersonalFileRoot[]>([]);
  const [rootId, setRootId] = useState("documents");
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems] = useState<PersonalFileItem[]>([]);
  const [selected, setSelected] = useState<PersonalFileContent | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [visited, setVisited] = useState<number | null>(null);
  const [limited, setLimited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const activeRoot = useMemo(() => roots.find((root) => root.id === rootId) || roots[0], [roots, rootId]);
  const canGoBack = Boolean(activeRoot && currentPath && currentPath !== activeRoot.path);

  useEffect(() => {
    async function loadRoots() {
      setLoading(true);
      setError("");
      try {
        const response = await listPersonalFileRoots(token);
        setRoots(response.roots);
        const preferred = response.roots.find((root) => root.id === "documents") || response.roots[0];
        if (preferred) {
          setRootId(preferred.id);
          await loadFolder({ rootId: preferred.id });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nao consegui carregar suas pastas.");
      } finally {
        setLoading(false);
      }
    }
    loadRoots();
  }, [token]);

  async function loadFolder(options: { rootId?: string; path?: string }) {
    setLoading(true);
    setError("");
    try {
      const tree = await listPersonalFiles(token, { ...options, limit: 350 });
      setCurrentPath(tree.path);
      setItems(tree.items);
      setSelected(null);
      setResults([]);
      setVisited(null);
      setLimited(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao consegui abrir esta pasta.");
    } finally {
      setLoading(false);
    }
  }

  async function changeRoot(nextRootId: string) {
    setRootId(nextRootId);
    await loadFolder({ rootId: nextRootId });
  }

  async function openItem(item: PersonalFileItem | SearchResult) {
    const isDirectory = "type" in item && item.type === "directory";
    if (isDirectory) {
      await loadFolder({ path: item.path });
      return;
    }
    setLoading(true);
    setError("");
    try {
      setSelected(await readPersonalFile(token, item.path));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao consegui ler o arquivo.");
    } finally {
      setLoading(false);
    }
  }

  async function goBack() {
    if (!activeRoot || !canGoBack) return;
    const parent = parentPath(currentPath);
    await loadFolder({ path: parent || activeRoot.path });
  }

  async function runSearch() {
    const clean = query.trim();
    if (clean.length < 2) {
      setResults([]);
      setVisited(null);
      setLimited(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await searchPersonalFiles(token, rootId, clean);
      setResults(response.items);
      setVisited(response.visited ?? null);
      setLimited(Boolean(response.limited));
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao consegui buscar nos arquivos.");
    } finally {
      setLoading(false);
    }
  }

  async function analyzeSelected() {
    if (!selected) return;
    setAnalyzing(true);
    setError("");
    try {
      setSelected(await analyzePersonalFile(token, selected.path));
      window.dispatchEvent(
        new CustomEvent("jake:notify", {
          detail: { title: "Arquivo analisado", body: selected.name }
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao consegui analisar este arquivo.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[380px_1fr]">
      <aside className="min-h-0 rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-panel bg-accent-soft text-accent">
                <HardDrive className="h-4 w-4" />
              </span>
              <div>
                <h1 className="text-lg font-semibold">Arquivos do PC</h1>
                <p className="text-xs text-muted dark:text-stone-400">leitura segura sob demanda</p>
              </div>
            </div>
          </div>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : null}
        </div>

        <div className="mb-3 rounded-panel border border-line bg-cream p-2 dark:border-stone-700 dark:bg-night">
          <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-muted dark:text-stone-400">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            Windows, AppData, Program Files e chaves ficam bloqueados.
          </div>
          <select
            value={rootId}
            onChange={(event) => changeRoot(event.target.value)}
            className="h-10 w-full rounded-panel border border-line bg-paper px-3 text-sm outline-none focus:border-accent dark:border-stone-700 dark:bg-night-panel"
          >
            {roots.map((root) => (
              <option key={root.id} value={root.id}>
                {root.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3 flex gap-2">
          <button
            onClick={goBack}
            disabled={!canGoBack}
            className="flex h-10 w-10 items-center justify-center rounded-panel border border-line text-muted transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-700"
            title="Voltar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => loadFolder(activeRoot ? { path: currentPath || activeRoot.path } : { rootId })}
            className="flex h-10 w-10 items-center justify-center rounded-panel border border-line text-muted transition hover:border-accent hover:text-accent dark:border-stone-700"
            title="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1 rounded-panel border border-line bg-cream px-3 py-2 text-xs text-muted dark:border-stone-700 dark:bg-night dark:text-stone-400">
            <div className="truncate">{shortPath(currentPath)}</div>
          </div>
        </div>

        <div className="mb-3 flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") runSearch();
            }}
            placeholder="Buscar nome ou texto"
            className="h-10 min-w-0 flex-1 rounded-panel border border-line bg-cream px-3 text-sm outline-none focus:border-accent dark:border-stone-700 dark:bg-night"
          />
          <button
            onClick={runSearch}
            className="flex h-10 w-10 items-center justify-center rounded-panel border border-line text-muted transition hover:border-accent hover:text-accent dark:border-stone-700"
            title="Buscar"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        {results.length ? (
          <div className="mb-3 rounded-panel border border-line bg-cream p-2 dark:border-stone-700 dark:bg-night">
            <p className="mb-2 px-1 text-xs font-medium text-muted dark:text-stone-400">
              Resultados {visited !== null ? `(${visited} itens verificados)` : ""}
            </p>
            <div className="max-h-52 space-y-1 overflow-y-auto">
              {results.map((item) => (
                <button key={item.path} onClick={() => openItem(item)} className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-paper dark:hover:bg-night-panel">
                  <span className="font-medium">{item.name}</span>
                  <span className="block truncate text-muted dark:text-stone-400">{item.snippet || shortPath(item.path)}</span>
                </button>
              ))}
            </div>
            {limited ? <p className="mt-2 px-1 text-xs text-amber-700 dark:text-amber-300">Busca limitada para manter o PC responsivo. Refine o termo se precisar.</p> : null}
          </div>
        ) : null}

        <div className="scrollbar-thin max-h-[calc(100vh-330px)] overflow-y-auto pr-1">
          {items.map((item) => (
            <button key={item.path} onClick={() => openItem(item)} className="group flex w-full items-center gap-2 rounded-panel px-2 py-2 text-left text-sm transition hover:bg-cream dark:hover:bg-night">
              {item.type === "directory" ? <Folder className="h-4 w-4 shrink-0 text-accent" /> : fileIcon(item)}
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              {item.type === "file" ? <span className="text-[11px] text-muted dark:text-stone-400">{formatBytes(item.size || 0)}</span> : null}
            </button>
          ))}
          {!items.length && !loading ? <p className="rounded-panel bg-cream p-3 text-sm text-muted dark:bg-night dark:text-stone-400">Nenhum item liberado nesta pasta.</p> : null}
        </div>
      </aside>

      <section className="min-h-0 rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
        {error ? <p className="mb-3 rounded-panel bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p> : null}
        {selected ? (
          <div className="flex h-full min-h-[520px] flex-col">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3 dark:border-stone-800">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{selected.name}</h2>
                <p className="mt-1 truncate text-xs text-muted dark:text-stone-400">{selected.path}</p>
                <p className="mt-1 text-xs text-muted dark:text-stone-400">
                  {formatBytes(selected.size)} · {selected.mime || "tipo desconhecido"} · {formatDate(selected.modified_at)}
                </p>
              </div>
              <button
                onClick={analyzeSelected}
                disabled={analyzing}
                className="inline-flex h-10 items-center gap-2 rounded-panel bg-accent px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
              >
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Analisar
              </button>
            </div>

            {selected.summary ? (
              <div className="mb-4 rounded-panel border border-line bg-cream p-4 dark:border-stone-700 dark:bg-night">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">Analise local</p>
                <p className="text-sm leading-6">{selected.summary}</p>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-hidden rounded-panel bg-cream dark:bg-night">
              {selected.kind === "image" && selected.content ? (
                <div className="flex h-full min-h-[420px] items-center justify-center p-4">
                  <img src={selected.content} alt={selected.name} className="max-h-full max-w-full rounded-panel object-contain shadow-soft" />
                </div>
              ) : null}
              {selected.kind === "text" ? (
                <pre className="scrollbar-thin h-full max-h-[calc(100vh-260px)] overflow-auto p-4 text-xs leading-5">
                  {selected.content}
                </pre>
              ) : null}
              {selected.kind === "metadata" ? (
                <div className="grid h-full min-h-[420px] place-items-center p-6 text-center">
                  <div>
                    <File className="mx-auto mb-3 h-10 w-10 text-muted" />
                    <p className="text-sm font-medium">{selected.preview || "Este formato ainda nao tem leitura direta."}</p>
                    <p className="mt-2 text-xs text-muted dark:text-stone-400">O Jake ainda pode usar nome, tamanho, tipo e data para organizar ou procurar depois.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid h-full min-h-[520px] place-items-center rounded-panel bg-cream p-6 text-center dark:bg-night">
            <div className="max-w-md">
              <HardDrive className="mx-auto mb-4 h-12 w-12 text-accent" />
              <h2 className="text-xl font-semibold">Jake agora enxerga seus arquivos pessoais</h2>
              <p className="mt-2 text-sm leading-6 text-muted dark:text-stone-400">
                Abra um arquivo, imagem, documento ou planilha para visualizar e analisar. Pastas de sistema e arquivos sensiveis continuam bloqueados.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function fileIcon(item: PersonalFileItem) {
  if (item.mime?.startsWith("image/")) return <FileImage className="h-4 w-4 shrink-0 text-muted" />;
  return <File className="h-4 w-4 shrink-0 text-muted" />;
}

function parentPath(path: string) {
  const normalized = path.replaceAll("/", "\\");
  const index = normalized.lastIndexOf("\\");
  return index > 0 ? normalized.slice(0, index) : "";
}

function shortPath(path: string) {
  if (!path) return "carregando...";
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.slice(-4).join(" / ");
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
