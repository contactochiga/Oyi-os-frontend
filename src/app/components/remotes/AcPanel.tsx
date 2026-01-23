// src/app/components/remotes/AcPanel.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RemotePanel from "./RemotePanel";
import { signalService } from "@/services/signalService";
import useAuth from "@/hooks/useAuth";
import { useDeviceLiveState } from "@/hooks/useDeviceLiveState";

type AcMode = "cool" | "heat" | "fan" | "dry";
type FanSpeed = "low" | "medium" | "high" | "auto";

function pickBool(state: any, keys: string[], fallback: boolean) {
  for (const k of keys) {
    const v = state?.[k];
    if (typeof v === "boolean") return v;
    if (v === 1 || v === 0) return !!v;
    if (v === "on") return true;
    if (v === "off") return false;
  }
  return fallback;
}

function pickNumber(state: any, keys: string[], fallback: number) {
  for (const k of keys) {
    const v = state?.[k];
    const n = Number(v);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }
  return fallback;
}

function pickEnum<T extends string>(
  state: any,
  keys: string[],
  allowed: T[],
  fallback: T
) {
  for (const k of keys) {
    const v = String(state?.[k] ?? "").toLowerCase();
    if (allowed.includes(v as T)) return v as T;
  }
  return fallback;
}

export default function AcPanel({
  deviceId,
  lastUpdated,
  onInteraction,
}: {
  deviceId?: string;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const { user } = useAuth();
  const estateId = useMemo(
    () =>
      user?.estate_id ??
      (typeof window !== "undefined"
        ? localStorage.getItem("ochiga_estate")
        : null),
    [user?.estate_id]
  );

  const { state, loading, refresh } = useDeviceLiveState(deviceId, estateId);

  // ✅ Authoritative values from backend state
  const power = useMemo(
    () => pickBool(state, ["power", "on", "acOn", "switch"], false),
    [state]
  );

  const temperature = useMemo(
    () => pickNumber(state, ["temperature", "temp", "setpoint"], 24),
    [state]
  );

  const mode = useMemo(
    () =>
      pickEnum<AcMode>(
        state,
        ["mode", "acMode"],
        ["cool", "heat", "fan", "dry"],
        "cool"
      ),
    [state]
  );

  const fanSpeed = useMemo(
    () =>
      pickEnum<FanSpeed>(
        state,
        ["fanSpeed", "fan_speed", "fan"],
        ["low", "medium", "high", "auto"],
        "auto"
      ),
    [state]
  );

  const swing = useMemo(
    () => pickBool(state, ["swing", "oscillate"], false),
    [state]
  );

  // ✅ Local draft (only for slider UX)
  const [tempDraft, setTempDraft] = useState<number>(temperature);

  // Keep draft aligned with authoritative state when backend updates
  useEffect(() => {
    setTempDraft(temperature);
  }, [temperature]);

  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tempTimer = useRef<any>(null);
  const pendingTimer = useRef<any>(null);

  // Track last known state snapshot to detect confirmation
  const lastStateRef = useRef<any>(null);

  // Track what we are waiting to be confirmed
  const expectedRef = useRef<{ key: string; value: any } | null>(null);

  function touch() {
    onInteraction?.();
  }

  function startPending(expected: { key: string; value: any }) {
    expectedRef.current = expected;
    setPending(true);

    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => {
      // fallback: stop pending even if device never reported back
      expectedRef.current = null;
      setPending(false);
    }, 3500);
  }

  // ✅ Clear pending when we see state reflect the command (confirmation)
  useEffect(() => {
    const expected = expectedRef.current;
    if (!expected) {
      lastStateRef.current = state;
      return;
    }

    // If no state, nothing to confirm
    if (!state) return;

    // We confirm by checking if the derived value now matches what we requested
    const derived: Record<string, any> = {
      power,
      temperature,
      mode,
      fanSpeed,
      swing,
    };

    if (derived[expected.key] === expected.value) {
      expectedRef.current = null;
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      setPending(false);
    }

    lastStateRef.current = state;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, power, temperature, mode, fanSpeed, swing]);

  async function send(capability: string, value: any) {
    if (!deviceId) {
      setErr("No AC device selected.");
      return;
    }

    setErr(null);
    touch();

    // Start pending until confirmed (or timeout fallback)
    startPending({ key: capability === "fanSpeed" ? "fanSpeed" : capability, value });

    try {
      const resp = await signalService.sendDeviceCommand({
        deviceId,
        capability,
        value,
        meta: { panel: "ac" },
      });

      if (resp?.status !== "accepted") throw new Error("Command not accepted");

      // Backup pull (if socket missed)
      setTimeout(() => refresh(), 450);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed");
      expectedRef.current = null;
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      setPending(false);
    }
  }

  useEffect(() => {
    return () => {
      if (tempTimer.current) clearTimeout(tempTimer.current);
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
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
          {(pending || loading) && (
            <span className="text-xs text-gray-400">• syncing…</span>
          )}
        </span>

        <button
          onClick={() => send("power", !power)}
          disabled={disabled}
          className={`px-4 py-2 rounded-full text-sm font-medium transition disabled:opacity-50
            ${power ? "bg-[#E11D2E]" : "bg-gray-700"}`}
        >
          {power ? "Turn off" : "Turn on"}
        </button>
      </div>

      {/* TEMPERATURE (responsive UI + debounced send) */}
      <div className={`mb-4 ${(!power || disabled) && "opacity-40 pointer-events-none"}`}>
        <label className="block text-xs text-gray-400 mb-2">
          Temperature ({tempDraft}°C)
        </label>

        <input
          type="range"
          min={16}
          max={30}
          value={tempDraft}
          onChange={(e) => {
            const val = Number(e.target.value);
            setTempDraft(val);

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
              onClick={() => send("mode", m)}
              disabled={disabled}
              className={`px-3 py-1 rounded-full text-xs capitalize disabled:opacity-50
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
              onClick={() => send("fanSpeed", f)}
              disabled={disabled}
              className={`px-3 py-1 rounded-full text-xs capitalize disabled:opacity-50
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
          onClick={() => send("swing", !swing)}
          disabled={disabled}
          className={`px-3 py-1 rounded-full text-xs disabled:opacity-50
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
