import type { LucideIcon } from "lucide-react";

export type User = {
  id: number;
  name: string;
  username: string;
  email: string;
  role: "admin" | "user" | string;
  theme: "light" | "dark" | string;
  is_active: boolean;
};

export type AuthState = {
  token: string;
  user: User;
};

export type ModuleId =
  | "home"
  | "chat"
  | "projects"
  | "files"
  | "code"
  | "screen"
  | "camera"
  | "automations"
  | "whatsapp"
  | "finance"
  | "memory"
  | "settings"
  | "users"
  | "logs"
  | "models";

export type NavItem = {
  id: ModuleId;
  label: string;
  icon: LucideIcon;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type Conversation = {
  id: number;
  title: string;
  mode: string;
  created_at: string;
  updated_at: string;
};

export type FinanceTransaction = {
  id: number;
  type: "income" | "expense";
  amount: number;
  description: string;
  category_id: number | null;
  transaction_date: string;
  created_at: string;
};

export type FinanceCategory = {
  id: number;
  name: string;
  type: "income" | "expense";
  color: string;
  parent_id: number | null;
};

export type FinanceSummary = {
  income: number;
  expense: number;
  balance: number;
  by_category: Array<{ name: string; value: number }>;
  monthly: Array<{ month: string; income: number; expense: number }>;
  analysis: {
    top_category: string;
    top_category_value: number;
    suggestion: string;
  };
};

