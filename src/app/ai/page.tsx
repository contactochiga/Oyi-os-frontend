"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, CircleDashed, Clock3, Copy, History, Menu, Plus, Search, ThumbsUp, UserRound, Volume2, X } from "lucide-react";

import useAuth from "@/hooks/useAuth";
import useActiveContext from "@/hooks/useActiveContext";
import { aiService, type AiChatResponse } from "@/services/aiService";
import { deriveConsumerOperationalObject, deriveConsumerTarget } from "@/services/operationalObjectContext";
import { isTerminalOyiWorkflowStatus, normalizeOyiActiveWorkflow, oyiService, type OyiActiveWorkflow, type OyiThread, type OyiThreadMessage } from "@/services/oyiService";
import { resolveConsumerOyiTarget } from "@/services/oyiTargetRegistry";
import { actionResultView, confirmationProposal, emptyResponseText, latestAssistantMessage, normalizeOyiThreads, orbStateForView, OYI_WORKING_TEXT, OyiActionResult, OyiConfirmation, OyiOrb, useOyiConnectivity, useOyiInteraction, useOyiLayout, useOyiReducedMotion, voiceSnapshotEvents, type OyiVoiceAdapter, OyiShell, OyiComposer, OyiCaption, OyiSuggestions, OyiHistory, OyiNotice, normalizeOyiSuggestions, oyiHistoryView } from "oyi-interaction";
import "oyi-interaction/styles.css";
import "./oyi-reference.css";
import { createConsumerVoiceAdapter } from "@/oyi/consumerVoiceAdapter";
import { consumerMessageStateForAction, createConsumerSurfaceAdapter } from "@/oyi/consumerSurfaceAdapter";
import type { OyiTarget } from "@/services/oyiService";
import {
  operationalObjectFromActiveContext,
  clearPersistedActiveIntelligenceContext,
  readPersistedActiveIntelligenceContext,
  targetFromActiveContext,
  type ActiveIntelligenceContext,
  useActiveIntelligenceContextStore,
} from "@/store/useActiveIntelligenceContextStore";

type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  state?: "idle" | "preparing" | "informational" | "report_ready" | "recommendation" | "clarification_required" | "approval_required" | "executing" | "action_confirmed" | "action_failed" | "failed" | "denied" | "partial" | "unavailable";
  pending?: boolean;
  confirmations?: Array<Record<string, any>>;
  cards?: Array<Record<string, any>>;
  sources?: Array<Record<string, any>>;
  suggested_actions?: Array<Record<string, any>>;
  warnings?: string[];
  persistence_saved?: boolean;
  resolved_turn?: Record<string, any>;
  presentation_policy?: Record<string, any>;
  navigation_route?: string | null;
  intent?: string;
  understood?: string;
  execution?: Record<string, any>;
  display_mode?: "conversation" | "list" | "detail" | "audit" | "report" | "awareness";
  executionSummary?: string;
  executionHistory?: Array<Record<string, any>>;
  approvalRequired?: boolean;
  trustScore?: number | null;
  initiatorType?: string | null;
  approvedBy?: string | null;
};

function routeForOyiDestination(destination?: Record<string, any> | null) {
  const key = String(destination?.key || "");
  const params = destination?.parameters && typeof destination.parameters === "object" ? destination.parameters as Record<string, any> : {};
  const routes: Record<string, string> = {
    "devices.module": "/devices",
    "visitors.module": "/visitors",
    "wallet.summary": "/wallet",
    "maintenance.module": "/maintenance",
    "scenes.module": "/scenes",
    "automations.module": "/scenes?tab=automations",
    "services.module": "/services",
    "community.module": "/community",
    "messages.module": "/messages",
    "rooms.module": "/rooms",
    "rooms.detail": "/room",
    "devices.detail": "/devices",
    "devices.channel": "/devices",
    "visitors.detail": "/visitors",
    "maintenance.detail": "/maintenance",
    "wallet.transaction": "/wallet",
    "scenes.detail": "/scenes",
    "automations.detail": "/scenes?tab=automations",
  };
  const route = routes[key];
  if (!route) return null;
  const entries = Object.entries(params).filter(([, value]) => value !== null && value !== undefined && String(value).trim());
  if (!entries.length) return route;
  const separator = route.includes("?") ? "&" : "?";
  return `${route}${separator}${entries.map(([paramKey, value]) => `${encodeURIComponent(paramKey)}=${encodeURIComponent(String(value))}`).join("&")}`;
}

function navigationRouteFromResponse(resp: AiChatResponse) {
  const policy = resp.presentation_policy && typeof resp.presentation_policy === "object" ? resp.presentation_policy : {};
  if (!policy.auto_navigation) return null;
  const turnDestination = resp.resolved_turn?.destination && typeof resp.resolved_turn.destination === "object"
    ? routeForOyiDestination(resp.resolved_turn.destination as Record<string, any>)
    : null;
  if (turnDestination && /^navigate_/.test(String(resp.resolved_turn?.operation || ""))) return turnDestination;
  return null;
}

type Suggestion = { label: string; prompt?: string; href?: string; tone?: "blue" | "green" | "amber" | "violet" };
type VoiceMode = "idle" | "recording" | "conversation";
type VoiceStatus = "Listening" | "Working" | "Speaking" | "Done" | "Failed";
type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: AiMessage[];
  backendThreadId?: string | null;
  activeWorkflow?: OyiActiveWorkflow | null;
  preview?: string | null;
  messageCount?: number;
  scope?: string | null;
};
type ActiveConversationState = {
  threadId: string | null;
  status: "blank" | "loading_thread" | "active_thread" | "thread_error";
  source: "new" | "history" | "route" | "drawer";
  activeWorkflow?: OyiActiveWorkflow | null;
};
const SUPPORT_DISPLAY_MODES = new Set(["list", "detail", "audit", "report", "awareness"]);

function shouldRenderSupport(displayMode?: string) {
  return SUPPORT_DISPLAY_MODES.has(String(displayMode || "conversation"));
}


function contextualSuggestions(module: string, starter?: string | null): Suggestion[] {
  const first = starter ? [{ label: starter, prompt: starter, tone: "green" as const }] : [];
  if (module === "device") return [...first, { label: "Is this device working?", prompt: "Is this device working?", tone: "blue" }, { label: "What changed recently?", prompt: "What changed recently?", tone: "violet" }, { label: "Scenes or automations?", prompt: "Is it used by a scene or automation?", tone: "amber" }];
  if (module === "automations") return [...first, { label: "Why didn’t this run?", prompt: "Why didn’t this run?", tone: "amber" }, { label: "What happens next?", prompt: "What happens next?", tone: "blue" }, { label: "Show last run", prompt: "Show the last run.", tone: "green" }];
  if (module === "wallet") return [...first, { label: "Explain transaction", prompt: "Explain this transaction.", tone: "violet" }, { label: "Why did it fail?", prompt: "Why did it fail?", tone: "amber" }, { label: "Show receipt", prompt: "Show the receipt.", tone: "green" }];
  if (module === "maintenance") return [...first, { label: "What happened?", prompt: "What happened?", tone: "blue" }, { label: "Who owns this?", prompt: "Who owns this?", tone: "green" }, { label: "Is it overdue?", prompt: "Is it overdue?", tone: "amber" }];
  return first;
}

