"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUp, Check, Clock3, Copy, Mic, Square, ThumbsUp, Volume2, X } from "lucide-react";

import LayoutWrapper from "@/app/components/LayoutWrapper";
import useAuth from "@/hooks/useAuth";
import { aiService, type AiChatResponse } from "@/services/aiService";

type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  state?: "idle" | "preparing" | "confirmation_required" | "executing" | "success" | "failed" | "denied";
  pending?: boolean;
  confirmations?: Array<Record<string, any>>;
};

type Suggestion = { label: string; prompt?: string; href?: string; tone?: "blue" | "green" | "amber" | "violet" };
type VoiceMode = "idle" | "recording" | "conversation";
type VoiceStatus = "Listening" | "Thinking" | "Speaking" | "Done" | "Failed";
type Conversation = { id: string; title: string; updatedAt: number; messages: AiMessage[] };

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { label: "Show device status", prompt: "Show device status", tone: "blue" },
  { label: "Turn off living room light", prompt: "Turn off living room light", tone: "amber" },
  { label: "Visitors", prompt: "Show visitors", tone: "green" },
  { label: "Security", prompt: "Show security", tone: "green" },
  { label: "Scenes", href: "/scenes", tone: "violet" },
  { label: "Automations", href: "/scenes?tab=automations", tone: "blue" },
];

const USAGE_KEY = "oyi_ai_shortcut_usage_v1";
const CONVERSATIONS_KEY = "oyi_ai_conversations_v1";
const FEEDBACK_KEY = "oyi_ai_helpful_feedback_v1";

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function commandHint(tool: Record<string, any>) {
  if (tool.status === "executed") return tool.summary || "Command completed.";
  if (tool.status === "queued") return tool.summary || "Command queued.";
  if (tool.status === "pending_confirmation") return "Confirmation needed.";
  if (tool.status === "denied") return tool.reason === "missing_permission" ? "You do not have permission for that action." : "That action is not available.";
  if (tool.status === "failed") return tool.error || "The command could not complete.";
  return tool.summary || "Oyi processed that command.";
}

function replyFromResponse(resp: AiChatResponse) {
  const details = (resp.tools || []).map(commandHint).filter(Boolean);
  return [resp.reply, ...details.filter((line) => line !== resp.reply)].filter(Boolean).join("\n");
}

