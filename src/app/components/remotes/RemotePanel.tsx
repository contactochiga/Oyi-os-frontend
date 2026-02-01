// src/app/components/remotes/RemotePanel.tsx
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
  right?: React.ReactNode; // optional right-side header action (Refresh btn etc.)
  children: React.ReactNode;
}) {
  const timeLabel = React.useMemo(() => {
    if (!lastUpdated) return null;

    const diffMs = Date.now() - lastUpdated;
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));

    if (diffSec < 5) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;

    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  }, [lastUpdated]);

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-white">{title}</h2>

            {timeLabel && (
              <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-gray-300">
                {timeLabel}
              </span>
            )}
          </div>

          {subtitle && (
            <div className="mt-1 text-xs text-gray-400">{subtitle}</div>
          )}
        </div>

        {/* Optional right action (ex: Refresh) */}
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>

      {/* Body */}
      <div>{children}</div>
    </div>
  );
}
