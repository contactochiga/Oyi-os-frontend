export type SummaryIntent =
  | "home_summary"
  | "room_summary"
  | "light"
  | "ac"
  | "tv"
  | "door_control"
  | "visitor_access"
  | "cctv"
  | "security_home"
  | "security_estate"
  | "maintenance"
  | "wallet"
  | "utilities"
  | "rooms_manage"
  | "community"
  | "devices"
  | null;

export function summaryRouter(
  aiPanel?: string | null,
  userText?: string
): SummaryIntent {
  const src = `${aiPanel || ""} ${userText || ""}`.toLowerCase();

  /* ---------------- HOME & ROOM ---------------- */
  if (
    src.includes("what's happening in my house") ||
    src.includes("home status") ||
    src.includes("my home")
  ) return "home_summary";

  if (
    src.includes("room status") ||
    src.includes("what's happening in") ||
    src.includes("kitchen") ||
    src.includes("bedroom") ||
    src.includes("living room")
  ) return "room_summary";

  /* ---------------- DEVICES ---------------- */
  if (src.includes("light")) return "light";
  if (src.includes("ac") || src.includes("air condition")) return "ac";
  if (src.includes("tv")) return "tv";

  /* ---------------- VISITOR vs DOOR ---------------- */
  if (
    src.includes("visitor") ||
    src.includes("guest") ||
    src.includes("invite") ||
    src.includes("access code")
  ) return "visitor_access";

  if (
    src.includes("door") ||
    src.includes("lock") ||
    src.includes("unlock")
  ) return "door_control";

  /* ---------------- CCTV ---------------- */
  if (
    src.includes("cctv") ||
    src.includes("camera") ||
    src.includes("surveillance")
  ) return "cctv";

  /* ---------------- SECURITY ---------------- */
  if (
    src.includes("is my house safe") ||
    src.includes("home security")
  ) return "security_home";

  if (
    src.includes("estate security") ||
    src.includes("is the estate safe")
  ) return "security_estate";

  /* ---------------- MAINTENANCE ---------------- */
  if (
    src.includes("fix") ||
    src.includes("repair") ||
    src.includes("maintenance") ||
    src.includes("support")
  ) return "maintenance";

  /* ---------------- WALLET & UTILITIES ---------------- */
  if (
    src.includes("wallet") ||
    src.includes("balance") ||
    src.includes("top up")
  ) return "wallet";

  if (
    src.includes("electricity") ||
    src.includes("water") ||
    src.includes("internet") ||
    src.includes("gas") ||
    src.includes("service charge") ||
    src.includes("rent")
  ) return "utilities";

  /* ---------------- ROOMS ---------------- */
  if (
    src.includes("rooms") ||
    src.includes("create room") ||
    src.includes("assign devices")
  ) return "rooms_manage";

  /* ---------------- COMMUNITY ---------------- */
  if (
    src.includes("announcement") ||
    src.includes("community") ||
    src.includes("estate update")
  ) return "community";

  /* ---------------- DEVICE DISCOVERY ---------------- */
  if (src.includes("devices")) return "devices";

  return null;
}
