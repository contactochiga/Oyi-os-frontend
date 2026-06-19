import API from "./api";

export type OyiSurface = "consumer" | "facility" | "office" | "watch" | "edge";
export type OyiSeverity = "normal" | "info" | "attention" | "critical";

export type OyiAwareness = {
  headline: string;
  body?: string;
  severity: OyiSeverity;
  destination: string;
  cards?: Array<Record<string, any>>;
  sources?: Array<Record<string, any>>;
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

export const oyiService = {
  async awareness(input: { surface?: OyiSurface; estate_id?: string | null; home_id?: string | null }) {
    const res = await API.get("/oyi/awareness", { params: input });
    return res.data as OyiAwareness & { ok?: boolean };
  },

  async chat(input: OyiChatRequest) {
    const res = await API.post("/oyi/chat", input);
    return res.data as OyiChatResponse;
  },
};
