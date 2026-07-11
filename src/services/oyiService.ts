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

export type OperationalObjectType =
  | "estate"
  | "building"
  | "floor"
  | "home"
  | "room"
  | "zone"
  | "device"
  | "visitor"
  | "access_pass"
  | "maintenance_request"
  | "wallet"
  | "transaction"
  | "service_account"
  | "infrastructure_asset"
  | "provider"
  | "camera"
  | "meter"
  | "scene"
  | "automation"
  | "message_thread"
  | "community_post"
  | "notification"
  | "operational_event"
  | "twin_node";

export type TruthState =
  | "confirmed"
  | "observed"
  | "inferred"
  | "predicted"
  | "pending_confirmation"
  | "unavailable"
  | "unsupported"
  | "permission_restricted";

export type OperationalObject = {
  object_type: OperationalObjectType;
  canonical_id: string;
  label: string;
  estate_id: string | null;
  building_id: string | null;
  home_id: string | null;
  room_id: string | null;
  parent_id: string | null;
  source_module: string | null;
  capabilities: string[];
  current_state: string | null;
  health: string | null;
  permissions: string[];
  relationships: Record<string, any>;
  evidence_references: string[];
  metadata: Record<string, any>;
  freshness: string | null;
};

export type CanonicalTruth = {
  title: string;
  body: string;
  truth_state: TruthState;
  severity: OyiSeverity;
  source_event: string | null;
  confidence: number | null;
  object: OperationalObject | null;
  occurred_at: string | null;
  freshness: string | null;
  recommended_actions: Array<Record<string, any>>;
  active_execution: Record<string, any> | null;
  target: OyiTarget | null;
  technical_details: Record<string, any> | null;
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
  operational_object?: Partial<OperationalObject> | null;
  target?: OyiTarget | null;
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
  truth?: CanonicalTruth;
  operational_object?: OperationalObject | null;
  context?: {
    surface: OyiSurface;
    estate_id: string | null;
    home_id: string | null;
    module: string | null;
    context_source: string;
    warnings: string[];
  };
  confirmations?: Array<Record<string, any>>;
  approvalRequired?: boolean;
  requiresConfirmation?: boolean;
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
    const res = await API.post("/oyi/runtime/conversation", {
      message: input.message,
      surface: input.surface,
      estate_id: input.context?.estate_id || input.estate_id || null,
      home_id: input.context?.home_id || input.home_id || null,
      module: input.module || input.context?.module || null,
      role: input.role || null,
      thread_id: input.thread_id || null,
      context: input.context || null,
      device_id: input.device_id || null,
      device_name: input.device_name || null,
      room_id: input.room_id || null,
      room_name: input.room_name || null,
      control_profile: input.control_profile || null,
      primary_state: input.primary_state || null,
      health_status: input.health_status || null,
      supported_controls: input.supported_controls || null,
      channel_definitions: input.channel_definitions || null,
      memory_summary: input.memory_summary || null,
      relationships: input.relationships || null,
      predictive_findings: input.predictive_findings || null,
      recent_executions: input.recent_executions || null,
      active_scenes: input.active_scenes || null,
      active_automations: input.active_automations || null,
      conversation_context: input.conversation_context || null,
      operational_object: input.operational_object || null,
      target: input.target || null,
    });
    const runtime = res.data?.response || {};
    return {
      ok: Boolean(res.data?.ok),
      message: runtime.message || runtime.reply || "",
      reply: runtime.reply || runtime.message || "",
      intent: runtime.intent,
      understood: runtime.understood,
      execution: runtime.execution,
      display_mode: runtime.display_mode,
      cards: Array.isArray(runtime.cards) ? runtime.cards : [],
      sources: Array.isArray(runtime.sources) ? runtime.sources : [],
      suggested_actions: Array.isArray(runtime.suggested_actions) ? runtime.suggested_actions : [],
      awareness: runtime.awareness,
      thread_id: runtime.thread_id,
      warnings: Array.isArray(runtime.warnings) ? runtime.warnings : [],
      truth: runtime.truth || undefined,
      operational_object: runtime.operational_object || null,
      context: runtime.context || undefined,
      confirmations: Array.isArray(runtime.confirmations) ? runtime.confirmations : [],
      approvalRequired: Boolean(runtime.approvalRequired),
      requiresConfirmation: Boolean(runtime.requiresConfirmation),
    } as OyiChatResponse;
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
