// src/app/components/remotes/LightPanel.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RemotePanel from "./RemotePanel";
import { signalService } from "@/services/signalService";
import useAuth from "@/hooks/useAuth";
import { useDeviceLiveState } from "@/hooks/useDeviceLiveState";
import GangRingSwitch from "@/app/components/devices/GangRingSwitch";

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
  title = "Light",
}: {
  deviceId?: string;
  lastUpdated?: number;
  onInteraction?: () => void;
  title?: string;
}) {
  const { user } = useAuth();
  const estateId = useMemo(
    () =>
      user?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user?.estate_id]
  );

  const { state, loading, refresh } = useDeviceLiveState(deviceId, estateId);

  const isOn = useMemo(() => pickBool(state, ["power", "on", "switch"], false), [state]);
  const brightness = useMemo(
    () => pickNumber(state, ["brightness", "dimmer", "level"], 70),
    [state]
  );

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
    }, 3000);
  }

  useEffect(() => {
    const expected = expectedRef.current;
    if (!expected) return;

    const derived = { power: isOn, brightness };
    if (derived[expected.key] === expected.value) {
      expectedRef.current = null;
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      setPending(false);
    }
  }, [isOn, brightness]);

  async function sendPower(next: boolean) {
    if (!deviceId) return setErr("No light linked.");
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
    if (!deviceId) return setErr("No light linked.");
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
  const mutedControls = !isOn || disabled;

  return (
    <RemotePanel title={title} lastUpdated={lastUpdated}>
      {err && (
        <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-white/80">
          {isOn ? "On" : "Off"}
          {pending || loading ? (
            <span className="text-xs text-white/40"> • syncing…</span>
          ) : null}
        </div>

        <GangRingSwitch
          gangCount={1}
          online={deviceId ? true : null}
          values={[isOn]}
          busy={pending || loading}
          onToggleGang={(_, next) => sendPower(next)}
          size={58}
        />
      </div>

      <div className={`mt-4 ${mutedControls ? "opacity-40 pointer-events-none" : ""}`}>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-white/45">Brightness</label>
          <div className="text-xs text-white/60">{brightDraft}%</div>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          value={brightDraft}
          onChange={(e) => {
            const val = Number(e.target.value);
            setBrightDraft(val);

            if (brightTimer.current) clearTimeout(brightTimer.current);
            brightTimer.current = setTimeout(() => sendBrightness(val), 250);
          }}
          className="w-full accent-white"
        />
      </div>

      {!deviceId && <div className="mt-3 text-[11px] text-white/40">No light linked yet.</div>}
    </RemotePanel>
  );
}
