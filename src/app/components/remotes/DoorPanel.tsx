"use client";

import { useState } from "react";
import RemotePanel from "./RemotePanel";

export default function DoorPanel({
  deviceId,
  hasCamera = false,
  lastUpdated,
  onInteraction,
}: {
  deviceId?: string;
  hasCamera?: boolean;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const [locked, setLocked] = useState(true);

  function touch() {
    onInteraction?.();
  }

  const timeLabel =
    lastUpdated &&
    new Date(lastUpdated).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  function toggleLock() {
    setLocked(!locked);
    touch();
  }

  return (
    <RemotePanel title="Front Door" timestamp={timeLabel}>
      {/* STATUS */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-300">
          Status:{" "}
          <span className="text-white">
            {locked ? "Locked" : "Unlocked"}
          </span>
        </span>

        <button
          onClick={toggleLock}
          className={`px-4 py-2 rounded-full text-sm font-medium transition
            ${locked ? "bg-[#E11D2E]" : "bg-gray-700"}`}
        >
          {locked ? "Unlock" : "Lock"}
        </button>
      </div>

      {/* CAMERA (OPTIONAL) */}
      {hasCamera && (
        <div className="mb-4 rounded-xl overflow-hidden border border-gray-800">
          <div className="h-36 bg-black flex items-center justify-center text-xs text-gray-400">
            Camera Feed (placeholder)
          </div>
        </div>
      )}

      {/* ACTIONS */}
      <div className="flex gap-2">
        {hasCamera && (
          <button
            onClick={() => {
              console.log("Doorbell rung");
              touch();
            }}
            className="btn-tv"
          >
            Ring
          </button>
        )}

        <button
          onClick={() => {
            console.log("Home access");
            touch();
          }}
          className="btn-tv"
        >
          Access Log
        </button>
      </div>
    </RemotePanel>
  );
}
