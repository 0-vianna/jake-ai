"use client";

import { FormEvent, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";

import { sendChat } from "@/lib/api";

type WorkspaceChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function ChatPanel({
  token,
  messages,
  conversationId,
  onChange
}: {
  token: string;
  messages: WorkspaceChatMessage[];
  conversationId: number | null;
  onChange: (patch: { messages?: WorkspaceChatMessage[]; conversationId?: number | null; title?: string }) => void;
}) {
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || loading) return;
    const nextUserMessage: WorkspaceChatMessage = { id: `w-user-${Date.now()}`, role: "user", content: draft.trim() };
    const optimistic = [...messages, nextUserMessage];
    onChange({ messages: optimistic });
    setDraft("");
    setLoading(true);
    try {
      const result = await sendChat(token, nextUserMessage.content, "balanced", conversationId);
      onChange({
        conversationId: result.conversation_id,
        messages: [...optimistic, { id: `w-assistant-${Date.now()}`, role: "assistant", content: result.reply }],
        title: result.reply.slice(0, 48) ? "Chat com Jake" : undefined
      });
    } catch (err) {
      onChange({
        messages: [
          ...optimistic,
          {
            id: `w-error-${Date.now()}`,
            role: "assistant",
            content: err instanceof Error ? err.message : "Nao consegui responder agora."
          }
        ]
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-accent">
        <Sparkles className="h-3.5 w-3.5" />
        Conversa rapida dentro do workspace
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-y-auto rounded-panel border border-line bg-cream p-3 dark:border-stone-700 dark:bg-night">
        {messages.length ? (
          messages.map((item) => (
            <div
              key={item.id}
              className={`max-w-[92%] rounded-panel px-3 py-2 text-sm leading-6 ${
                item.role === "user"
                  ? "ml-auto bg-accent text-white"
                  : "bg-paper text-ink dark:bg-night-panel dark:text-stone-100"
              }`}
            >
              {item.content}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted dark:text-stone-400">Abra ideias, organize paineis e converse com o Jake sem sair do workspace.</p>
        )}
      </div>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Fale com o Jake aqui..."
          className="h-10 min-w-0 flex-1 rounded-panel border border-line bg-paper px-3 text-sm outline-none focus:border-accent dark:border-stone-700 dark:bg-night-panel"
        />
        <button className="flex h-10 w-10 items-center justify-center rounded-panel bg-accent text-white">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
