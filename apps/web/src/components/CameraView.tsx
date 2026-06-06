"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  Camera,
  Eye,
  Hand,
  Loader2,
  Mic,
  MicOff,
  MousePointer2,
  PanelRightClose,
  PanelRightOpen,
  Save,
  SlidersHorizontal,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  Wand2
} from "lucide-react";

import {
  getNativeHandControlStatus,
  sendChat,
  startNativeHandControl,
  stopNativeHandControl,
  type ChatAttachment,
  type NativeHandControlStatus
} from "@/lib/api";
import { createPtBrUtterance, ensureMicrophonePermission, getSpeechRecognitionCtor, type BrowserSpeechRecognition, type SpeechRecognitionEventLike } from "@/lib/speech";

type CameraViewProps = {
  token: string;
};

type Landmark = {
  x: number;
  y: number;
  z?: number;
};

type HandLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, timestamp: number) => {
    landmarks: Landmark[][];
    handedness?: Array<Array<{ score?: number }>>;
  };
};

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

const CONTROL_GESTURES = [
  { label: "Pinca", action: "Clique direito" },
  { label: "Dedo indicador levantado", action: "Clique esquerdo" },
  { label: "Movimento da mao", action: "Controle do mouse" },
  { label: "Arrastar mao para cima/baixo", action: "Scroll do mouse" },
  { label: "Dois dedos", action: "Alt + Tab" },
  { label: "Punho fechado", action: "Windows + D" },
  { label: "Joinha pra cima", action: "Despausar musica" },
  { label: "Joinha pra baixo", action: "Pausar musica" }
];

const GESTURE_PREF_KEY = "jake-gesture-settings-v2";
let directionalPrevious: { x: number; y: number; at: number } | null = null;

