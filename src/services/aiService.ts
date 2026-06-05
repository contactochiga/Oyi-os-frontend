// src/services/aiService.ts
import API from "./api";

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
  confidence?: number;

  panel?: string | null;
  deviceId?: string;

  actions?: AiAction[];
  tools?: Array<Record<string, any>>;
  confirmations?: Array<Record<string, any>>;
  cards?: Array<Record<string, any>>;
  sources?: Array<Record<string, any>>;
  suggested_actions?: Array<Record<string, any>>;
  safe_mode?: boolean;

  requiresConfirmation?: boolean;
};

function normalize(resp: any): AiChatResponse {
  return {
    message: String(resp?.message || resp?.reply || "").trim(),
    reply: String(resp?.reply || resp?.message || "").trim() || "Done.",

    intent: resp?.intent || "info",
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
    safe_mode: Boolean(resp?.safe_mode),

    requiresConfirmation: Boolean(resp?.requiresConfirmation || (Array.isArray(resp?.confirmations) && resp.confirmations.length)),
  };
}

export const aiService = {
  async chat(message: string, context?: Record<string, any>): Promise<AiChatResponse> {
    try {
      const res = await API.post("/ai/chat", { message, context });
      return normalize(res.data);
    } catch (err) {
      console.warn("aiService.chat error:", err);

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
