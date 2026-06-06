"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2, Plus, RotateCcw, Sparkles, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  createFinanceTransaction,
  financeCategories,
  financeSummary,
  financeTransactions,
  quickFinanceEntry,
  resetFinance
} from "@/lib/api";
import { formatMoney } from "@/lib/time";
import type { FinanceCategory, FinanceSummary, FinanceTransaction } from "@/lib/types";

type FinanceViewProps = {
  token: string;
};

const fallbackSummary: FinanceSummary = {
  income: 0,
  expense: 0,
  balance: 0,
  by_category: [],
  monthly: [],
  analysis: {
    top_category: "Sem dados",
    top_category_value: 0,
    suggestion: "Cadastre alguns lançamentos para o Jake analisar seus padrões."
  }
};

export function FinanceView({ token }: FinanceViewProps) {
  const [summary, setSummary] = useState<FinanceSummary>(fallbackSummary);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [quickText, setQuickText] = useState("gastei 25 reais com lanche");
  const [loading, setLoading] = useState(true);
  const [manual, setManual] = useState({ type: "expense" as "income" | "expense", amount: "0", description: "", category_id: "" });
  const [easyEntry, setEasyEntry] = useState({ amount: "", description: "" });

  async function load() {
    setLoading(true);
    const [nextSummary, nextTransactions, nextCategories] = await Promise.all([
      financeSummary(token),
      financeTransactions(token),
      financeCategories(token)
    ]);
    setSummary(nextSummary);
    setTransactions(nextTransactions);
    setCategories(nextCategories);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [token]);

  async function handleQuick(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quickText.trim()) return;
    await quickFinanceEntry(token, quickText.trim());
    setQuickText("");
    await load();
  }

  async function handleManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createFinanceTransaction(token, {
      type: manual.type,
      amount: Number(manual.amount),
      description: manual.description,
      category_id: manual.category_id ? Number(manual.category_id) : null
    });
    setManual({ type: "expense", amount: "0", description: "", category_id: "" });
    await load();
  }

  async function saveEasy(type: "income" | "expense") {
    const amount = Number(easyEntry.amount.replace(",", "."));
    if (!amount || amount <= 0) return;
    await createFinanceTransaction(token, {
      type,
      amount,
      description: easyEntry.description || (type === "income" ? "Ganho rápido" : "Despesa rápida"),
      category_id: null
    });
    setEasyEntry({ amount: "", description: "" });
    await load();
  }

  async function handleReset() {
    const confirmed = window.confirm("Resetar financeiro? Isso apaga todos os lançamentos desta conta, mas mantém as categorias.");
    if (!confirmed) return;
    await resetFinance(token);
    await load();
  }

  const cards = useMemo(
    () => [
      ["Saldo atual", summary.balance, "text-ink dark:text-stone-100"],
      ["Receitas", summary.income, "text-emerald-700 dark:text-emerald-300"],
      ["Despesas", summary.expense, "text-orange-700 dark:text-orange-300"]
    ],
    [summary]
  );

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[1fr_360px]">
      <section className="min-w-0 space-y-4">
        <div className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Financeiro</h1>
              <p className="mt-1 text-sm text-muted dark:text-stone-400">Receitas, despesas, categorias, gráficos e análise inicial.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="flex h-10 items-center gap-2 rounded-panel border border-line px-3 text-sm font-medium text-muted transition hover:border-red-300 hover:text-red-600 dark:border-stone-700"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
              {loading ? <Loader2 className="h-5 w-5 animate-spin text-accent" /> : <Wallet className="h-5 w-5 text-accent" />}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {cards.map(([label, value, color]) => (
            <div key={String(label)} className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
              <p className="text-sm text-muted dark:text-stone-400">{label}</p>
              <p className={`mt-3 text-2xl font-semibold ${color}`}>{formatMoney(Number(value))}</p>
            </div>
          ))}
        </div>

        <div className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <h2 className="mb-3 text-sm font-semibold">Lançamento rápido</h2>
          <div className="grid gap-3 md:grid-cols-[160px_1fr_auto_auto]">
            <input
              value={easyEntry.amount}
              onChange={(event) => setEasyEntry((current) => ({ ...current, amount: event.target.value }))}
              inputMode="decimal"
              placeholder="Valor"
              className="h-11 rounded-panel border border-line bg-cream px-3 text-sm outline-none focus:border-accent dark:border-stone-700 dark:bg-night"
            />
            <input
              value={easyEntry.description}
              onChange={(event) => setEasyEntry((current) => ({ ...current, description: event.target.value }))}
              placeholder="Descrição. Ex: lanche, salário, mercado"
              className="h-11 rounded-panel border border-line bg-cream px-3 text-sm outline-none focus:border-accent dark:border-stone-700 dark:bg-night"
            />
            <button onClick={() => saveEasy("expense")} className="h-11 rounded-panel bg-orange-600 px-4 text-sm font-medium text-white">
              Salvar despesa
            </button>
            <button onClick={() => saveEasy("income")} className="h-11 rounded-panel bg-emerald-600 px-4 text-sm font-medium text-white">
              Salvar ganho
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {["25 lanche", "120 mercado", "200 trabalho", "50 transporte"].map((example) => (
              <button
                key={example}
                onClick={() => {
                  const [amount, ...description] = example.split(" ");
                  setEasyEntry({ amount, description: description.join(" ") });
                }}
                className="rounded border border-line bg-cream px-2 py-1 text-muted hover:border-accent hover:text-accent dark:border-stone-700 dark:bg-night"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartPanel title="Gastos por categoria" icon={BarChart3}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={summary.by_category} dataKey="value" nameKey="name" innerRadius={54} outerRadius={84}>
                  {summary.by_category.map((_, index) => (
                    <Cell key={index} fill={["#d97732", "#0ea5e9", "#16a34a", "#a855f7", "#64748b"][index % 5]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </ChartPanel>
          <ChartPanel title="Evolução mensal" icon={Sparkles}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={summary.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eadfce" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Line type="monotone" dataKey="income" stroke="#16a34a" strokeWidth={2} />
                <Line type="monotone" dataKey="expense" stroke="#d97732" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>
        </div>

        <ChartPanel title="Receitas x despesas" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={summary.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eadfce" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Bar dataKey="income" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="#d97732" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <div className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <h2 className="mb-4 text-sm font-semibold">Últimos lançamentos</h2>
          <div className="space-y-2">
            {transactions.slice(0, 8).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 rounded-panel bg-cream px-3 py-2 text-sm dark:bg-night">
                <div>
                  <p className="font-medium">{tx.description || "Sem descrição"}</p>
                  <p className="text-xs text-muted dark:text-stone-400">{tx.transaction_date}</p>
                </div>
                <p className={tx.type === "income" ? "text-emerald-700 dark:text-emerald-300" : "text-orange-700 dark:text-orange-300"}>
                  {tx.type === "income" ? "+" : "-"} {formatMoney(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <form onSubmit={handleQuick} className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-accent" />
            Lançamento por texto
          </h2>
          <textarea
            value={quickText}
            onChange={(event) => setQuickText(event.target.value)}
            rows={3}
            className="mt-3 w-full resize-none rounded-panel border border-line bg-cream p-3 text-sm outline-none focus:border-accent dark:border-stone-700 dark:bg-night"
          />
          <button className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-panel bg-accent text-sm font-medium text-white">
            <Plus className="h-4 w-4" />
            Registrar com Jake
          </button>
        </form>

        <form onSubmit={handleManual} className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <h2 className="text-sm font-semibold">Lançamento manual</h2>
          <div className="mt-3 grid gap-3">
            <select
              value={manual.type}
              onChange={(event) => setManual((current) => ({ ...current, type: event.target.value as "income" | "expense" }))}
              className="h-10 rounded-panel border border-line bg-cream px-3 text-sm dark:border-stone-700 dark:bg-night"
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
            <input
              value={manual.amount}
              onChange={(event) => setManual((current) => ({ ...current, amount: event.target.value }))}
              type="number"
              min="0"
              step="0.01"
              className="h-10 rounded-panel border border-line bg-cream px-3 text-sm dark:border-stone-700 dark:bg-night"
              placeholder="Valor"
            />
            <input
              value={manual.description}
              onChange={(event) => setManual((current) => ({ ...current, description: event.target.value }))}
              className="h-10 rounded-panel border border-line bg-cream px-3 text-sm dark:border-stone-700 dark:bg-night"
              placeholder="Descrição"
            />
            <select
              value={manual.category_id}
              onChange={(event) => setManual((current) => ({ ...current, category_id: event.target.value }))}
              className="h-10 rounded-panel border border-line bg-cream px-3 text-sm dark:border-stone-700 dark:bg-night"
            >
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <button className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-panel border border-line text-sm font-medium hover:border-accent hover:text-accent dark:border-stone-700">
            <Plus className="h-4 w-4" />
            Salvar
          </button>
        </form>

        <div className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
          <h2 className="text-sm font-semibold">Análise do Jake</h2>
          <p className="mt-3 text-sm leading-6 text-muted dark:text-stone-400">
            Maior gasto: <strong>{summary.analysis.top_category}</strong> ({formatMoney(summary.analysis.top_category_value)}). {summary.analysis.suggestion}
          </p>
        </div>
      </aside>
    </div>
  );
}

function ChartPanel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="rounded-panel border border-line bg-paper p-4 shadow-soft dark:border-stone-800 dark:bg-night-panel">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Icon className="h-4 w-4 text-accent" />
      </div>
      {children}
    </div>
  );
}
