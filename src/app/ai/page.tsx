"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUp, Check, Mic, Sparkles, X } from "lucide-react";

import LayoutWrapper from "@/app/components/LayoutWrapper";
import BottomNav from "@/app/components/BottomNav";
import useAuth from "@/hooks/useAuth";
import { aiService, type AiChatResponse } from "@/services/aiService";

type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  state?:
    | "idle"
    | "preparing"
    | "confirmation_required"
    | "executing"
    | "success"
    | "failed"
    | "denied";
  pending?: boolean;
  confirmations?: Array<Record<string, any>>;
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function commandHint(tool: Record<string, any>) {
  if (tool.status === "executed") return tool.summary || "Command completed.";
  if (tool.status === "pending_confirmation") return "Confirmation needed.";
  if (tool.status === "denied") {
    return tool.reason === "missing_permission"
      ? "You do not have permission for that action."
      : "That action is not available.";
  }
  if (tool.status === "failed") return tool.error || "The command could not complete.";
  return tool.summary || "Oyi processed that command.";
}

function replyFromResponse(resp: AiChatResponse) {
  const details = (resp.tools || []).map(commandHint).filter(Boolean);
  return [resp.reply, ...details.filter((line) => line !== resp.reply)]
    .filter(Boolean)
    .join("\n");
}

function responseState(resp: AiChatResponse): AiMessage["state"] {
  if (resp.confirmations?.length) return "confirmation_required";
  if ((resp.tools || []).some((tool) => tool.status === "denied")) return "denied";
  if ((resp.tools || []).some((tool) => tool.status === "failed")) return "failed";
  return "success";
}