const USAGE_KEY = "oyi_ai_shortcut_usage_v1";
const CONVERSATIONS_KEY = "oyi_ai_conversations_v1";
const FEEDBACK_KEY = "oyi_ai_helpful_feedback_v1";

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isBroadHomeReadPrompt(message: string) {
  const lower = message.toLowerCase();
  if (/\b(this|selected|current)\b[\s\S]{0,20}\b(device|channel|switch|tv|remote|light|socket|plug)\b/i.test(lower)) return false;
  if (/\b(channel|gang|switch)\s*[123]\b/i.test(lower)) return false;
  if (/\b(show|list|which|what|check|find)\b[\s\S]{0,40}\b(offline|unavailable|down|failed)\b[\s\S]{0,30}\bdevices?\b/i.test(lower)) return true;
  if (/\bwhat(?:'s| is) happening\b[\s\S]{0,24}\b(home|house|apartment|unit)\b/i.test(lower)) return true;
  if (/\bwhat changed recently\b/i.test(lower)) return true;
  if (/\bwhat needs attention\b/i.test(lower)) return true;
  if (/\bis everything okay\b/i.test(lower)) return true;
  if (/\b(home|house|apartment|unit)\b[\s\S]{0,24}\b(report|summary|recent|changed|changes|offline|unavailable)\b/i.test(lower)) return true;
  return false;
}

function broadIntentHint(message: string) {
  const lower = message.toLowerCase();
  if (/offline|unavailable|down|failed/.test(lower) && /devices?/.test(lower)) return "device_availability_inventory";
  if (/what(?:'s| is) happening|needs attention/.test(lower) && /home|house|apartment|unit/.test(lower)) return "home_operational_summary";
  if (/changed|recent|activity|history/.test(lower)) return "recent_changes";
  if (/report|summary/.test(lower)) return "report";
  return "current_state";
}

function turnScopedAiContext(command: string, context: Record<string, any>) {
  if (!isBroadHomeReadPrompt(command)) return context;
  const conversationContext = { ...(context.conversation_context || {}) };
  return {
    ...context,
    module: context.module === "device" ? "dashboard" : context.module,
    room_id: null,
    device_id: null,
    operational_object: null,
    target: null,
    active_intelligence_context: null,
    intent_hint: broadIntentHint(command),
    operation_class_hint: "read",
    scope_mode_hint: "home_scope",
    page_launch_context: context.active_intelligence_context || null,
    selected_ui_object: null,
    current_turn_hints: {
      intent_hint: broadIntentHint(command),
      operation_class_hint: "read",
      scope_mode_hint: "home_scope",
      inherited_target_cleared: true,
    },
    authorised_scope: {
      estate_id: context.estate_id || null,
      home_id: context.home_id || null,
      surface: context.surface || "consumer",
    },
    conversation_context: {
      ...conversationContext,
      active_context: null,
      context_id: null,
      context_version: null,
      selected_subobject: null,
      visible_state: null,
      target_override_reason: "explicit_broad_home_read",
      intent_hint: broadIntentHint(command),
      operation_class_hint: "read",
      scope_mode_hint: "home_scope",
    },
  };
}

function activeWorkflowFromUnknown(value: unknown) {
  const workflow = normalizeOyiActiveWorkflow(value);
  if (!workflow || isTerminalOyiWorkflowStatus(workflow.status)) return null;
  return workflow;
}

function activeWorkflowFromThread(thread?: OyiThread | null) {
  const metadata = thread?.metadata && typeof thread.metadata === "object" ? thread.metadata as Record<string, any> : {};
  const conversationState = metadata.conversation_state && typeof metadata.conversation_state === "object" ? metadata.conversation_state as Record<string, any> : {};
  return activeWorkflowFromUnknown(thread?.active_workflow || metadata.active_workflow || conversationState.active_workflow || metadata.workflow);
}

function workflowFromChatResponse(resp: AiChatResponse) {
  const candidates: unknown[] = [
    resp.active_workflow,
    resp.execution?.workflow,
    resp.execution,
    ...(Array.isArray(resp.confirmations) ? resp.confirmations : []),
  ];
  for (const candidate of candidates) {
    const workflow = normalizeOyiActiveWorkflow(candidate);
    if (workflow) return workflow;
  }
  return null;
}

function isTerminalWorkflowIntent(command: string) {
  const lower = command.trim().toLowerCase();
  return /^(cancel|cancel it|never mind|don't do it|do not do it|no|nope)$/i.test(lower);
}

function replyFromResponse(resp: AiChatResponse) {
  const base = resp.message || resp.reply;
  return base || "";
}

function responseState(resp: AiChatResponse): AiMessage["state"] {
  const intent = String(resp.intent || "").toLowerCase();
  const operationClass = String((resp.context as any)?.request_contract?.operation_class || (resp.context as any)?.canonical_request_contract?.operation_class || "").toLowerCase();
  if (resp.confirmations?.length || resp.requiresConfirmation) return "approval_required";
  // Canonical action truth (execution.action) decides first: only a
  // verified ("confirmed") action is ever action_confirmed.
  const actionState = consumerMessageStateForAction(actionResultView(resp));
  if (actionState) return actionState;
  const results = Array.isArray(resp.execution?.results) ? resp.execution.results : [];
  if (results.some((result) => result?.status === "pending_confirmation")) return "approval_required";
  if (results.some((result) => result?.status === "denied")) return "denied";
  if (results.some((result) => result?.status === "failed")) return "action_failed";
  if ((resp.tools || []).some((tool) => tool.status === "denied")) return "denied";
  if ((resp.tools || []).some((tool) => tool.status === "failed")) return "action_failed";
  const executionStatus = String(resp.execution?.status || resp.execution?.final_status || "").toLowerCase();
  if (/failed|rejected|timed_out|mismatch/.test(executionStatus)) return "action_failed";
  if (/state_confirmed|action_confirmed/.test(executionStatus) && !/read_only/.test(executionStatus)) return "action_confirmed";
  // A legacy "executed" status means the command was dispatched, not that
  // the result was verified.
  if (/executed/.test(executionStatus)) return "partial";
  if (resp.display_mode === "report" || intent === "report") return "report_ready";
  if (/recommend/.test(intent)) return "recommendation";
  if (/clarification/.test(intent)) return "clarification_required";
  if (operationClass === "read" || operationClass === "report" || operationClass === "recommend" || executionStatus === "read_only") return "informational";
  return "informational";
}

function normalizedUiCopy(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function containsInternalConversationText(value: unknown) {
  return /\b(?:proximity\.(?:awareness\.checked|awareness_evaluated)|audit\.recorded|ai\.[a-z0-9_.-]+|oyi\.[a-z0-9_.-]+|tool\.(?:requested|executed)|response\.generated|command\.received)\b/i.test(String(value ?? ""));
}

function awarenessCards(resp: AiChatResponse) {
  if (!["list", "detail", "audit", "report", "awareness"].includes(String(resp.display_mode || "conversation"))) return [];
  const policy = (resp as any).presentation_policy && typeof (resp as any).presentation_policy === "object" ? (resp as any).presentation_policy : {};
  const suppressAwareness = Boolean(policy.suppress_equivalent_awareness) && String(policy.primary || "") === "table";
  const answerText = normalizedUiCopy(resp.message || resp.reply || "");
  const cards = (Array.isArray(resp.cards) ? resp.cards : []).filter((card) => {
    if (containsInternalConversationText(JSON.stringify(card))) return false;
    const cardText = normalizedUiCopy(`${card?.title || ""} ${card?.summary || ""}`);
    return !cardText || !answerText || cardText !== answerText;
  });
  const awareness = resp.awareness;
  if (suppressAwareness) return cards;
  if (!awareness?.headline) return cards;
  const awarenessText = normalizedUiCopy(`${awareness.headline || ""} ${awareness.summary || awareness.body || ""}`);
  if (awarenessText && answerText && (awarenessText === answerText || answerText.includes(awarenessText))) return cards;
  const primaryCard = {
    type: awareness.severity === "normal" ? "normal" : "attention",
    title: awareness.headline,
    summary: awareness.summary || awareness.body || awareness.recommended_action || "Oyi ranked this as the current home state.",
    items: awareness.recommended_action
      ? [{ title: "Recommended action", status: awareness.recommended_action }]
      : [],
    score: awareness.awareness_score ?? awareness.score,
  };
  const remaining = cards.filter((card) => String(card?.title || "") !== awareness.headline);
  return [primaryCard, ...remaining];
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(window.localStorage.getItem(key) || "") || fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function toTimestamp(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) && time > 0 ? time : Date.now();
}

function restoredExecution(row: OyiThreadMessage): Record<string, any> | undefined {
  const metadata = row.metadata || {};
  if (metadata.execution && typeof metadata.execution === "object") return metadata.execution as Record<string, any>;
  // Persistence stores the canonical action/workflow beside the message
  // rather than as an execution object; rebuild the same shape the live
  // response used so restored truth matches the live turn.
  if (row.role !== "user" && metadata.action && typeof metadata.action === "object" && Object.keys(metadata.action).length) {
    return { action: metadata.action, workflow: metadata.workflow && typeof metadata.workflow === "object" && Object.keys(metadata.workflow).length ? metadata.workflow : null };
  }
  return undefined;
}

function messageFromThread(row: OyiThreadMessage): AiMessage {
  const metadata = row.metadata || {};
  const execution = restoredExecution(row);
  const cards = (row.cards || []).filter((card) => !containsInternalConversationText(JSON.stringify(card)));
  const sources = (row.sources || []).filter((source) => !containsInternalConversationText(JSON.stringify(source)));
  return {
    id: row.id,
    role: row.role === "user" ? "user" : "assistant",
    content: row.content || "",
    state: row.role === "user" ? undefined : (consumerMessageStateForAction(actionResultView({ execution })) || (metadata.display_mode === "report" ? "report_ready" : "informational")),
    cards,
    sources,
    suggested_actions: row.suggested_actions || [],
    intent: typeof metadata.intent === "string" ? metadata.intent : undefined,
    understood: typeof metadata.understood === "string" ? metadata.understood : undefined,
    execution,
    display_mode: typeof metadata.display_mode === "string" ? metadata.display_mode as AiMessage["display_mode"] : "conversation",
    warnings: Array.isArray(metadata.warnings) ? metadata.warnings.map(String) : [],
    persistence_saved: typeof metadata.persistence_saved === "boolean" ? metadata.persistence_saved : undefined,
    resolved_turn: metadata.resolved_turn && typeof metadata.resolved_turn === "object" ? metadata.resolved_turn as Record<string, any> : undefined,
    presentation_policy: metadata.presentation_policy && typeof metadata.presentation_policy === "object" ? metadata.presentation_policy as Record<string, any> : undefined,
    navigation_route: metadata.resolved_turn && typeof metadata.resolved_turn === "object" && /^navigate_/.test(String((metadata.resolved_turn as Record<string, any>).operation || ""))
      ? routeForOyiDestination((metadata.resolved_turn as Record<string, any>).destination as Record<string, any>)
      : null,
  };
}

function formatSnapshotTime(timestamp: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "Time unavailable";
  const date = new Date(timestamp);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 24 * 60 * 60 * 1000;
  if (timestamp >= startToday) return `Today, ${time}`;
  if (timestamp >= startYesterday) return `Yesterday, ${time}`;
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return date.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function ConversationTable({ card }: { card: Record<string, any> }) {
  const columns = Array.isArray(card.columns) ? card.columns.filter((column) => column?.key && column?.label) : [];
  const rows = Array.isArray(card.rows) ? card.rows : [];
  const snapshot = card.snapshot && typeof card.snapshot === "object" ? card.snapshot : null;
  const snapshotLabel = snapshot?.snapshot_generated_at
    ? `Snapshot from ${formatSnapshotTime(Date.parse(String(snapshot.snapshot_generated_at)))}`
    : null;
  if (!columns.length || !rows.length) return null;
  return (
    <div className="mt-2 overflow-x-auto rounded-2xl border border-white/[0.06]">
      {card.title || snapshotLabel ? (
        <div className="border-b border-white/[0.06] bg-white/[0.035] px-3 py-2">
          {card.title ? <div className="text-xs font-semibold text-white/70">{card.title}</div> : null}
          {snapshotLabel ? <div className="mt-0.5 text-[10px] text-white/38">{snapshotLabel}</div> : null}
        </div>
      ) : null}
      <table className="min-w-full border-separate border-spacing-0 text-left text-[11px] leading-4">
        <thead className="bg-white/[0.045] text-white/45">
          <tr>
            {columns.map((column: any) => (
              <th key={String(column.key)} className="whitespace-nowrap px-3 py-2 font-medium">{String(column.label)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((row: any, rowIndex: number) => (
            <tr key={row.event_id || row.device_id || rowIndex} className="border-t border-white/[0.05]">
              {columns.map((column: any) => (
                <td key={`${rowIndex}-${String(column.key)}`} className="max-w-[220px] border-t border-white/[0.045] px-3 py-2 align-top text-white/68">
                  <span className="break-words">{row?.[column.key] === null || row?.[column.key] === undefined || row?.[column.key] === "" ? "—" : String(row[column.key])}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StructuredCards({ cards, onTarget }: { cards?: Array<Record<string, any>>; onTarget: (target: OyiTarget | null | undefined) => boolean }) {
  const visibleCards = (cards || []).filter((card) => !["capability", "capability_registry"].includes(String(card?.type || "")));
  if (!visibleCards.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {visibleCards.slice(0, 3).map((card, index) => {
        const items = Array.isArray(card.items) ? card.items : [];
        const isTable = String(card.type || "") === "table";
        return (
          <div key={`${card.type || card.title || "card"}-${index}`} className={isTable ? "min-w-0 w-full" : "rounded-[18px] border border-white/[0.07] bg-black/18 p-3"}>
            {!isTable ? <div className="text-[11px] uppercase tracking-[0.16em] text-sky-100/46">{card.type ? String(card.type).replace(/_/g, " ") : "Summary"}</div> : null}
            {!isTable ? <div className="mt-1 text-[13px] font-semibold text-white/90">{card.title || "Home update"}</div> : null}
            {!isTable && card.summary ? <div className="mt-1 text-xs leading-5 text-white/52">{String(card.summary)}</div> : null}
            {isTable ? <ConversationTable card={card} /> : null}
            {!isTable && items.length ? (
              <div className="mt-2 grid gap-1.5">
                {items.slice(0, 6).map((item: any, itemIndex: number) => (
                  <button key={itemIndex} type="button" onClick={() => onTarget(item.target || card.target)} className="flex w-full items-start justify-between gap-3 rounded-xl bg-white/[0.035] px-2.5 py-2 text-left text-xs">
                    <span className="min-w-0 break-words text-white/58">{item.title || item.label || item.subtitle || "Item"}</span>
                    <span className="max-w-[48%] shrink-0 break-words text-right text-white/82">{item.value !== undefined ? String(item.value) : item.status || item.subtitle || ""}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function OperatingStatus({ execution }: { intent?: string; understood?: string; execution?: Record<string, any> }) {
  // The canonical action card owns action truth when it is present.
  if (actionResultView({ execution })) return null;
  const results = Array.isArray(execution?.results) ? execution.results : [];
  const first = results[0] || {};
  const rawStatus = String(first.status || "").replace(/_/g, " ");
  if (!rawStatus) return null;
  const status = /denied/.test(rawStatus)
    ? "Action not available"
    : /failed|error/.test(rawStatus)
      ? "Action could not be completed"
      : /confirmation|pending/.test(rawStatus)
        ? "Confirmation needed"
        : /executed|success/.test(rawStatus)
          ? "Command sent · not verified"
          : "Action update";
  const tone =
    /denied|failed|error/.test(status)
      ? "border-rose-300/15 bg-rose-400/[0.055] text-rose-50/80"
      : /confirmation|pending/.test(status)
        ? "border-amber-300/16 bg-amber-400/[0.06] text-amber-50/82"
        : "border-sky-300/14 bg-sky-400/[0.055] text-sky-50/82";
  return (
    <div className={`mt-3 rounded-[18px] border p-3 ${tone}`}>
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] opacity-75">
        {status}
      </div>
      {first.summary || first.error ? <div className="mt-1 text-xs leading-5 opacity-90">{String(first.summary || first.error)}</div> : null}
    </div>
  );
}

function terminalActionStatus(status: string) {
  return /confirmed|failed|cancelled|unobservable|timed_out|provider_rejected|superseded/.test(status);
}

function ReviewCard({ workflow }: { workflow?: Record<string, any> | null }) {
  if (!workflow || typeof workflow !== "object") return null;
  const status = String(workflow.status || "");
  if (!["collecting_inputs", "ready_for_review", "awaiting_approval"].includes(status)) return null;
  const proposed = workflow.proposed_action && typeof workflow.proposed_action === "object" ? workflow.proposed_action as Record<string, any> : {};
  const target = workflow.target && typeof workflow.target === "object" ? workflow.target as Record<string, any> : {};
  const unresolved = Array.isArray(workflow.unresolved_inputs) ? workflow.unresolved_inputs : [];
  return (
    <div className="mt-3 rounded-[20px] border border-cyan-200/12 bg-cyan-300/[0.055] p-3.5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/58">Review</div>
      <div className="mt-1.5 text-sm font-semibold text-white">{target.label || workflow.capability_key || "Review this request"}</div>
      {proposed.command || proposed.desired_state !== undefined ? (
        <div className="mt-2 text-xs leading-5 text-white/60">
          {proposed.command ? <div>Action: {String(proposed.command).replace(/_/g, " ")}</div> : null}
          {proposed.desired_state !== undefined ? <div>Requested result: {String(proposed.desired_state)}</div> : null}
        </div>
      ) : null}
      {unresolved.length ? <div className="mt-2 text-xs leading-5 text-cyan-50/68">Oyi still needs: {unresolved.map((item) => String(item).replace(/_/g, " ")).join(", ")}.</div> : null}
    </div>
  );
}

function ActionLifecycleCard({ execution, hasConfirmationPrompt = false }: { execution?: Record<string, any>; hasConfirmationPrompt?: boolean }) {
  // Canonical action truth (execution.action) through the shared
  // interaction foundation: only "confirmed" is verified.
  const truthView = actionResultView({ execution });
  // A pending approval is presented once, by the ConfirmationCard.
  if (truthView?.awaiting_user && hasConfirmationPrompt) return null;
  if (truthView) return <div className="mt-3"><OyiActionResult view={truthView} showTerminalNote /></div>;
  const action = execution?.action && typeof execution.action === "object" ? execution.action as Record<string, any> : null;
  const workflow = execution?.workflow && typeof execution.workflow === "object" ? execution.workflow as Record<string, any> : null;
  if (!action && !workflow) return null;
  const operation = String(action?.requested_operation || workflow?.operation || "");
  const hasActionLifecycle = Boolean(
    action ||
      workflow?.proposed_action ||
      Array.isArray(workflow?.unresolved_inputs) && workflow.unresolved_inputs.length > 0 ||
      ["propose_mutation", "approve", "execute", "execute_mutation"].includes(operation),
  );
  if (!hasActionLifecycle) return null;
  const status = String(action?.status || workflow?.status || "");
  const target = action?.target && typeof action.target === "object" ? action.target as Record<string, any> : workflow?.target && typeof workflow.target === "object" ? workflow.target as Record<string, any> : {};
  const terminal = terminalActionStatus(status);
  const verified = status === "confirmed";
  const tone = terminal
    ? /failed|rejected|timed_out/.test(status)
      ? "border-rose-300/16 bg-rose-400/[0.06] text-rose-50/82"
      : verified
        ? "border-emerald-300/16 bg-emerald-400/[0.06] text-emerald-50/82"
        : "border-white/[0.08] bg-white/[0.035] text-white/70"
    : "border-amber-300/16 bg-amber-400/[0.06] text-amber-50/82";
  return (
    <div className={`mt-3 rounded-[20px] border p-3.5 ${tone}`} data-terminal-action={terminal ? "true" : "false"}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] opacity-70">{terminal ? (verified ? "Verified" : "Action ended · not verified") : "Action pending"}</div>
          <div className="mt-1 text-sm font-semibold text-white/90">{target.label || action?.requested_operation || workflow?.capability_key || "Oyi action"}</div>
        </div>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.08]">
          {terminal && /failed|rejected|timed_out/.test(status) ? <X className="h-4 w-4" /> : terminal && verified ? <Check className="h-4 w-4" /> : terminal ? <CircleDashed className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
        </div>
      </div>
      <div className="mt-2 text-xs leading-5 opacity-82">Status: {status ? status.replace(/_/g, " ") : "waiting"}</div>
      {terminal ? <div className="mt-2 text-[11px] leading-5 opacity-70">This historical action is terminal. Confirm and Cancel controls are not reusable.</div> : null}
    </div>
  );
}

function ExecutionAccountability({
  executionSummary,
  executionHistory,
  approvalRequired,
  trustScore,
  initiatorType,
  approvedBy,
}: {
  executionSummary?: string;
  executionHistory?: Array<Record<string, any>>;
  approvalRequired?: boolean;
  trustScore?: number | null;
  initiatorType?: string | null;
  approvedBy?: string | null;
}) {
  const latest = Array.isArray(executionHistory) ? executionHistory[0] : null;
  const rows = [
    executionSummary,
    latest?.origin ? `Origin: ${latest.origin}` : null,
    initiatorType || latest?.initiatorType ? `Initiator: ${initiatorType || latest?.initiatorType}` : null,
    approvalRequired ? `Approval: ${approvedBy ? `approved by ${approvedBy}` : "required"}` : approvedBy ? `Approval: approved by ${approvedBy}` : null,
    typeof trustScore === "number" ? `Trust score ${Math.round(trustScore * 100)}%` : null,
  ].filter(Boolean);
  if (!rows.length) return null;
  return (
    <div className="mt-3 rounded-[18px] border border-white/[0.07] bg-white/[0.035] p-3 text-xs leading-5 text-white/58">
      {rows.slice(0, 4).map((row) => <div key={String(row)}>{String(row)}</div>)}
    </div>
  );
}

function SourceLabels({ sources }: { sources?: Array<Record<string, any>> }) {
  const visibleSources = (sources || []).filter((source) => !/ai_tool|execution_ledger|capability registry/i.test(String(source?.label || source?.table || "")) && !containsInternalConversationText(JSON.stringify(source)));
  if (!visibleSources.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {visibleSources.slice(0, 3).map((source, index) => (
        <span key={`${source.label || "source"}-${index}`} className="rounded-full border border-white/[0.06] bg-white/[0.035] px-2 py-1 text-[10px] text-white/38">
          {source.label || "Source"}
        </span>
      ))}
    </div>
  );
}

function isNavigationSuggestion(action: Record<string, any>) {
  return action?.type === "navigation" || action?.type === "open_module" || action?.operation_class === "navigate";
}

function SuggestedActions({ actions, onOpen, onTarget }: { actions?: Array<Record<string, any>>; onOpen: (route: string) => void; onTarget: (target: OyiTarget | null | undefined) => boolean }) {
  const rows = (actions || []).filter((action) => action?.label && (action?.route || (action?.target && action.target.target_type !== "none")));
  if (!rows.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {rows.slice(0, 4).map((action, index) => {
        const navigation = isNavigationSuggestion(action);
        return (
        <button
          key={`${action.route || action.label}-${index}`}
          type="button"
          data-action-kind={navigation ? "navigation" : "contextual"}
          onClick={() => { if (!onTarget(action.target) && action.route) onOpen(String(action.route)); }}
          className={navigation
            ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200/16 bg-emerald-300/[0.075] px-3 py-1.5 text-[11px] font-semibold text-emerald-50/88 transition active:scale-95"
            : "rounded-full border border-sky-200/15 bg-sky-400/[0.07] px-3 py-1.5 text-[11px] font-medium text-sky-100/84 transition active:scale-95"}
        >
          <span>{action.label}</span>
          {navigation ? <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-50/42">open</span> : null}
        </button>
      );})}
    </div>
  );
}

function NavigationTransition({ route, onStay, onContinue }: { route?: string | null; onStay: () => void; onContinue: (route: string) => void }) {
  if (!route) return null;
  return (
    <div className="mt-3 rounded-[20px] border border-emerald-200/14 bg-emerald-300/[0.07] p-3">
      <div className="text-xs font-semibold text-emerald-50/86">Opening another workspace…</div>
      <div className="mt-1 text-[11px] leading-5 text-emerald-50/58">Your conversation will remain available here.</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onStay} className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/70 transition active:scale-95">Stay in chat</button>
        <button type="button" onClick={() => onContinue(route)} className="rounded-full bg-emerald-200 px-3 py-1.5 text-[11px] font-semibold text-emerald-950 transition active:scale-95">Continue</button>
      </div>
    </div>
  );
}

function ConfirmationCard({ confirmation, onDecision, disabled }: { confirmation: Record<string, any>; onDecision: (confirmation: Record<string, any>, decision: "confirm" | "cancel") => void; disabled: boolean }) {
  const referenceId = String(confirmation?.workflow_id || confirmation?.action_id || confirmation?.ledger_id || confirmation?.id || confirmation?.command_id || "");
  // Shared proposal primitive: approval, never verification.
  const { proposal, targetLabel } = confirmationProposal(confirmation);
  return (
    <div className="mt-3">
      <OyiConfirmation proposal={proposal} targetLabel={targetLabel} disabled={disabled || !referenceId} onConfirm={() => onDecision(confirmation, "confirm")} onCancel={() => onDecision(confirmation, "cancel")} />
    </div>
  );
}

function OyiAiCommandCenterContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth() as any;
  const activeContext = useActiveContext();
  const clearActiveIntelligenceContext = useActiveIntelligenceContextStore((state) => state.clearContext);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState(createId);
  const [backendThreadId, setBackendThreadId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<ActiveConversationState>({ threadId: null, status: "blank", source: "new" });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyReload, setHistoryReload] = useState(0);
  const layout = useOyiLayout();
  const reducedMotion = useOyiReducedMotion();
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [restoringThreadId, setRestoringThreadId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("idle");
  const [, setVoiceStatus] = useState<VoiceStatus>("Listening");
  // Shared Oyi interaction state: local facts (voice, connectivity, turn in
  // flight) + canonical truth of the current turn. The orb renders it.
  const [interaction, dispatchInteraction] = useOyiInteraction();
  useOyiConnectivity(dispatchInteraction);
  const [voiceError, setVoiceError] = useState("");
  const [helpfulResponses, setHelpfulResponses] = useState<Record<string, boolean>>({});
  const [transcript, setTranscript] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const voiceAdapterRef = useRef<OyiVoiceAdapter | null>(null);
  const voiceDraftRef = useRef("");
  const voiceFinishIntentRef = useRef<"review" | "send" | null>(null);
  const voiceSubmitRef = useRef<(text: string) => void>(() => undefined);
  const [voiceStopping, setVoiceStopping] = useState(false);
  const [voiceStarting, setVoiceStarting] = useState(false);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioMeterEpoch = useRef(0);
  const meterRafRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const routeThreadRestoreRef = useRef<string | null>(null);
  const restoreSequenceRef = useRef(0);
  const cancelledNavigationRef = useRef<Set<string>>(new Set());
  const [audioLevels, setAudioLevels] = useState<number[]>([]);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);
  const moduleContext = searchParams.get("module") || "ai";
  const [registeredContext, setRegisteredContext] = useState<ActiveIntelligenceContext | null>(() => readPersistedActiveIntelligenceContext());

  useEffect(() => {
    const context = readPersistedActiveIntelligenceContext();
    const expectedRef = searchParams.get("contextRef");
    if (context && (!expectedRef || context.context_id === expectedRef)) setRegisteredContext(context);
    else setRegisteredContext(null);
  }, [searchParams]);

  const latestRegisteredContext = useCallback(() => {
    const persisted = readPersistedActiveIntelligenceContext();
    const expectedRef = searchParams.get("contextRef");
    if (persisted && (!expectedRef || persisted.context_id === expectedRef)) return persisted;
    return registeredContext;
  }, [registeredContext, searchParams]);

  function openTarget(target: OyiTarget | null | undefined) {
    const result = resolveConsumerOyiTarget(target, router, { homeId: activeContext.home_id || (user as any)?.home_id || null });
    if (!result.handled && result.error) setTargetError(result.error);
    return result.handled;
  }

  const setThreadRoute = useCallback((threadId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (threadId) params.set("threadId", threadId);
    else {
      params.delete("threadId");
      params.delete("contextRef");
      params.delete("deviceId");
      params.delete("roomId");
      params.delete("channel");
      params.delete("prompt");
    }
    const next = params.toString();
    router.replace(next ? `${pathname || "/ai"}?${next}` : pathname || "/ai", { scroll: false });
  }, [pathname, router, searchParams]);

  const context = useMemo(
    () => {
      const routeContext = {
        module: moduleContext,
        pathname: pathname || "/ai",
        estate_id: activeContext.estate_id || (user as any)?.estate_id || null,
        home_id: activeContext.home_id || (user as any)?.home_id || null,
        searchParams,
      };
      const currentRegisteredContext = latestRegisteredContext();
      const registeredObject = operationalObjectFromActiveContext(currentRegisteredContext);
      const registeredTarget = targetFromActiveContext(currentRegisteredContext);
      const selectedUiObject = currentRegisteredContext?.selected_subobject || currentRegisteredContext?.primary_object || null;
      return {
        surface: "consumer",
        scope: "home",
        module: currentRegisteredContext?.module || moduleContext,
        route: pathname || "/ai",
        page: pathname || "/ai",
        estate_id: routeContext.estate_id,
        home_id: routeContext.home_id,
        room_id: currentRegisteredContext?.scope.room_id || searchParams.get("roomId") || null,
        device_id: currentRegisteredContext?.primary_object?.object_type === "device" ? currentRegisteredContext.primary_object.canonical_id : searchParams.get("deviceId") || null,
        visitor_id: searchParams.get("visitorId") || null,
        wallet_reference: searchParams.get("transactionId") || null,
        maintenance_id: searchParams.get("ticketId") || null,
        notification_id: searchParams.get("notificationId") || null,
        conversation_id: searchParams.get("threadId") || null,
        operational_object: registeredObject || deriveConsumerOperationalObject(routeContext),
        target: registeredTarget || deriveConsumerTarget(routeContext),
        active_intelligence_context: currentRegisteredContext,
        page_launch_context: currentRegisteredContext,
        selected_ui_object: selectedUiObject,
        current_turn_hints: null,
        authorised_scope: {
          estate_id: routeContext.estate_id,
          home_id: routeContext.home_id,
          surface: "consumer",
        },
        conversation_context: {
          active_context: currentRegisteredContext,
          context_id: currentRegisteredContext?.context_id || null,
          context_version: currentRegisteredContext?.context_version || null,
          selected_subobject: currentRegisteredContext?.selected_subobject || null,
          visible_state: currentRegisteredContext?.visible_state || null,
        },
      };
    },
    [activeContext.estate_id, activeContext.home_id, latestRegisteredContext, moduleContext, pathname, searchParams, user],
  );

  // Consumer surface adapter: context, permission-filtered navigation,
  // starter seeds, operational object, history policy. No authority.
  const surfaceAdapter = useMemo(() => createConsumerSurfaceAdapter({
    user: user as any,
    estateId: context.estate_id,
    homeId: context.home_id,
    homeLabel: activeContext.home?.name || null,
    operationalObject: (context.operational_object as Record<string, unknown> | null) || null,
    voiceEntry: true,
  }), [activeContext.home?.name, context.estate_id, context.home_id, context.operational_object, user]);

  const suggestions = useMemo(() => {
    const seeds = surfaceAdapter.starterSeeds() as Suggestion[];
    const byLabel = new Map(seeds.map((item) => [item.label, item]));
    const ranked = Object.entries(usage)
      .sort((a, b) => b[1] - a[1])
      .map(([label]) => byLabel.get(label))
      .filter(Boolean) as Suggestion[];
    const contextual = contextualSuggestions(moduleContext, searchParams.get("starter"));
    const filled = [...contextual, ...ranked, ...seeds.filter((item) => !ranked.some((rankedItem) => rankedItem.label === item.label) && !contextual.some((ctx) => ctx.label === item.label))];
    return filled.slice(0, 5);
  }, [moduleContext, searchParams, surfaceAdapter, usage]);

  const chatMode = messages.length > 0;
  const canonicalActiveThreadId = activeConversation.threadId || backendThreadId || searchParams.get("threadId");
  const recording = voiceMode === "recording";
  const orbState = orbStateForView(interaction);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    messages.filter((message) => message.role === "assistant" && !message.pending).forEach((message) => {
      const support = shouldRenderSupport(message.display_mode);
      console.debug("[oyi-chat-render]", {
        display_mode: message.display_mode || "conversation",
        cards_rendered: support && Boolean(message.cards?.length),
        support_panels_rendered: support,
      });
    });
  }, [messages]);

  useEffect(() => {
    setUsage(loadJson<Record<string, number>>(USAGE_KEY, {}));
    setHelpfulResponses(loadJson<Record<string, boolean>>(FEEDBACK_KEY, {}));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadConversations() {
      setHistoryLoading(true);
      setHistoryError(null);
      const localFallback = loadJson<Conversation[]>(CONVERSATIONS_KEY, []);
      if (!(user as any)?.id) {
        setConversations(localFallback);
        setHistoryLoading(false);
        return;
      }
      try {
        const res = await oyiService.listThreads({
          surface: "consumer",
          estate_id: context.estate_id,
          home_id: context.home_id,
          limit: 24,
        });
        if (cancelled) return;
        // Shape canonical GET /oyi/threads rows through the shared history
        // normalizer (dedupe, ordering, safe titles) before presentation.
        const normalized = new Set(normalizeOyiThreads(res.threads || []).map((thread) => thread.id));
        const rows = (res.threads || []).filter((thread) => normalized.has(String(thread.id)));
        setConversations(rows.map((thread) => ({
          id: `backend:${thread.id}`,
          backendThreadId: thread.id,
          title: thread.title || "Oyi conversation",
          preview: thread.preview || null,
          messageCount: thread.message_count || 0,
          scope: thread.last_scope || null,
          updatedAt: toTimestamp(thread.updated_at || thread.created_at),
          messages: [],
        })));
      } catch {
        if (!cancelled) {
          setConversations(localFallback);
          setHistoryError("Saved history is unavailable. Any conversations shown below are cached on this device.");
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }
    void loadConversations();
    return () => { cancelled = true; };
  }, [user, context.estate_id, context.home_id, historyReload]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prompt = new URLSearchParams(window.location.search).get("prompt") || "";
    if (prompt.trim()) void handleSend(prompt.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, reducedMotion]);

  useEffect(() => {
    // Use the latest committed conversation/scope, without restarting capture.
    voiceSubmitRef.current = (text) => {
      if (!navigator.onLine || busy || restoringThreadId) {
        setVoiceError("Your voice draft is ready, but could not be sent. Review it and retry when connected.");
        return;
      }
      void handleSend(text);
    };
  });

  useEffect(() => {
    const adapter = createConsumerVoiceAdapter(window);
    voiceAdapterRef.current = adapter;
    setVoiceAvailable(adapter.getSnapshot().available);
    let previous = adapter.getSnapshot();
    const unsubscribe = adapter.subscribe((next) => {
      for (const event of voiceSnapshotEvents(previous, next)) dispatchInteraction(event);
      const starting = next.permissionState === "prompt" && next.status === "idle";
      setVoiceStarting(starting);
      setVoiceStopping(next.status === "transcribing");
      setVoiceMode(starting || next.status === "listening" || next.status === "transcribing" ? "recording" : "idle");
      setTranscript(next.interimTranscript || next.finalTranscript);
      setVoiceError(next.error || "");
      if (next.status === "listening" && previous.status !== "listening") { startTimer(); void startAudioMeter(); }
      if (next.status !== "listening") {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        stopAudioMeter();
      }
      if (next.status === "idle" && next.finalTranscript && (previous.status === "listening" || previous.status === "transcribing")) {
        const text = [voiceDraftRef.current, next.finalTranscript].filter(Boolean).join(voiceDraftRef.current && !/\s$/.test(voiceDraftRef.current) ? " " : "");
        const shouldSend = voiceFinishIntentRef.current === "send";
        voiceFinishIntentRef.current = null;
        setInput(text);
        if (shouldSend) voiceSubmitRef.current(text);
      } else if (next.status === "error") {
        voiceFinishIntentRef.current = null;
        // Recover recognized words for manual review, not automatic submission.
        if (next.finalTranscript || next.interimTranscript) setInput([voiceDraftRef.current, next.finalTranscript, next.interimTranscript].filter(Boolean).join(" "));
      }
      previous = next;
    });
    return () => { unsubscribe(); voiceFinishIntentRef.current = null; adapter.cancelListening(); voiceAdapterRef.current = null; if (timerRef.current) window.clearInterval(timerRef.current); stopAudioMeter(); };
    // Meter/timer helpers read only stable refs/setters. Resubscribing per render
    // would cancel a recording when an interim transcript updates the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatchInteraction]);

  function persistConversation(nextMessages: AiMessage[], threadId = backendThreadId, activeWorkflow = activeConversation.activeWorkflow || null) {
    const firstUser = nextMessages.find((item) => item.role === "user")?.content || "Oyi conversation";
    const latestMessage = nextMessages[nextMessages.length - 1];
    const item: Conversation = { id: threadId ? `backend:${threadId}` : conversationId, backendThreadId: threadId || undefined, activeWorkflow, title: firstUser.slice(0, 84), updatedAt: Date.now(), messages: nextMessages, preview: latestMessage?.content || firstUser, messageCount: nextMessages.length };
    setConversations((current) => {
      const next = [item, ...current.filter((entry) => entry.id !== item.id && entry.id !== conversationId)].slice(0, 24);
      if (!(user as any)?.id || !threadId) saveJson(CONVERSATIONS_KEY, next);
      return next;
    });
  }

  function remember(label?: string) {
    if (!label) return;
    setUsage((current) => {
      const next = { ...current, [label]: (current[label] || 0) + 1 };
      saveJson(USAGE_KEY, next);
      return next;
    });
  }

  async function handleSend(text?: string, options?: { usageLabel?: string; fromVoice?: boolean; workflowOverride?: OyiActiveWorkflow | null; threadIdOverride?: string | null }) {
    const command = (text ?? input).trim();
    if (!command || busy) return;

    const pendingId = createId();
    const userMessage: AiMessage = { id: createId(), role: "user", content: command };
    const pendingMessage: AiMessage = { id: pendingId, role: "assistant", content: OYI_WORKING_TEXT, state: "executing", pending: true };
    const baseMessages = [...messages, userMessage, pendingMessage];

    const turnId = pendingId;
    dispatchInteraction({ type: "turn.submitted", turnId });
    setBusy(true);
    setInput("");
    setTranscript("");
    if (options?.fromVoice) setVoiceStatus("Working");
    setMessages(baseMessages);

    try {
      const turnContext = turnScopedAiContext(command, context as Record<string, any>);
      const workflowForTurn = activeWorkflowFromUnknown(options?.workflowOverride || activeConversation.activeWorkflow);
      const turnThreadId = options?.threadIdOverride || canonicalActiveThreadId || undefined;
      const conversationContext = workflowForTurn
        ? { ...(turnContext.conversation_context || {}), active_workflow: workflowForTurn }
        : turnContext.conversation_context;
      const resp = await aiService.chat(command, {
        ...turnContext,
        thread_id: turnThreadId,
        workflow_id: workflowForTurn?.workflow_id || undefined,
        active_workflow: workflowForTurn || undefined,
        conversation_context: conversationContext,
      });
      const nextThreadId = resp.thread_id || turnThreadId || null;
      const responseWorkflow = workflowFromChatResponse(resp);
      const nextActiveWorkflow = responseWorkflow && !isTerminalOyiWorkflowStatus(responseWorkflow.status)
        ? responseWorkflow
        : responseWorkflow || isTerminalWorkflowIntent(command)
          ? null
          : workflowForTurn;
      if (nextThreadId) {
        setBackendThreadId(nextThreadId);
        setActiveConversation({ threadId: nextThreadId, status: "active_thread", source: activeConversation.status === "blank" ? "new" : activeConversation.source, activeWorkflow: nextActiveWorkflow });
        setConversationId(`backend:${nextThreadId}`);
        setThreadRoute(nextThreadId);
      }
      dispatchInteraction({ type: "turn.response", turnId, response: resp });
      const content = replyFromResponse(resp) || emptyResponseText(resp);
      const state = responseState(resp);
      if (["informational", "report_ready", "recommendation", "action_confirmed"].includes(String(state))) remember(options?.usageLabel || command);
      const navigationRoute = navigationRouteFromResponse(resp);
      const nextMessages = baseMessages.map((item) => item.id === pendingId ? { ...item, pending: false, content, state, confirmations: resp.confirmations || [], cards: awarenessCards(resp), sources: resp.sources || [], suggested_actions: resp.suggested_actions || [], warnings: resp.warnings || [], persistence_saved: resp.persistence_saved, resolved_turn: resp.resolved_turn, presentation_policy: resp.presentation_policy, navigation_route: navigationRoute, intent: resp.intent, understood: resp.understood, execution: resp.execution, display_mode: resp.display_mode || "conversation", executionSummary: resp.executionSummary, executionHistory: resp.executionHistory, approvalRequired: resp.approvalRequired, trustScore: resp.trustScore, initiatorType: resp.initiatorType, approvedBy: resp.approvedBy } : item);
      setMessages(nextMessages);
      persistConversation(nextMessages, nextThreadId || undefined, nextActiveWorkflow);
      if (navigationRoute && !resp.approvalRequired && !resp.requiresConfirmation) {
        window.setTimeout(() => {
          if (!cancelledNavigationRef.current.has(pendingId)) router.push(navigationRoute);
        }, 1400);
      }
      let speaking = false;
      if (options?.fromVoice) {
        setVoiceStatus(state === "failed" || state === "action_failed" || state === "denied" ? "Failed" : "Speaking");
        if (state !== "failed" && state !== "action_failed" && state !== "denied") speaking = speakResponse(content, true, () => dispatchInteraction({ type: "turn.presented", turnId }));
      }
      // Responding lasts only while the reply is actually being spoken.
      if (!speaking) dispatchInteraction({ type: "turn.presented", turnId });
    } catch {
      dispatchInteraction({ type: "turn.failed", turnId, reason: typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "network" });
      const nextMessages = baseMessages.map((item) => item.id === pendingId ? { ...item, pending: false, state: "failed" as const, content: "Oyi could not respond right now." } : item);
      setMessages(nextMessages);
      persistConversation(nextMessages);
      if (options?.fromVoice) setVoiceStatus("Failed");
    } finally {
      setBusy(false);
      if (options?.fromVoice) window.setTimeout(() => setVoiceMode("idle"), 900);
    }
  }

  async function copyResponse(text: string) {
    if (!text || typeof navigator === "undefined") return;
    await navigator.clipboard?.writeText(text);
  }

  function speakResponse(text: string, fromVoiceConversation = false, onDone?: () => void) {
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.96;
    if (fromVoiceConversation) {
      utterance.onend = () => { setVoiceStatus("Done"); onDone?.(); };
      utterance.onerror = () => { setVoiceStatus("Done"); onDone?.(); };
    }
    window.speechSynthesis.speak(utterance);
    return true;
  }

  function markHelpful(message: AiMessage) {
    setHelpfulResponses((current) => {
      const next = { ...current, [message.id]: !current[message.id] };
      saveJson(FEEDBACK_KEY, next);
      return next;
    });
  }

  function submitSuggestion(item: Suggestion) {
    remember(item.label);
    if (item.href) {
      router.push(item.href);
      return;
    }
    void handleSend(item.prompt || item.label, { usageLabel: item.label });
  }

  function startTimer() {
    setRecordingSeconds(0);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
  }

  function stopAudioMeter() {
    audioMeterEpoch.current += 1;
    if (meterRafRef.current) window.cancelAnimationFrame(meterRafRef.current);
    meterRafRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    void audioContextRef.current?.close?.().catch(() => undefined);
    audioContextRef.current = null;
  }

  async function startAudioMeter() {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    const epoch = ++audioMeterEpoch.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (epoch !== audioMeterEpoch.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      mediaStreamRef.current = stream;
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) { stopAudioMeter(); return; }
      const ctx = new Ctx();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) {
          const centered = (value - 128) / 128;
          sum += centered * centered;
        }
        const rms = Math.min(1, Math.sqrt(sum / data.length) * 4);
        setAudioLevels((current) => [...current.slice(-27), rms]);
        meterRafRef.current = window.requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Speech recognition may still work even when amplitude metering is unavailable.
    }
  }

  function stopVoiceCapture() {
    voiceFinishIntentRef.current = null;
    voiceAdapterRef.current?.cancelListening();
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    stopAudioMeter();
  }

  function stopRecordingForReview() {
    finishVoiceCapture("review");
  }

  function finishVoiceCapture(intent: "review" | "send") {
    const adapter = voiceAdapterRef.current;
    // Synchronous first-wins latch also covers rapid clicks before React renders.
    if (!adapter || adapter.getSnapshot().status !== "listening" || voiceFinishIntentRef.current) return;
    voiceFinishIntentRef.current = intent;
    void adapter.stopListening();
  }

  function startVoiceCapture() {
    if (busy || typeof window === "undefined" || recording) return;
    voiceDraftRef.current = input;
    voiceFinishIntentRef.current = null;
    setRecordingSeconds(0);
    setAudioLevels([]);
    void voiceAdapterRef.current?.startListening();
  }

  async function decideConfirmation(confirmation: Record<string, any>, decision: "confirm" | "cancel") {
    if (busy) return;
    const workflow = activeWorkflowFromUnknown(confirmation) || activeWorkflowFromUnknown(activeConversation.activeWorkflow);
    const workflowId = workflow?.workflow_id || String(confirmation?.workflow_id || "").trim();
    if (workflowId) {
      const nextWorkflow = workflow || {
        workflow_id: workflowId,
        action_id: confirmation?.action_id || confirmation?.id || null,
        status: "awaiting_confirmation",
        capability_key: confirmation?.capability_key || null,
      };
      await handleSend(decision === "confirm" ? "Confirm" : "Cancel", {
        usageLabel: decision === "confirm" ? "Confirm action" : "Cancel action",
        workflowOverride: nextWorkflow,
        threadIdOverride: canonicalActiveThreadId || undefined,
      });
      return;
    }

    const ledgerId = String(confirmation?.ledger_id || confirmation?.id || confirmation?.command_id || "").trim();
    if (!ledgerId) return;
    const pendingId = createId();
    const pendingMessage: AiMessage = { id: pendingId, role: "assistant", content: decision === "confirm" ? "Sending your approval…" : "Cancelling…", state: "executing", pending: true };
    const baseMessages = [...messages, pendingMessage];
    setBusy(true);
    setMessages(baseMessages);
    try {
      const result = decision === "confirm" ? await aiService.confirm(ledgerId) : await aiService.cancel(ledgerId);
      // The legacy confirmation ledger reports dispatch (execution_status),
      // never a verified physical result -- so approval is never presented
      // as a completed or verified action.
      const ledgerStatus = String(result?.record?.execution_status || "").toLowerCase();
      const ledgerFailed = decision === "confirm" && (result?.ok === false || /failed|denied|rejected|error/.test(ledgerStatus));
      const nextMessages = baseMessages.map((item) => item.id === pendingId
        ? {
            ...item,
            pending: false,
            state: decision === "cancel" ? "denied" as const : ledgerFailed ? "action_failed" as const : "partial" as const,
            content: decision === "cancel"
              ? "Cancelled. Nothing was sent."
              : ledgerFailed
                ? "That action could not be completed. Nothing is confirmed as changed."
                : `${result?.record?.result_summary ? `${String(result.record.result_summary).trim().replace(/\.?$/, ".")} ` : ""}Approved and sent. Oyi has not verified the result.`,
          }
        : item);
      setMessages(nextMessages);
      persistConversation(nextMessages);
    } catch {
      const nextMessages = baseMessages.map((item) => item.id === pendingId ? { ...item, pending: false, state: "failed" as const, content: "That confirmation could not be completed safely." } : item);
      setMessages(nextMessages);
      persistConversation(nextMessages);
    } finally {
      setBusy(false);
    }
  }

  async function restoreThreadById(threadId: string, source: "history" | "route") {
    const requestedThreadId = String(threadId || "").trim();
    if (!requestedThreadId) return false;
    const restoreSeq = restoreSequenceRef.current + 1;
    restoreSequenceRef.current = restoreSeq;
    routeThreadRestoreRef.current = requestedThreadId;
    setActiveConversation({ threadId: requestedThreadId, status: "loading_thread", source, activeWorkflow: null });
    setRestoringThreadId(requestedThreadId);
    setHistoryError(null);
    setTargetError(null);
    setRegisteredContext(null);
    clearActiveIntelligenceContext();
    clearPersistedActiveIntelligenceContext();
    try {
      const res = await oyiService.getThreadMessages(requestedThreadId);
      if (restoreSequenceRef.current !== restoreSeq) return false;
      if (res.ok === false) throw new Error("thread_restore_rejected");
      if (res.thread?.id && String(res.thread.id) !== requestedThreadId) throw new Error("thread_restore_mismatch");
      if (!res.messages?.length) throw new Error("thread_empty");
      const rows = (res.messages || []).slice().sort((a, b) => {
        const at = toTimestamp(a.created_at);
        const bt = toTimestamp(b.created_at);
        if (at !== bt) return at - bt;
        return String(a.id || "").localeCompare(String(b.id || ""));
      });
      if (Number(res.thread?.message_count || 0) > 0 && rows.length === 0) throw new Error("thread_message_count_mismatch");
      const nextMessages = rows.map(messageFromThread);
      const restoredWorkflow = activeWorkflowFromThread(res.thread);
      dispatchInteraction({ type: "thread.restored", latestAssistant: latestAssistantMessage(rows) });
      setMessages(nextMessages);
      setBackendThreadId(requestedThreadId);
      setConversationId(`backend:${requestedThreadId}`);
      setActiveConversation({ threadId: requestedThreadId, status: "active_thread", source, activeWorkflow: restoredWorkflow });
      setConversations((current) => current.map((item) => item.backendThreadId === requestedThreadId ? {
        ...item,
        title: res.thread?.title || item.title,
        preview: res.thread?.preview || item.preview,
        messageCount: Number(res.thread?.message_count || nextMessages.length || item.messageCount || 0),
        updatedAt: res.thread?.updated_at ? toTimestamp(res.thread.updated_at) : item.updatedAt,
        messages: nextMessages,
        activeWorkflow: restoredWorkflow,
      } : item));
      setThreadRoute(requestedThreadId);
      setHistoryOpen(false);
      setSidebarOpen(false);
      window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end", behavior: reducedMotion ? "auto" : "smooth" }));
      return true;
    } catch (error) {
      if (restoreSequenceRef.current !== restoreSeq) return false;
      const emptyThread = error instanceof Error && error.message === "thread_empty";
      setHistoryError(emptyThread ? "This conversation has no saved messages." : "This conversation could not be loaded. Try again.");
      setActiveConversation({ threadId: requestedThreadId, status: "thread_error", source, activeWorkflow: null });
      setMessages((current) => current.length ? current : emptyThread ? [] : [{ id: createId(), role: "assistant", content: "This conversation could not be loaded right now.", state: "unavailable" }]);
      return false;
    } finally {
      if (restoreSequenceRef.current === restoreSeq) setRestoringThreadId(null);
    }
  }

  async function restoreConversation(conversation: Conversation) {
    const threadId = conversation.backendThreadId || null;
    if (threadId) {
      setThreadRoute(threadId);
      await restoreThreadById(threadId, "history");
      return;
    }
    setConversationId(conversation.id);
    setBackendThreadId(null);
    setActiveConversation({ threadId: null, status: "blank", source: "history", activeWorkflow: conversation.activeWorkflow || null });
    setMessages(conversation.messages || []);
    dispatchInteraction({ type: "thread.restored", latestAssistant: [...(conversation.messages || [])].reverse().find((message) => message.role === "assistant") || null });
    setThreadRoute(null);
    setSidebarOpen(false);
    setHistoryOpen(false);
  }

  function startNewConversation() {
    if (activeConversation.status === "loading_thread" || activeConversation.status === "active_thread") {
      console.debug("conversation_blank_state_suppressed_for_active_thread", {
        thread_id: activeConversation.threadId,
        status: activeConversation.status,
        source: activeConversation.source,
        reason: "explicit_new_conversation_reset",
      });
    }
    restoreSequenceRef.current += 1;
    dispatchInteraction({ type: "conversation.reset" });
    setConversationId(createId());
    setBackendThreadId(null);
    setActiveConversation({ threadId: null, status: "blank", source: "new", activeWorkflow: null });
    setMessages([]);
    stopVoiceCapture();
    setVoiceMode("idle");
    setSidebarOpen(false);
    setHistoryOpen(false);
    setHistoryError(null);
    setRestoringThreadId(null);
    setInput("");
    setTranscript("");
    setTargetError(null);
    setRegisteredContext(null);
    clearActiveIntelligenceContext();
    clearPersistedActiveIntelligenceContext();
    setThreadRoute(null);
  }

  useEffect(() => {
    const routeThreadId = searchParams.get("threadId");
    if (!(user as any)?.id || !routeThreadId) return;
    if (routeThreadId === activeConversation.threadId && activeConversation.status === "active_thread") return;
    if (routeThreadId === activeConversation.threadId && activeConversation.status === "loading_thread") return;
    if (routeThreadRestoreRef.current === routeThreadId && activeConversation.status !== "thread_error") return;
    void restoreThreadById(routeThreadId, "route");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation.status, activeConversation.threadId, searchParams, user]);

  const filteredConversations = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((item) => `${item.title || ""} ${item.preview || ""}`.toLowerCase().includes(query));
  }, [conversations, historyQuery]);

  const historyThreads = filteredConversations.flatMap((conversation) => normalizeOyiThreads([{
    id: conversation.backendThreadId || conversation.id,
    title: conversation.title,
    preview: conversation.preview,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messageCount || conversation.messages.length,
  }], { activeThreadId: canonicalActiveThreadId || conversationId, source: conversation.backendThreadId ? "backend" : "local" }));
  const navigation = surfaceAdapter.navigation();
  const historyView = oyiHistoryView({ threads: historyThreads, loading: historyLoading, error: historyError, activeThreadId: canonicalActiveThreadId });
  const controlsBusy = busy || Boolean(restoringThreadId);
  const closeDrawers = () => { setSidebarOpen(false); setHistoryOpen(false); };
  const newConversation = () => { if (!controlsBusy) startNewConversation(); };
  const historyContent = (
    <div className="oyi-reference-history">
      <div className="oyi-reference-section-heading">
        <h2>Conversations</h2>
        <button type="button" className="oyi-icon-button oyi-reference-mobile-only" aria-label="Close history" onClick={closeDrawers}><X size={18} /></button>
      </div>
      <label className="oyi-reference-search"><Search size={16} aria-hidden="true" /><input aria-label="Search conversations" placeholder="Search conversations" value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} /></label>
      {historyQuery && !historyThreads.length && !historyLoading && !historyError ? <p className="oyi-reference-hint">No matching conversations.</p> : null}
      <div inert={controlsBusy}>
        <OyiHistory view={historyView} restoringThreadId={restoringThreadId} onRetry={() => setHistoryReload((value) => value + 1)} onSelect={(thread) => {
          const conversation = conversations.find((item) => (item.backendThreadId || item.id) === thread.id);
          if (conversation && !controlsBusy) void restoreConversation(conversation);
        }} />
      </div>
    </div>
  );
  const renderMessage = (message: AiMessage) => {
                  return (
                  <article key={message.id} className="oyi-reference-message" data-role={message.role}>
                    <div className="oyi-reference-message-body">
                      {message.pending ? <OyiNotice>{message.content}</OyiNotice> : <OyiCaption key={message.id} live={message === messages[messages.length - 1]} collapseAfter={900} entries={[{ kind: message.role === "user" ? "user_final" : message.state === "clarification_required" ? "clarification" : "oyi_response", text: message.content }]} />}
                      {!message.pending && message.role === "assistant" && (message.persistence_saved === false || message.warnings?.some((warning) => /not saved|history/i.test(warning))) ? (
                        <OyiNotice tone="warning">This response could not be saved to History.</OyiNotice>
                      ) : null}
                      {!message.pending && message.role === "assistant" ? (
                        <>
                          {shouldRenderSupport(message.display_mode) ? <>
                            <StructuredCards cards={message.cards} onTarget={openTarget} />
                            <OperatingStatus execution={message.execution} />
                            <ReviewCard workflow={message.execution?.workflow as Record<string, any> | undefined} />
                            <ActionLifecycleCard execution={message.execution} hasConfirmationPrompt={Boolean(message.confirmations?.length)} />
                            <ExecutionAccountability
                              executionSummary={message.executionSummary}
                              executionHistory={message.executionHistory}
                              approvalRequired={message.confirmations?.length ? false : message.approvalRequired}
                              trustScore={message.trustScore}
                              initiatorType={message.initiatorType}
                              approvedBy={message.approvedBy}
                            />
                            <NavigationTransition
                              route={message.navigation_route}
                              onStay={() => cancelledNavigationRef.current.add(message.id)}
                              onContinue={(route) => router.push(route)}
                            />
                            <SourceLabels sources={message.sources} />
                            <SuggestedActions actions={message.suggested_actions} onOpen={(route) => router.push(route)} onTarget={openTarget} />
                          </> : message.presentation_policy?.primary === "execution" ? (
                            // An action outcome turn: the canonical action truth is its status.
                            <ActionLifecycleCard execution={message.execution} hasConfirmationPrompt={Boolean(message.confirmations?.length)} />
                          ) : null}
                        </>
                      ) : null}
                      {shouldRenderSupport(message.display_mode) && message.confirmations?.length ? message.confirmations.map((confirmation, index) => <ConfirmationCard key={String(confirmation?.ledger_id || confirmation?.id || index)} confirmation={confirmation} disabled={busy || message !== messages[messages.length - 1]} onDecision={decideConfirmation} />) : null}
                      {message.role === "assistant" && !message.pending ? (
                        <div className="mt-2.5 flex items-center gap-1.5 border-t border-white/[0.055] pt-2">
                          <button type="button" onClick={() => void copyResponse(message.content)} className="grid h-7 w-7 place-items-center rounded-full text-white/30 transition hover:bg-white/[0.055] hover:text-white/72 active:scale-95" aria-label="Copy Oyi response"><Copy className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => speakResponse(message.content)} className="grid h-7 w-7 place-items-center rounded-full text-white/30 transition hover:bg-white/[0.055] hover:text-white/72 active:scale-95" aria-label="Listen to Oyi response"><Volume2 className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => markHelpful(message)} className={`grid h-7 w-7 place-items-center rounded-full transition hover:bg-white/[0.055] active:scale-95 ${helpfulResponses[message.id] ? "text-sky-200" : "text-white/30 hover:text-white/72"}`} aria-label="Mark Oyi response helpful"><ThumbsUp className={`h-3.5 w-3.5 ${helpfulResponses[message.id] ? "fill-current" : ""}`} /></button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                  );
                };

  return (
    <div className="oyi-reference" data-has-conversation={chatMode}>
      <OyiShell
        label="Oyi conversation"
        sidebarOpen={sidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        historyOpen={historyOpen}
        onDismissSidebar={() => setSidebarOpen(false)}
        onDismissHistory={() => setHistoryOpen(false)}
        topRail={<>
          <button type="button" className="oyi-icon-button" aria-label={layout === "desktop" ? "Toggle sidebar" : "Open navigation"} aria-expanded={layout === "desktop" ? !sidebarCollapsed : sidebarOpen} onClick={() => {
            setHistoryOpen(false);
            if (layout === "desktop") setSidebarCollapsed((value) => !value);
            else setSidebarOpen((value) => !value);
          }}><Menu size={20} /></button>
          <span className="oyi-reference-identity"><OyiOrb size="identity" state="idle" /></span>
        </>}
        topRailEnd={<>
          <button type="button" className="oyi-icon-button oyi-reference-mobile-only" aria-label="Conversation history" aria-expanded={historyOpen} onClick={() => { setSidebarOpen(false); setHistoryOpen((value) => !value); }}><History size={20} /></button>
          <button type="button" className="oyi-icon-button" aria-label="New conversation" disabled={controlsBusy} onClick={newConversation}><Plus size={20} /></button>
        </>}
        surfaceNavigation={<>
          <div className="oyi-reference-sidebar-heading">
            <span className="oyi-reference-identity"><OyiOrb size="identity" state="idle" /></span>
            <button type="button" className="oyi-icon-button oyi-reference-mobile-only" aria-label="Close navigation" onClick={closeDrawers}><X size={18} /></button>
          </div>
          <button type="button" className="oyi-history-new" disabled={controlsBusy} onClick={newConversation}><Plus size={18} />New conversation</button>
          {surfaceAdapter.context().scopeLabel ? <p className="oyi-reference-context">{surfaceAdapter.context().scopeLabel}</p> : null}
          <nav className="oyi-reference-navigation" aria-label="Consumer modules">{navigation.map((item) => <a key={item.key} href={item.href} aria-current={item.href === pathname ? "page" : undefined} onClick={closeDrawers}>{item.label}</a>)}</nav>
          {user ? <a className="oyi-reference-account" href="/profile"><UserRound size={17} /><span>Account</span></a> : null}
        </>}
        sidebar={historyContent}
        history={historyContent}
        mainCanvas={<>
          <span className="oyi-visually-hidden" role="status" aria-live="polite">{interaction.label}</span>
          <OyiOrb size="large" state={orbState} />
          {recording ? <OyiCaption entries={[{ kind: "truth_note", text: voiceStarting ? "Waiting for microphone permission…" : voiceStopping ? "Finalizing transcription…" : transcript || "I'm listening…" }]} /> : null}
        </>}
        caption={<>
          {!interaction.online ? <OyiNotice tone="offline">You’re offline. Reconnect to send a message.</OyiNotice> : null}
          {targetError ? <OyiNotice tone="warning">{targetError}</OyiNotice> : null}
          {voiceError ? <OyiNotice tone="warning">{voiceError}</OyiNotice> : null}
          {restoringThreadId ? <OyiNotice>Loading conversation…</OyiNotice> : null}
          <div className="oyi-reference-replies">
            {messages.length > 2 ? <details className="oyi-reference-earlier"><summary>Earlier messages</summary>{messages.slice(0, -2).map(renderMessage)}</details> : null}
            {messages.slice(-2).map(renderMessage)}
            <div ref={bottomRef} aria-hidden="true" />
          </div>
        </>}
        suggestions={!chatMode && !recording ? <OyiSuggestions items={normalizeOyiSuggestions(suggestions.slice(0, 3), { source: "seed" })} onSelect={(item) => { if (!controlsBusy && interaction.online) submitSuggestion({ label: item.label, prompt: item.prompt || undefined, href: item.href || undefined }); }} /> : null}
        composer={<OyiComposer
          controlsLayout="expanded"
          capabilitySlot={<span title="Attachments are not supported in Oyi conversations yet."><button type="button" className="oyi-icon-button" disabled aria-label="Attachments unavailable" aria-describedby="oyi-attachment-help"><Plus size={20} /></button><span id="oyi-attachment-help" className="oyi-visually-hidden">Files and images cannot be attached to Oyi conversations yet. No file will be selected or uploaded.</span></span>}
          value={input} onChange={setInput} onSubmit={(value) => { void handleSend(value); }}
          turnInFlight={busy} disabled={!interaction.online || Boolean(restoringThreadId)}
          confirmationPending={Boolean(interaction.action?.awaiting_user) || interaction.canonical?.kind === "confirmation"}
          voiceAvailable={voiceAvailable} voiceActive={recording} voiceInterim={transcript} voiceLevels={audioLevels}
          voiceStatusLabel={voiceStarting ? "Allow microphone…" : voiceStopping ? "Finalizing…" : "Recording"}
          voiceElapsedSeconds={recordingSeconds} voiceStopping={voiceStarting || voiceStopping}
          onStartVoice={startVoiceCapture}
          onStopVoice={stopRecordingForReview}
          onSendVoice={() => finishVoiceCapture("send")}
          onCancelVoice={() => { stopVoiceCapture(); setTranscript(""); setAudioLevels([]); }}
        />}
      />
    </div>
  );
}

export default function OyiAiCommandCenter() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#02060b]" />}>
      <OyiAiCommandCenterContent />
    </Suspense>
  );
}
