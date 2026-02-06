export type EventPriority = "low" | "medium" | "high";
export type EventCategory = "system" | "assistant" | "security" | "ops";

export type EstateEvent = {
  id: string;

  // what kind of event this is
  type: "doorbell" | "power" | "security" | "info";

  // what shows on the button
  title: string;

  // what gets re-sent when tapped
  message: string;

  timestamp: number;

  // runtime UI controls
  actionable?: boolean;          // if false, hide from suggestion chips
  category?: EventCategory;      // "system" will be hidden from chips
  priority?: EventPriority;      // affects sorting
  dismissed?: boolean;           // chip disappears when dismissed
  expiresAt?: number;            // auto-expire time
};
