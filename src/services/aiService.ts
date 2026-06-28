// src/services/aiService.ts
import API from "./api";
import { oyiService, type OyiAwareness } from "./oyiService";
import { runOyiCoreConversation } from "./oyiCoreRuntimeService";

export type AiAction =
  | {
      type: "device.command";
      deviceId: string;
      command: Record<string, any>;
    }
  | {
      type: "open.panel";
      panel: string;
      deviceId?: string;
    }
  | {
      type: "visitor.create";
      payload: {
        name?: string;
        phone?: string;
        purpose?: string;
        expires_hours?: number;
        navigation_mode?: "code" | "link";
      };
    };

export type AiChatResponse = {
  message?: string;
  reply: string;

  intent?: string;
  understood?: string;
  execution?: Record<string, any>;
  display_mode?: "conversation" | "list" | "detail" | "audit" | "report" | "awareness";
  confidence?: number;

  panel?: string | null;
  deviceId?: string;

  actions?: AiAction[];
  tools?: Array<Record<string, any>>;
  confirmations?: Array<Record<string, any>>;
  cards?: Array<Record<string, any>>;
  sources?: Array<Record<string, any>>;
  suggested_actions?: Array<Record<string, any>>;
  awareness?: OyiAwareness;
  thread_id?: string;
  safe_mode?: boolean;

  requiresConfirmation?: boolean;
};

function normalize(resp: any): AiChatResponse {
  return {
    message: String(resp?.message || resp?.reply || "").trim(),
    reply: String(resp?.reply || resp?.message || "").trim() || "Done.",

    intent: resp?.intent || "info",
    understood: resp?.understood ? String(resp.understood) : undefined,
    execution: resp?.execution && typeof resp.execution === "object" ? resp.execution : undefined,
    display_mode: resp?.display_mode,
    confidence:
      typeof resp?.confidence === "number"
        ? Math.max(0, Math.min(1, resp.confidence))
        : 0.6,

    panel: resp?.panel ?? null,
    deviceId: resp?.deviceId,

    actions: Array.isArray(resp?.actions) ? resp.actions : [],

    tools: Array.isArray(resp?.tools) ? resp.tools : [],
    confirmations: Array.isArray(resp?.confirmations) ? resp.confirmations : [],
    cards: Array.isArray(resp?.cards) ? resp.cards : [],
    sources: Array.isArray(resp?.sources) ? resp.sources : [],
    suggested_actions: Array.isArray(resp?.suggested_actions) ? resp.suggested_actions : Array.isArray(resp?.suggestedActions) ? resp.suggestedActions : [],
    awareness: resp?.awareness || undefined,
    thread_id: resp?.thread_id ? String(resp.thread_id) : undefined,
    safe_mode: Boolean(resp?.safe_mode),

    requiresConfirmation: Boolean(resp?.requiresConfirmation || (Array.isArray(resp?.confirmations) && resp.confirmations.length)),
  };
}

export const aiService = {
  async chat(message: string, context?: Record<string, any>): Promise<AiChatResponse> {
    try {
      const unified = await oyiService.chat({
        surface: (context?.surface as any) || "consumer",
        estate_id: context?.estate_id || context?.estateId || null,
        home_id: context?.home_id || context?.homeId || null,
        module: context?.module || null,
        role: context?.role || null,
        thread_id: context?.thread_id || context?.threadId || null,
        context: context?.ois_context || context || null,
        message,
      });
      return normalize({ ...unified, reply: unified.reply || unified.message });
    } catch {
      // Keep the legacy action-capable route alive as a compatibility fallback.
    }

    try {
      const res = await API.post("/ai/chat", { message, context });
      return normalize(res.data);
    } catch (err) {
      console.warn("aiService.chat error:", err);

      try {
        const runtime = await runOyiCoreConversation(message, context);
        if (runtime) {
          return {
            reply: String(runtime.answer || runtime.summary || "I reviewed the current operational context."),
            intent: runtime.intent || "info",
            confidence:
              typeof runtime.confidence === "number"
                ? Math.max(0, Math.min(1, runtime.confidence))
                : 0.4,
            actions: [],
            panel: null,
            requiresConfirmation: Boolean(runtime.approvalRequired),
          };
        }
      } catch (runtimeErr) {
        console.warn("aiService.chat runtime fallback error:", runtimeErr);
      }

      return {
        reply: "I couldn't reach Oyi right now.",
        intent: "error",
        confidence: 0,
      };
    }
  },

  async confirm(ledgerId: string) {
    const res = await API.post(`/ai/confirmations/${ledgerId}/confirm`);
    return res.data;
  },

  async cancel(ledgerId: string) {
    const res = await API.post(`/ai/confirmations/${ledgerId}/cancel`);
    return res.data;
  },
};
