"use client";

import RemotePanel from "./RemotePanel";

type VisitorStatus = "pending" | "approved" | "denied";

type Visitor = {
  id: string;
  name: string;
  purpose: string;
  status: VisitorStatus;
};

export default function VisitorPanel({
  deviceId,
  lastUpdated,
  onInteraction,
}: {
  deviceId?: string;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const visitor: Visitor = {
    id: "vis-1",
    name: "John Doe",
    purpose: "Delivery",
    status: "pending",
  };

  const timeLabel =
    lastUpdated &&
    new Date(lastUpdated).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  function approve() {
    console.log("Visitor approved");
    onInteraction?.();
  }

  function deny() {
    console.log("Visitor denied");
    onInteraction?.();
  }

  return (
    <RemotePanel title="Visitor Access" timestamp={timeLabel}>
      <div className="space-y-4">
        {/* VISITOR INFO */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="text-sm text-white font-medium">
            {visitor.name}
          </div>
          <div className="text-xs text-gray-400">
            Purpose: {visitor.purpose}
          </div>
          <div className="text-xs text-yellow-400 mt-1">
            Status: Pending
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex gap-3">
          <button
            onClick={approve}
            className="flex-1 py-3 rounded-xl bg-[#16A34A] text-white text-sm font-medium active:scale-95 transition"
          >
            Approve & Open
          </button>

          <button
            onClick={deny}
            className="flex-1 py-3 rounded-xl bg-[#DC2626] text-white text-sm font-medium active:scale-95 transition"
          >
            Deny
          </button>
        </div>
      </div>
    </RemotePanel>
  );
}
