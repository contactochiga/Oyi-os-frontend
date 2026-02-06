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

function pickEnum<T extends string>(state: any, keys: string[], allowed: T[], fallback: T) {
  for (const k of keys) {
    const v = String(state?.[k] ?? "").toLowerCase();
    if (allowed.includes(v as T)) return v as T;
  }
  return fallback;
}

function Chip({
  active,
  children,
  onClick,
  disabled,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-full text-[12px] border transition disabled:opacity-50
        ${
          active
            ? "bg-white text-black border-white/20"
            : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
        }`}
    >
      {children}
    </button>
  );
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
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user?.estate_id]
  );

  const { state, loading, refresh } = useDeviceLiveState(deviceId, estateId);

  const power = useMemo(() => pickBool(state, ["power", "on", "acOn", "switch"], false), [state]);
  const temperature = useMemo(() => pickNumber(state, ["temperature", "temp", "setpoint"], 24), [state]);

  const mode = useMemo(
    () => pickEnum<AcMode>(state, ["mode", "acMode"], ["cool", "heat", "fan", "dry"], "cool"),
    [state]
  );

  const fanSpeed = useMemo(
    () => pickEnum<FanSpeed>(state, ["fanSpeed", "fan_speed", "fan"], ["low", "medium", "high", "auto"], "auto"),
    [state]
  );

  const swing = useMemo(() => pickBool(state, ["swing", "oscillate"], false), [state]);

  const [tempDraft, setTempDraft] = useState<number>(temperature);
  useEffect(() => setTempDraft(temperature), [temperature]);

  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tempTimer = useRef<any>(null);
  const pendingTimer = useRef<any>(null);
  const expectedRef = useRef<{ key: string; value: any } | null>(null);

  function touch() {
    onInteraction?.();
  }

  function startPending(expected: { key: string; value: any }) {
    expectedRef.current = expected;
    setPending(true);

    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => {
      expectedRef.current = null;
      setPending(false);
    }, 3000);
  }

  useEffect(() => {
    const expected = expectedRef.current;
    if (!expected || !state) return;

    const derived: Record<string, any> = { power, temperature, mode, fanSpeed, swing };
    if (derived[expected.key] === expected.value) {
      expectedRef.current = null;
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      setPending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, power, temperature, mode, fanSpeed, swing]);

  async function send(capability: string, value: any) {
    if (!deviceId) return setErr("No AC device selected.");
    setErr(null);
    touch();

    const key = capability === "fanSpeed" ? "fanSpeed" : capability;
    startPending({ key, value });

    try {
      const resp = await signalService.sendDeviceCommand({
        deviceId,
        capability,
        value,
        meta: { panel: "ac" },
      });

      if (resp?.status !== "accepted") throw new Error("Command not accepted");
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
  const locked = !power || disabled;

  return (
    <RemotePanel title="AC" lastUpdated={lastUpdated}>
      {err && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-white/80">
          {power ? "On" : "Off"}
          {(pending || loading) ? <span className="text-xs text-white/40"> • syncing…</span> : null}
        </div>

        <button
          type="button"
          onClick={() => send("power", !power)}
          disabled={disabled}
          className={`px-4 py-2 rounded-full text-sm font-semibold border transition disabled:opacity-50
            ${power ? "bg-white text-black border-white/20" : "bg-white/5 text-white border-white/10 hover:bg-white/10"}`}
        >
          {power ? "Turn off" : "Turn on"}
        </button>
      </div>

      {/* Temperature */}
      <div className={`mt-4 ${locked ? "opacity-40 pointer-events-none" : ""}`}>
        <div className="flex items-center justify-between">
          <div className="text-xs text-white/45">Temperature</div>
          <div className="text-sm text-white/85 font-semibold">{tempDraft}°C</div>
        </div>

        <input
          type="range"
          min={16}
          max={30}
          value={tempDraft}
          onChange={(e) => {
            const val = Number(e.target.value);
            setTempDraft(val);
            if (tempTimer.current) clearTimeout(tempTimer.current);
            tempTimer.current = setTimeout(() => send("temperature", val), 260);
          }}
          className="w-full mt-2 accent-white"
        />
      </div>

      {/* Mode + Fan */}
      <div className={`mt-4 space-y-3 ${locked ? "opacity-40 pointer-events-none" : ""}`}>
        <div>
          <div className="text-xs text-white/45 mb-2">Mode</div>
          <div className="flex gap-2 flex-wrap">
            {(["cool", "heat", "fan", "dry"] as AcMode[]).map((m) => (
              <Chip key={m} active={mode === m} onClick={() => send("mode", m)} disabled={disabled}>
                {m.toUpperCase()}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-white/45 mb-2">Fan</div>
          <div className="flex gap-2 flex-wrap">
            {(["low", "medium", "high", "auto"] as FanSpeed[]).map((f) => (
              <Chip key={f} active={fanSpeed === f} onClick={() => send("fanSpeed", f)} disabled={disabled}>
                {f.toUpperCase()}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* Swing */}
      <div className={`mt-4 flex items-center justify-between ${locked ? "opacity-40 pointer-events-none" : ""}`}>
        <div className="text-xs text-white/45">Swing</div>
        <button
          type="button"
          onClick={() => send("swing", !swing)}
          disabled={disabled}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition disabled:opacity-50
            ${swing ? "bg-white text-black border-white/20" : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"}`}
        >
          {swing ? "ON" : "OFF"}
        </button>
      </div>

      {!deviceId && (
        <div className="mt-3 text-[11px] text-white/40">
          No AC device linked yet.
        </div>
      )}
    </RemotePanel>
  );
}
