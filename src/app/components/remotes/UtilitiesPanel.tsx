"use client";

import RemotePanel from "./RemotePanel";

export default function UtilitiesPanel({ lastUpdated }: { lastUpdated?: number }) {
  return (
    <RemotePanel title="Utilities" lastUpdated={lastUpdated}>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
        Utilities data is not connected yet.
      </div>
    </RemotePanel>
  );
}
