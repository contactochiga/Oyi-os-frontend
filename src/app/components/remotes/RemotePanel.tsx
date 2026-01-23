"use client";

import React, { useEffect, useMemo, useState } from "react";

function safeMs(ms?: number) {
  if (!ms || Number.isNaN(ms)) return null;
  return ms;
}

function formatAgo(ms?: number | null) {
  if (!ms) return "--";

  const diff = Date.now() - ms;
  if (diff < 0) return "Just now";

  const sec = Math.floor(diff / 1000);
  if (sec < 10) return "Just now";
  if (sec < 60) return `${sec}s ago`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function freshness(ms?: number | null) {
  if (!ms) return { label: "OFFLINE", dot: "bg-gray-600", text: "text-gray-500", pill: "bg-gray-800 border-gray-700 text-gray-400" };

  const diff = Date.now() - ms;
  const sec = diff / 1000;

  // <10s => LIVE
  if (sec <= 10) {
    return {
      label: "LIVE",
      dot: "bg-green-400",
      text: "text-green-300",
      pill: "bg-green-500/10 border-green-500/20 text-green-200",
    };
  }

  // <60s => RECENT
  if (sec <= 60) {
    return {
      label: "RECENT",
      dot: "bg-emerald-300/90",
      text: "text-emerald-200",
      pill: "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
    };
  }

  // <5m => OK
  if (sec <= 60 * 5) {
    return {
      label: "OK",
      dot: "bg-yellow-300/90",
      text: "text-yellow-200",
      pill: "bg-yellow-500/10 border-yellow-500/20 text-yellow-200",
    };
  }

  // >=5m => STALE
  return {
    label: "STALE",
    dot: "bg-red-400/90",
    text: "text-red-200",
    pill: "bg-red-500/10 border-red-500/20 text-red-200",
  };
}

export default function RemotePanel({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated?: number;
  children: React.ReactNode;
}) {
  const ms = useMemo(() => safeMs(lastUpdated), [lastUpdated]);

  // Update "ago" + LIVE/STALE states even if lastUpdated doesn’t change
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 2_000); // tighter for LIVE/STALE feel
    return () => clearInterval(t);
  }, []);

  const exactTime = useMemo(() => {
    if (!ms) return "--:--";
    return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [ms]);

  const ago = useMemo(() => formatAgo(ms), [ms, tick]);
  const meta = useMemo(() => freshness(ms), [ms, tick]);

  // Pulse on update
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!ms) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 450);
    return () => clearTimeout(t);
  }, [ms]);

  return (
    <div className="mt-3 rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
      {/* HEADER */}
      <div
        className={`px-4 py-2 border-b border-gray-800 text-xs flex justify-between items-center transition
          ${pulse ? "bg-white/5" : ""}`}
      >
        {/* LEFT: title + dot */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-gray-200 truncate">{title}</span>

          <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dot}`} />

          {/* status pill */}
          <span className={`px-2 py-[2px] rounded-full border text-[10px] tracking-wide ${meta.pill}`}>
            {meta.label}
          </span>
        </div>

        {/* RIGHT: ago + exact */}
        <div className="flex items-center gap-2">
          <span className={`${meta.text}`}>{ago}</span>
          <span className="text-gray-400">{exactTime}</span>
        </div>
      </div>

      {/* BODY */}
      <div className="p-4">{children}</div>
    </div>
  );
}
