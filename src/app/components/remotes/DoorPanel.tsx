"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RemotePanel from "./RemotePanel";
import { signalService } from "@/services/signalService";
import useActiveContext from "@/hooks/useActiveContext";
import { useDeviceLiveState } from "@/hooks/useDeviceLiveState";
import { deviceService, type SmartAccessResponse } from "@/services/deviceService";

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

function capEvidence(smart: SmartAccessResponse | null, group: string, key: string) {
  return smart?.profile?.capabilities?.[group]?.[key] || null;
}

function isReadable(smart: SmartAccessResponse | null, group: string, key: string) {
  return capEvidence(smart, group, key)?.readableByOyi === true;
}

function isExecutable(smart: SmartAccessResponse | null, group: string, key: string) {
  return capEvidence(smart, group, key)?.executableByOyi === true;
}

function batteryLabel(value: number | null | undefined, level?: string | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Battery unknown";
  const quality = level && level !== "unknown" ? ` · ${level[0]?.toUpperCase()}${level.slice(1)}` : "";
  return `${Math.round(value)}%${quality}`;
}

function capabilityNote(smart: SmartAccessResponse | null, group: string, key: string, labels: { missing?: string; declared?: string; unavailable?: string; verification?: string }) {
  const evidence = capEvidence(smart, group, key);
  if (!evidence) return null;
  if (evidence.status === "mapping_missing") return labels.missing || evidence.reason || "Provider setup is incomplete.";
  if (evidence.status === "provider_declared_only") return labels.declared || evidence.reason || "Provider capability detected, but not verified.";
  if (evidence.status === "verification_required") return labels.verification || evidence.reason || "This capability needs live verification before use.";
  if (["temporarily_unavailable", "permission_denied", "provider_disconnected"].includes(evidence.status)) {
    return labels.unavailable || evidence.reason || "This capability is temporarily unavailable.";
  }
  return null;
}

