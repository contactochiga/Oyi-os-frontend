import API from "./api";

export type OyiSurface = "consumer" | "facility" | "office" | "watch" | "edge";
export type OyiSeverity = "normal" | "info" | "attention" | "warning" | "critical";

export type OyiAwareness = {
  headline: string;
  summary?: string;
  body?: string;
  severity: OyiSeverity;
  recommended_action?: string;
  destination: string;
  cards?: Array<Record<string, any>>;
  sources?: Array<Record<string, any>>;
  suggested_actions?: Array<Record<string, any>>;
  awareness_score?: number;
  score?: number;
  generated_at?: string;
};

export type OyiChatRequest = {
  surface: OyiSurface;
  estate_id?: string | null;
  home_id?: string | null;
  module?: string | null;
  role?: string | null;
  message: string;
  thread_id?: string | null;
};

export type OyiChatResponse = {
  ok?: boolean;
  message: string;
  reply?: string;
  cards?: Array<Record<string, any>>;
  sources?: Array<Record<string, any>>;
  suggested_actions?: Array<Record<string, any>>;
  awareness?: OyiAwareness;
  thread_id?: string;
  warnings?: string[];
};

export type OyiThread = {
  id: string;
  surface: OyiSurface;
  estate_id?: string | null;
  home_id?: string | null;
  module?: string | null;
  title?: string | null;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, any>;
};

export type OyiThreadMessage = {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  cards?: Array<Record<string, any>>;
  sources?: Array<Record<string, any>>;
  suggested_actions?: Array<Record<string, any>>;
  metadata?: Record<string, any>;
  created_at?: string;
};

export const oyiService = {
  async awareness(input: { surface?: OyiSurface; estate_id?: string | null; home_id?: string | null }) {
    const res = await API.get("/oyi/awareness", { params: input });
    return res.data as OyiAwareness & { ok?: boolean };
  },

  async chat(input: OyiChatRequest) {
    const res = await API.post("/oyi/chat", input);
    return res.data as OyiChatResponse;
  },

  async listThreads(input: { surface?: OyiSurface; estate_id?: string | null; home_id?: string | null; limit?: number }) {
    const res = await API.get("/oyi/threads", { params: input });
    return res.data as { ok?: boolean; threads?: OyiThread[] };
  },

  async getThreadMessages(threadId: string) {
    const res = await API.get(`/oyi/threads/${encodeURIComponent(threadId)}/messages`);
    return res.data as { ok?: boolean; thread?: OyiThread; messages?: OyiThreadMessage[] };
  },
};
