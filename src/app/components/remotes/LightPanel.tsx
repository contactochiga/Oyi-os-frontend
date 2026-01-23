"use client";

import { useState } from "react";
import RemotePanel from "./RemotePanel";
import { signalService } from "@/services/signalService";

export default function LightPanel({
  deviceId,
  lastUpdated,
  onInteraction,
}: {
  deviceId?: string;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const [on, setOn] = useState(false);
  const [brightness, setBrightness] = useState(70);

  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function touch() {
    onInteraction?.();
  }

  async function send(capability: string, value: any, applyLocal?: () => void) {
    if (!deviceId) {
      setErr("No light device selected.");
      return;
    }

    setErr(null);
    setPending(true);

    try {
      const resp = await signalService.sendDeviceCommand({
        deviceId,
        capability,
        value,
        meta: { panel: "light" },
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
    <RemotePanel title="Living Room Light" lastUpdated={lastUpdated}>
      {err && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-300">
          Status: <span className="text-white">{on ? "On" : "Off"}</span>{" "}
          {pending && <span className="text-xs text-gray-400">• syncing…</span>}
        </span>

        <button
          onClick={() =>
            send("power", !on, () => {
              setOn((x) => !x);
            })
          }
          disabled={disabled}
          className={`px-4 py-2 rounded-full text-sm font-medium transition disabled:opacity-50
            ${on ? "bg-[#E11D2E]" : "bg-gray-700 hover:bg-gray-600"}`}
        >
          {on ? "Turn off" : "Turn on"}
        </button>
      </div>

      <div className={`${(!on || disabled) ? "opacity-40 pointer-events-none" : ""}`}>
        <label className="block text-xs text-gray-400 mb-2">
          Brightness ({brightness}%)
        </label>

        <input
          type="range"
          min={0}
          max={100}
          value={brightness}
          onChange={(e) => {
            const val = Number(e.target.value);
            setBrightness(val);
            // send immediately (or debounce like AC if you prefer)
            send("brightness", val);
          }}
          className="w-full accent-[#E11D2E]"
        />
      </div>

      {!deviceId && (
        <div className="mt-3 text-[11px] text-gray-500">
          No light device bound yet. Bind a light device to enable commands.
        </div>
      )}
    </RemotePanel>
  );
}
