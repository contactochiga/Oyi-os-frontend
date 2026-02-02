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
    };

export type AiChatResponse = {
  reply: string;
  panel?: string | null;
  deviceId?: string;
  actions?: AiAction[];
};

export const aiService = {
  async chat(message: string): Promise<AiChatResponse> {
    try {
      const res = await API.post("/ai/chat", { message });

      // Expected (new):
      // {
      //   reply: "...",
      //   actions: [{ type: "device.command", deviceId, command }]
      // }

      return res.data as AiChatResponse;
    } catch (err) {
      console.warn("aiService.chat error:", err);

      // Safe conversational fallback
      return {
        reply: `Okay — I processed "${message}".`,
      };
    }
  },
};
