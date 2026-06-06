"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Copy, FileText, Loader2, Mic, MicOff, MonitorUp, Paperclip, Send, Sparkles, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { motion } from "framer-motion";

import { deleteConversation, listConversations, listMessages, sendChat, type ChatAttachment } from "@/lib/api";
import { createPtBrUtterance, ensureMicrophonePermission, getSpeechRecognitionCtor, type BrowserSpeechRecognition, type SpeechRecognitionEventLike } from "@/lib/speech";
import type { ChatMessage, Conversation } from "@/lib/types";

type ChatViewProps = {
  token: string;
  initialMessage?: string;
  initialMode?: string;
  onModeChange?: (mode: string) => void;
};

const modes = [
  { id: "economic", label: "Economico" },
  { id: "balanced", label: "Equilibrado" },
  { id: "maximum", label: "Maximo" }
];

export function ChatView({ token, initialMessage, initialMode = "balanced", onModeChange }: ChatViewProps) {
  const [mode, setMode] = useState(initialMode);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState("Pronto para conversar.");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const speakNextReplyRef = useRef(false);

  useEffect(() => {
    listConversations(token).then(setConversations).catch(() => setConversations([]));
  }, [token]);

  useEffect(() => {
    if (initialMessage) setMessage(initialMessage);
  }, [initialMessage]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const empty = useMemo(() => messages.length === 0, [messages.length]);

  async function openConversation(id: number) {
    setConversationId(id);
    const rows = await listMessages(token, id);
    setMessages(rows);
  }

  async function removeConversation(id: number) {
    const confirmed = window.confirm("Excluir esta conversa? Essa acao remove o historico local dela.");
    if (!confirmed) return;
    await deleteConversation(token, id);
    setConversations((current) => current.filter((conversation) => conversation.id !== id));
    if (conversationId === id) {
      setConversationId(null);
      setMessages([]);
      setMeta("Conversa excluida.");
    }
  }

  async function readFiles(files: FileList | null) {
    if (!files?.length) return;
    const next: ChatAttachment[] = [];
    for (const file of Array.from(files).slice(0, 6)) {
      if (file.size > 7 * 1024 * 1024) {
        next.push({
          name: file.name,
          type: file.type || "application/octet-stream",
          kind: "file",
          content: "Arquivo maior que 7 MB; envie um arquivo menor para leitura direta."
        });
        continue;
      }
      if (file.type.startsWith("image/")) {
        next.push({
          name: file.name,
          type: file.type,
          kind: "image",
          content: await readAsDataUrl(file)
        });
        continue;
      }
      if (isReadableTextFile(file)) {
        next.push({
          name: file.name,
          type: file.type || "text/plain",
          kind: "text",
          content: (await file.text()).slice(0, 60000)
        });
        continue;
      }
      next.push({
        name: file.name,
        type: file.type || "application/octet-stream",
        kind: "file",
        content: "Arquivo anexado, mas ainda sem extrator local para este formato."
      });
    }
    setAttachments((current) => [...current, ...next]);
  }

  async function captureScreenAttachment(): Promise<ChatAttachment | null> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      stream.getTracks().forEach((track) => track.stop());
      return {
        name: `captura-tela-${new Date().toISOString()}.png`,
        type: "image/png",
        kind: "image",
        content: canvas.toDataURL("image/png")
      };
    } catch {
      setMeta("Permissao de tela cancelada ou indisponivel.");
      return null;
    }
  }

  function stopVoiceListening(reason = "Microfone pausado.") {
    recognitionRef.current?.abort?.();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { voice: false } }));
    setMeta(reason);
  }

  async function speakReply(text: string) {
    if (!voiceReplyEnabled || typeof window.speechSynthesis === "undefined") return;
    window.speechSynthesis.cancel();
    const utterance = await createPtBrUtterance(text);
    utterance.onstart = () => {
      setSpeaking(true);
      window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { voice: true } }));
    };
    utterance.onend = () => {
      setSpeaking(false);
      window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { voice: false } }));
    };
    utterance.onerror = () => {
      setSpeaking(false);
      window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { voice: false } }));
    };
    window.speechSynthesis.speak(utterance);
  }

  async function toggleVoice() {
    if (listening) {
      stopVoiceListening();
      return;
    }

    const SpeechRecognition = getSpeechRecognitionCtor();
    if (!SpeechRecognition) {
      setMeta("Seu navegador nao liberou reconhecimento de voz. Use Chrome ou Edge.");
      return;
    }

    try {
      await ensureMicrophonePermission();
    } catch (err) {
      setMeta(err instanceof Error ? err.message : "Nao consegui liberar o microfone.");
      return;
    }

    let finalText = "";
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
        if (event.results[index].isFinal) finalText += `${event.results[index][0].transcript} `;
      }
      setMessage(transcript || finalText);
    };
    recognition.onerror = (event) => {
      stopVoiceListening(event.error ? `Erro no microfone: ${event.error}` : "Nao consegui ouvir agora.");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { voice: false } }));
      const spoken = finalText.trim();
      if (spoken) {
        setMessage(spoken);
        speakNextReplyRef.current = true;
        void submitPrompt(spoken, attachments);
      }
    };

    recognitionRef.current = recognition;
    setListening(true);
    setMeta("Ouvindo... fale com o Jake.");
    window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { voice: true } }));
    try {
      recognition.start();
    } catch {
      stopVoiceListening("Nao consegui iniciar o microfone. Verifique a permissao do navegador.");
    }
  }

  async function submitPrompt(messageOverride?: string, attachmentsOverride?: ChatAttachment[]) {
    const trimmed = (messageOverride ?? message).trim();
    const currentAttachments = attachmentsOverride ?? attachments;
    if ((!trimmed && currentAttachments.length === 0) || loading) return;

    setMessage("");
    let outgoingAttachments = currentAttachments;
    setAttachments([]);
    if (shouldAttachScreen(trimmed) && outgoingAttachments.length === 0) {
      setMeta("Escolha a tela para o Jake analisar...");
      const screen = await captureScreenAttachment();
      outgoingAttachments = screen ? [screen] : [];
    }

    const displayText = trimmed || "Analise os anexos.";
    const userMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: displayText + (outgoingAttachments.length ? `\n\n[${outgoingAttachments.length} anexo(s)]` : "")
    };
    setMessages((current) => [...current, userMessage]);
    setLoading(true);
    setMeta("Jake esta pensando...");
    window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { thinking: true } }));
    try {
      const result = await sendChat(token, displayText, mode, conversationId, outgoingAttachments);
      setConversationId(result.conversation_id);
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", content: result.reply }]);
      setMeta(`${result.provider} · ${result.model} · ${result.usage.total_tokens} tokens`);
      if (voiceReplyEnabled || speakNextReplyRef.current) speakReply(result.reply);
      speakNextReplyRef.current = false;
      const updated = await listConversations(token);
      setConversations(updated);
    } catch (err) {
      const reply = err instanceof Error ? err.message : "Nao consegui responder agora.";
      setMessages((current) => [...current, { id: `error-${Date.now()}`, role: "assistant", content: reply }]);
      setMeta("Erro ao conversar com a API.");
      if (voiceReplyEnabled || speakNextReplyRef.current) speakReply(reply);
      speakNextReplyRef.current = false;
    } finally {
      setLoading(false);
      window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { thinking: false } }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitPrompt();
  }

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[280px_1fr]">
      <aside className="hidden rounded-panel border border-line bg-paper p-3 shadow-soft dark:border-stone-800 dark:bg-night-panel xl:block">
        <button
          onClick={() => {
            setConversationId(null);
            setMessages([]);
          }}
          className="mb-3 flex h-10 w-full items-center justify-center gap-2 rounded-panel bg-accent text-sm font-medium text-white"
        >
          <Sparkles className="h-4 w-4" />
          Nova conversa
        </button>
        <div className="space-y-1">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => openConversation(conversation.id)}
              className="group flex w-full items-start gap-2 rounded-panel px-3 py-2 text-left text-sm text-muted transition hover:bg-cream hover:text-ink dark:text-stone-300 dark:hover:bg-night dark:hover:text-stone-100"
            >
              <span className="line-clamp-2 flex-1">{conversation.title}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  void removeConversation(conversation.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    void removeConversation(conversation.id);
                  }
                }}
                className="mt-0.5 hidden h-7 w-7 shrink-0 items-center justify-center rounded text-muted hover:bg-red-50 hover:text-red-600 group-hover:flex dark:hover:bg-red-950"
                title="Excluir conversa"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col rounded-panel border border-line bg-paper shadow-soft dark:border-stone-800 dark:bg-night-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4 dark:border-stone-800">
          <div>
            <h1 className="text-lg font-semibold">Chat com o Jake</h1>
            <p className="text-sm text-muted dark:text-stone-400">{meta}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setVoiceReplyEnabled((current) => {
                  const next = !current;
                  if (!next) {
                    window.speechSynthesis?.cancel();
                    setSpeaking(false);
                  }
                  return next;
                });
              }}
              className={`flex h-9 items-center gap-2 rounded-panel border px-3 text-sm ${
                voiceReplyEnabled ? "border-accent bg-accent-soft text-accent" : "border-line text-muted dark:border-stone-700 dark:text-stone-300"
              }`}
              title="Fala do Jake"
            >
              {voiceReplyEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              Voz
            </button>
            <div className="flex rounded-panel border border-line bg-cream p-1 dark:border-stone-700 dark:bg-night">
              {modes.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setMode(item.id);
                    onModeChange?.(item.id);
                  }}
                  className={`rounded px-3 py-1.5 text-sm transition ${
                    mode === item.id ? "bg-accent text-white" : "text-muted hover:text-ink dark:text-stone-300 dark:hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
          {empty ? (
            <div className="grid h-full place-items-center text-center">
              <div className="max-w-lg">
                <Sparkles className="mx-auto mb-4 h-8 w-8 text-accent" />
                <h2 className="text-2xl font-semibold">Peca qualquer coisa pratica</h2>
                <p className="mt-3 text-sm leading-6 text-muted dark:text-stone-400">
                  Experimente "Jake, gastei 25 reais com lanche", "pesquise o proximo jogo do Galo" ou "o que voce ve na minha tela?".
                </p>
              </div>
            </div>
          ) : null}
          {messages.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[86%] rounded-panel border px-4 py-3 text-sm leading-6 ${
                  item.role === "user"
                    ? "border-accent/20 bg-accent text-white"
                    : "border-line bg-cream text-ink dark:border-stone-700 dark:bg-night dark:text-stone-100"
                }`}
              >
                <p className="whitespace-pre-wrap">{item.content}</p>
                {item.role === "assistant" ? (
                  <button
                    onClick={() => navigator.clipboard.writeText(item.content)}
                    className="mt-3 flex items-center gap-1 text-xs text-muted hover:text-accent dark:text-stone-400"
                  >
                    <Copy className="h-3 w-3" />
                    Copiar
                  </button>
                ) : null}
              </div>
            </motion.div>
          ))}
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted dark:text-stone-400">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              Jake esta organizando a resposta
            </div>
          ) : null}
          {speaking ? <div className="text-xs text-accent">Jake esta falando...</div> : null}
          <div ref={endRef} />
        </div>

        <form onSubmit={handleSubmit} className="border-t border-line p-4 dark:border-stone-800">
          {attachments.length ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {attachments.map((attachment, index) => (
                <span key={`${attachment.name}-${index}`} className="flex items-center gap-2 rounded-panel border border-line bg-cream px-3 py-2 text-xs dark:border-stone-700 dark:bg-night">
                  <FileText className="h-3.5 w-3.5 text-accent" />
                  <span className="max-w-52 truncate">{attachment.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    className="text-muted hover:text-red-600"
                    title="Remover anexo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex min-h-14 items-end gap-2 rounded-panel border border-line bg-cream p-2 dark:border-stone-700 dark:bg-night">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => void readFiles(event.target.files)} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-10 w-10 items-center justify-center rounded-panel text-muted hover:text-accent" title="Anexar arquivo">
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Digite para o Jake..."
              rows={1}
              className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none"
            />
            <button
              type="button"
              onClick={toggleVoice}
              className={`flex h-10 w-10 items-center justify-center rounded-panel hover:text-accent ${
                listening ? "bg-accent text-white hover:text-white" : "text-muted"
              }`}
              title={listening ? "Parar microfone" : "Falar"}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={async () => {
                const screen = await captureScreenAttachment();
                if (screen) setAttachments((current) => [...current, screen]);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-panel text-muted hover:text-accent"
              title="Capturar tela para a IA"
            >
              <MonitorUp className="h-4 w-4" />
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-panel bg-accent text-white" title="Enviar">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function isReadableTextFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return (
    file.type.startsWith("text/") ||
    [".txt", ".md", ".json", ".csv", ".ts", ".tsx", ".js", ".jsx", ".py", ".html", ".css", ".log"].some((suffix) =>
      lower.endsWith(suffix)
    )
  );
}

function shouldAttachScreen(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("minha tela") || normalized.includes("ve na tela") || normalized.includes("veja a tela") || normalized.includes("print");
}