export function CameraView({ token }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const handLandmarkerRef = useRef<HandLandmarkerLike | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(performance.now());
  const lastActionAtRef = useRef(0);
  const lastGestureRef = useRef("");
  const analyzingRef = useRef(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const visualActiveRef = useRef(false);
  const visualConversationIdRef = useRef<number | null>(null);

  const [active, setActive] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [trackingMode, setTrackingMode] = useState<"idle" | "mediapipe" | "fallback">("idle");
  const [gesture, setGesture] = useState("Aguardando mao");
  const [fps, setFps] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [sensitivity, setSensitivity] = useState(35);
  const [gestureHistory, setGestureHistory] = useState<Array<{ gesture: string; action: string; at: string }>>([]);
  const [error, setError] = useState("");
  const [trackingError, setTrackingError] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saved, setSaved] = useState("");
  const [panelMinimized, setPanelMinimized] = useState(false);
  const [nativeStatus, setNativeStatus] = useState<NativeHandControlStatus | null>(null);
  const [nativeLoading, setNativeLoading] = useState(false);
  const [visualActive, setVisualActive] = useState(false);
  const [visualListening, setVisualListening] = useState(false);
  const [visualSpeaking, setVisualSpeaking] = useState(false);
  const [visualTranscript, setVisualTranscript] = useState("");
  const [visualReply, setVisualReply] = useState("");
  const [speechError, setSpeechError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(GESTURE_PREF_KEY);
      if (!raw) return;
      const prefs = JSON.parse(raw) as Partial<{ overlayEnabled: boolean; sensitivity: number; panelMinimized: boolean }>;
      if (typeof prefs.overlayEnabled === "boolean") setOverlayEnabled(prefs.overlayEnabled);
      if (typeof prefs.sensitivity === "number") setSensitivity(prefs.sensitivity);
      if (typeof prefs.panelMinimized === "boolean") setPanelMinimized(prefs.panelMinimized);
    } catch {
      localStorage.removeItem(GESTURE_PREF_KEY);
    }
  }, []);

  useEffect(() => {
    visualActiveRef.current = visualActive;
  }, [visualActive]);

  useEffect(() => {
    let mounted = true;
    async function loadNativeStatus() {
      try {
        const status = await getNativeHandControlStatus(token);
        if (mounted) setNativeStatus(status);
      } catch {
        if (mounted) setNativeStatus(null);
      }
    }
    void loadNativeStatus();
    const timer = window.setInterval(loadNativeStatus, 1500);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [token]);

  useEffect(() => {
    return () => {
      stopVisualConversation();
      stopCamera();
    };
  }, []);

  async function startCamera(): Promise<boolean> {
    setError("");
    setTrackingError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: "user" }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setActive(true);
      window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { camera: true } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao consegui abrir a camera. Verifique a permissao do navegador.");
      return false;
    }

    try {
      await loadHandTracker();
      startTrackingLoop();
    } catch (err) {
      setTracking(true);
      setTrackingMode("fallback");
      setTrackingError(
        err instanceof Error
          ? `MediaPipe nao carregou (${err.message}). Usando rastreamento visual aproximado.`
          : "MediaPipe nao carregou. Usando rastreamento visual aproximado."
      );
      startTrackingLoop();
    }
    return true;
  }

  async function loadHandTracker() {
    if (handLandmarkerRef.current) return;
    setTracking(true);
    setTrackingMode("mediapipe");
    const vision = await import("@mediapipe/tasks-vision");
    const fileset = await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm");
    const options = {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
      },
      runningMode: "VIDEO" as const,
      numHands: 2,
      minHandDetectionConfidence: 0.35,
      minHandPresenceConfidence: 0.35,
      minTrackingConfidence: 0.35
    };
    try {
      handLandmarkerRef.current = await vision.HandLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: "GPU" }
      });
    } catch {
      handLandmarkerRef.current = await vision.HandLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: "CPU" }
      });
    }
  }

  function startTrackingLoop() {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      const now = performance.now();
      const delta = Math.max(1, now - lastFrameTimeRef.current);
      lastFrameTimeRef.current = now;
      setFps(Math.round(1000 / delta));

      let detected = false;
      let nextGesture = "Aguardando mao";
      let nextConfidence = 0;

      if (handLandmarkerRef.current) {
        try {
          const result = handLandmarkerRef.current.detectForVideo(video, now);
          for (const [index, hand] of result.landmarks.entries()) {
            if (overlayEnabled) drawHand(ctx, hand, width, height);
            nextGesture = detectDirectionalGesture(hand, detectGesture(hand), now, sensitivity);
            nextConfidence = Math.max(nextConfidence, Math.round((result.handedness?.[index]?.[0]?.score ?? 0.86) * 100));
            detected = true;
          }
        } catch {
          setTrackingMode("fallback");
        }
      }

      if (!detected) {
        const fallbackHand = estimateFallbackHand(video, sampleCanvasRef, width, height);
        if (fallbackHand) {
          if (overlayEnabled) drawHand(ctx, fallbackHand, width, height);
          nextGesture = "Movimento da mao";
          nextConfidence = Math.max(42, sensitivity);
        }
      }

      setGesture(nextGesture);
      setConfidence(nextConfidence);
      runPreviewGestureAction(nextGesture);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }

  function stopCamera() {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setActive(false);
    setTracking(false);
    setTrackingMode("idle");
    setGesture("Aguardando mao");
    setConfidence(0);
    setFps(0);
    setTrackingError("");
    if (!nativeStatus?.running) {
      window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { camera: false } }));
    }
  }

  async function startNativeControl() {
    setNativeLoading(true);
    try {
      const status = await startNativeHandControl(token, 0);
      setNativeStatus(status);
      window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { camera: true } }));
      window.dispatchEvent(new CustomEvent("jake:notify", { detail: { title: "Controle nativo", body: "Gestos controlando mouse e teclado do Windows." } }));
      setSpeechError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao consegui ativar o controle nativo.";
      setSpeechError(message);
    } finally {
      setNativeLoading(false);
    }
  }

  async function stopNativeControl() {
    setNativeLoading(true);
    try {
      const status = await stopNativeHandControl(token);
      setNativeStatus(status);
      if (!active) window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { camera: false } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao consegui parar o controle nativo.";
      setSpeechError(message);
    } finally {
      setNativeLoading(false);
    }
  }

  async function analyzeCamera(customPrompt?: string) {
    if (analyzingRef.current) return;
    const attachment = captureCameraFrame();
    if (!attachment) {
      setAnalysis("Abra a camera antes de pedir para o Jake ver.");
      return;
    }
    analyzingRef.current = true;
    setAnalyzing(true);
    window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { screen: true, thinking: true } }));
    setAnalysis("");
    try {
      const result = await sendChat(
        token,
        customPrompt || "Analise a imagem atual da minha camera. Diga objetivamente o que voce ve e se ha uma mao/gesto visivel.",
        "balanced",
        visualConversationIdRef.current,
        [attachment]
      );
      visualConversationIdRef.current = result.conversation_id;
      setAnalysis(result.reply);
      setVisualReply(result.reply);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao consegui analisar a camera agora.";
      setAnalysis(message);
      setVisualReply(message);
    } finally {
      analyzingRef.current = false;
      setAnalyzing(false);
      window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { screen: false, thinking: false } }));
    }
  }

  async function startVisualConversation() {
    setSpeechError("");
    if (!active) {
      const opened = await startCamera();
      if (!opened) return;
    }
    setVisualActive(true);
    visualActiveRef.current = true;
    window.setTimeout(() => startVoiceTurn(), 250);
  }

  function stopVisualConversation() {
    visualActiveRef.current = false;
    setVisualActive(false);
    setVisualListening(false);
    setVisualSpeaking(false);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    window.speechSynthesis?.cancel();
    window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { voice: false, thinking: false } }));
  }

  async function startVoiceTurn() {
    if (!visualActiveRef.current || visualListening || visualSpeaking) return;
    const SpeechRecognition = getSpeechRecognitionCtor();
    if (!SpeechRecognition) {
      setSpeechError("Reconhecimento de voz indisponivel neste navegador. Use Chrome ou Edge.");
      return;
    }

    try {
      await ensureMicrophonePermission();
    } catch (err) {
      setSpeechError(err instanceof Error ? err.message : "Nao consegui liberar o microfone.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;
    let finalText = "";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
        if (event.results[index].isFinal) finalText += `${event.results[index][0].transcript} `;
      }
      setVisualTranscript(transcript || finalText);
    };
    recognition.onerror = (event) => {
      setVisualListening(false);
      setSpeechError(event.error ? `Erro no microfone: ${event.error}` : "Nao consegui ouvir agora.");
      window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { voice: false } }));
    };
    recognition.onend = () => {
      setVisualListening(false);
      window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { voice: false } }));
      recognitionRef.current = null;
      const text = finalText.trim();
      if (text && visualActiveRef.current) void sendVisualTurn(text);
    };
    recognitionRef.current = recognition;
    setVisualListening(true);
    setVisualTranscript("");
    window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { voice: true } }));
    recognition.start();
  }

  async function sendVisualTurn(text: string) {
    const attachment = captureCameraFrame();
    const prompt =
      `Voce e o Jake, um assistente masculino conversando em tempo real. ` +
      `Responda como uma pessoa presente, olhando pela camera como seus olhos. ` +
      `Fale de forma natural, curta e util. O usuario disse: "${text}". ` +
      `Use a imagem anexada para entender o que voce esta vendo agora.`;
    setVisualReply("Jake esta vendo e pensando...");
    setAnalyzing(true);
    window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { thinking: true, screen: true } }));
    try {
      const result = await sendChat(token, prompt, "balanced", visualConversationIdRef.current, attachment ? [attachment] : []);
      visualConversationIdRef.current = result.conversation_id;
      setVisualReply(result.reply);
      setAnalysis(result.reply);
      speakVisualReply(result.reply);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao consegui responder agora.";
      setVisualReply(message);
      speakVisualReply(message);
    } finally {
      setAnalyzing(false);
      window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { thinking: false, screen: false } }));
    }
  }

  async function speakVisualReply(text: string) {
    if (typeof window.speechSynthesis === "undefined") {
      if (visualActiveRef.current) globalThis.setTimeout(() => startVoiceTurn(), 250);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = await createPtBrUtterance(text);
    utterance.onstart = () => {
      setVisualSpeaking(true);
      window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { voice: true } }));
    };
    utterance.onend = () => {
      setVisualSpeaking(false);
      window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { voice: false } }));
      if (visualActiveRef.current) globalThis.setTimeout(() => startVoiceTurn(), 300);
    };
    utterance.onerror = () => {
      setVisualSpeaking(false);
      window.dispatchEvent(new CustomEvent("jake:indicator", { detail: { voice: false } }));
      if (visualActiveRef.current) globalThis.setTimeout(() => startVoiceTurn(), 300);
    };
    window.speechSynthesis.speak(utterance);
  }

  function captureCameraFrame(): ChatAttachment | null {
    const video = videoRef.current;
    if (!video || !active || video.readyState < 2) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return {
      name: `camera-${new Date().toISOString()}.png`,
      type: "image/png",
      kind: "image",
      content: canvas.toDataURL("image/png")
    };
  }

  function runPreviewGestureAction(nextGesture: string) {
    if (nextGesture === "Aguardando mao" || nextGesture === "Movimento da mao") return;
    const now = performance.now();
    if (nextGesture === lastGestureRef.current && now - lastActionAtRef.current < 1200) return;
    lastGestureRef.current = nextGesture;
    lastActionAtRef.current = now;
    const action = actionForGesture(nextGesture);
    setGestureHistory((current) => [{ gesture: nextGesture, action, at: new Date().toLocaleTimeString() }, ...current].slice(0, 8));
    window.dispatchEvent(new CustomEvent("jake:notify", { detail: { title: nextGesture, body: action } }));
    if (nextGesture === "Dedo indicador levantado") clickFocusedElement();
    if (nextGesture === "Arrastar mao para cima/baixo") scrollActiveArea(220);
    if (nextGesture === "Pinca") openContextMenuHint();
  }

  function actionForGesture(nextGesture: string) {
    return CONTROL_GESTURES.find((item) => item.label === nextGesture)?.action ?? "Controle nativo recomendado";
  }

  function clickFocusedElement() {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && activeElement !== document.body) activeElement.click();
  }

  function openContextMenuHint() {
    window.dispatchEvent(new CustomEvent("jake:notify", { detail: { title: "Clique direito", body: "Use Controle nativo para clique direito real no Windows." } }));
  }

  function scrollActiveArea(delta: number) {
    const activeElement = document.activeElement;
    const target = activeElement instanceof HTMLElement ? activeElement.closest("[data-scrollable='true']") : null;
    if (target instanceof HTMLElement) {
      target.scrollBy({ top: delta, behavior: "smooth" });
      return;
    }
    window.scrollBy({ top: delta, behavior: "smooth" });
  }

  function saveGestureConfig() {
    localStorage.setItem(GESTURE_PREF_KEY, JSON.stringify({ overlayEnabled, sensitivity, panelMinimized }));
    setSaved("Configuracao salva.");
    window.setTimeout(() => setSaved(""), 1800);
  }

  function calibrateGesture() {
    directionalPrevious = null;
    lastGestureRef.current = "";
    lastActionAtRef.current = 0;
    setSensitivity(45);
    setSaved("Calibracao reiniciada.");
    window.setTimeout(() => setSaved(""), 1800);
  }

  return (
    <div className={`grid h-full gap-4 ${panelMinimized ? "xl:grid-cols-[1fr_84px]" : "xl:grid-cols-[1fr_380px]"}`}>
      <section className="rounded-panel border border-line bg-paper p-5 shadow-soft dark:border-stone-800 dark:bg-night-panel">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Camera, Voz e Gestos</h1>
            <p className="mt-1 text-sm text-muted dark:text-stone-400">
              Preview com landmarks, conversa visual e controle nativo do Windows mesmo com o navegador minimizado.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={visualActive ? stopVisualConversation : startVisualConversation}
              className={`flex h-10 items-center gap-2 rounded-panel px-4 text-sm font-medium ${
                visualActive ? "border border-line text-muted hover:border-accent hover:text-accent dark:border-stone-700" : "bg-accent text-white"
              }`}
            >
              {visualActive ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              {visualActive ? "Parar conversa" : "Conversar vendo"}
            </button>
            <button
              onClick={() => analyzeCamera()}
              disabled={!active || analyzing}
              className="flex h-10 items-center gap-2 rounded-panel border border-line px-4 text-sm font-medium hover:border-accent hover:text-accent dark:border-stone-700"
            >
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Ver com IA
            </button>
            <button
              onClick={active ? stopCamera : startCamera}
              className="flex h-10 items-center gap-2 rounded-panel bg-accent px-4 text-sm font-medium text-white"
            >
              {active ? <Square className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {active ? "Parar camera" : "Abrir camera"}
            </button>
          </div>
        </div>

        <div className="relative grid min-h-[440px] place-items-center overflow-hidden rounded-panel border border-line bg-cream dark:border-stone-700 dark:bg-night">
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-contain" />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-contain" />
          {!active ? <p className="relative z-10 text-sm text-muted dark:text-stone-400">Clique em abrir camera e permita o acesso no navegador.</p> : null}
          {tracking ? (
            <div className="absolute left-3 top-3 rounded-panel bg-black/60 px-3 py-2 text-xs text-white">
              {gesture} - {trackingMode === "mediapipe" ? "MediaPipe" : "visual"} - {fps} FPS - {confidence}%
            </div>
          ) : null}
          {visualActive ? (
            <div className="absolute bottom-3 left-3 right-3 rounded-panel bg-black/65 px-3 py-2 text-xs text-white">
              {visualListening ? "Ouvindo voce..." : visualSpeaking ? "Jake falando..." : analyzing ? "Jake vendo e pensando..." : "Conversa visual ativa"}
            </div>
          ) : null}
        </div>
        {error ? <p className="mt-3 rounded-panel bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p> : null}
        {trackingError ? <p className="mt-3 rounded-panel bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">{trackingError}</p> : null}
      </section>

      {panelMinimized ? (
        <aside className="rounded-panel border border-line bg-paper p-2 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <button
            onClick={() => setPanelMinimized(false)}
            className="grid h-10 w-full place-items-center rounded-panel border border-line text-accent hover:bg-accent-soft dark:border-stone-700"
            title="Expandir controles"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
          <div className="mt-3 grid gap-2 text-xs text-muted dark:text-stone-400">
            <MiniStatus label="PC" active={Boolean(nativeStatus?.running)} />
            <MiniStatus label="Voz" active={visualListening || visualSpeaking} />
            <MiniStatus label="IA" active={analyzing} />
          </div>
        </aside>
      ) : (
        <aside className="max-h-[calc(100vh-2rem)] space-y-4 overflow-y-auto rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Hand className="h-4 w-4 text-accent" />
              Controles
            </h2>
            <button onClick={() => setPanelMinimized(true)} className="grid h-8 w-8 place-items-center rounded-panel border border-line text-muted hover:border-accent hover:text-accent dark:border-stone-700" title="Minimizar aba">
              <PanelRightClose className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-panel border border-line bg-cream p-4 dark:border-stone-700 dark:bg-night">
            <p className="text-xs text-muted dark:text-stone-400">Gesto atual no preview</p>
            <p className="mt-2 text-xl font-semibold">{gesture}</p>
            <p className="mt-1 text-xs text-muted dark:text-stone-400">FPS {fps} - confianca {confidence}%</p>
          </div>

          <div className="rounded-panel border border-line bg-cream p-4 dark:border-stone-700 dark:bg-night">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <MousePointer2 className="h-4 w-4 text-accent" />
                  Controle nativo do PC
                </h3>
                <p className="mt-2 text-xs leading-5 text-muted dark:text-stone-400">
                  Roda no backend Python, usa a webcam local e continua funcionando com o navegador minimizado.
                </p>
              </div>
              <span className={`rounded px-2 py-1 text-xs ${nativeStatus?.running ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}>
                {nativeStatus?.running ? "ativo" : "parado"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={startNativeControl}
                disabled={nativeLoading || nativeStatus?.running}
                className="flex h-9 items-center justify-center gap-2 rounded-panel bg-accent text-xs font-medium text-white"
              >
                {nativeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hand className="h-3.5 w-3.5" />}
                Ativar PC
              </button>
              <button
                onClick={stopNativeControl}
                disabled={nativeLoading || !nativeStatus?.running}
                className="flex h-9 items-center justify-center gap-2 rounded-panel border border-line text-xs hover:border-accent hover:text-accent dark:border-stone-700"
              >
                <Square className="h-3.5 w-3.5" />
                Parar
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted dark:text-stone-400">
              Nativo: {nativeStatus?.gesture ?? "aguardando"} - {nativeStatus?.action ?? "nenhuma"} - {nativeStatus?.fps ?? 0} FPS.
            </p>
            {nativeStatus?.error ? <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-200">{nativeStatus.error}</p> : null}
          </div>

          <div className="rounded-panel border border-line bg-cream p-4 dark:border-stone-700 dark:bg-night">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              {visualListening ? <Mic className="h-4 w-4 text-accent" /> : <MicOff className="h-4 w-4 text-accent" />}
              Conversa visual
            </h3>
            <p className="mt-2 text-xs leading-5 text-muted dark:text-stone-400">
              O Jake escuta voce, captura o frame atual, responde como se estivesse olhando pela camera e fala a resposta.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={visualActive ? stopVisualConversation : startVisualConversation} className="flex h-9 items-center justify-center gap-2 rounded-panel bg-accent text-xs font-medium text-white">
                {visualActive ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                {visualActive ? "Parar" : "Iniciar"}
              </button>
              <button
                onClick={startVoiceTurn}
                disabled={!visualActive || visualListening || visualSpeaking}
                className="flex h-9 items-center justify-center gap-2 rounded-panel border border-line text-xs hover:border-accent hover:text-accent dark:border-stone-700"
              >
                <Mic className="h-3.5 w-3.5" />
                Ouvir agora
              </button>
            </div>
            {speechError ? <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-200">{speechError}</p> : null}
            <p className="mt-3 text-xs text-muted dark:text-stone-400">Voce: {visualTranscript || "..."}</p>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted dark:text-stone-400">Jake: {visualReply || "Inicie a conversa visual."}</p>
          </div>

          <div className="rounded-panel border border-line bg-cream p-4 dark:border-stone-700 dark:bg-night">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="h-4 w-4 text-accent" />
              Configuracao
            </h3>
            <label className="mt-3 flex items-center justify-between gap-3 text-sm text-muted dark:text-stone-400">
              Overlay dos landmarks
              <input type="checkbox" checked={overlayEnabled} onChange={(event) => setOverlayEnabled(event.target.checked)} />
            </label>
            <label className="mt-3 block text-sm text-muted dark:text-stone-400">
              Sensibilidade: {sensitivity}
              <input className="mt-2 w-full" type="range" min={20} max={80} value={sensitivity} onChange={(event) => setSensitivity(Number(event.target.value))} />
            </label>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={() => runPreviewGestureAction("Dedo indicador levantado")} className="flex h-9 items-center justify-center gap-2 rounded-panel border border-line text-xs hover:border-accent hover:text-accent dark:border-stone-700">
                <Wand2 className="h-3.5 w-3.5" />
                Testar
              </button>
              <button onClick={calibrateGesture} className="flex h-9 items-center justify-center gap-2 rounded-panel border border-line text-xs hover:border-accent hover:text-accent dark:border-stone-700">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Calibrar
              </button>
              <button onClick={saveGestureConfig} className="flex h-9 items-center justify-center gap-2 rounded-panel bg-accent text-xs font-medium text-white">
                <Save className="h-3.5 w-3.5" />
                Salvar
              </button>
            </div>
            {saved ? <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{saved}</p> : null}
          </div>

          <div className="space-y-2 text-sm text-muted dark:text-stone-400">
            <p className="font-medium text-ink dark:text-stone-100">Mapa novo de gestos</p>
            {CONTROL_GESTURES.map((item) => (
              <p key={item.label}>{item.label}: {item.action}.</p>
            ))}
          </div>

          <div className="rounded-panel border border-line bg-cream p-4 dark:border-stone-700 dark:bg-night">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-accent" />
              Historico
            </h3>
            <div className="mt-3 space-y-2">
              {[...(nativeStatus?.history ?? []), ...gestureHistory].slice(0, 10).map((item, index) => (
                <div key={`${item.at}-${index}`} className="rounded bg-paper px-2 py-1.5 text-xs dark:bg-night-panel">
                  <span className="font-medium">{item.gesture}</span>
                  <span className="text-muted dark:text-stone-400"> - {item.action} - {item.at}</span>
                </div>
              ))}
              {!nativeStatus?.history?.length && !gestureHistory.length ? <p className="text-xs text-muted dark:text-stone-400">Nenhum gesto acionado ainda.</p> : null}
            </div>
          </div>

          <div className="rounded-panel border border-line bg-cream p-4 dark:border-stone-700 dark:bg-night">
            <h3 className="text-sm font-semibold">Visao do Jake</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted dark:text-stone-400">
              {analysis || "Clique em Ver com IA ou inicie Conversa visual para o Jake analisar o que esta vendo."}
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}

function MiniStatus({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`rounded-panel border px-2 py-2 text-center ${active ? "border-accent bg-accent-soft text-accent" : "border-line dark:border-stone-700"}`}>
      {label}
    </div>
  );
}

function drawHand(ctx: CanvasRenderingContext2D, landmarks: Landmark[], width: number, height: number) {
  ctx.lineWidth = Math.max(3, width / 420);
  ctx.strokeStyle = "#22c55e";
  ctx.fillStyle = "#ef4444";
  ctx.shadowColor = "rgba(34, 197, 94, 0.45)";
  ctx.shadowBlur = 8;

  for (const [start, end] of HAND_CONNECTIONS) {
    const a = landmarks[start];
    const b = landmarks[end];
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  for (const point of landmarks) {
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, Math.max(4, width / 230), 0, Math.PI * 2);
    ctx.fill();
  }
}

function detectGesture(hand: Landmark[]): string {
  const points = hand.map((item) => [item.x, item.y, item.z ?? 0] as [number, number, number]);
  return detectGestureFromPoints(points);
}

function detectGestureFromPoints(points: Array<[number, number, number]>): string {
  const thumbTip = points[4];
  const thumbMcp = points[2];
  const indexTip = points[8];
  const indexPip = points[6];
  const middleTip = points[12];
  const middlePip = points[10];
  const ringTip = points[16];
  const ringPip = points[14];
  const pinkyTip = points[20];
  const pinkyPip = points[18];
  const wrist = points[0];
  const indexUp = indexTip[1] < indexPip[1] - 0.025;
  const middleUp = middleTip[1] < middlePip[1] - 0.025;
  const ringUp = ringTip[1] < ringPip[1] - 0.025;
  const pinkyUp = pinkyTip[1] < pinkyPip[1] - 0.025;
  const foldedCount = [!indexUp, !middleUp, !ringUp, !pinkyUp].filter(Boolean).length;
  const pinchDistance = Math.hypot(thumbTip[0] - indexTip[0], thumbTip[1] - indexTip[1]);
  const thumbVertical = Math.abs(thumbTip[1] - wrist[1]) > 0.12 && Math.abs(thumbTip[1] - thumbMcp[1]) > 0.08;

  if (pinchDistance < 0.055) return "Pinca";
  if (indexUp && middleUp && !ringUp && !pinkyUp) return "Dois dedos";
  if (foldedCount >= 4 && !thumbVertical) return "Punho fechado";
  if (foldedCount >= 3 && thumbVertical && thumbTip[1] < wrist[1]) return "Joinha pra cima";
  if (foldedCount >= 3 && thumbVertical && thumbTip[1] > wrist[1]) return "Joinha pra baixo";
  if (indexUp && !middleUp && !ringUp && !pinkyUp) return "Dedo indicador levantado";
  return "Movimento da mao";
}

function detectDirectionalGesture(hand: Landmark[], fallback: string, now: number, sensitivity: number): string {
  const center = hand.reduce(
    (sum, point) => ({ x: sum.x + point.x / hand.length, y: sum.y + point.y / hand.length }),
    { x: 0, y: 0 }
  );
  const previous = directionalPrevious;
  directionalPrevious = { ...center, at: now };
  if (!previous || now - previous.at > 800) return fallback;
  const dy = center.y - previous.y;
  const threshold = 0.11 - sensitivity / 1000;
  if (Math.abs(dy) > threshold) return "Arrastar mao para cima/baixo";
  return fallback;
}

function estimateFallbackHand(video: HTMLVideoElement, sampleCanvasRef: MutableRefObject<HTMLCanvasElement | null>, width: number, height: number): Landmark[] | null {
  const sampleWidth = 180;
  const sampleHeight = Math.max(100, Math.round(sampleWidth * (height / width)));
  const canvas = sampleCanvasRef.current ?? document.createElement("canvas");
  sampleCanvasRef.current = canvas;
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, sampleWidth, sampleHeight);
  const data = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
  let minX = sampleWidth;
  let minY = sampleHeight;
  let maxX = 0;
  let maxY = 0;
  let count = 0;

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const offset = (y * sampleWidth + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      if (!looksLikeSkin(r, g, b)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      count += 1;
    }
  }

  const coverage = count / (sampleWidth * sampleHeight);
  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;
  if (coverage < 0.015 || boxWidth < 16 || boxHeight < 18 || coverage > 0.55) return null;

  const scaleX = width / sampleWidth;
  const scaleY = height / sampleHeight;
  return syntheticHandFromBox({ x: minX * scaleX, y: minY * scaleY, width: boxWidth * scaleX, height: boxHeight * scaleY }, width, height);
}

function looksLikeSkin(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const classic = r > 92 && g > 45 && b > 25 && max - min > 18 && Math.abs(r - g) > 12 && r > g && r > b;
  const warmBright = r > 125 && g > 80 && b > 45 && r > b + 18 && g > b + 8;
  return classic || warmBright;
}

function syntheticHandFromBox(box: { x: number; y: number; width: number; height: number }, width: number, height: number): Landmark[] {
  const x = (ratio: number) => (box.x + box.width * ratio) / width;
  const y = (ratio: number) => (box.y + box.height * ratio) / height;
  return [
    { x: x(0.50), y: y(0.94) }, { x: x(0.38), y: y(0.78) }, { x: x(0.25), y: y(0.62) },
    { x: x(0.15), y: y(0.48) }, { x: x(0.08), y: y(0.34) }, { x: x(0.42), y: y(0.66) },
    { x: x(0.36), y: y(0.48) }, { x: x(0.31), y: y(0.28) }, { x: x(0.27), y: y(0.08) },
    { x: x(0.53), y: y(0.62) }, { x: x(0.53), y: y(0.42) }, { x: x(0.53), y: y(0.22) },
    { x: x(0.53), y: y(0.04) }, { x: x(0.64), y: y(0.66) }, { x: x(0.68), y: y(0.48) },
    { x: x(0.71), y: y(0.30) }, { x: x(0.73), y: y(0.12) }, { x: x(0.74), y: y(0.74) },
    { x: x(0.83), y: y(0.58) }, { x: x(0.89), y: y(0.44) }, { x: x(0.95), y: y(0.28) }
  ];
}
