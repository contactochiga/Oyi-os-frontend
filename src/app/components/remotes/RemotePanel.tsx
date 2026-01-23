"use client";

import React, { useEffect, useMemo, useState } from "react";

function formatAgo(ms?: number) {
  if (!ms || Number.isNaN(ms)) return "--";

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

export default function RemotePanel({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated?: number;
  children: React.ReactNode;
}) {
  // Live "ago" updates every 10s even if lastUpdated didn't change
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const exactTime = useMemo(() => {
    if (!lastUpdated || Number.isNaN(lastUpdated)) return "--:--";
    return new Date(lastUpdated).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [lastUpdated]);

  const ago = useMemo(() => formatAgo(lastUpdated), [lastUpdated, tick]);

  // Pulse on updates
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!lastUpdated || Number.isNaN(lastUpdated)) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 450);
    return () => clearTimeout(t);
  }, [lastUpdated]);

  return (
    <div className="mt-3 rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
      {/* HEADER */}
      <div
        className={`px-4 py-2 border-b border-gray-800 text-xs text-gray-400 flex justify-between items-center transition
          ${pulse ? "bg-white/5" : ""}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-200">{title}</span>

          {/* live dot */}
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full
              ${lastUpdated ? "bg-green-400/80" : "bg-gray-600"}`}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-500">{ago}</span>
          <span className="text-gray-400">{exactTime}</span>
        </div>
      </div>

      {/* BODY */}
      <div className="p-4">{children}</div>
    </div>
  );
}
