export type EstateEvent = {
  id: string;
  type: "doorbell" | "power" | "security" | "info";
  title: string;
  message: string;
  timestamp: number;
  actionable?: boolean;
};
