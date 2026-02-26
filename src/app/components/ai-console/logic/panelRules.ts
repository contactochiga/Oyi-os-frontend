import type { ChatMessage } from "../types";

export function getSuggestionTitle(panel: string): string {
  switch (panel) {
    case "home": return "View home summary";
    case "rooms": return "Manage rooms";
    case "visitor": return "Manage visitors";
    case "door": return "Door access";
    case "wallet": return "Open wallet";
    case "utilities": return "View utilities";
    case "maintenance": return "Report maintenance issue";
    case "community": return "Community updates";
    case "light": return "Control lights";
    case "ac": return "Adjust air conditioner";
    case "tv": return "Control TV";
    case "cctv": return "View CCTV";
    case "sensors": return "View sensors";
    case "devices": return "Devices & Discovery";
    default: return "Continue";
  }
}

export function shouldOpenPanel(userText: string, panel: string | null) {
  if (!panel) return false;

  const MANAGEMENT = new Set([
    "home","rooms","visitor","wallet","utilities","maintenance","community","devices","cctv","sensors",
  ]);

  const t = (userText || "").toLowerCase();

  const explicit =
    t.includes("open") ||
    t.includes("show") ||
    t.includes("manage") ||
    t.includes("panel") ||
    t.includes("settings") ||
    t.includes("list") ||
    t.includes("view") ||
    t.includes("discover") ||
    t.includes("add device") ||
    t.includes("bind device") ||
    t.includes("pair device") ||
    t.includes("connect device");

  return explicit && MANAGEMENT.has(panel);
}

export function isSamePanelInstance(m: ChatMessage, panel: string, deviceId?: string) {
  if (!m.panel) return false;
  if (m.panel !== panel) return false;
  if (panel === "devices") return true;
  if (!deviceId) return true;
  return m.deviceId === deviceId;
}
