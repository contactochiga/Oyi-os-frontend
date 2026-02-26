export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  panel?: string | null;
  deviceId?: string;
  time: string;
  lastUpdated: number;
  pending?: boolean;
};

export type DeviceAction =
  | { type: "device.command"; deviceId: string; command: Record<string, any> }
  | { type: "open.panel"; panel: string; deviceId?: string };
