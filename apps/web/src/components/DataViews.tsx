"use client";

import { FormEvent, useEffect, useState } from "react";
import { Activity, Brain, FolderKanban, Loader2, LogOut, Play, Plus, Trash2, UserPlus, Users, Workflow } from "lucide-react";

import {
  createAutomation,
  createMemory,
  createProject,
  createUser,
  deleteAutomation,
  deleteMemory,
  listAuditLogs,
  listAutomations,
  listMemories,
  listProjects,
  listUsers,
  runAutomation
} from "@/lib/api";
import type { User } from "@/lib/types";

export function ProjectsView({ token }: { token: string }) {
  const [rows, setRows] = useState<Array<{ id: number; name: string; description: string; status: string }>>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setRows(await listProjects(token));
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await createProject(token, { name, description });
    setName("");
    setDescription("");
    await load();
  }

  return (
    <CrudPanel icon={FolderKanban} title="Projetos" loading={loading}>
      <form onSubmit={submit} className="grid gap-2 md:grid-cols-[220px_1fr_auto]">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do projeto" className="h-10 rounded-panel border border-line bg-cream px-3 text-sm dark:border-stone-700 dark:bg-night" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" className="h-10 rounded-panel border border-line bg-cream px-3 text-sm dark:border-stone-700 dark:bg-night" />
        <button className="flex h-10 items-center justify-center gap-2 rounded-panel bg-accent px-4 text-sm font-medium text-white"><Plus className="h-4 w-4" /> Criar</button>
      </form>
      <p className="mt-3 text-sm text-muted dark:text-stone-400">Crie projetos para agrupar conversas, arquivos, tarefas e memórias do Jake.</p>
      <Rows>{rows.map((row) => <Row key={row.id} title={row.name} detail={`${row.status} · ${row.description || "sem descrição"}`} />)}</Rows>
    </CrudPanel>
  );
}

export function MemoryView({ token }: { token: string }) {
  const [rows, setRows] = useState<Array<{ id: number; content: string; tags: string; summary: string | null }>>([]);
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setRows(await listMemories(token));
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    await createMemory(token, { content, tags });
    setContent("");
    setTags("");
    await load();
  }

  return (
    <CrudPanel icon={Brain} title="Memória" loading={loading}>
      <form onSubmit={submit} className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
        <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Salvar na memória" className="h-10 rounded-panel border border-line bg-cream px-3 text-sm dark:border-stone-700 dark:bg-night" />
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags" className="h-10 rounded-panel border border-line bg-cream px-3 text-sm dark:border-stone-700 dark:bg-night" />
        <button className="flex h-10 items-center justify-center gap-2 rounded-panel bg-accent px-4 text-sm font-medium text-white"><Plus className="h-4 w-4" /> Salvar</button>
      </form>
      <p className="mt-3 text-sm text-muted dark:text-stone-400">Salve preferências, decisões e informações importantes. Você pode esquecer memórias pela lixeira.</p>
      <Rows>
        {rows.map((row) => (
          <div key={row.id} className="flex items-start justify-between gap-3 rounded-panel bg-cream p-3 text-sm dark:bg-night">
            <div>
              <p className="font-medium">{row.summary || row.content}</p>
              <p className="mt-1 text-xs text-muted dark:text-stone-400">{row.tags || "sem tags"}</p>
            </div>
            <button onClick={async () => { await deleteMemory(token, row.id); await load(); }} title="Esquecer"><Trash2 className="h-4 w-4 text-red-600" /></button>
          </div>
        ))}
      </Rows>
    </CrudPanel>
  );
}

export function UsersView({ token, currentUser, onLogout }: { token: string; currentUser: User; onLogout: () => void }) {
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    role: "user"
  });

  async function load() {
    setLoading(true);
    try {
      setRows(await listUsers(token));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui carregar usuários.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.username.trim() || !form.email.trim() || form.password.length < 6) return;
    await createUser(token, form);
    setForm({ name: "", username: "", email: "", password: "", role: "user" });
    await load();
  }

  return (
    <CrudPanel icon={Users} title="Usuários" loading={loading}>
      <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
        <form onSubmit={submit} className="rounded-panel border border-line bg-cream p-4 dark:border-stone-700 dark:bg-night">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="h-4 w-4 text-accent" />
            Novo usuário
          </h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} placeholder="Nome" className="h-10 rounded-panel border border-line bg-paper px-3 text-sm dark:border-stone-700 dark:bg-night-panel" />
            <input value={form.username} onChange={(e) => setForm((current) => ({ ...current, username: e.target.value }))} placeholder="Usuário" className="h-10 rounded-panel border border-line bg-paper px-3 text-sm dark:border-stone-700 dark:bg-night-panel" />
            <input value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} placeholder="Email" type="email" className="h-10 rounded-panel border border-line bg-paper px-3 text-sm dark:border-stone-700 dark:bg-night-panel" />
            <input value={form.password} onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))} placeholder="Senha (mín. 6)" type="password" className="h-10 rounded-panel border border-line bg-paper px-3 text-sm dark:border-stone-700 dark:bg-night-panel" />
            <select value={form.role} onChange={(e) => setForm((current) => ({ ...current, role: e.target.value }))} className="h-10 rounded-panel border border-line bg-paper px-3 text-sm dark:border-stone-700 dark:bg-night-panel">
              <option value="user">Usuário</option>
              <option value="admin">Admin</option>
            </select>
            <button className="flex h-10 items-center justify-center gap-2 rounded-panel bg-accent px-4 text-sm font-medium text-white">
              <Plus className="h-4 w-4" />
              Criar conta
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </form>
        <div className="rounded-panel border border-line bg-cream p-4 dark:border-stone-700 dark:bg-night">
          <p className="text-xs text-muted dark:text-stone-400">Conta atual</p>
          <p className="mt-2 font-semibold">{currentUser.name}</p>
          <p className="text-sm text-muted dark:text-stone-400">{currentUser.username} · {currentUser.role}</p>
          <button onClick={onLogout} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-panel border border-line bg-paper text-sm font-medium text-muted hover:border-accent hover:text-accent dark:border-stone-700 dark:bg-night-panel">
            <LogOut className="h-4 w-4" />
            Deslogar
          </button>
        </div>
      </div>
      <Rows>{rows.map((row) => <Row key={row.id} title={`${row.name} (${row.username})`} detail={`${row.role} · ${row.email}`} />)}</Rows>
    </CrudPanel>
  );
}

