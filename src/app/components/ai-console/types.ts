// src/app/components/ai-console/types/ai.ts
export type AiPanel =
  | "home"
  | "rooms"
  | "visitor"
  | "door"
  | "cctv"
  | "sensors"
  | "maintenance"
  | "wallet"
  | "utilities"
  | "community"
  | "light"
  | "ac"
  | "tv"
  | "devices";

export type DeviceAction =
  | { type: "device.command"; deviceId: string; command: Record<string, any> }
  | { type: "open.panel"; panel: AiPanel; deviceId?: string }
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

export type AiResponse = {
  reply: string;
  panel?: AiPanel | null;
  confidence?: number; // 0..1 (important)
  actions?: DeviceAction[];
  deviceId?: string;
  meta?: {
    intent?: string;
    reason?: string;
  };
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  time?: string;
  pending?: boolean;
  panel?: AiPanel | string | null;
  deviceId?: string;
  cards?: Array<Record<string, any>>;
  sources?: Array<Record<string, any>>;
  suggested_actions?: Array<Record<string, any>>;
  intent?: string;
  understood?: string;
  execution?: Record<string, any>;
  display_mode?: "conversation" | "list" | "detail" | "audit" | "report" | "awareness";
  confirmations?: Array<Record<string, any>>;
  lastUpdated?: number;
};
