export type EventPriority = "low" | "medium" | "high";

export type EstateEvent = {
  id: string;

  // Existing types preserved
  type: "doorbell" | "power" | "security" | "info";

  // Display & replay
  title: string;
  message: string;

  // Time
  timestamp: number;
  expiresAt?: number;

  // Behaviour flags
  actionable?: boolean;
  dismissed?: boolean;

  // UI / routing helpers
  priority?: EventPriority;
  category?: "assistant" | "system" | "device" | "finance" | "community";
};