export default function AiAutomationModule() {
  const router = useRouter();
  const { user } = useAuth() as any;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);

  const context = useMemo(
    () => ({
      surface: "consumer",
      scope: "home",
      estateId: (user as any)?.estate_id || null,
      homeId: (user as any)?.home_id || null,
    }),
    [user],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prompt = new URLSearchParams(window.location.search).get("prompt") || "";
    if (prompt.trim()) setInput(prompt.trim());
  }, []);

  async function handleSend(text?: string) {
    const command = (text ?? input).trim();
    if (!command || busy) return;

    const pendingId = createId();
    setBusy(true);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: createId(), role: "user", content: command },
      {
        id: pendingId,
        role: "assistant",
        content: "Working…",
        state: "executing",
        pending: true,
      },
    ]);

    try {
      const resp = await aiService.chat(command, context);
      const content = replyFromResponse(resp) || "Done.";
      setMessages((prev) =>
        prev.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                pending: false,
                content,
                state: responseState(resp),
                confirmations: resp.confirmations || [],
              }
            : item,
        ),
      );
    } catch {
      setMessages((prev) =>
        prev.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                pending: false,
                state: "failed",
                content: "Oyi could not reach the command layer right now.",
              }
            : item,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function decideConfirmation(ledgerId: string, decision: "confirm" | "cancel") {
    if (!ledgerId || busy) return;
    setBusy(true);
    const pendingId = createId();
    setMessages((prev) => [
      ...prev,
      {
        id: pendingId,
        role: "assistant",
        content: decision === "confirm" ? "Confirmed. Working…" : "Cancelling…",
        state: "executing",
        pending: true,
      },
    ]);
    try {
      const result = decision === "confirm" ? await aiService.confirm(ledgerId) : await aiService.cancel(ledgerId);
      setMessages((prev) =>
        prev.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                pending: false,
                state: decision === "confirm" ? "success" : "denied",
                content:
                  result?.record?.result_summary ||
                  (decision === "confirm"
                    ? "Command approved and processed."
                    : "Cancelled. No action was executed."),
              }
            : item,
        ),
      );
    } catch {
      setMessages((prev) =>
        prev.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                pending: false,
                state: "failed",
                content: "That confirmation could not be completed safely.",
              }
            : item,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const emptySuggestions = [
    "Show device status",
    "Turn off living room light",
    "Open spaces",
    "What happened today?",
  ];

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 overflow-hidden bg-[#02060b] text-white">
        <div className="oyi-ambient-bg" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(0,132,255,0.13),transparent_30%),linear-gradient(180deg,rgba(4,12,22,0.16),rgba(0,0,0,0.92))]" />

        <header
          className="relative z-20 mx-auto flex max-w-[680px] items-center justify-between px-5"
          style={{ paddingTop: "calc(12px + var(--sat))" }}
        >
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/70 backdrop-blur-2xl transition active:scale-95"
            aria-label="Back home"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <div className="text-[17px] font-semibold tracking-[-0.035em]">Oyi</div>
            <div className="mt-0.5 text-[11px] text-white/42">Living intelligence</div>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-full border border-sky-300/16 bg-sky-300/[0.055] text-sky-100 shadow-[0_0_24px_rgba(56,189,248,0.18)]">
            <Sparkles className="h-4 w-4" />
          </div>
        </header>

        <section
          className="relative z-10 mx-auto flex h-full max-w-[680px] flex-col px-5"
          style={{ paddingTop: 18, paddingBottom: "calc(132px + var(--sab) + var(--kb))" }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto pb-4 pr-1" style={{ WebkitOverflowScrolling: "touch" }}>
            {messages.length === 0 ? (
              <div className="flex min-h-full flex-col items-center justify-center text-center">
                <div className="grid h-24 w-24 place-items-center rounded-full border border-sky-300/50 bg-[radial-gradient(circle_at_center,rgba(32,129,255,0.35),rgba(3,8,16,0.96)_68%)] shadow-[0_0_42px_rgba(0,132,255,0.38)]">
                  <span className="text-[25px] font-semibold tracking-[-0.08em]">Oyi</span>
                </div>
                <h1 className="mt-6 text-[28px] font-semibold tracking-[-0.055em]">How can I help?</h1>
                <p className="mt-2 max-w-[300px] text-sm leading-5 text-white/45">
                  Ask about your home, devices, visitors, activity, or safe commands.
                </p>
                <div className="mt-6 flex max-w-full gap-2 overflow-x-auto pb-1">
                  {emptySuggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setInput(item)}
                      className="shrink-0 rounded-full border border-white/[0.07] bg-white/[0.035] px-3.5 py-2 text-xs text-white/58 transition hover:bg-white/[0.06]"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-3">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`max-w-[88%] rounded-[24px] px-4 py-3 text-sm leading-6 shadow-[0_14px_38px_rgba(0,0,0,0.20)] ${
                      message.role === "user"
                        ? "ml-auto bg-sky-300/14 text-sky-50"
                        : "mr-auto border border-white/[0.06] bg-white/[0.04] text-white/76"
                    }`}
                  >
                    {message.state ? (
                      <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-white/30">
                        {message.state.replaceAll("_", " ")}
                      </div>
                    ) : null}
                    <div className="whitespace-pre-line">{message.content}</div>
                    {message.confirmations?.length ? (
                      <div className="mt-3 space-y-2">
                        {message.confirmations.map((item, index) => {
                          const ledgerId = String(item.ledger_id || item.id || "");
                          return (
                            <div key={ledgerId || index} className="rounded-[20px] border border-amber-300/18 bg-amber-300/[0.08] p-3">
                              <div className="text-xs font-semibold text-amber-100">Confirmation required</div>
                              <div className="mt-1 text-xs text-white/45">No risky action runs until you approve it.</div>
                              <div className="mt-3 flex gap-2">
                                <button
                                  type="button"
                                  disabled={busy || !ledgerId}
                                  onClick={() => decideConfirmation(ledgerId, "confirm")}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-45"
                                >
                                  <Check className="h-3.5 w-3.5" /> Confirm
                                </button>
                                <button
                                  type="button"
                                  disabled={busy || !ledgerId}
                                  onClick={() => decideConfirmation(ledgerId, "cancel")}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/70 disabled:opacity-45"
                                >
                                  <X className="h-3.5 w-3.5" /> Cancel
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>

          <form
            className="relative z-20 rounded-[28px] border border-white/[0.075] bg-[#050a12]/88 p-2 shadow-[0_20px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSend();
            }}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInput((current) => current || "Voice command")}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-400/14 text-sky-100 transition active:scale-95"
                aria-label="Voice input"
              >
                <Mic className="h-5 w-5" />
              </button>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Message Oyi…"
                className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/32"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black transition active:scale-95 disabled:bg-white/12 disabled:text-white/35"
                aria-label="Send message"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>

        <BottomNav />
      </main>
    </LayoutWrapper>
  );
}
