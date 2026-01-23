"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RemotePanel from "./RemotePanel";
import { signalService } from "@/services/signalService";
import useAuth from "@/hooks/useAuth";
import { useDeviceLiveState } from "@/hooks/useDeviceLiveState";

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

export default function LightPanel({
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

  // Authoritative
  const isOn = useMemo(() => pickBool(state, ["power", "on", "switch"], false), [state]);
  const brightness = useMemo(() => pickNumber(state, ["brightness", "dimmer", "level"], 70), [state]);

  // Draft for slider UX
  const [brightDraft, setBrightDraft] = useState<number>(brightness);
  useEffect(() => setBrightDraft(brightness), [brightness]);

  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pendingTimer = useRef<any>(null);
  const brightTimer = useRef<any>(null);

  const expectedRef = useRef<{ key: "power" | "brightness"; value: any } | null>(null);

  function touch() {
    onInteraction?.();
  }

  function startPending(key: "power" | "brightness", value: any) {
    expectedRef.current = { key, value };
    setPending(true);

    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => {
      expectedRef.current = null;
      setPending(false);
    }, 3500);
  }

  // Confirm by live state
  useEffect(() => {
    const expected = expectedRef.current;
    if (!expected) return;

    const derived = {
      power: isOn,
      brightness,
    };

    if (derived[expected.key] === expected.value) {
      expectedRef.current = null;
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      setPending(false);
    }
  }, [isOn, brightness]);

  async function sendPower(next: boolean) {
    if (!deviceId) return setErr("No light device selected.");
    setErr(null);
    touch();
    startPending("power", next);

    try {
      const resp = await signalService.sendDeviceCommand({
        deviceId,
        capability: "power",
        value: next,
        meta: { panel: "light" },
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

  async function sendBrightness(val: number) {
    if (!deviceId) return setErr("No light device selected.");
    setErr(null);
    touch();
    startPending("brightness", val);

    try {
      const resp = await signalService.sendDeviceCommand({
        deviceId,
        capability: "brightness",
        value: val,
        meta: { panel: "light" },
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
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      if (brightTimer.current) clearTimeout(brightTimer.current);
    };
  }, []);

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
          Status: <span className="text-white">{isOn ? "On" : "Off"}</span>{" "}
          {(pending || loading) && <span className="text-xs text-gray-400">• syncing…</span>}
        </span>

        <button
          onClick={() => sendPower(!isOn)}
          disabled={disabled}
          className={`px-4 py-2 rounded-full text-sm font-medium transition disabled:opacity-50
            ${isOn ? "bg-[#E11D2E]" : "bg-gray-700 hover:bg-gray-600"}`}
        >
          {isOn ? "Turn off" : "Turn on"}
        </button>
      </div>

      <div className={`${(!isOn || disabled) ? "opacity-40 pointer-events-none" : ""}`}>
        <label className="block text-xs text-gray-400 mb-2">
          Brightness ({brightDraft}%)
        </label>

        <input
          type="range"
          min={0}
          max={100}
          value={brightDraft}
          onChange={(e) => {
            const val = Number(e.target.value);
            setBrightDraft(val);

            if (brightTimer.current) clearTimeout(brightTimer.current);
            brightTimer.current = setTimeout(() => {
              sendBrightness(val);
            }, 250);
          }}
          className="w-full accent-[#E11D2E]"
        />
      </div>

      {!deviceId && (
        <div className="mt-3 text-[11px] text-gray-500">
          No Light device bound yet. Bind a Light device to enable commands.
        </div>
      )}
    </RemotePanel>
  );
}
