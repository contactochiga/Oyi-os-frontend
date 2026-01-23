// src/app/components/remotes/DoorPanel.tsx
"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import RemotePanel from "./RemotePanel";
import { signalService } from "@/services/signalService";
import useAuth from "@/hooks/useAuth";
import { useDeviceLiveState } from "@/hooks/useDeviceLiveState";

function pickBool(state: any, keys: string[], fallback: boolean) {
  for (const k of keys) {
    const v = state?.[k];
    if (typeof v === "boolean") return v;
    if (v === 1 || v === 0) return !!v;
    if (v === "locked") return true;
    if (v === "unlocked") return false;
  }
  return fallback;
}

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
  const { user } = useAuth();
  const estateId = useMemo(
    () => user?.estate_id ?? (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user?.estate_id]
  );

  const { state, loading } = useDeviceLiveState(deviceId, estateId);

  const locked = useMemo(() => pickBool(state, ["locked", "lock", "isLocked", "doorLocked"], true), [state]);

  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pendingTimer = useRef<any>(null);

  function touch() {
    onInteraction?.();
  }

  async function sendLock(nextLocked: boolean) {
    if (!deviceId) {
      setErr("No Door device selected.");
      return;
    }

    setErr(null);
    setPending(true);
    touch();

    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => setPending(false), 3500);

    try {
      const resp = await signalService.sendDeviceCommand({
        deviceId,
        capability: "lock",
        value: nextLocked ? "locked" : "unlocked",
        meta: { panel: "door" },
      });

      if (resp?.status !== "accepted") throw new Error("Command not accepted");
      setTimeout(() => setPending(false), 250);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed");
      setPending(false);
    }
  }

  useEffect(() => {
    return () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    };
  }, []);

  const disabled = pending || !deviceId;

  return (
    <RemotePanel title="Front Door" lastUpdated={lastUpdated}>
      {err && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-300">
          Status:{" "}
          <span className="text-white">{locked ? "Locked" : "Unlocked"}</span>{" "}
          {(pending || loading) && <span className="text-xs text-gray-400">• syncing…</span>}
        </span>

        <button
          onClick={() => sendLock(!locked)}
          disabled={disabled}
          className={`px-4 py-2 rounded-full text-sm font-medium transition disabled:opacity-50
            ${locked ? "bg-[#E11D2E]" : "bg-gray-700"}`}
        >
          {locked ? "Unlock" : "Lock"}
        </button>
      </div>

      {hasCamera && (
        <div className="mb-4 rounded-xl overflow-hidden border border-gray-800">
          <div className="h-36 bg-black flex items-center justify-center text-xs text-gray-400">
            Camera Feed (panel wired separately)
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {hasCamera && (
          <button
            onClick={() => {
              signalService.sendDeviceCommand({
                deviceId: deviceId!,
                capability: "doorbell",
                value: "ring",
                meta: { panel: "door" },
              });
              touch();
            }}
            disabled={!deviceId}
            className="btn-tv disabled:opacity-50"
          >
            Ring
          </button>
        )}

        <button
          onClick={() => {
            // placeholder (you can wire /access/log later)
            touch();
          }}
          className="btn-tv"
        >
          Access Log
        </button>
      </div>

      {!deviceId && (
        <div className="mt-3 text-[11px] text-gray-500">
          No Door device bound yet. Bind a Door lock to enable commands.
        </div>
      )}
    </RemotePanel>
  );
}
