"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, ChevronRight, Mic, ShieldCheck, X } from "lucide-react";
import ConsumerShell from "@/app/components/ConsumerShell";
import ChatFooter from "@/app/components/ChatFooter";
import useAuth from "@/hooks/useAuth";
import { aiService, type AiChatResponse } from "@/services/aiService";

type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  confirmations?: Array<Record<string, any>>;
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function commandHint(tool: Record<string, any>) {
  if (tool.status === "executed") return tool.summary || "Command completed.";
  if (tool.status === "pending_confirmation") return "Confirmation required before Oyi executes this action.";
  if (tool.status === "denied") return tool.reason === "missing_permission" ? "You do not have permission for that action." : "That action is not available.";
  if (tool.status === "failed") return tool.error || "The command could not complete.";
  return tool.summary || "Oyi processed that command.";
}

export default function AiAutomationModule() {
  const router = useRouter();
  const { user } = useAuth() as any;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([
    {
      id: "intro",
      role: "assistant",
      content: "Home aware. Ask me to control lights, check device status, open spaces, or prepare a safe action.",
    },
  ]);

  const context = useMemo(
    () => ({
      surface: "consumer",
      scope: "home",
      estateId: (user as any)?.estate_id || null,
      homeId: (user as any)?.home_id || null,
    }),
    [user]
  );

  function updatePending(id: string, resp: AiChatResponse) {
    const details = (resp.tools || []).map(commandHint).filter(Boolean);
    const content = [resp.reply, ...details.filter((line) => line !== resp.reply)].filter(Boolean).join("\n");
    setMessages((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              pending: false,
              content: content || "Oyi processed that command.",
              confirmations: resp.confirmations || [],
            }
          : item
      )
    );
  }

  async function handleSend(text?: string) {
    const command = (text ?? input).trim();
    if (!command || busy) return;
    setBusy(true);
    setInput("");
    const pendingId = createId();
    setMessages((prev) => [
      ...prev,
      { id: createId(), role: "user", content: command },
      { id: pendingId, role: "assistant", content: "Listening to the home context…", pending: true },
    ]);
    try {
      const resp = await aiService.chat(command, context);
      updatePending(pendingId, resp);
    } catch {
      setMessages((prev) => prev.map((item) => (item.id === pendingId ? { ...item, pending: false, content: "Oyi could not reach the command layer right now." } : item)));
    } finally {
      setBusy(false);
    }
  }

  async function decideConfirmation(ledgerId: string, decision: "confirm" | "cancel") {
    if (!ledgerId) return;
    setBusy(true);
    try {
      const result = decision === "confirm" ? await aiService.confirm(ledgerId) : await aiService.cancel(ledgerId);
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content:
            result?.record?.result_summary ||
            (decision === "confirm" ? "Confirmed. Oyi processed the approved command." : "Cancelled. No action was executed."),
        },
      ]);
    } catch {
      setMessages((prev) => [...prev, { id: createId(), role: "assistant", content: "That confirmation could not be completed safely." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsumerShell title="Oyi" subtitle="Ambient intelligence • voice-first home command">
      <div className="flex min-h-[calc(100vh-220px)] flex-col pb-6">
        <section className="oyi-glass relative overflow-hidden rounded-[28px] p-5">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-sky-300/10 blur-3xl" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.26em] text-sky-100/55">Living Intelligence</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Oyi is listening.</h1>
              <p className="mt-2 max-w-md text-sm leading-5 text-white/52">
                Low-risk home commands execute through the secure backend command layer. Risky actions ask for confirmation first.
              </p>
            </div>
            <div className="oyi-orb h-[76px] w-[76px] shrink-0" aria-hidden="true" />
          </div>
          <div className="relative mt-4 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white/60">
              <ShieldCheck className="mb-2 h-4 w-4 text-emerald-200" />
              Permissioned
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white/60">
              <Mic className="mb-2 h-4 w-4 text-sky-200" />
              Voice-ready
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white/60">
              <Bot className="mb-2 h-4 w-4 text-violet-200" />
              Audited
            </div>
          </div>
        </section>

        <section className="mt-3 flex-1 rounded-[28px] border border-white/10 bg-white/[0.028] p-3">
          <div className="space-y-3">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`rounded-[22px] px-4 py-3 ${
                  message.role === "user" ? "ml-auto max-w-[88%] bg-sky-300/12 text-sky-50" : "mr-auto max-w-[92%] bg-black/22 text-white/78"
                }`}
              >
                <div className="whitespace-pre-line text-sm leading-6">{message.pending ? "Oyi is processing…" : message.content}</div>
                {message.confirmations?.length ? (
                  <div className="mt-3 space-y-2">
                    {message.confirmations.map((item) => {
                      const ledgerId = String(item.ledger_id || item.id || "");
                      return (
                        <div key={ledgerId || JSON.stringify(item)} className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3">
                          <div className="text-xs font-medium text-amber-100">Confirmation needed</div>
                          <div className="mt-1 text-xs text-white/50">No risky action will run until you approve it.</div>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              disabled={busy || !ledgerId}
                              onClick={() => decideConfirmation(ledgerId, "confirm")}
                              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" /> Confirm
                            </button>
                            <button
                              type="button"
                              disabled={busy || !ledgerId}
                              onClick={() => decideConfirmation(ledgerId, "cancel")}
                              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/70 disabled:opacity-50"
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
        </section>

        <section className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {[
            ["Open spaces", "/rooms"],
            ["Show devices", "/devices"],
            ["Open activity", "/activity"],
            ["Security", "/security"],
          ].map(([label, href]) => (
            <button
              key={href}
              type="button"
              onClick={() => router.push(href)}
              className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/[0.035] px-3 py-3 text-left text-white/68 transition hover:bg-white/[0.07]"
            >
              <span>{label}</span>
              <ChevronRight className="h-4 w-4 text-white/30" />
            </button>
          ))}
        </section>

        <div className="mt-3 rounded-[26px] border border-white/10 bg-black/30 p-2">
          <ChatFooter input={input} setInput={setInput} onSend={handleSend} />
        </div>
      </div>
    </ConsumerShell>
  );
}
