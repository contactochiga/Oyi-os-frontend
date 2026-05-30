"use client";

import React from "react";

export default function RemotePanel({
  title,
  subtitle,
  lastUpdated,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  lastUpdated?: number;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const timeLabel = React.useMemo(() => {
    if (!lastUpdated) return null;
    const diffMs = Date.now() - lastUpdated;
    const s = Math.max(0, Math.floor(diffMs / 1000));
    if (s < 5) return "Just now";
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  }, [lastUpdated]);

  return (
    <section className="rounded-[24px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-3.5 shadow-[0_16px_46px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[14px] font-semibold tracking-[-0.02em] text-white/90">{title}</h2>
            {timeLabel ? (
              <span className="rounded-full border border-white/[0.08] bg-black/20 px-2 py-0.5 text-[10px] text-white/50">
                {timeLabel}
              </span>
            ) : null}
          </div>
          {subtitle ? <div className="mt-1 text-[11px] text-white/42">{subtitle}</div> : null}
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>

      <div>{children}</div>
    </section>
  );
}
