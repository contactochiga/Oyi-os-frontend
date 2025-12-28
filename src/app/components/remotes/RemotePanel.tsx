"use client";

import React from "react";

export default function RemotePanel({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated?: number;
  children: React.ReactNode;
}) {
  const time =
    lastUpdated && !isNaN(lastUpdated)
      ? new Date(lastUpdated).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "--:--";

  return (
    <div className="mt-3 rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
      {/* HEADER */}
      <div className="px-4 py-2 border-b border-gray-800 text-xs text-gray-400 flex justify-between">
        <span>{title}</span>
        <span>{time}</span>
      </div>

      {/* BODY */}
      <div className="p-4">{children}</div>
    </div>
  );
}
