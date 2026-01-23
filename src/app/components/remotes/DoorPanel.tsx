"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RemotePanel from "./RemotePanel";
import { signalService } from "@/services/signalService";
import useAuth from "@/hooks/useAuth";
import { useDeviceLiveState } from "@/hooks/useDeviceLiveState";

function pickLocked(state: any, keys: string[], fallback: boolean) {
  for (const k of keys) {
    const v = state?.[k];
    if (typeof v === "boolean") return v;

    if (v === 1 || v === 0) return !!v;

    const s = String(v ?? "").toLowerCase();
    if (s === "locked") return true;
    if (s === "unlocked") return false;
    if (s === "lock") return true;
    if (s === "unlock") return false;
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
    () =>
      user?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user?.estate_id]
  );

  const { state, loading, refresh } = useDeviceLiveState(deviceId, estateId);

  const locked = useMemo(
    () => pickLocked(state, ["locked", "lock", "isLocked", "doorLocked", "state"], true),
    [state]
  );

  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pendingTimer = useRef<any>(null);
  const expectedRef = useRef<{ locked: boolean } | null>(null);

  function touch() {
    onInteraction?.();
  }

  function startPending(expectedLocked: boolean) {
    expectedRef.current = { locked: expectedLocked };
    setPending(true);

    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => {
      // fallback: stop waiting even if device doesn't report back
      expectedRef.current = null;
      setPending(false);
    }, 3500);
  }

  // ✅ Confirm by live state update
  useEffect(() => {
    const expected = expectedRef.current;
    if (!expected) return;

    if (locked === expected.locked) {
      expectedRef.current = null;
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      setPending(false);
    }
  }, [locked]);

  async function sendLock(nextLocked: boolean) {
    if (!deviceId) {
      setErr("No Door device selected.");
      return;
    }

    setErr(null);
    touch();
    startPending(nextLocked);

    try {
      const resp = await signalService.sendDeviceCommand({
        deviceId,
        capability: "lock",
        value: nextLocked ? "locked" : "unlocked",
        meta: { panel: "door" },
      });

      if (resp?.status !== "accepted") throw new Error("Command not accepted");

      // Backup pull in case socket missed
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
          Status: <span className="text-white">{locked ? "Locked" : "Unlocked"}</span>{" "}
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
            onClick={async () => {
              if (!deviceId) return;
              setErr(null);
              touch();
              try {
                await signalService.sendDeviceCommand({
                  deviceId,
                  capability: "doorbell",
                  value: "ring",
                  meta: { panel: "door" },
                });
              } catch (e: any) {
                setErr(e?.response?.data?.error || e?.message || "Ring failed");
              }
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
