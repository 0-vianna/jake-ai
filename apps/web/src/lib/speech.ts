"use client";

export type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

export type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };

export function getSpeechRecognitionCtor() {
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export async function ensureMicrophonePermission() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Seu navegador nao oferece acesso ao microfone.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
}

export async function createPtBrUtterance(text: string) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  utterance.rate = 1;
  utterance.pitch = 0.88;
  const voice = await resolveVoice();
  if (voice) utterance.voice = voice;
  return utterance;
}

async function resolveVoice() {
  if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") return null;
  const existing = pickVoice(window.speechSynthesis.getVoices());
  if (existing) return existing;
  return new Promise<SpeechSynthesisVoice | null>((resolve) => {
    let settled = false;
    const finish = (voice: SpeechSynthesisVoice | null) => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(voice);
    };
    const onVoicesChanged = () => finish(pickVoice(window.speechSynthesis.getVoices()));
    window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
    window.setTimeout(() => finish(pickVoice(window.speechSynthesis.getVoices())), 450);
  });
}

function pickVoice(voices: SpeechSynthesisVoice[]) {
  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith("pt-br")) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("pt")) ??
    voices[0] ??
    null
  );
}
