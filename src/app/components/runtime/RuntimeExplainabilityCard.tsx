"use client";

type ExecutionRecord = Record<string, any>;

function label(value: unknown, fallback: string) {
  const text = String(value || "").trim();
  return text || fallback;
}

function when(value?: string | null) {
  if (!value) return "Now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";
  return date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function RuntimeExplainabilityCard({
  heading,
  summary,
  awareness,
  recommendation,
  executionHistory = [],
}: {
  heading: string;
  summary?: string | null;
  awareness?: Record<string, any> | null;
  recommendation?: Record<string, any> | null;
  executionHistory?: ExecutionRecord[];
}) {
  const latest = executionHistory[0] || null;
  const rows = [
    latest?.origin ? `Source ${label(latest.origin, "system")}` : null,
    latest?.initiator?.name || latest?.initiatorType ? `Initiator ${label(latest?.initiator?.name || latest?.initiatorType, "system")}` : null,
    typeof latest?.verification?.trustScore === "number"
      ? `Trust ${Math.round(Number(latest.verification.trustScore) * 100)}%`
      : typeof latest?.trustScore === "number"
      ? `Trust ${Math.round(Number(latest.trustScore) * 100)}%`
      : null,
    latest?.provider ? `Provider ${label(latest.provider, "backend")}` : null,
  ].filter(Boolean);

  return (
    <section className="rounded-[22px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.014))] p-4 shadow-[0_14px_42px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/46">Runtime intelligence</div>
          <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.03em] text-white">{heading}</h2>
          <p className="mt-1 text-xs leading-5 text-white/52">
            {summary || awareness?.summary || awareness?.reason || "Operational context is attached to this activity."}
          </p>
        </div>
        <div className="rounded-full border border-cyan-300/14 bg-cyan-400/[0.08] px-2.5 py-1 text-[10px] text-cyan-100/80">
          {executionHistory.length ? `${executionHistory.length} execution${executionHistory.length === 1 ? "" : "s"}` : "Live"}
        </div>
      </div>

      {rows.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {rows.slice(0, 4).map((row) => (
            <span key={String(row)} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/62">
              {String(row)}
            </span>
          ))}
        </div>
      ) : null}

      {recommendation?.title || recommendation?.summary || recommendation?.action ? (
        <div className="mt-3 rounded-[18px] border border-emerald-300/14 bg-emerald-400/[0.055] p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-emerald-100/58">Recommended action</div>
          <div className="mt-1 text-sm font-medium text-white">
            {label(recommendation?.title || recommendation?.action, "No immediate action required")}
          </div>
          {(recommendation?.summary || recommendation?.reason) ? (
            <div className="mt-1 text-xs leading-5 text-emerald-50/72">{label(recommendation?.summary || recommendation?.reason, "")}</div>
          ) : null}
        </div>
      ) : null}

      {latest ? (
        <div className="mt-3 rounded-[18px] border border-white/[0.07] bg-black/20 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Latest execution</div>
              <div className="mt-1 text-sm font-medium text-white">{label(latest.action, "Runtime execution")}</div>
              <div className="mt-1 text-xs text-white/50">
                {label(latest.status, "recorded")} · {when(latest.completedAt || latest.requestedAt)}
              </div>
            </div>
            <div className="text-right text-[11px] text-white/44">
              {latest?.approvalRequired ? "Approval required" : "No approval"}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