function recordDate(value: any) {
  const raw = String(value || "").trim();
  if (!raw) return "Recently";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
  const activeContext = useActiveContext();
  const estateId = activeContext.estate_id;

  const { state, runtime, loading, refresh } = useDeviceLiveState(deviceId, estateId);
  const [smartAccess, setSmartAccess] = useState<SmartAccessResponse | null>(null);
  const [smartLoading, setSmartLoading] = useState(false);

  const locked = useMemo(
    () => {
      const smartLocked = smartAccess?.profile?.state?.locked;
      if (typeof smartLocked === "boolean") return smartLocked;
      return pickLocked(state, ["locked", "lock", "isLocked", "doorLocked", "state"], true);
    },
    [state, smartAccess]
  );
  const controlEvidence = useMemo(() => {
    const family = String(runtime?.device_family || runtime?.control_profile || "").toLowerCase();
    const runtimeLooksAccess = /lock|door|access|smart_access/.test(family);
    return {
      canLock: isExecutable(smartAccess, "control", "lock"),
      canUnlock: isExecutable(smartAccess, "control", "unlock"),
      hasLockState: isReadable(smartAccess, "state", "lock_state") || runtimeLooksAccess,
      hasHistory: isReadable(smartAccess, "history", "access_records"),
      hasCredentials: isExecutable(smartAccess, "credentials", "temporary_code"),
      hasMembers: isReadable(smartAccess, "members", "list"),
      hasMedia: isReadable(smartAccess, "media", "live_view") || isExecutable(smartAccess, "media", "live_view"),
      hasDoorbell: isReadable(smartAccess, "doorbell", "events"),
    };
  }, [runtime, smartAccess]);

  const [pending, setPending] = useState(false);
  const [confirmingUnlock, setConfirmingUnlock] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pendingTimer = useRef<any>(null);
  const expectedRef = useRef<{ locked: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!deviceId || !activeContext.home_id) {
      setSmartAccess(null);
      return;
    }
    setSmartLoading(true);
    deviceService.getSmartAccess(deviceId)
      .then((payload) => {
        if (!cancelled) setSmartAccess(payload);
      })
      .catch(() => {
        if (!cancelled) setSmartAccess(null);
      })
      .finally(() => {
        if (!cancelled) setSmartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deviceId, activeContext.contextKey, activeContext.home_id]);

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
    if (nextLocked && !controlEvidence.canLock) return setErr("This lock does not support remote locking.");
    if (!nextLocked && !controlEvidence.canUnlock) return setErr("Remote unlock is not supported by this lock.");

    setErr(null);
    setConfirmingUnlock(false);
    touch();
    startPending(nextLocked);

    try {
      const resp = await signalService.sendDeviceCommand({
        deviceId,
        capability: "lock",
        value: nextLocked ? "locked" : "unlocked",
        estateId: activeContext.estate_id || undefined,
        homeId: activeContext.home_id || undefined,
        meta: {
          panel: "door",
          unlock_confirmed: !nextLocked,
          idempotency_key: `${activeContext.contextKey}:${deviceId}:lock:${nextLocked ? "locked" : "unlocked"}:${Date.now()}`,
        },
      });

      if (!resp?.ok && !["accepted", "command_accepted"].includes(String(resp?.status || ""))) {
        throw new Error(nextLocked ? "I could not start locking this door." : "I could not start unlocking this door.");
      }
      setTimeout(() => refresh(), 450);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "I could not complete that door action.");
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

  const nextControlSupported = locked ? controlEvidence.canUnlock : controlEvidence.canLock;
  const disabled = pending || !deviceId || !nextControlSupported;
  const actionLabel = pending ? (expectedRef.current?.locked ? "Locking..." : "Unlocking...") : locked ? "Unlock" : "Lock";
  const accessState = smartAccess?.profile?.state;
  const batteryLow = accessState?.batteryLow === true;
  const battery = accessState?.batteryPercentage;
  const batteryLevel = accessState?.batteryLevel;
  const securityAlert = accessState?.tamperActive || accessState?.wrongAttemptActive;
  const recentRecords = smartAccess?.records || [];
  const lockUnavailableNote = locked
    ? capabilityNote(smartAccess, "control", "unlock", {
        missing: "Remote unlock is unavailable through this connection.",
        declared: "Remote unlock is detected, but provider setup is not verified.",
        verification: "Remote unlock needs live verification before Oyi enables it.",
      })
    : capabilityNote(smartAccess, "control", "lock", {
        missing: "Remote lock is unavailable through this connection.",
        declared: "Remote lock is detected, but provider setup is not verified.",
        verification: "Remote lock needs live verification before Oyi enables it.",
      });
  const batteryUnavailableNote = capabilityNote(smartAccess, "state", "battery", {
    declared: "Battery is detected, but Oyi cannot read it yet.",
    unavailable: "Battery is unavailable through the current provider connection.",
  });
  const temporaryAccessNote = capabilityNote(smartAccess, "credentials", "temporary_code", {
    declared: "Temporary access detected. Provider setup is required before Oyi can manage codes.",
    verification: "Temporary access needs live verification before use.",
  });
  const accessRecordsNote = capabilityNote(smartAccess, "history", "access_records", {
    declared: "Access history detected. Event retrieval is not verified yet.",
    unavailable: "Access history is unavailable through this connection.",
  });
  const doorbellNote = capabilityNote(smartAccess, "doorbell", "events", {
    declared: "Doorbell capability detected. Event connection is not verified.",
    unavailable: "Doorbell events are unavailable through this connection.",
  });

  return (
    <RemotePanel title="Door" lastUpdated={lastUpdated}>
      {err && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-white/80">
          {controlEvidence.hasLockState ? (locked ? "Locked" : "Unlocked") : "Lock state unknown"}
          {(pending || loading) ? <span className="text-xs text-white/40"> • syncing…</span> : null}
          {smartLoading ? <span className="block text-xs text-white/42">Checking access capabilities…</span> : null}
          {!nextControlSupported ? <span className="block text-xs text-white/42">{lockUnavailableNote || `This lock does not support ${locked ? "remote unlock" : "remote lock"}.`}</span> : null}
        </div>

        <button
          type="button"
          onClick={() => {
            if (locked) setConfirmingUnlock(true);
            else void sendLock(true);
          }}
          disabled={disabled}
          className={`px-4 py-2 rounded-full text-sm font-semibold border transition disabled:opacity-50
            ${
              locked
                ? "bg-white text-black border-white/20"
                : "bg-white/5 text-white border-white/10 hover:bg-white/10"
            }`}
        >
          {actionLabel}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className={`rounded-2xl border px-3 py-2 ${batteryLow ? "border-amber-300/25 bg-amber-400/10 text-amber-50" : "border-white/10 bg-white/5 text-white/72"}`}>
          <div className="text-white/45">Battery</div>
          <div className="mt-0.5 font-semibold">{batteryLabel(battery, batteryLevel)}</div>
          {batteryUnavailableNote && typeof battery !== "number" ? <div className="mt-1 text-[11px] text-white/42">{batteryUnavailableNote}</div> : null}
        </div>
        <div className={`rounded-2xl border px-3 py-2 ${securityAlert ? "border-red-300/25 bg-red-500/10 text-red-50" : "border-white/10 bg-white/5 text-white/72"}`}>
          <div className="text-white/45">Security</div>
          <div className="mt-0.5 font-semibold">{securityAlert ? "Needs attention" : "No alert reported"}</div>
        </div>
      </div>

      {confirmingUnlock ? (
        <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-xs text-amber-50">
          <div className="font-medium text-amber-50">Unlock this door?</div>
          <div className="mt-1 text-amber-50/72">I found the linked lock. Unlocking will allow access to this home.</div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void sendLock(false)} className="flex-1 rounded-full bg-white px-3 py-2 font-semibold text-black">
              Unlock now
            </button>
            <button type="button" onClick={() => setConfirmingUnlock(false)} className="flex-1 rounded-full border border-white/10 px-3 py-2 text-white/76">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        {(hasCamera && controlEvidence.hasMedia) ? (
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

        {controlEvidence.hasHistory ? (
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
        ) : null}
      </div>

      {(controlEvidence.hasCredentials || controlEvidence.hasMembers || controlEvidence.hasDoorbell || temporaryAccessNote || accessRecordsNote || doorbellNote) ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/68">
          {controlEvidence.hasCredentials ? <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Temporary access available</div> : null}
          {temporaryAccessNote && !controlEvidence.hasCredentials ? <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">{temporaryAccessNote}</div> : null}
          {accessRecordsNote && !controlEvidence.hasHistory ? <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">{accessRecordsNote}</div> : null}
          {controlEvidence.hasMembers ? <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Member access available</div> : null}
          {controlEvidence.hasDoorbell ? <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Doorbell events active</div> : null}
          {doorbellNote && !controlEvidence.hasDoorbell ? <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">{doorbellNote}</div> : null}
        </div>
      ) : null}

      {recentRecords.length ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2 text-xs font-semibold text-white/70">Latest access</div>
          <div className="space-y-2">
            {recentRecords.slice(0, 3).map((record: any) => (
              <div key={String(record.id || `${record.event_type}-${record.occurred_at}`)} className="flex items-center justify-between gap-3 text-xs text-white/66">
                <span>{String(record.event_type || "Access event").replace(/_/g, " ")}</span>
                <span className="text-white/38">{recordDate(record.occurred_at)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!deviceId && (
        <div className="mt-3 text-[11px] text-white/40">
          No door lock linked yet.
        </div>
      )}
    </RemotePanel>
  );
}
