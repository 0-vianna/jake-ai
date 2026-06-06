"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

import { login, register, verifyEmail } from "@/lib/api";
import type { AuthState } from "@/lib/types";

type LoginScreenProps = {
  onLogin: (auth: AuthState) => void;
};

const trustCards: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Login seguro", icon: ShieldCheck },
  { label: "Memoria propria", icon: Sparkles },
  { label: "Controle local", icon: LockKeyhole }
];

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [verifyUrl, setVerifyUrl] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("verify_email");
    if (!token) return;
    setLoading(true);
    verifyEmail(token)
      .then((result) => {
        setSuccess(result.message);
        window.history.replaceState({}, "", window.location.pathname);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Nao consegui verificar o email agora."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setVerifyUrl("");
    try {
      if (isRegisterMode) {
        const result = await register({ name, username, email, password });
        setSuccess(result.message);
        setVerifyUrl(result.verify_url ?? "");
        setIsRegisterMode(false);
        setPassword("");
      } else {
        const auth = await login(username, password);
        onLogin(auth);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao consegui concluir agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-cream text-ink dark:bg-night dark:text-stone-100">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-10 px-5 py-8 md:grid-cols-[1.1fr_0.9fr]">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="space-y-6"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-panel border border-line bg-paper shadow-soft dark:border-stone-700 dark:bg-night-panel">
            <Sparkles className="h-6 w-6 text-accent" />
          </div>
          <div className="max-w-xl space-y-4">
            <h1 className="text-4xl font-semibold leading-tight md:text-6xl">Jake IA</h1>
            <p className="text-lg leading-8 text-muted dark:text-stone-300">
              Uma central pessoal para conversar, programar, organizar arquivos, controlar financas e preparar automacoes locais com seguranca.
            </p>
          </div>
          <div className="grid max-w-xl gap-3 sm:grid-cols-3">
            {trustCards.map(({ label, icon: Icon }) => (
              <div key={label} className="rounded-panel border border-line bg-paper p-4 text-sm text-muted shadow-soft dark:border-stone-700 dark:bg-night-panel dark:text-stone-300">
                <Icon className="mb-3 h-5 w-5 text-accent" />
                {label}
              </div>
            ))}
          </div>
        </motion.section>

        <motion.form
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
          onSubmit={handleSubmit}
          className="rounded-panel border border-line bg-paper p-6 shadow-panel dark:border-stone-700 dark:bg-night-panel"
        >
          <div className="mb-6">
            <p className="text-sm font-medium text-accent">Acesso local</p>
            <h2 className="mt-2 text-2xl font-semibold">{isRegisterMode ? "Criar conta no Jake" : "Entrar no Jake"}</h2>
          </div>

          {isRegisterMode ? (
            <label className="mb-4 block">
              <span className="mb-2 block text-sm text-muted dark:text-stone-300">Nome</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-11 w-full rounded-panel border border-line bg-cream px-3 outline-none transition focus:border-accent dark:border-stone-700 dark:bg-night"
                autoComplete="name"
                required
              />
            </label>
          ) : null}

          <label className="mb-4 block">
            <span className="mb-2 block text-sm text-muted dark:text-stone-300">{isRegisterMode ? "Usuario" : "Usuario ou email"}</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="h-11 w-full rounded-panel border border-line bg-cream px-3 outline-none transition focus:border-accent dark:border-stone-700 dark:bg-night"
              autoComplete="username"
              required
            />
          </label>

          {isRegisterMode ? (
            <label className="mb-4 block">
              <span className="mb-2 block text-sm text-muted dark:text-stone-300">Email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                className="h-11 w-full rounded-panel border border-line bg-cream px-3 outline-none transition focus:border-accent dark:border-stone-700 dark:bg-night"
                autoComplete="email"
                required
              />
            </label>
          ) : null}

          <label className="mb-4 block">
            <span className="mb-2 block text-sm text-muted dark:text-stone-300">Senha</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="h-11 w-full rounded-panel border border-line bg-cream px-3 outline-none transition focus:border-accent dark:border-stone-700 dark:bg-night"
              autoComplete={isRegisterMode ? "new-password" : "current-password"}
              required
            />
          </label>

          {error ? <p className="mb-4 rounded-panel bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p> : null}
          {success ? (
            <div className="mb-4 rounded-panel bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              <p>{success}</p>
              {verifyUrl ? (
                <a className="mt-2 block font-medium underline" href={verifyUrl}>
                  Abrir link de verificacao
                </a>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-panel bg-accent px-4 font-medium text-white shadow-soft transition hover:bg-orange-700"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Processando..." : isRegisterMode ? "Criar conta" : "Entrar"}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsRegisterMode((current) => !current);
              setError("");
              setSuccess("");
              setVerifyUrl("");
              setPassword("");
            }}
            className="mt-4 text-sm text-accent underline"
          >
            {isRegisterMode ? "Ja tenho conta" : "Criar nova conta"}
          </button>

          <p className="mt-4 text-xs leading-5 text-muted dark:text-stone-400">
            Conta admin local preparada: <strong>jprvianna</strong>. As credenciais nao aparecem preenchidas por padrao.
          </p>
        </motion.form>
      </div>
    </main>
  );
}
