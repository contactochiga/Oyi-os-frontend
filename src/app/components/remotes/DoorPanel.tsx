"use client";

import { useState } from "react";
import RemotePanel from "./RemotePanel";
import { signalService } from "@/services/signalService";

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

  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function touch() {
    onInteraction?.();
  }

  async function send(capability: string, value: any, applyLocal?: () => void) {
    if (!deviceId) {
      setErr("No door/lock device selected.");
      return;
    }

    setErr(null);
    setPending(true);

    try {
      const resp = await signalService.sendDeviceCommand({
        deviceId,
        capability,
        value,
        meta: { panel: "door" },
      });

      if (resp?.status !== "accepted") throw new Error("Command not accepted");

      applyLocal?.();
      touch();
      setTimeout(() => setPending(false), 200);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed");
      setPending(false);
    }
  }

  const disabled = pending || !deviceId;

  return (
    <RemotePanel title="Front Door" lastUpdated={lastUpdated}>
      {err && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      {/* STATUS */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-300">
          Status:{" "}
          <span className="text-white">
            {locked ? "Locked" : "Unlocked"}
          </span>{" "}
          {pending && <span className="text-xs text-gray-400">• syncing…</span>}
        </span>

        <button
          onClick={() =>
            send("lock", locked ? "unlock" : "lock", () => {
              setLocked((x) => !x);
            })
          }
          disabled={disabled}
          className={`px-4 py-2 rounded-full text-sm font-medium transition disabled:opacity-50
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
            disabled={disabled}
            onClick={() => send("doorbell", "ring")}
            className="btn-tv disabled:opacity-50"
          >
            Ring
          </button>
        )}

        <button
          disabled={disabled}
          onClick={() => send("accessLog", "open")}
          className="btn-tv disabled:opacity-50"
        >
          Access Log
        </button>
      </div>

      {!deviceId && (
        <div className="mt-3 text-[11px] text-gray-500">
          No door device bound yet. Bind a lock/door device to enable commands.
        </div>
      )}
    </RemotePanel>
  );
}
