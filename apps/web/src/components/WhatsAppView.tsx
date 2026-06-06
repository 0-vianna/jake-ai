"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, Plus, QrCode, ShieldCheck, Smartphone, Trash2, WifiOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  addWhatsAppWhitelist,
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppStatus,
  removeWhatsAppWhitelist,
  type WhatsAppStatus
} from "@/lib/api";

type WhatsAppViewProps = {
  token: string;
};

const fallbackStatus: WhatsAppStatus = {
  status: "disconnected",
  qr_code: null,
  whitelist: [],
  bridge: {
    implemented: false,
    path: "services/whatsapp-bridge",
    next_step: "Instalar e rodar o bridge Baileys para QR real."
  }
};

export function WhatsAppView({ token }: WhatsAppViewProps) {
  const [status, setStatus] = useState<WhatsAppStatus>(fallbackStatus);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setStatus(await getWhatsAppStatus(token));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function handleConnect() {
    setLoading(true);
    setStatus(await connectWhatsApp(token));
    setLoading(false);
  }

  async function handleDisconnect() {
    setLoading(true);
    setStatus(await disconnectWhatsApp(token));
    setLoading(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!phone.trim()) return;
    setStatus(await addWhatsAppWhitelist(token, phone.trim()));
    setPhone("");
  }

  async function remove(phoneToRemove: string) {
    setStatus(await removeWhatsAppWhitelist(token, phoneToRemove));
  }

  const connected = status.status === "connected";
  const waiting = status.status === "waiting_bridge";

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[1fr_340px]">
      <section className="space-y-4">
        <div className="rounded-panel border border-line bg-paper p-5 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">WhatsApp remoto</h1>
              <p className="mt-1 text-sm text-muted dark:text-stone-400">
                Controle remoto com whitelist e bridge local preparado para Baileys/WPPConnect.
              </p>
            </div>
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-accent" /> : <Smartphone className="h-5 w-5 text-accent" />}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <StatusCard title="Status" value={status.status} icon={connected ? Smartphone : WifiOff} />
          <StatusCard title="Whitelist" value={`${status.whitelist.length} número(s)`} icon={ShieldCheck} />
          <StatusCard title="Bridge" value={status.bridge.implemented ? "ativo" : "aguardando"} icon={QrCode} />
        </div>

        <div className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Conexão</h2>
              <p className="mt-1 text-sm text-muted dark:text-stone-400">
                O backend já salva sessão e permissões. O QR real aparece quando o bridge local estiver rodando.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleConnect} className="h-10 rounded-panel bg-accent px-4 text-sm font-medium text-white">
                Conectar
              </button>
              <button onClick={handleDisconnect} className="h-10 rounded-panel border border-line px-4 text-sm font-medium text-muted hover:border-accent hover:text-accent dark:border-stone-700">
                Desconectar
              </button>
            </div>
          </div>
          <div className="mt-4 rounded-panel border border-dashed border-line bg-cream p-4 text-sm leading-6 text-muted dark:border-stone-700 dark:bg-night dark:text-stone-300">
            {waiting ? status.qr_code : "Clique em Conectar para preparar a sessão remota."}
          </div>
        </div>

        <form onSubmit={submit} className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <h2 className="text-sm font-semibold">Números autorizados</h2>
          <div className="mt-3 flex gap-2">
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+55 31 99999-9999"
              className="h-10 flex-1 rounded-panel border border-line bg-cream px-3 text-sm outline-none focus:border-accent dark:border-stone-700 dark:bg-night"
            />
            <button className="flex h-10 items-center gap-2 rounded-panel bg-accent px-4 text-sm font-medium text-white">
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {status.whitelist.map((item) => (
              <div key={item} className="flex items-center justify-between rounded-panel bg-cream px-3 py-2 text-sm dark:bg-night">
                <span>{item}</span>
                <button type="button" onClick={() => remove(item)} title="Remover número">
                  <Trash2 className="h-4 w-4 text-red-600" />
                </button>
              </div>
            ))}
            {!status.whitelist.length ? <p className="text-sm text-muted dark:text-stone-400">Nenhum número autorizado ainda.</p> : null}
          </div>
        </form>
      </section>

      <aside className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
        <h2 className="text-sm font-semibold">Bridge local</h2>
        <div className="mt-4 rounded-panel bg-cream p-4 text-sm leading-6 text-muted dark:bg-night dark:text-stone-300">
          <p className="font-medium text-ink dark:text-stone-100">{status.bridge.path}</p>
          <p className="mt-2">{status.bridge.next_step}</p>
        </div>
        <div className="mt-4 rounded-panel border border-line bg-cream p-4 text-sm leading-6 text-muted dark:border-stone-700 dark:bg-night dark:text-stone-300">
          Mensagens remotas devem passar por whitelist antes de acionar chat, tela ou comandos do PC.
        </div>
      </aside>
    </div>
  );
}

function StatusCard({ title, value, icon: Icon }: { title: string; value: string; icon: LucideIcon }) {
  return (
    <div className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted dark:text-stone-400">{title}</p>
        <Icon className="h-4 w-4 text-accent" />
      </div>
      <p className="mt-3 text-xl font-semibold">{value}</p>
    </div>
  );
}
