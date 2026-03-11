"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
    if (s === "locked" || s === "lock") return true;
    if (s === "unlocked" || s === "unlock") return false;
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
  const router = useRouter();
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
      expectedRef.current = null;
      setPending(false);
    }, 3000);
  }

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
    if (!deviceId) return setErr("No door device selected.");

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
    <RemotePanel title="Door" lastUpdated={lastUpdated}>
      {err && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-white/80">
          {locked ? "Locked" : "Unlocked"}
          {(pending || loading) ? <span className="text-xs text-white/40"> • syncing…</span> : null}
        </div>

        <button
          type="button"
          onClick={() => sendLock(!locked)}
          disabled={disabled}
          className={`px-4 py-2 rounded-full text-sm font-semibold border transition disabled:opacity-50
            ${
              locked
                ? "bg-white text-black border-white/20"
                : "bg-white/5 text-white border-white/10 hover:bg-white/10"
            }`}
        >
          {locked ? "Unlock" : "Lock"}
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        {hasCamera ? (
          <button
            type="button"
            onClick={() => {
              touch();
              router.push("/devices");
            }}
            className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/85 text-sm border border-white/10"
          >
            Open camera
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => {
            touch();
            router.push("/visitors");
          }}
          className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-semibold border border-white/20"
        >
          Access log
        </button>
      </div>

      {!deviceId && (
        <div className="mt-3 text-[11px] text-white/40">
          No door lock linked yet.
        </div>
      )}
    </RemotePanel>
  );
}
