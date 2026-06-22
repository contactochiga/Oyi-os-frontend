"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUp, Check, Clock3, Copy, History, Mic, Plus, Square, ThumbsUp, Volume2, X } from "lucide-react";

import LayoutWrapper from "@/app/components/LayoutWrapper";
import useAuth from "@/hooks/useAuth";
import useActiveContext from "@/hooks/useActiveContext";
import { aiService, type AiChatResponse } from "@/services/aiService";
import { oyiService, type OyiThreadMessage } from "@/services/oyiService";

type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  state?: "idle" | "preparing" | "confirmation_required" | "executing" | "success" | "failed" | "denied";
  pending?: boolean;
  confirmations?: Array<Record<string, any>>;
  cards?: Array<Record<string, any>>;
  sources?: Array<Record<string, any>>;
  suggested_actions?: Array<Record<string, any>>;
  intent?: string;
  understood?: string;
  execution?: Record<string, any>;
  display_mode?: "conversation" | "list" | "detail" | "audit" | "report" | "awareness";
};

type Suggestion = { label: string; prompt?: string; href?: string; tone?: "blue" | "green" | "amber" | "violet" };
type VoiceMode = "idle" | "recording" | "conversation";
type VoiceStatus = "Listening" | "Thinking" | "Speaking" | "Done" | "Failed";
type Conversation = { id: string; title: string; updatedAt: number; messages: AiMessage[]; backendThreadId?: string | null };
const SUPPORT_DISPLAY_MODES = new Set(["list", "detail", "audit", "report", "awareness"]);

function shouldRenderSupport(displayMode?: string) {
  return SUPPORT_DISPLAY_MODES.has(String(displayMode || "conversation"));
}

