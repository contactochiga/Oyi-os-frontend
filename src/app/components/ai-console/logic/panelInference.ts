import type { AiPanel } from "../types";

export function inferPanel(aiPanel?: string | null, userText?: string): AiPanel | null {
  const src = `${aiPanel || ""} ${userText || ""}`
    .toLowerCase()
    .replace(/[^\w\s]/g, "");

  if (src.includes("home") || src.includes("summary") || src.includes("overview") || src.includes("status")) return "home";
  if (src.includes("room") || src.includes("bedroom") || src.includes("kitchen") || src.includes("living room")) return "rooms";
  if (src.includes("visitor") || src.includes("guest") || src.includes("delivery") || src.includes("gate pass")) return "visitor";
  if (src.includes("door") || src.includes("lock") || src.includes("unlock") || src.includes("front door")) return "door";
  if (src.includes("cctv") || src.includes("camera") || src.includes("surveillance")) return "cctv";
  if (src.includes("sensor") || src.includes("motion") || src.includes("smoke") || src.includes("gas") || src.includes("alert")) return "sensors";
  if (src.includes("maintenance") || src.includes("repair") || src.includes("fix") || src.includes("support")) return "maintenance";
  if (src.includes("wallet") || src.includes("payment") || src.includes("balance") || src.includes("fund")) return "wallet";
  if (src.includes("utility") || src.includes("electric") || src.includes("power") || src.includes("water") || src.includes("internet") || src.includes("rent"))
    return "utilities";
  if (src.includes("community") || src.includes("announcement") || src.includes("estate news") || src.includes("notice")) return "community";
  if (src.includes("light")) return "light";
  if (src.includes("ac") || src.includes("air conditioner") || src.includes("air")) return "ac";
  if (src.includes("tv") || src.includes("television")) return "tv";
  if (src.includes("device") || src.includes("discover") || src.includes("pair") || src.includes("bind") || src.includes("add device") || src.includes("connect device"))
    return "devices";

  return null;
}
