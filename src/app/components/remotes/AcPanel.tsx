"use client";

import { useEffect, useRef, useState } from "react";
import RemotePanel from "./RemotePanel";
import { signalService } from "@/services/signalService";

type AcMode = "cool" | "heat" | "fan" | "dry";
type FanSpeed = "low" | "medium" | "high" | "auto";

export default function AcPanel({
  deviceId,
  lastUpdated,
  onInteraction,
}: {
  deviceId?: string;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const [power, setPower] = useState(false);
  const [temperature, setTemperature] = useState(24);
  const [mode, setMode] = useState<AcMode>("cool");
  const [fanSpeed, setFanSpeed] = useState<FanSpeed>("auto");
  const [swing, setSwing] = useState(false);

  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tempTimer = useRef<any>(null);

  function touch() {
    onInteraction?.();
  }

  async function send(capability: string, value: any, applyLocal?: () => void) {
    if (!deviceId) {
      setErr("No AC device selected.");
      return;
    }

    setErr(null);
    setPending(true);

    try {
      const resp = await signalService.sendDeviceCommand({
        deviceId,
        capability,
        value,
        meta: { panel: "ac" },
      });

      if (resp?.status !== "accepted") {
        throw new Error("Command not accepted");
      }

      // ✅ Since backend returns 202 only, we apply local state after acceptance.
      // Later, we’ll replace this with socket-confirmed state.
      applyLocal?.();
      touch();

      // keep pending briefly (feels like “confirmation”)
      setTimeout(() => setPending(false), 250);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed");
      setPending(false);
    }
  }

  useEffect(() => {
    return () => {
      if (tempTimer.current) clearTimeout(tempTimer.current);
    };
  }, []);

  const disabled = pending || !deviceId;

  return (
    <RemotePanel title="Air Conditioner" lastUpdated={lastUpdated}>
      {err && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      {/* POWER */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-white">
          Status: {power ? "On" : "Off"}{" "}
          {pending && <span className="text-xs text-gray-400">• syncing…</span>}
        </span>

        <button
          onClick={() =>
            send("power", !power, () => {
              setPower((p) => !p);
            })
          }
          disabled={disabled}
          className={`px-4 py-2 rounded-full text-sm font-medium transition disabled:opacity-50
            ${power ? "bg-[#E11D2E]" : "bg-gray-700"}`}
        >
          {power ? "Turn off" : "Turn on"}
        </button>
      </div>

      {/* TEMPERATURE (debounced) */}
      <div className={`mb-4 ${(!power || disabled) && "opacity-40 pointer-events-none"}`}>
        <label className="block text-xs text-gray-400 mb-2">
          Temperature ({temperature}°C)
        </label>

        <input
          type="range"
          min={16}
          max={30}
          value={temperature}
          onChange={(e) => {
            const val = Number(e.target.value);
            setTemperature(val);

            if (tempTimer.current) clearTimeout(tempTimer.current);
            tempTimer.current = setTimeout(() => {
              send("temperature", val);
            }, 250);
          }}
          className="w-full accent-[#E11D2E]"
        />
      </div>

      {/* MODE */}
      <div className={`mb-4 ${(!power || disabled) && "opacity-40 pointer-events-none"}`}>
        <label className="block text-xs text-gray-400 mb-2">Mode</label>
        <div className="flex gap-2 flex-wrap">
          {(["cool", "heat", "fan", "dry"] as AcMode[]).map((m) => (
            <button
              key={m}
              onClick={() =>
                send("mode", m, () => {
                  setMode(m);
                })
              }
              className={`px-3 py-1 rounded-full text-xs capitalize
                ${mode === m ? "bg-[#E11D2E] text-white" : "bg-gray-700 text-gray-300"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* FAN SPEED */}
      <div className={`mb-4 ${(!power || disabled) && "opacity-40 pointer-events-none"}`}>
        <label className="block text-xs text-gray-400 mb-2">Fan Speed</label>
        <div className="flex gap-2 flex-wrap">
          {(["low", "medium", "high", "auto"] as FanSpeed[]).map((f) => (
            <button
              key={f}
              onClick={() =>
                send("fanSpeed", f, () => {
                  setFanSpeed(f);
                })
              }
              className={`px-3 py-1 rounded-full text-xs capitalize
                ${fanSpeed === f ? "bg-[#E11D2E] text-white" : "bg-gray-700 text-gray-300"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* SWING */}
      <div className={`flex items-center justify-between ${(!power || disabled) && "opacity-40 pointer-events-none"}`}>
        <span className="text-xs text-gray-400">Swing</span>
        <button
          onClick={() =>
            send("swing", !swing, () => {
              setSwing((s) => !s);
            })
          }
          className={`px-3 py-1 rounded-full text-xs
            ${swing ? "bg-[#E11D2E] text-white" : "bg-gray-700 text-gray-300"}`}
        >
          {swing ? "On" : "Off"}
        </button>
      </div>

      {!deviceId && (
        <div className="mt-3 text-[11px] text-gray-500">
          No AC device bound yet. Bind an AC device to enable commands.
        </div>
      )}
    </RemotePanel>
  );
}