const DEFAULT_SUGGESTIONS: Suggestion[] = [
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

const USAGE_KEY = "oyi_ai_shortcut_usage_v1";
const CONVERSATIONS_KEY = "oyi_ai_conversations_v1";
const FEEDBACK_KEY = "oyi_ai_helpful_feedback_v1";

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function replyFromResponse(resp: AiChatResponse) {
  const base = resp.message || resp.reply;
  return base || "";
}

function responseState(resp: AiChatResponse): AiMessage["state"] {
  if (resp.confirmations?.length) return "confirmation_required";
  const results = Array.isArray(resp.execution?.results) ? resp.execution.results : [];
  if (results.some((result) => result?.status === "pending_confirmation")) return "confirmation_required";
  if (results.some((result) => result?.status === "denied")) return "denied";
  if (results.some((result) => result?.status === "failed")) return "failed";
  if ((resp.tools || []).some((tool) => tool.status === "denied")) return "denied";
  if ((resp.tools || []).some((tool) => tool.status === "failed")) return "failed";
  return "success";
}

function awarenessCards(resp: AiChatResponse) {
  if (!["list", "detail", "audit", "report", "awareness"].includes(String(resp.display_mode || "conversation"))) return [];
  const cards = Array.isArray(resp.cards) ? resp.cards : [];
  const awareness = resp.awareness;
  if (!awareness?.headline) return cards;
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

function thinkingTextFor(command: string) {
  const value = command.toLowerCase();
  if (value.includes("light") || value.includes("ac") || value.includes("device")) return "Searching devices…";
  if (value.includes("living") || value.includes("bedroom") || value.includes("kitchen")) return "Looking through rooms…";
  if (value.includes("permission") || value.includes("unlock") || value.includes("gate") || value.includes("lock")) return "Validating permissions…";
  if (value.includes("scene")) return "Checking scenes…";
  if (value.includes("automation")) return "Checking automations…";
  if (value.includes("visitor")) return "Checking visitor activity…";
  if (value.includes("security")) return "Checking home security…";
  return "Checking home status…";
}

function toneClass(tone?: Suggestion["tone"]) {
  if (tone === "green") return "border-emerald-300/20 bg-emerald-400/[0.07] text-emerald-50";
  if (tone === "amber") return "border-amber-300/20 bg-amber-400/[0.07] text-amber-50";
  if (tone === "violet") return "border-violet-300/20 bg-violet-400/[0.07] text-violet-50";
  return "border-sky-300/22 bg-sky-400/[0.08] text-sky-50";
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

function messageFromThread(row: OyiThreadMessage): AiMessage {
  const metadata = row.metadata || {};
  return {
    id: row.id,
    role: row.role === "user" ? "user" : "assistant",
    content: row.content || "",
    state: row.role === "user" ? undefined : "success",
    cards: row.cards || [],
    sources: row.sources || [],
    suggested_actions: row.suggested_actions || [],
    intent: typeof metadata.intent === "string" ? metadata.intent : undefined,
    understood: typeof metadata.understood === "string" ? metadata.understood : undefined,
    execution: metadata.execution && typeof metadata.execution === "object" ? metadata.execution as Record<string, any> : undefined,
    display_mode: typeof metadata.display_mode === "string" ? metadata.display_mode as AiMessage["display_mode"] : "conversation",
  };
}

function groupConversationTime(timestamp: number) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 24 * 60 * 60 * 1000;
  if (timestamp >= startToday) return "Today";
  if (timestamp >= startYesterday) return "Yesterday";
  return "Earlier";
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-white/18 border-t-sky-200 align-[-2px]" />;
}

function StructuredCards({ cards }: { cards?: Array<Record<string, any>> }) {
  const visibleCards = (cards || []).filter((card) => !["capability", "capability_registry"].includes(String(card?.type || "")));
  if (!visibleCards.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {visibleCards.slice(0, 3).map((card, index) => {
        const items = Array.isArray(card.items) ? card.items : [];
        return (
          <div key={`${card.type || card.title || "card"}-${index}`} className="rounded-[18px] border border-white/[0.07] bg-black/18 p-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-sky-100/46">{card.type ? String(card.type).replace(/_/g, " ") : "Summary"}</div>
            <div className="mt-1 text-[13px] font-semibold text-white/90">{card.title || "Home update"}</div>
            {card.summary ? <div className="mt-1 text-xs leading-5 text-white/52">{String(card.summary)}</div> : null}
            {items.length ? (
              <div className="mt-2 grid gap-1.5">
                {items.slice(0, 6).map((item: any, itemIndex: number) => (
                  <div key={itemIndex} className="flex items-start justify-between gap-3 rounded-xl bg-white/[0.035] px-2.5 py-2 text-xs">
                    <span className="min-w-0 break-words text-white/58">{item.title || item.label || item.subtitle || "Item"}</span>
                    <span className="max-w-[48%] shrink-0 break-words text-right text-white/82">{item.value !== undefined ? String(item.value) : item.status || item.subtitle || ""}</span>
                  </div>
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
          ? "Action completed"
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

function SourceLabels({ sources }: { sources?: Array<Record<string, any>> }) {
  const visibleSources = (sources || []).filter((source) => !/ai_tool|execution_ledger|capability registry/i.test(String(source?.label || source?.table || "")));
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

function SuggestedActions({ actions, onOpen }: { actions?: Array<Record<string, any>>; onOpen: (route: string) => void }) {
  const rows = (actions || []).filter((action) => action?.route && action?.label);
  if (!rows.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {rows.slice(0, 4).map((action, index) => (
        <button key={`${action.route}-${index}`} type="button" onClick={() => onOpen(String(action.route))} className="rounded-full border border-sky-200/15 bg-sky-400/[0.07] px-3 py-1.5 text-[11px] font-medium text-sky-100/84 transition active:scale-95">
          {action.label}
        </button>
      ))}
    </div>
  );
}

function ComposerWaveform({ active, levels }: { active: boolean; levels?: number[] }) {
  const bars = levels?.length ? levels : Array.from({ length: 28 }).map((_, index) => 0.18 + (((index * 5) % 18) / 24));
  return (
    <div className="flex h-8 items-center gap-[3px] overflow-hidden" aria-hidden="true">
      {bars.slice(-28).map((level, index) => (
        <span
          key={index}
          className="w-[2px] rounded-full bg-sky-200/80 shadow-[0_0_8px_rgba(56,189,248,0.38)]"
          style={{
            height: `${Math.max(5, Math.min(24, 5 + level * 26))}px`,
            opacity: active ? 0.82 : 0.32,
            transition: "height 90ms ease, opacity 120ms ease",
          }}
        />
      ))}
    </div>
  );
}

function OyiOrb({ size = "large", state = "idle", onClick }: { size?: "large" | "small"; state?: "idle" | "listening" | "thinking" | "responding" | "failed" | "offline"; onClick?: () => void }) {
  const sizeClass = size === "large" ? "h-32 w-32 text-[26px]" : "h-11 w-11 text-[13px]";
  const stateClass =
    state === "listening"
      ? "border-sky-200/70 shadow-[0_0_60px_rgba(0,132,255,0.72)] animate-pulse"
      : state === "thinking"
        ? "border-sky-300/46 shadow-[0_0_42px_rgba(0,132,255,0.42)] animate-pulse"
        : state === "responding"
          ? "border-sky-200/58 shadow-[0_0_52px_rgba(56,189,248,0.52)]"
          : state === "failed"
            ? "border-amber-200/45 shadow-[0_0_34px_rgba(251,191,36,0.30)]"
            : state === "offline"
              ? "border-white/12 opacity-55 shadow-none"
              : "border-sky-300/38 shadow-[0_0_30px_rgba(0,132,255,0.30)]";
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={`relative grid shrink-0 place-items-center rounded-full border bg-[radial-gradient(circle_at_center,rgba(32,129,255,0.30),rgba(3,8,16,0.96)_68%)] transition active:scale-95 ${sizeClass} ${stateClass}`} aria-label="Talk to Oyi">
      <span className="absolute inset-[-14px] rounded-full bg-sky-400/10 blur-2xl" />
      <span className="relative font-semibold tracking-[-0.08em]">Oyi</span>
    </button>
  );
}

function ConfirmationCard({ confirmation, onDecision, disabled }: { confirmation: Record<string, any>; onDecision: (id: string, decision: "confirm" | "cancel") => void; disabled: boolean }) {
  const ledgerId = String(confirmation?.ledger_id || confirmation?.id || confirmation?.command_id || "");
  return (
    <div className="mt-3 rounded-[20px] border border-amber-200/14 bg-amber-300/[0.055] p-3.5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-amber-100/60">Confirmation required</div>
      <div className="mt-1.5 text-sm font-semibold text-white">{confirmation?.summary || confirmation?.prompt || "Approve this action?"}</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={disabled || !ledgerId} onClick={() => onDecision(ledgerId, "cancel")} className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-xs text-white/70 disabled:opacity-45">Cancel</button>
        <button type="button" disabled={disabled || !ledgerId} onClick={() => onDecision(ledgerId, "confirm")} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-45">Confirm</button>
      </div>
    </div>
  );
}

function OyiAiCommandCenterContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth() as any;
  const activeContext = useActiveContext();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState(createId);
  const [backendThreadId, setBackendThreadId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("idle");
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("Listening");
  const [voiceError, setVoiceError] = useState("");
  const [helpfulResponses, setHelpfulResponses] = useState<Record<string, boolean>>({});
  const [transcript, setTranscript] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>(Array.from({ length: 28 }, () => 0.2));
  const [composerHeight, setComposerHeight] = useState(132);
  const moduleContext = searchParams.get("module") || "ai";

  const context = useMemo(
    () => ({
      surface: "consumer",
      scope: "home",
      module: moduleContext,
      route: pathname || "/ai",
      estate_id: activeContext.estate_id || (user as any)?.estate_id || null,
      home_id: activeContext.home_id || (user as any)?.home_id || null,
    }),
    [activeContext.estate_id, activeContext.home_id, moduleContext, pathname, user],
  );

  const suggestions = useMemo(() => {
    const byLabel = new Map(DEFAULT_SUGGESTIONS.map((item) => [item.label, item]));
    const ranked = Object.entries(usage)
      .sort((a, b) => b[1] - a[1])
      .map(([label]) => byLabel.get(label))
      .filter(Boolean) as Suggestion[];
    const filled = [...ranked, ...DEFAULT_SUGGESTIONS.filter((item) => !ranked.some((rankedItem) => rankedItem.label === item.label))];
    return filled.slice(0, 5);
  }, [usage]);

  const chatMode = messages.length > 0;
  const recording = voiceMode === "recording";
  const voiceConversation = voiceMode === "conversation";
  const inputWake = input.toLowerCase().includes("oyi") || transcript.toLowerCase().includes("oyi");
  const orbState = voiceConversation || recording ? "listening" : busy ? "thinking" : voiceStatus === "Failed" ? "failed" : "idle";
  const composerReserve = `calc(${composerHeight + 24}px + var(--sab) + var(--kb))`;

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
      const localFallback = loadJson<Conversation[]>(CONVERSATIONS_KEY, []);
      if (!(user as any)?.id) {
        setConversations(localFallback);
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
        const rows = res.threads || [];
        if (!rows.length) {
          setConversations(localFallback);
          return;
        }
        setConversations(rows.map((thread) => ({
          id: `backend:${thread.id}`,
          backendThreadId: thread.id,
          title: thread.title || "Oyi conversation",
          updatedAt: toTimestamp(thread.updated_at || thread.created_at),
          messages: [],
        })));
      } catch {
        if (!cancelled) setConversations(localFallback);
      }
    }
    void loadConversations();
    return () => { cancelled = true; };
  }, [user, context.estate_id, context.home_id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prompt = new URLSearchParams(window.location.search).get("prompt") || "";
    if (prompt.trim()) void handleSend(prompt.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let frame = 0;
    const measure = () => {
      const height = Math.ceil(composerRef.current?.getBoundingClientRect().height || 132);
      setComposerHeight((current) => (Math.abs(current - height) > 2 ? height : current));
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" && composerRef.current ? new ResizeObserver(measure) : null;
    if (observer && composerRef.current) observer.observe(composerRef.current);
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [recording, inputWake]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, composerHeight]);

  useEffect(() => {
    return () => stopVoiceCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistConversation(nextMessages: AiMessage[], threadId = backendThreadId) {
    const firstUser = nextMessages.find((item) => item.role === "user")?.content || "Oyi conversation";
    const item: Conversation = { id: conversationId, backendThreadId: threadId || undefined, title: firstUser.slice(0, 84), updatedAt: Date.now(), messages: nextMessages };
    setConversations((current) => {
      const next = [item, ...current.filter((entry) => entry.id !== conversationId)].slice(0, 24);
      saveJson(CONVERSATIONS_KEY, next);
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

  async function handleSend(text?: string, options?: { usageLabel?: string; fromVoice?: boolean }) {
    const command = (text ?? input).trim();
    if (!command || busy) return;

    const pendingId = createId();
    const userMessage: AiMessage = { id: createId(), role: "user", content: command };
    const pendingMessage: AiMessage = { id: pendingId, role: "assistant", content: thinkingTextFor(command), state: "executing", pending: true };
    const baseMessages = [...messages, userMessage, pendingMessage];

    setBusy(true);
    setInput("");
    setTranscript("");
    if (options?.fromVoice) setVoiceStatus("Thinking");
    setMessages(baseMessages);

    try {
      const resp = await aiService.chat(command, { ...context, thread_id: backendThreadId || undefined });
      const nextThreadId = resp.thread_id || backendThreadId;
      if (nextThreadId) setBackendThreadId(nextThreadId);
      const content = replyFromResponse(resp) || "Done.";
      const state = responseState(resp);
      if (state === "success") remember(options?.usageLabel || command);
      const nextMessages = baseMessages.map((item) => item.id === pendingId ? { ...item, pending: false, content, state, confirmations: resp.confirmations || [], cards: awarenessCards(resp), sources: resp.sources || [], suggested_actions: resp.suggested_actions || [], intent: resp.intent, understood: resp.understood, execution: resp.execution, display_mode: resp.display_mode || "conversation" } : item);
      setMessages(nextMessages);
      persistConversation(nextMessages, nextThreadId || undefined);
      if (options?.fromVoice) {
        setVoiceStatus(state === "failed" || state === "denied" ? "Failed" : "Speaking");
        if (state !== "failed" && state !== "denied") speakResponse(content, true);
      }
    } catch {
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

  function speakResponse(text: string, fromVoiceConversation = false) {
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.96;
    if (fromVoiceConversation) {
      utterance.onend = () => setVoiceStatus("Done");
      utterance.onerror = () => setVoiceStatus("Done");
    }
    window.speechSynthesis.speak(utterance);
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
    if (meterRafRef.current) window.cancelAnimationFrame(meterRafRef.current);
    meterRafRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    void audioContextRef.current?.close?.().catch(() => undefined);
    audioContextRef.current = null;
  }

  async function startAudioMeter() {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
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
        setAudioLevels((current) => [...current.slice(-27), Math.max(0.12, rms)]);
        meterRafRef.current = window.requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Speech recognition may still work even when amplitude metering is unavailable.
    }
  }

  function stopVoiceCapture() {
    try { recognitionRef.current?.stop?.(); } catch {}
    recognitionRef.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    stopAudioMeter();
  }

  function stopRecordingForReview() {
    stopVoiceCapture();
    setVoiceMode("idle");
  }

  function startVoiceCapture(mode: VoiceMode) {
    if (busy || typeof window === "undefined") return;
    setVoiceError("");
    setTranscript("");
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("Voice capture is not available in this build. Type your command below.");
      setVoiceMode("idle");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event: any) => {
        const text = Array.from(event?.results || [])
          .map((result: any) => String(result?.[0]?.transcript || ""))
          .join(" ")
          .trim();
        setTranscript(text);
        if (mode === "recording") setInput(text);
        const finalResult = Array.from(event?.results || []).some((result: any) => Boolean(result?.isFinal));
        if (mode === "conversation" && finalResult && text) void handleSend(text, { fromVoice: true });
      };
      recognition.onerror = () => {
        setVoiceError("I could not hear clearly. Try again or type your command.");
        setVoiceStatus("Failed");
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        stopAudioMeter();
        if (mode === "recording") setVoiceMode("idle");
      };
      setVoiceMode(mode);
      setVoiceStatus("Listening");
      startTimer();
      if (mode === "recording") void startAudioMeter();
      recognition.start();
    } catch {
      setVoiceMode("idle");
      setVoiceError("Voice capture could not start. Type your command below.");
    }
  }

  async function decideConfirmation(ledgerId: string, decision: "confirm" | "cancel") {
    if (!ledgerId || busy) return;
    const pendingId = createId();
    const pendingMessage: AiMessage = { id: pendingId, role: "assistant", content: decision === "confirm" ? "Executing command…" : "Cancelling…", state: "executing", pending: true };
    const baseMessages = [...messages, pendingMessage];
    setBusy(true);
    setMessages(baseMessages);
    try {
      const result = decision === "confirm" ? await aiService.confirm(ledgerId) : await aiService.cancel(ledgerId);
      const nextMessages = baseMessages.map((item) => item.id === pendingId
        ? { ...item, pending: false, state: decision === "confirm" ? "success" as const : "denied" as const, content: result?.record?.result_summary || (decision === "confirm" ? "Command approved and processed." : "Cancelled. No action was executed.") }
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

  async function restoreConversation(conversation: Conversation) {
    setConversationId(conversation.id);
    setBackendThreadId(conversation.backendThreadId || null);
    if (conversation.backendThreadId) {
      try {
        const res = await oyiService.getThreadMessages(conversation.backendThreadId);
        const nextMessages = (res.messages || []).map(messageFromThread);
        setMessages(nextMessages.length ? nextMessages : conversation.messages || []);
      } catch {
        setMessages(conversation.messages || []);
      }
    } else {
      setMessages(conversation.messages || []);
    }
    setHistoryOpen(false);
  }

  function startNewConversation() {
    setConversationId(createId());
    setBackendThreadId(null);
    setMessages([]);
    setHistoryOpen(false);
  }

  const groupedConversations = ["Today", "Yesterday", "Earlier"].map((group) => ({ group, items: conversations.filter((item) => groupConversationTime(item.updatedAt) === group) })).filter((section) => section.items.length);

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 overflow-hidden bg-[#02060b] text-white">
        <div className="oyi-ambient-bg" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(0,132,255,0.16),transparent_32%),linear-gradient(180deg,rgba(4,12,22,0.12),rgba(0,0,0,0.94))]" />

        <header className="relative z-20 mx-auto max-w-[680px] px-5" style={{ paddingTop: "calc(12px + var(--sat))" }}>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push("/home"))} className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3.5 text-sm text-white/72 backdrop-blur-2xl transition active:scale-95" aria-label="Back">
              <ArrowLeft className="h-[18px] w-[18px]" /> Back
            </button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setHistoryOpen(true)} className="grid h-10 w-10 place-items-center rounded-full border border-sky-300/14 bg-sky-300/[0.055] text-sky-50/82 shadow-[0_0_24px_rgba(56,189,248,0.14)] transition active:scale-95" aria-label="Conversation history"><History className="h-4 w-4" /></button>
              <button type="button" onClick={startNewConversation} className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.09] bg-white/[0.045] text-white/78 transition active:scale-95" aria-label="New chat"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="mt-4 text-center">
            <div className="text-[18px] font-semibold tracking-[-0.04em]">Oyi</div>
            <div className="mt-0.5 text-[11px] text-white/42">Living intelligence</div>
          </div>
        </header>

        <section className="relative z-10 mx-auto flex h-full max-w-[680px] flex-col px-5" style={{ paddingTop: 8, paddingBottom: composerReserve }}>
          <div
            ref={scrollerRef}
            className="min-h-0 flex-1 overflow-y-auto pr-1"
            style={{
              WebkitOverflowScrolling: "touch",
              paddingBottom: composerReserve,
              scrollPaddingBottom: composerReserve,
            }}
          >
            {!chatMode ? (
              <div className="flex min-h-full flex-col items-center justify-center text-center">
                <OyiOrb state={voiceConversation ? "listening" : "idle"} onClick={() => startVoiceCapture("conversation")} />
                <h1 className="mt-6 text-[29px] font-semibold tracking-[-0.06em]">{voiceConversation ? voiceStatus : "How can I help?"}</h1>
                <p className="mt-2 max-w-[280px] text-[14px] leading-5 text-white/50">Ask about your home, run safe commands, open scenes, or check what needs attention.</p>
                {voiceError ? <p className="mt-4 rounded-full border border-amber-300/14 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-100/80">{voiceError}</p> : null}
                <div className="mt-7 flex w-full max-w-[390px] flex-wrap justify-center gap-2.5">
                  {suggestions.map((item) => (
                    <button key={item.label} type="button" onClick={() => submitSuggestion(item)} className={`rounded-full border px-3.5 py-2 text-xs font-medium backdrop-blur-xl transition active:scale-95 ${toneClass(item.tone)}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[94%] overflow-hidden rounded-[24px] px-4 py-3 text-sm leading-6 shadow-[0_16px_42px_rgba(0,0,0,0.24)] sm:max-w-[86%] ${message.role === "user" ? "rounded-br-[8px] bg-white text-black" : "rounded-bl-[8px] border border-white/[0.07] bg-white/[0.045] text-white/82 backdrop-blur-xl"}`}>
                      <div className="whitespace-pre-wrap break-words">{message.pending ? <span className="inline-flex items-center gap-2"><Spinner /> {message.content}</span> : message.content}</div>
                      {!message.pending && message.role === "assistant" ? (
                        <>
                          {shouldRenderSupport(message.display_mode) ? <>
                            <StructuredCards cards={message.cards} />
                            <OperatingStatus execution={message.execution} />
                            <SourceLabels sources={message.sources} />
                            <SuggestedActions actions={message.suggested_actions} onOpen={(route) => router.push(route)} />
                          </> : null}
                        </>
                      ) : null}
                      {shouldRenderSupport(message.display_mode) && message.confirmations?.length ? message.confirmations.map((confirmation, index) => <ConfirmationCard key={String(confirmation?.ledger_id || confirmation?.id || index)} confirmation={confirmation} disabled={busy} onDecision={decideConfirmation} />) : null}
                      {message.role === "assistant" && !message.pending ? (
                        <div className="mt-2.5 flex items-center gap-1.5 border-t border-white/[0.055] pt-2">
                          <button type="button" onClick={() => void copyResponse(message.content)} className="grid h-7 w-7 place-items-center rounded-full text-white/30 transition hover:bg-white/[0.055] hover:text-white/72 active:scale-95" aria-label="Copy Oyi response"><Copy className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => speakResponse(message.content)} className="grid h-7 w-7 place-items-center rounded-full text-white/30 transition hover:bg-white/[0.055] hover:text-white/72 active:scale-95" aria-label="Listen to Oyi response"><Volume2 className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => markHelpful(message)} className={`grid h-7 w-7 place-items-center rounded-full transition hover:bg-white/[0.055] active:scale-95 ${helpfulResponses[message.id] ? "text-sky-200" : "text-white/30 hover:text-white/72"}`} aria-label="Mark Oyi response helpful"><ThumbsUp className={`h-3.5 w-3.5 ${helpfulResponses[message.id] ? "fill-current" : ""}`} /></button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} className="h-1" />
              </div>
            )}
          </div>
        </section>

        <form ref={composerRef} onSubmit={(event) => { event.preventDefault(); void handleSend(); }} className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[680px] px-4" style={{ paddingBottom: "calc(12px + var(--sab) + var(--kb))" }}>
          <div className={`rounded-[28px] border bg-[#040911]/92 p-2.5 shadow-[0_18px_70px_rgba(0,0,0,0.62)] backdrop-blur-2xl transition ${inputWake ? "border-sky-300/45 shadow-[0_0_42px_rgba(0,132,255,0.26)]" : "border-white/[0.08]"}`}>
            {recording ? (
              <div className="flex items-center gap-3 px-1.5 py-1">
                <OyiOrb size="small" state="listening" />
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center justify-between text-[10px] text-white/42"><span>Listening</span><span>{recordingSeconds}s</span></div>
                  <ComposerWaveform active levels={audioLevels} />
                </div>
                <button type="button" onClick={stopRecordingForReview} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-400/14 text-red-100" aria-label="Stop recording">
                  <Square className="h-4 w-4 fill-current" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <OyiOrb size="small" state={orbState} onClick={() => startVoiceCapture("conversation")} />
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={1}
                  placeholder="Message Oyi…"
                  className="max-h-28 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-3 text-[15px] leading-5 text-white outline-none placeholder:text-white/32"
                />
                {input ? <button type="button" onClick={() => setInput("")} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.05] text-white/45" aria-label="Clear"><X className="h-4 w-4" /></button> : null}
                {input.trim() ? (
                  <button type="submit" disabled={busy} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-black transition active:scale-95 disabled:bg-white/20 disabled:text-white/35" aria-label="Send">
                    {busy ? <Check className="h-4 w-4" /> : <ArrowUp className="h-[18px] w-[18px]" />}
                  </button>
                ) : (
                  <button type="button" onClick={() => startVoiceCapture("recording")} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-sky-300/20 bg-sky-400/[0.09] text-sky-100 transition active:scale-95" aria-label="Record voice command">
                    <Mic className="h-[18px] w-[18px]" />
                  </button>
                )}
              </div>
            )}
          </div>
        </form>

        {historyOpen ? (
          <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 px-4 pb-[calc(14px+var(--sab))] backdrop-blur-md sm:items-center">
            <button type="button" className="absolute inset-0" onClick={() => setHistoryOpen(false)} aria-label="Close recent conversations" />
            <section className="relative flex max-h-[76dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#050a12]/96 shadow-[0_26px_90px_rgba(0,0,0,0.68)]">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
                <div>
                  <h2 className="text-lg font-semibold tracking-[-0.04em]">Recent Conversations</h2>
                  <p className="mt-0.5 text-xs text-white/42">Previous Oyi interactions across your signed-in devices.</p>
                </div>
                <button type="button" onClick={() => setHistoryOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-white/55"><X className="h-4 w-4" /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" style={{ WebkitOverflowScrolling: "touch" }}>
                {groupedConversations.length ? groupedConversations.map((section) => (
                  <div key={section.group} className="mb-4">
                    <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-sky-100/45">{section.group}</div>
                    <div className="space-y-2">
                      {section.items.map((conversation) => (
                        <button key={conversation.id} type="button" onClick={() => void restoreConversation(conversation)} className="flex w-full items-center justify-between gap-3 rounded-[18px] border border-white/[0.06] bg-white/[0.032] px-3.5 py-3 text-left transition active:scale-[0.99]">
                          <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white/88">{conversation.title}</span><span className="mt-0.5 block text-xs text-white/38">{conversation.messages.length ? `${conversation.messages.length} messages` : "Saved thread"}</span></span>
                          <span className="shrink-0 text-xs text-white/38">{formatTime(conversation.updatedAt)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )) : <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.025] p-5 text-center"><Clock3 className="mx-auto h-5 w-5 text-sky-200/60" /><div className="mt-2 text-sm font-semibold">No recent conversations yet.</div><div className="mt-1 text-xs leading-5 text-white/42">Your Oyi interactions will appear here after a successful command or question.</div></div>}
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </LayoutWrapper>
  );
}

export default function OyiAiCommandCenter() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#02060b]" />}>
      <OyiAiCommandCenterContent />
    </Suspense>
  );
}