function responseState(resp: AiChatResponse): AiMessage["state"] {
  if (resp.confirmations?.length) return "confirmation_required";
  if ((resp.tools || []).some((tool) => tool.status === "denied")) return "denied";
  if ((resp.tools || []).some((tool) => tool.status === "failed")) return "failed";
  return "success";
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

function groupConversationTime(timestamp: number) {
  const now = new Date();
  const date = new Date(timestamp);
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

export default function OyiAiCommandCenter() {
  const router = useRouter();
  const { user } = useAuth() as any;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState(createId);
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
  const [audioLevels, setAudioLevels] = useState<number[]>(Array.from({ length: 28 }, () => 0.2));

  const context = useMemo(
    () => ({ surface: "consumer", scope: "home", estateId: (user as any)?.estate_id || null, homeId: (user as any)?.home_id || null }),
    [user],
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

  useEffect(() => {
    setUsage(loadJson<Record<string, number>>(USAGE_KEY, {}));
    setConversations(loadJson<Conversation[]>(CONVERSATIONS_KEY, []));
    setHelpfulResponses(loadJson<Record<string, boolean>>(FEEDBACK_KEY, {}));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prompt = new URLSearchParams(window.location.search).get("prompt") || "";
    if (prompt.trim()) void handleSend(prompt.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => stopVoiceCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistConversation(nextMessages: AiMessage[]) {
    const firstUser = nextMessages.find((item) => item.role === "user")?.content || "Oyi conversation";
    const item: Conversation = { id: conversationId, title: firstUser.slice(0, 84), updatedAt: Date.now(), messages: nextMessages };
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
      const resp = await aiService.chat(command, context);
      const content = replyFromResponse(resp) || "Done.";
      const state = responseState(resp);
      if (state === "success") remember(options?.usageLabel || command);
      const nextMessages = baseMessages.map((item) => item.id === pendingId ? { ...item, pending: false, content, state, confirmations: resp.confirmations || [] } : item);
      setMessages(nextMessages);
      persistConversation(nextMessages);
      if (options?.fromVoice) {
        setVoiceStatus(state === "failed" || state === "denied" ? "Failed" : "Speaking");
        if (state !== "failed" && state !== "denied") speakResponse(content, true);
      }
    } catch {
      const nextMessages = baseMessages.map((item) => item.id === pendingId ? { ...item, pending: false, state: "failed" as const, content: "Oyi could not reach the command layer right now." } : item);
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

  function restoreConversation(conversation: Conversation) {
    setConversationId(conversation.id);
    setMessages(conversation.messages || []);
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
            <button type="button" onClick={() => setHistoryOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-full border border-sky-300/14 bg-sky-300/[0.055] px-3.5 text-xs font-medium text-sky-50/82 shadow-[0_0_24px_rgba(56,189,248,0.14)]">
              <Clock3 className="h-3.5 w-3.5" /> Recent Conversations
            </button>
          </div>
          <div className="mt-4 text-center">
            <div className="text-[18px] font-semibold tracking-[-0.04em]">Oyi</div>
            <div className="mt-0.5 text-[11px] text-white/42">Living intelligence</div>
          </div>
        </header>

        <section className="relative z-10 mx-auto flex h-full max-w-[680px] flex-col px-5" style={{ paddingTop: 8, paddingBottom: "calc(112px + var(--sab) + var(--kb))" }}>
          <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto pb-5 pr-1" style={{ WebkitOverflowScrolling: "touch" }}>
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
                    <div className={`max-w-[84%] rounded-[24px] px-4 py-3 text-sm leading-5 shadow-[0_16px_42px_rgba(0,0,0,0.24)] ${message.role === "user" ? "rounded-br-[8px] bg-white text-black" : "rounded-bl-[8px] border border-white/[0.07] bg-white/[0.045] text-white/82 backdrop-blur-xl"}`}>
                      <div className="whitespace-pre-line">{message.pending ? <span className="inline-flex items-center gap-2"><Spinner /> {message.content}</span> : message.content}</div>
                      {message.confirmations?.length ? message.confirmations.map((confirmation, index) => <ConfirmationCard key={String(confirmation?.ledger_id || confirmation?.id || index)} confirmation={confirmation} disabled={busy} onDecision={decideConfirmation} />) : null}
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
              </div>
            )}
          </div>
        </section>

        <form onSubmit={(event) => { event.preventDefault(); void handleSend(); }} className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[680px] px-4" style={{ paddingBottom: "calc(12px + var(--sab) + var(--kb))" }}>
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
                <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Message Oyi…" className="h-11 min-w-0 flex-1 bg-transparent px-2 text-[15px] text-white outline-none placeholder:text-white/32" />
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
                  <p className="mt-0.5 text-xs text-white/42">Previous Oyi interactions on this device.</p>
                </div>
                <button type="button" onClick={() => setHistoryOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-white/55"><X className="h-4 w-4" /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" style={{ WebkitOverflowScrolling: "touch" }}>
                {groupedConversations.length ? groupedConversations.map((section) => (
                  <div key={section.group} className="mb-4">
                    <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-sky-100/45">{section.group}</div>
                    <div className="space-y-2">
                      {section.items.map((conversation) => (
                        <button key={conversation.id} type="button" onClick={() => restoreConversation(conversation)} className="flex w-full items-center justify-between gap-3 rounded-[18px] border border-white/[0.06] bg-white/[0.032] px-3.5 py-3 text-left transition active:scale-[0.99]">
                          <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white/88">{conversation.title}</span><span className="mt-0.5 block text-xs text-white/38">{conversation.messages.length} messages</span></span>
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
