"use client";

import RemotePanel from "./RemotePanel";

export default function HomeSummaryPanel({
  lastUpdated,
}: {
  lastUpdated?: number;
}) {
  return (
    <RemotePanel title="Home Summary" lastUpdated={lastUpdated}>
      <div className="space-y-4">

        {/* STATUS BLOCKS */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="text-xs text-gray-400">Power</div>
            <div className="text-white font-medium">Active</div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="text-xs text-gray-400">Water</div>
            <div className="text-white font-medium">Available</div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="text-xs text-gray-400">Security</div>
            <div className="text-white font-medium">All doors locked</div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="text-xs text-gray-400">Active Devices</div>
            <div className="text-white font-medium">3 running</div>
          </div>
        </div>

        {/* QUICK INSIGHT */}
        <div className="rounded-xl bg-gray-900 border border-gray-700 p-4 text-sm text-gray-300">
          No security alerts. Last visitor was approved 2 hours ago.
        </div>
      </div>
    </RemotePanel>
  );
}
