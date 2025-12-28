"use client";

import React from "react";

export default function RemotePanel({
  title,
  timestamp,
  children,
}: {
  title: string;
  timestamp?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-800 text-xs text-gray-400 flex justify-between">
        <span>{title}</span>
        {timestamp && <span>{timestamp}</span>}
      </div>

      <div className="p-4">{children}</div>
    </div>
  );
}
