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
  | { type: "open.panel"; panel: AiPanel; deviceId?: string };

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
