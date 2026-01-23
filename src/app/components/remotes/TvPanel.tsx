// src/app/components/remotes/TvPanel.tsx
"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import RemotePanel from "./RemotePanel";
import { signalService } from "@/services/signalService";
import useAuth from "@/hooks/useAuth";
import { useDeviceLiveState } from "@/hooks/useDeviceLiveState";

type Mode = "trackpad" | "numbers";

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

export default function TvPanel({
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
    () => user?.estate_id ?? (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user?.estate_id]
  );

  const { state, loading } = useDeviceLiveState(deviceId, estateId);
  const tvOn = useMemo(() => pickBool(state, ["power", "on", "tvOn"], true), [state]);

  const [mode, setMode] = useState<Mode>("trackpad");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pendingTimer = useRef<any>(null);

  function touch() {
    onInteraction?.();
  }

  async function sendAction(action: string) {
    if (!deviceId) {
      setErr("No TV device selected.");
      return;
    }

    setErr(null);
    setPending(true);
    touch();

    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => setPending(false), 2500);

    try {
      const resp = await signalService.sendDeviceCommand({
        deviceId,
        capability: "action",
        value: action,
        meta: { panel: "tv" },
      });

      if (resp?.status !== "accepted") throw new Error("Command not accepted");
      setTimeout(() => setPending(false), 200);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed");
      setPending(false);
    }
  }

  async function togglePower() {
    await sendAction("power");
  }

  useEffect(() => {
    return () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    };
  }, []);

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
          onClick={togglePower}
          disabled={disabled}
          className={`px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50
            ${tvOn ? "bg-[#E11D2E]" : "bg-gray-700"}`}
        >
          {tvOn ? "Turn off" : "Turn on"}{" "}
          {(pending || loading) && <span className="text-xs text-gray-200/70">…</span>}
        </button>

        <button
          onClick={() => sendAction("mute")}
          disabled={disabled}
          className="px-4 py-2 rounded-full bg-gray-700 text-sm disabled:opacity-50"
        >
          Mute
        </button>
      </div>

      {/* VOL / CH */}
      <div className="flex justify-between mb-6">
        <div className="flex flex-col gap-2">
          <button onClick={() => sendAction("vol_up")} disabled={disabled} className="btn-tv disabled:opacity-50">
            Vol +
          </button>
          <button onClick={() => sendAction("vol_down")} disabled={disabled} className="btn-tv disabled:opacity-50">
            Vol -
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <button onClick={() => sendAction("ch_up")} disabled={disabled} className="btn-tv disabled:opacity-50">
            Ch ↑
          </button>
          <button onClick={() => sendAction("ch_down")} disabled={disabled} className="btn-tv disabled:opacity-50">
            Ch ↓
          </button>
        </div>
      </div>

      {/* CENTER CONTROL */}
      {mode === "trackpad" ? (
        <div className="flex flex-col items-center gap-2 mb-6">
          <button onClick={() => sendAction("up")} disabled={disabled} className="btn-dir disabled:opacity-50">
            ↑
          </button>

          <div className="flex gap-2">
            <button onClick={() => sendAction("left")} disabled={disabled} className="btn-dir disabled:opacity-50">
              ←
            </button>
            <button onClick={() => sendAction("ok")} disabled={disabled} className="btn-ok disabled:opacity-50">
              OK
            </button>
            <button onClick={() => sendAction("right")} disabled={disabled} className="btn-dir disabled:opacity-50">
              →
            </button>
          </div>

          <button onClick={() => sendAction("down")} disabled={disabled} className="btn-dir disabled:opacity-50">
            ↓
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
            <button
              key={n}
              onClick={() => sendAction(`num_${n}`)}
              disabled={disabled}
              className="btn-num disabled:opacity-50"
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {/* BOTTOM */}
      <div className="flex justify-between items-center">
        <button onClick={() => sendAction("home")} disabled={disabled} className="btn-tv disabled:opacity-50">
          Home
        </button>

        <button
          onClick={() => setMode(mode === "trackpad" ? "numbers" : "trackpad")}
          className="btn-tv"
        >
          {mode === "trackpad" ? "123" : "Pad"}
        </button>
      </div>

      {!deviceId && (
        <div className="mt-3 text-[11px] text-gray-500">
          No TV device bound yet. Bind a TV device to enable commands.
        </div>
      )}
    </RemotePanel>
  );
}
