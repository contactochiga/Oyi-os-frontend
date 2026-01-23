"use client";

import { useState } from "react";
import RemotePanel from "./RemotePanel";
import { signalService } from "@/services/signalService";

type Mode = "trackpad" | "numbers";

export default function TvPanel({
  deviceId,
  lastUpdated,
  onInteraction,
}: {
  deviceId?: string;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const [power, setPower] = useState(true);
  const [mode, setMode] = useState<Mode>("trackpad");

  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function touch() {
    onInteraction?.();
  }

  async function send(action: string, applyLocal?: () => void) {
    if (!deviceId) {
      setErr("No TV device selected.");
      return;
    }

    setErr(null);
    setPending(true);

    try {
      // ✅ normalize all TV actions into one command shape
      // backend receives: command: { action: "vol_up" }
      const resp = await signalService.sendDeviceCommand({
        deviceId,
        command: { action },
        meta: { panel: "tv" },
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
    <RemotePanel title="Living Room TV" lastUpdated={lastUpdated}>
      {err && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      {/* POWER */}
      <div className="flex justify-between mb-4">
        <button
          onClick={() =>
            send("power", () => {
              setPower((p) => !p);
            })
          }
          disabled={disabled}
          className={`px-4 py-2 rounded-full text-sm font-medium transition disabled:opacity-50
            ${power ? "bg-[#E11D2E]" : "bg-gray-700"}`}
        >
          {power ? "Turn off" : "Turn on"}
        </button>

        <button
          onClick={() => send("mute")}
          disabled={disabled}
          className="px-4 py-2 rounded-full bg-gray-700 text-sm disabled:opacity-50"
        >
          Mute
        </button>
      </div>

      {/* VOL / CH */}
      <div className={`flex justify-between mb-6 ${(!power || disabled) ? "opacity-40 pointer-events-none" : ""}`}>
        <div className="flex flex-col gap-2">
          <button onClick={() => send("vol_up")} className="btn-tv">
            Vol +
          </button>
          <button onClick={() => send("vol_down")} className="btn-tv">
            Vol -
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <button onClick={() => send("ch_up")} className="btn-tv">
            Ch ↑
          </button>
          <button onClick={() => send("ch_down")} className="btn-tv">
            Ch ↓
          </button>
        </div>
      </div>

      {/* CENTER CONTROL */}
      <div className={`${(!power || disabled) ? "opacity-40 pointer-events-none" : ""}`}>
        {mode === "trackpad" ? (
          <div className="flex flex-col items-center gap-2 mb-6">
            <button onClick={() => send("up")} className="btn-dir">
              ↑
            </button>

            <div className="flex gap-2">
              <button onClick={() => send("left")} className="btn-dir">
                ←
              </button>
              <button onClick={() => send("ok")} className="btn-ok">
                OK
              </button>
              <button onClick={() => send("right")} className="btn-dir">
                →
              </button>
            </div>

            <button onClick={() => send("down")} className="btn-dir">
              ↓
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
              <button
                key={n}
                onClick={() => send(`num_${n}`)}
                className="btn-num"
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* BOTTOM */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => send("home")}
          disabled={!power || disabled}
          className="btn-tv disabled:opacity-50"
        >
          Home
        </button>

        <button
          onClick={() =>
            setMode((m) => (m === "trackpad" ? "numbers" : "trackpad"))
          }
          className="btn-tv"
        >
          {mode === "trackpad" ? "123" : "Pad"}
        </button>
      </div>

      <div className="mt-3 text-[11px] text-gray-500">
        {pending ? "Syncing with backend…" : !deviceId ? "No TV device bound yet." : "Backend-confirmed commands (202 accepted)."}
      </div>
    </RemotePanel>
  );
}
