"use client";

import { useRef, useState } from "react";
import { Eye, Loader2, MonitorUp, ScanLine, Square } from "lucide-react";

import { sendChat, type ChatAttachment } from "@/lib/api";

type ScreenViewProps = {
  token: string;
};

export function ScreenView({ token }: ScreenViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  async function startScreen() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      if (videoRef.current) videoRef.current.srcObject = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        setActive(false);
        window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { screen: false } }));
      });
      setActive(true);
      window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { screen: true } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui compartilhar a tela.");
    }
  }

  function stopScreen() {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { screen: false } }));
  }

  function capture() {
    const dataUrl = captureDataUrl();
    if (dataUrl) setSnapshot(dataUrl);
  }

  function captureDataUrl() {
    const video = videoRef.current;
    if (!video || !active || video.readyState < 2) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  }

  async function analyzeScreen() {
    const dataUrl = captureDataUrl();
    if (!dataUrl) {
      setAnalysis("Compartilhe a tela antes de pedir análise.");
      return;
    }
    setSnapshot(dataUrl);
    setAnalyzing(true);
    window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { screen: true } }));
    setAnalysis("");
    const attachment: ChatAttachment = {
      name: `tela-${new Date().toISOString()}.png`,
      type: "image/png",
      kind: "image",
      content: dataUrl
    };
    try {
      const result = await sendChat(
        token,
        "Analise esta captura da minha tela. Diga o que está aberto e aponte erros ou elementos importantes.",
        "balanced",
        null,
        [attachment]
      );
      setAnalysis(result.reply);
    } catch (err) {
      setAnalysis(err instanceof Error ? err.message : "Não consegui analisar a tela agora.");
    } finally {
      setAnalyzing(false);
      window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { screen: active } }));
    }
  }

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[1fr_340px]">
      <section className="rounded-panel border border-line bg-paper p-5 shadow-soft dark:border-stone-800 dark:bg-night-panel">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Tela</h1>
            <p className="mt-1 text-sm text-muted dark:text-stone-400">Compartilhamento e captura de tela pelo navegador.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={analyzeScreen} disabled={!active || analyzing} className="flex h-10 items-center gap-2 rounded-panel border border-line px-4 text-sm font-medium hover:border-accent hover:text-accent dark:border-stone-700">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Analisar com IA
            </button>
            <button onClick={capture} disabled={!active} className="flex h-10 items-center gap-2 rounded-panel border border-line px-4 text-sm font-medium hover:border-accent hover:text-accent dark:border-stone-700">
              <ScanLine className="h-4 w-4" />
              Capturar
            </button>
            <button onClick={active ? stopScreen : startScreen} className="flex h-10 items-center gap-2 rounded-panel bg-accent px-4 text-sm font-medium text-white">
              {active ? <Square className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
              {active ? "Parar" : "Compartilhar"}
            </button>
          </div>
        </div>
        <div className="grid min-h-[420px] place-items-center overflow-hidden rounded-panel border border-line bg-cream dark:border-stone-700 dark:bg-night">
          <video ref={videoRef} autoPlay playsInline muted className="h-full max-h-[620px] w-full object-contain" />
          {!active ? <p className="text-sm text-muted dark:text-stone-400">Clique em compartilhar e escolha a tela ou janela.</p> : null}
        </div>
        {error ? <p className="mt-3 rounded-panel bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p> : null}
      </section>
      <aside className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
        <h2 className="text-sm font-semibold">Última captura</h2>
        {snapshot ? <img src={snapshot} alt="Captura da tela" className="mt-4 w-full rounded-panel border border-line dark:border-stone-700" /> : <p className="mt-4 text-sm text-muted dark:text-stone-400">Nenhuma captura ainda.</p>}
        <div className="mt-4 rounded-panel border border-line bg-cream p-4 dark:border-stone-700 dark:bg-night">
          <h3 className="text-sm font-semibold">Análise do Jake</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted dark:text-stone-400">
            {analysis || "Compartilhe a tela e clique em Analisar com IA."}
          </p>
        </div>
      </aside>
    </div>
  );
}
