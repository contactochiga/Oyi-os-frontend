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
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-white/90">{title}</h2>
            {timeLabel ? (
              <span className="rounded-full bg-black/20 border border-white/10 px-2 py-0.5 text-[10px] text-white/60">
                {timeLabel}
              </span>
            ) : null}
          </div>
          {subtitle ? <div className="mt-1 text-xs text-white/45">{subtitle}</div> : null}
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>

      <div>{children}</div>
    </section>
  );
}
