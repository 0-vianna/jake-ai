"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, File, Folder, Loader2, Search } from "lucide-react";

import { getCodeTree, readCodeFile, searchCodeWorkspace, type CodeTreeItem } from "@/lib/api";

type CodeWorkspaceViewProps = {
  token: string;
};

export function CodeWorkspaceView({ token }: CodeWorkspaceViewProps) {
  const [path, setPath] = useState("");
  const [items, setItems] = useState<CodeTreeItem[]>([]);
  const [file, setFile] = useState<{ path: string; content: string } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ name: string; path: string; snippet: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(nextPath = path) {
    setLoading(true);
    setError("");
    try {
      const tree = await getCodeTree(token, nextPath);
      setPath(tree.path);
      setItems(tree.items);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao abrir workspace.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
  }, [token]);

  async function openItem(item: CodeTreeItem) {
    if (item.type === "directory") {
      await load(item.path);
      return;
    }
    setLoading(true);
    try {
      setFile(await readCodeFile(token, item.path));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui ler o arquivo.");
    } finally {
      setLoading(false);
    }
  }

  async function runSearch() {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const response = await searchCodeWorkspace(token, query.trim());
      setResults(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui buscar no workspace.");
    } finally {
      setLoading(false);
    }
  }

  function parentPath() {
    if (!path) return "";
    const parts = path.split("/");
    parts.pop();
    return parts.join("/");
  }

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[360px_1fr]">
      <aside className="min-h-0 rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Code Workspace</h1>
            <p className="text-xs text-muted dark:text-stone-400">{path || "raiz do projeto"}</p>
          </div>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : null}
        </div>
        {path ? (
          <button onClick={() => load(parentPath())} className="mb-2 flex h-9 items-center gap-2 rounded-panel px-2 text-sm text-muted hover:bg-cream dark:text-stone-300 dark:hover:bg-night">
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </button>
        ) : null}
        <div className="mb-3 flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") runSearch();
            }}
            placeholder="Buscar arquivo ou texto"
            className="h-9 min-w-0 flex-1 rounded-panel border border-line bg-cream px-3 text-sm outline-none focus:border-accent dark:border-stone-700 dark:bg-night"
          />
          <button onClick={runSearch} className="flex h-9 w-9 items-center justify-center rounded-panel border border-line text-muted hover:border-accent hover:text-accent dark:border-stone-700" title="Buscar">
            <Search className="h-4 w-4" />
          </button>
        </div>
        {results.length ? (
          <div className="mb-3 rounded-panel border border-line bg-cream p-2 dark:border-stone-700 dark:bg-night">
            <p className="mb-2 px-1 text-xs font-medium text-muted dark:text-stone-400">Resultados</p>
            {results.slice(0, 8).map((item) => (
              <button key={item.path} onClick={() => openItem({ name: item.name, path: item.path, type: "file", size: null })} className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-paper dark:hover:bg-night-panel">
                <span className="font-medium">{item.name}</span>
                <span className="block truncate text-muted dark:text-stone-400">{item.snippet || item.path}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="scrollbar-thin max-h-[calc(100vh-190px)] overflow-y-auto">
          {items.map((item) => (
            <button key={item.path} onClick={() => openItem(item)} className="flex w-full items-center gap-2 rounded-panel px-2 py-2 text-left text-sm hover:bg-cream dark:hover:bg-night">
              {item.type === "directory" ? <Folder className="h-4 w-4 text-accent" /> : <File className="h-4 w-4 text-muted" />}
              <span className="truncate">{item.name}</span>
            </button>
          ))}
        </div>
      </aside>
      <section className="min-h-0 rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
        {error ? <p className="mb-3 rounded-panel bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p> : null}
        {file ? (
          <>
            <h2 className="mb-3 text-sm font-semibold">{file.path}</h2>
            <pre className="scrollbar-thin max-h-[calc(100vh-180px)] overflow-auto rounded-panel bg-cream p-4 text-xs leading-5 dark:bg-night">
              {file.content}
            </pre>
          </>
        ) : (
          <div className="grid h-full min-h-[420px] place-items-center text-center text-sm text-muted dark:text-stone-400">
            Selecione um arquivo textual para visualizar. Edição com backup/checkpoint vem na próxima etapa.
          </div>
        )}
      </section>
    </div>
  );
}
