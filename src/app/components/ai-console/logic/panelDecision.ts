// src/app/components/ai-console/logic/panelDecision.ts
import type { AiPanel, AiResponse } from "../types";

export function decidePanelOpen(userText: string, resp: AiResponse, inferred: AiPanel | null) {
  const t = (userText || "").toLowerCase();
  const explicit =
    t.includes("open") ||
    t.includes("show") ||
    t.includes("manage") ||
    t.includes("panel") ||
    t.includes("view") ||
    t.includes("list") ||
    t.includes("discover") ||
    t.includes("add device") ||
    t.includes("pair") ||
    t.includes("connect");

  const conf = typeof resp.confidence === "number" ? resp.confidence : 0.55;
  const panel = (resp.panel ?? inferred) || null;

  // only open if user explicitly asked AND confidence is high
  if (!explicit) return { open: false, panel: null as AiPanel | null };
  if (!panel) return { open: false, panel: null as AiPanel | null };

  // devices can open with slightly lower confidence
  const min = panel === "devices" ? 0.55 : 0.7;

  if (conf < min) return { open: false, panel: null as AiPanel | null };
  return { open: true, panel };
}