export function LogsView({ token }: { token: string }) {
  const [rows, setRows] = useState<Array<{ id: number; action: string; details: string; level: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    listAuditLogs(token).then(setRows).finally(() => setLoading(false));
  }, [token]);
  return (
    <CrudPanel icon={Activity} title="Logs" loading={loading}>
      <Rows>{rows.map((row) => <Row key={row.id} title={row.action} detail={`${row.level} · ${row.details || row.created_at}`} />)}</Rows>
    </CrudPanel>
  );
}

export function AutomationsView({ token }: { token: string }) {
  const [rows, setRows] = useState<Array<{ id: number; name: string; description: string; trigger: string; actions_json: string; active: boolean; last_run_at: string | null }>>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("manual");
  const [action, setAction] = useState("Abrir chat e avisar João");
  const [loading, setLoading] = useState(true);
  async function load() {
    setRows(await listAutomations(token));
    setLoading(false);
  }
  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [token]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await createAutomation(token, { name, description, trigger, actions_json: JSON.stringify([{ type: "note", text: action }]), active: true });
    setName("");
    setDescription("");
    setTrigger("manual");
    setAction("Abrir chat e avisar João");
    await load();
  }
  return (
    <CrudPanel icon={Workflow} title="Automações" loading={loading}>
      <form onSubmit={submit} className="rounded-panel border border-line bg-cream p-4 dark:border-stone-700 dark:bg-night">
        <div className="grid gap-2 md:grid-cols-[180px_1fr]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da automação" className="h-10 rounded-panel border border-line bg-paper px-3 text-sm dark:border-stone-700 dark:bg-night-panel" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" className="h-10 rounded-panel border border-line bg-paper px-3 text-sm dark:border-stone-700 dark:bg-night-panel" />
          <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className="h-10 rounded-panel border border-line bg-paper px-3 text-sm dark:border-stone-700 dark:bg-night-panel">
            <option value="manual">Manual</option>
            <option value="daily">Todo dia</option>
            <option value="startup">Ao iniciar</option>
            <option value="whatsapp">Comando WhatsApp</option>
          </select>
          <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Ação" className="h-10 rounded-panel border border-line bg-paper px-3 text-sm dark:border-stone-700 dark:bg-night-panel" />
        </div>
        <button className="mt-3 flex h-10 items-center justify-center gap-2 rounded-panel bg-accent px-4 text-sm font-medium text-white"><Plus className="h-4 w-4" /> Criar automação</button>
      </form>
      <p className="mt-3 text-sm text-muted dark:text-stone-400">As automações manuais já rodam e ficam registradas. Gatilhos reais por horário/WhatsApp serão executados pelo agente desktop local.</p>
      <Rows>
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 rounded-panel bg-cream p-3 text-sm dark:bg-night">
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="mt-1 text-xs text-muted dark:text-stone-400">
                {row.active ? "ativa" : "inativa"} · {row.trigger} · última execução: {row.last_run_at || "nunca"}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={async () => { await runAutomation(token, row.id); await load(); }} title="Executar">
                <Play className="h-4 w-4 text-accent" />
              </button>
              <button onClick={async () => { await deleteAutomation(token, row.id); await load(); }} title="Excluir">
                <Trash2 className="h-4 w-4 text-red-600" />
              </button>
            </div>
          </div>
        ))}
      </Rows>
    </CrudPanel>
  );
}

function CrudPanel({ icon: Icon, title, loading, children }: { icon: typeof FolderKanban; title: string; loading: boolean; children: React.ReactNode }) {
  return (
    <section className="h-full rounded-panel border border-line bg-paper p-5 shadow-soft dark:border-stone-800 dark:bg-night-panel">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-accent" />
          <h1 className="text-2xl font-semibold">{title}</h1>
        </div>
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-accent" /> : null}
      </div>
      {children}
    </section>
  );
}

function Rows({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 space-y-2">{children}</div>;
}

function Row({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-panel bg-cream p-3 text-sm dark:bg-night">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted dark:text-stone-400">{detail}</p>
    </div>
  );
}
