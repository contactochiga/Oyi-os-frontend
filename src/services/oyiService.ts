import API from "./api";

export type OyiSurface = "consumer" | "facility" | "office" | "watch" | "edge";
export type OyiSeverity = "normal" | "info" | "attention" | "warning" | "critical";
export type OisContext = {
  actor_id: string;
  surface: OyiSurface;
  estate_id: string | null;
  home_id: string | null;
  module: string | null;
  role: string;
  permissions: string[];
  resolved_at: string;
};
export type OyiTarget = {
  target_type: "workflow" | "prediction" | "incident" | "maintenance" | "visitor" | "device" | "camera" | "infrastructure" | "wallet" | "service" | "community" | "message" | "handover" | "none";
  target_id?: string | null;
  infrastructure_source?: "devices" | "cameras" | "edge" | "utilities" | "providers";
  open_as: "drawer" | "page" | "queue" | "attention" | "none";
  action?: "inspect" | "approve" | "assign" | "acknowledge" | "verify" | "resolve" | "escalate" | "control" | "pay" | "message";
};

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
  context?: Partial<OisContext> | null;
  device_id?: string | null;
  device_name?: string | null;
  room_id?: string | null;
  room_name?: string | null;
  control_profile?: string | null;
  primary_state?: string | null;
  health_status?: string | null;
  supported_controls?: string[] | null;
  channel_definitions?: Array<Record<string, any>> | null;
  memory_summary?: Record<string, any> | null;
  relationships?: Record<string, any> | null;
  predictive_findings?: Array<Record<string, any>> | null;
  recent_executions?: Array<Record<string, any>> | null;
  active_scenes?: Array<Record<string, any>> | null;
  active_automations?: Array<Record<string, any>> | null;
  conversation_context?: Record<string, any> | null;
};

export type OyiChatResponse = {
  ok?: boolean;
  message: string;
  reply?: string;
  intent?: string;
  understood?: string;
  execution?: Record<string, any>;
  display_mode?: "conversation" | "list" | "detail" | "audit" | "report" | "awareness";
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
  async awareness(input: { surface?: OyiSurface; estate_id?: string | null; home_id?: string | null; context?: OisContext | null }) {
    const res = await API.get("/oyi/awareness", { params: { surface: input.surface, estate_id: input.context?.estate_id || input.estate_id, home_id: input.context?.home_id || input.home_id } });
    return res.data as OyiAwareness & { ok?: boolean };
  },

  async chat(input: OyiChatRequest) {
    const res = await API.post("/oyi/chat", input);
    return res.data as OyiChatResponse;
  },

  async listThreads(input: { surface?: OyiSurface; estate_id?: string | null; home_id?: string | null; limit?: number; context?: OisContext | null }) {
    const res = await API.get("/oyi/threads", { params: { surface: input.surface, estate_id: input.context?.estate_id || input.estate_id, home_id: input.context?.home_id || input.home_id, limit: input.limit } });
    return res.data as { ok?: boolean; threads?: OyiThread[] };
  },

  async getThreadMessages(threadId: string) {
    const res = await API.get(`/oyi/threads/${encodeURIComponent(threadId)}/messages`);
    return res.data as { ok?: boolean; thread?: OyiThread; messages?: OyiThreadMessage[] };
  },
};
