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
  reply: string;

  intent?: string;
  confidence?: number;

  panel?: string | null;
  deviceId?: string;

  actions?: AiAction[];

  requiresConfirmation?: boolean;
};

function normalize(resp: any): AiChatResponse {
  return {
    reply: String(resp?.reply || "").trim() || "Done.",

    intent: resp?.intent || "info",
    confidence:
      typeof resp?.confidence === "number"
        ? Math.max(0, Math.min(1, resp.confidence))
        : 0.6,

    panel: resp?.panel ?? null,
    deviceId: resp?.deviceId,

    actions: Array.isArray(resp?.actions) ? resp.actions : [],

    requiresConfirmation: Boolean(resp?.requiresConfirmation),
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
        reply: "I couldn't reach the AI service.",
        intent: "error",
        confidence: 0,
      };
    }
  },
};
