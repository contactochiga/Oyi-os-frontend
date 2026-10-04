// Consumer surface adapter for the shared Oyi interaction foundation
// (oyi-interaction). It supplies Consumer CONTEXT, NAVIGATION, STARTER SEEDS,
// OPERATIONAL-OBJECT context and HISTORY POLICY -- nothing else. It cannot
// grant capability authority, override Backend permission results, invent
// execution truth or change Core semantics (defineOyiSurfaceAdapter enforces
// the contract).
import { defineOyiSurfaceAdapter, normalizeOyiNavigation, type OyiActionResultView, type OyiSurfaceAdapter } from "oyi-interaction/core";
import { CONSUMER_MODULES, visibleModules } from "@/lib/moduleRegistry";
import type { OyiIdentity } from "@/lib/oyiFoundation";

export type ConsumerSuggestionSeed = { label: string; prompt?: string; href?: string; tone?: "blue" | "green" | "amber" | "violet" };

// Consumer starter seeds (surface-owned; the shared layer never decides them).
export const CONSUMER_STARTER_SEEDS: ConsumerSuggestionSeed[] = [
  { label: "What can you do?", prompt: "What can you do?", tone: "blue" },
  { label: "What’s happening?", prompt: "What’s happening?", tone: "green" },
  { label: "Show device status", prompt: "Show device status", tone: "blue" },
  { label: "Offline devices", prompt: "Show offline devices", tone: "amber" },
  { label: "Pending visitors", prompt: "Show pending visitors", tone: "green" },
  { label: "Wallet balance", prompt: "Show wallet balance", tone: "violet" },
  { label: "Home summary", prompt: "Generate today’s home summary", tone: "blue" },
  { label: "Turn off living room light", prompt: "Turn off living room light", tone: "amber" },
  { label: "Scenes", href: "/scenes", tone: "violet" },
];

export function createConsumerSurfaceAdapter(input: {
  user: OyiIdentity | null | undefined;
  estateId: string | null;
  homeId: string | null;
  homeLabel: string | null;
  operationalObject: Record<string, unknown> | null;
  voiceEntry: boolean;
}): OyiSurfaceAdapter {
  return defineOyiSurfaceAdapter({
    surface: "consumer",
    context: () => ({ scopeKind: input.homeId ? "home" : "none", scopeLabel: input.homeLabel, estateId: input.estateId, homeId: input.homeId, buildingId: null }),
    // Visibility only, through the existing permission-aware registry.
    navigation: () => normalizeOyiNavigation(visibleModules(input.user, CONSUMER_MODULES).map((module) => ({ key: module.key, label: module.label, href: module.href }))),
    starterSeeds: () => CONSUMER_STARTER_SEEDS,
    operationalObject: () => input.operationalObject,
    // Backend threads are the history. The on-device copy is kept only for
    // signed-out use and turns Backend could not persist (audited: it backs
    // offline/failed-persistence restoration, so it is not removed).
    historyPolicy: { source: "backend_threads", localFallback: "unsaved_turns_only", maxThreads: 24 },
    uiHints: { voiceEntry: input.voiceEntry },
  });
}

// Consumer message-state vocabulary for a canonical action outcome.
export function consumerMessageStateForAction(view: OyiActionResultView | null): "approval_required" | "executing" | "action_confirmed" | "action_failed" | "partial" | "informational" | null {
  if (!view) return null;
  if (view.awaiting_user) return "approval_required";
  if (view.tone === "verified") return "action_confirmed";
  if (view.tone === "failed") return "action_failed";
  if (view.tone === "unverified") return "partial";
  if (view.tone === "progress") return "executing";
  return "informational";
}
