import type {
  AuthState,
  ChatMessage,
  Conversation,
  FinanceCategory,
  FinanceSummary,
  FinanceTransaction,
  User
} from "./types";

function getApiUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${window.location.hostname}:8000/api`;
  }
  return "http://127.0.0.1:8000/api";
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? "Erro ao falar com a Jake API");
  }
  return response.json() as Promise<T>;
}

export async function requestNoContent(path: string, options: RequestInit = {}, token?: string): Promise<void> {
  const response = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? "Erro ao falar com a Jake API");
  }
}

export async function login(username: string, password: string): Promise<AuthState> {
  const result = await request<{ access_token: string; user: AuthState["user"] }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  return { token: result.access_token, user: result.user };
}

export async function register(payload: {
  name: string;
  username: string;
  email: string;
  password: string;
}): Promise<{
  ok: boolean;
  message: string;
  email_verification_required: boolean;
  delivery: string;
  verify_url?: string | null;
}> {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function verifyEmail(token: string): Promise<{
  ok: boolean;
  message: string;
  email_verification_required: boolean;
  delivery: string;
}> {
  return request(`/auth/verify-email?token=${encodeURIComponent(token)}`);
}

export async function getMe(token: string): Promise<User> {
  return request<User>("/auth/me", {}, token);
}

export async function sendChat(
  token: string,
  message: string,
  mode: string,
  conversationId: number | null,
  attachments: ChatAttachment[] = []
): Promise<{
  conversation_id: number;
  reply: string;
  model: string;
  provider: string;
  usage: { total_tokens: number; input_tokens: number; output_tokens: number };
  memories_used: string[];
}> {
  return request(
    "/chat",
    {
      method: "POST",
      body: JSON.stringify({ message, mode, conversation_id: conversationId, attachments })
    },
    token
  );
}

export type ChatAttachment = {
  name: string;
  type: string;
  kind: "image" | "text" | "file";
  content: string;
};

export async function listConversations(token: string): Promise<Conversation[]> {
  return request<Conversation[]>("/chat/conversations", {}, token);
}

export async function listMessages(token: string, conversationId: number): Promise<ChatMessage[]> {
  const rows = await request<Array<{ id: number; role: "user" | "assistant"; content: string }>>(
    `/chat/conversations/${conversationId}/messages`,
    {},
    token
  );
  return rows.map((row) => ({ id: String(row.id), role: row.role, content: row.content }));
}

export async function deleteConversation(token: string, conversationId: number): Promise<void> {
  return requestNoContent(`/chat/conversations/${conversationId}`, { method: "DELETE" }, token);
}

export async function financeSummary(token: string): Promise<FinanceSummary> {
  return request<FinanceSummary>("/finance/summary", {}, token);
}

export async function financeTransactions(token: string): Promise<FinanceTransaction[]> {
  return request<FinanceTransaction[]>("/finance/transactions", {}, token);
}

export async function financeCategories(token: string): Promise<FinanceCategory[]> {
  return request<FinanceCategory[]>("/finance/categories", {}, token);
}

export async function quickFinanceEntry(token: string, text: string): Promise<FinanceTransaction> {
  return request<FinanceTransaction>(
    "/finance/quick-entry",
    { method: "POST", body: JSON.stringify({ text }) },
    token
  );
}

export async function createFinanceTransaction(
  token: string,
  payload: {
    type: "income" | "expense";
    amount: number;
    description: string;
    category_id: number | null;
  }
): Promise<FinanceTransaction> {
  return request<FinanceTransaction>(
    "/finance/transactions",
    { method: "POST", body: JSON.stringify(payload) },
    token
  );
}

export async function resetFinance(token: string): Promise<{ ok: boolean; deleted: number }> {
  return request("/finance/reset", { method: "DELETE" }, token);
}

export async function getSettings(token: string): Promise<{
  user: Record<string, string>;
  runtime: Record<string, string | boolean | number | object>;
}> {
  return request("/settings", {}, token);
}

export async function saveSetting(token: string, key: string, value: string): Promise<{ key: string; value: string }> {
  return request("/settings", { method: "PUT", body: JSON.stringify({ key, value }) }, token);
}

export async function getModuleStatus(token: string, module: "screen" | "camera" | "whatsapp"): Promise<Record<string, unknown>> {
  return request(`/modules/${module}/status`, {}, token);
}

export type NativeHandControlStatus = {
  running: boolean;
  camera_index: number;
  gesture: string;
  action: string;
  confidence: number;
  fps: number;
  error: string | null;
  history: Array<{ gesture: string; action: string; at: string }>;
  gesture_map: Record<string, string>;
};

export async function getNativeHandControlStatus(token: string): Promise<NativeHandControlStatus> {
  return request("/hand-control/status", {}, token);
}

export async function startNativeHandControl(token: string, cameraIndex = 0): Promise<NativeHandControlStatus> {
  return request("/hand-control/start", { method: "POST", body: JSON.stringify({ camera_index: cameraIndex }) }, token);
}

export async function stopNativeHandControl(token: string): Promise<NativeHandControlStatus> {
  return request("/hand-control/stop", { method: "POST" }, token);
}

export async function listProjects(token: string): Promise<Array<{ id: number; name: string; description: string; status: string; notes: string }>> {
  return request("/projects", {}, token);
}

export async function createProject(token: string, payload: { name: string; description: string }): Promise<{ id: number; name: string; description: string; status: string; notes: string }> {
  return request("/projects", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function listMemories(token: string): Promise<Array<{ id: number; content: string; tags: string; summary: string | null; created_at: string }>> {
  return request("/memory", {}, token);
}

export async function createMemory(token: string, payload: { content: string; tags: string }): Promise<{ id: number; content: string; tags: string }> {
  return request("/memory", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function deleteMemory(token: string, id: number): Promise<void> {
  return requestNoContent(`/memory/${id}`, { method: "DELETE" }, token);
}

export async function listUsers(token: string): Promise<User[]> {
  return request("/users", {}, token);
}

export async function createUser(
  token: string,
  payload: { name: string; username: string; email: string; password: string; role: string }
): Promise<User> {
  return request("/users", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function listAuditLogs(token: string): Promise<Array<{ id: number; action: string; details: string; level: string; created_at: string }>> {
  return request("/logs/audit", {}, token);
}

export async function listAutomations(token: string): Promise<Array<{ id: number; name: string; description: string; trigger: string; actions_json: string; active: boolean; last_run_at: string | null }>> {
  return request("/modules/automations", {}, token);
}

export async function createAutomation(token: string, payload: { name: string; description: string; trigger: string; actions_json: string; active: boolean }): Promise<{ id: number; name: string; active: boolean }> {
  return request("/modules/automations", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function runAutomation(token: string, id: number): Promise<{ ok: boolean; id: number; last_run_at: string }> {
  return request(`/modules/automations/${id}/run`, { method: "POST" }, token);
}

export async function deleteAutomation(token: string, id: number): Promise<void> {
  return requestNoContent(`/modules/automations/${id}`, { method: "DELETE" }, token);
}

export type WhatsAppStatus = {
  status: string;
  qr_code: string | null;
  whitelist: string[];
  bridge: {
    implemented: boolean;
    path: string;
    next_step: string;
  };
};

export async function getWhatsAppStatus(token: string): Promise<WhatsAppStatus> {
  return request("/whatsapp/status", {}, token);
}

export async function connectWhatsApp(token: string): Promise<WhatsAppStatus> {
  return request("/whatsapp/connect", { method: "POST" }, token);
}

export async function disconnectWhatsApp(token: string): Promise<WhatsAppStatus> {
  return request("/whatsapp/disconnect", { method: "POST" }, token);
}

export async function addWhatsAppWhitelist(token: string, phone: string): Promise<WhatsAppStatus> {
  return request("/whatsapp/whitelist", { method: "POST", body: JSON.stringify({ phone }) }, token);
}

export async function removeWhatsAppWhitelist(token: string, phone: string): Promise<WhatsAppStatus> {
  return requestNoContent(`/whatsapp/whitelist/${encodeURIComponent(phone)}`, { method: "DELETE" }, token).then(() =>
    getWhatsAppStatus(token)
  );
}

export async function webSearch(token: string, query: string): Promise<{ query: string; results: Array<{ title: string; url: string; snippet: string }> }> {
  return request(`/tools/web-search?q=${encodeURIComponent(query)}`, {}, token);
}

export type CodeTreeItem = {
  name: string;
  path: string;
  type: "directory" | "file";
  size: number | null;
};

export async function getCodeTree(token: string, path = ""): Promise<{ root: string; path: string; items: CodeTreeItem[] }> {
  return request(`/code-workspace/tree?path=${encodeURIComponent(path)}`, {}, token);
}

export async function readCodeFile(token: string, path: string): Promise<{ path: string; content: string }> {
  return request(`/code-workspace/file?path=${encodeURIComponent(path)}`, {}, token);
}

export async function searchCodeWorkspace(token: string, query: string): Promise<{ query: string; items: Array<{ name: string; path: string; snippet: string }> }> {
  return request(`/code-workspace/search?q=${encodeURIComponent(query)}`, {}, token);
}

export type PersonalFileRoot = {
  id: string;
  label: string;
  path: string;
};

export type PersonalFileItem = {
  name: string;
  path: string;
  type: "directory" | "file";
  size: number | null;
  modified_at: number;
  mime: string | null;
};

export type PersonalFileContent = {
  name: string;
  path: string;
  kind: "text" | "image" | "metadata";
  size: number;
  modified_at: number;
  mime: string | null;
  content?: string;
  preview?: string;
  summary?: string;
};

export async function listPersonalFileRoots(token: string): Promise<{ home: string; roots: PersonalFileRoot[] }> {
  return request("/files/roots", {}, token);
}

export async function listPersonalFiles(
  token: string,
  options: { rootId?: string; path?: string; limit?: number }
): Promise<{ path: string; parent: string | null; items: PersonalFileItem[] }> {
  const params = new URLSearchParams();
  if (options.rootId) params.set("root_id", options.rootId);
  if (options.path) params.set("path", options.path);
  if (options.limit) params.set("limit", String(options.limit));
  return request(`/files/tree?${params.toString()}`, {}, token);
}

export async function readPersonalFile(token: string, path: string): Promise<PersonalFileContent> {
  return request(`/files/read?path=${encodeURIComponent(path)}`, {}, token);
}

export async function analyzePersonalFile(token: string, path: string): Promise<PersonalFileContent> {
  return request(`/files/analyze?path=${encodeURIComponent(path)}`, {}, token);
}

export async function searchPersonalFiles(
  token: string,
  rootId: string,
  query: string
): Promise<{ query: string; root: string; visited?: number; limited?: boolean; items: Array<{ name: string; path: string; size: number; modified_at: number; mime: string | null; snippet: string }> }> {
  return request(`/files/search?root_id=${encodeURIComponent(rootId)}&q=${encodeURIComponent(query)}`, {}, token);
}

export type WorkspaceLayoutRecord = {
  id: number;
  name: string;
  description: string;
  state_json: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export async function listWorkspaceLayouts(token: string): Promise<WorkspaceLayoutRecord[]> {
  return request("/workspace/layouts", {}, token);
}

export async function getDefaultWorkspaceLayout(token: string): Promise<WorkspaceLayoutRecord | null> {
  return request("/workspace/layouts/default", {}, token);
}

export async function createWorkspaceLayout(
  token: string,
  payload: { name: string; description?: string; state_json: string; is_default?: boolean }
): Promise<WorkspaceLayoutRecord> {
  return request("/workspace/layouts", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function updateWorkspaceLayout(
  token: string,
  id: number,
  payload: { name: string; description?: string; state_json: string; is_default?: boolean }
): Promise<WorkspaceLayoutRecord> {
  return request(`/workspace/layouts/${id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
}

export async function deleteWorkspaceLayout(token: string, id: number): Promise<void> {
  return requestNoContent(`/workspace/layouts/${id}`, { method: "DELETE" }, token);
}

export async function recordWorkspaceAction(
  token: string,
  payload: { action_type: string; payload_json?: string; source?: string }
): Promise<{ ok: boolean; id: number }> {
  return request("/workspace/actions", { method: "POST", body: JSON.stringify(payload) }, token);
}
