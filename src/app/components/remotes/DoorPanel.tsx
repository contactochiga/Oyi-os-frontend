"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, Battery, LockKeyhole, LockKeyholeOpen, Settings, ShieldCheck, Wifi } from "lucide-react";
import RemotePanel from "./RemotePanel";
import { signalService } from "@/services/signalService";
import useActiveContext from "@/hooks/useActiveContext";
import { useDeviceLiveState } from "@/hooks/useDeviceLiveState";
import { deviceService, type SmartAccessResponse } from "@/services/deviceService";

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

function batteryTruthLabel(value: number | null | undefined, level?: string | null, confirmedAt?: string | null, freshness?: string | null, providerState?: string | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Battery unavailable";
  const quality = level && level !== "unknown" ? ` · ${level[0]?.toUpperCase()}${level.slice(1)}` : "";
  const when = timeAgo(confirmedAt);
  const label = `${Math.round(value)}%${quality}`;
  if (!when) return label;
  if (freshness === "fresh" && providerState === "connected") return `${label} · Updated ${when}`;
  return `${label} · Last reported ${when}`;
}

function availabilityLabel(value: any) {
  const raw = String(value || "").toLowerCase();
  if (raw === "online") return "Online";
  if (raw === "offline") return "Offline";
  if (raw === "stale") return "Stale";
  if (raw === "provider_disconnected") return "Provider disconnected";
  if (raw === "setup_incomplete") return "Setup incomplete";
  return "Availability unknown";
}

function smartAccessAvailabilityCopy(providerState: string, reachability: string, availability: string, availabilityReason: string) {
  if (providerState === "reconnect_required" || providerState === "disconnected") return "Connection unavailable";
  if (providerState === "connected" && reachability === "unknown") return "Connection online";
  if (availabilityReason === "provider_reports_offline") return "Provider reports offline";
  return availabilityLabel(availability);
}

function smartAccessStateConfidenceCopy(input: {
  primaryConfidence: string;
  providerUnavailable: boolean;
  lastConfirmed?: string | null;
  lockFreshness: string;
}) {
  if (input.primaryConfidence === "live") return "Live state";
  if (input.providerUnavailable && input.lastConfirmed) return `Last known state · updated ${timeAgo(input.lastConfirmed)}`;
  if (input.lockFreshness === "expired") return "Last report is too old to rely on";
  if (input.primaryConfidence === "last_confirmed" && input.lastConfirmed) return `Last confirmed ${timeAgo(input.lastConfirmed)}`;
  if (input.primaryConfidence === "unknown") return "State confidence unknown";
  return "Inferred state";
}

function timeAgo(value: any) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
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

  const { runtime, loading, refresh } = useDeviceLiveState(deviceId, estateId);
  const [smartAccess, setSmartAccess] = useState<SmartAccessResponse | null>(null);
  const [smartLoading, setSmartLoading] = useState(false);

  const truth = smartAccess?.profile?.truth;
  const accessState = smartAccess?.profile?.state;
  const truthLockState = truth?.lock_state || (accessState?.lockState === "locked" || accessState?.lockState === "unlocked" ? accessState.lockState : "unknown");
  const locked = useMemo(
    () => {
      if (truthLockState === "locked") return true;
      if (truthLockState === "unlocked") return false;
      return null;
    },
    [truthLockState]
  );
  const controlEvidence = useMemo(() => {
    const family = String(runtime?.device_family || runtime?.control_profile || "").toLowerCase();
    const runtimeLooksAccess = /lock|door|access|smart_access/.test(family);
    return {
      canLock: isExecutable(smartAccess, "control", "lock"),
      canUnlock: isExecutable(smartAccess, "control", "unlock"),
      hasLockState: truthLockState === "locked" || truthLockState === "unlocked" || isReadable(smartAccess, "state", "lock_state") || runtimeLooksAccess,
      hasHistory: isReadable(smartAccess, "history", "access_records"),
      hasCredentials: isExecutable(smartAccess, "credentials", "temporary_code"),
      hasMembers: isReadable(smartAccess, "members", "list"),
      hasMedia: isReadable(smartAccess, "media", "live_view") || isExecutable(smartAccess, "media", "live_view"),
      hasDoorbell: isReadable(smartAccess, "doorbell", "events"),
    };
  }, [runtime, smartAccess, truthLockState]);

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

  const nextControlSupported = locked === true ? controlEvidence.canUnlock : locked === false ? controlEvidence.canLock : false;
  const disabled = pending || !deviceId || !nextControlSupported;
  const actionLabel = pending ? (expectedRef.current?.locked ? "Locking..." : "Unlocking...") : locked === true ? "Unlock" : "Lock";
  const presentation = (runtime as any)?.canonical_presentation || (runtime as any)?.presentation || null;
  const canonical = (runtime as any)?.canonical_state || (runtime as any)?.canonicalState || null;
  const providerConnectionState = truth?.provider_connection_state || accessState?.provider_connection_state || "unknown";
  const deviceReachability = truth?.device_reachability || accessState?.device_reachability || "unknown";
  const lockFreshness = truth?.lock_state_freshness || accessState?.lock_state_freshness || "unknown";
  const lockConfirmedAt = truth?.lock_state_confirmed_at || accessState?.lock_state_confirmed_at || null;
  const batteryFreshness = truth?.battery_freshness || accessState?.battery_freshness || "unknown";
  const batteryConfirmedAt = truth?.battery_confirmed_at || accessState?.battery_confirmed_at || null;
  const providerUnavailable = providerConnectionState === "disconnected" || providerConnectionState === "reconnect_required";
  const availability = String(providerUnavailable ? "offline" : deviceReachability === "online" ? "online" : deviceReachability === "offline" ? "offline" : presentation?.availability || canonical?.availability || "unknown");
  const availabilityReason = String(presentation?.availabilityReason || canonical?.availabilityReason || "unknown");
  const lastSeen = lockConfirmedAt || presentation?.lastSeenAt || canonical?.lastSeenAt || (runtime as any)?.lastSeen || null;
  const lastChecked = presentation?.lastCheckedAt || canonical?.lastProviderSyncAt || (runtime as any)?.last_refresh || null;
  const lastConfirmed = lockConfirmedAt || presentation?.lastConfirmedStateAt || canonical?.lastSeenAt || null;
  const roomName = presentation?.assignment?.roomName || (runtime as any)?.room_name || (smartAccess?.device as any)?.room_name || "Unassigned";
  const lockLive = providerConnectionState === "connected" && deviceReachability === "online" && lockFreshness === "fresh" && locked !== null;
  const primaryConfidence = lockLive ? "live" : lockFreshness === "fresh" || lockFreshness === "stale" ? "last_confirmed" : "unknown";
  const stateSummary = String(presentation?.summary || "").trim();
  const battery = typeof truth?.battery_level === "number" ? truth.battery_level : typeof presentation?.batteryPercentage === "number" ? presentation.batteryPercentage : accessState?.batteryPercentage;
  const batteryLevel = typeof battery === "number" ? (battery <= 20 ? "critical" : battery <= 35 ? "low" : "normal") : presentation?.batteryLevel || accessState?.batteryLevel;
  const batteryLow = accessState?.batteryLow === true || batteryLevel === "critical";
  const securityAlert = accessState?.tamperActive || accessState?.wrongAttemptActive;
  const recentRecords = smartAccess?.records || [];
  const operationMatrix = smartAccess?.profile?.operation_matrix || [];
  const LockIcon = locked === false ? LockKeyholeOpen : LockKeyhole;
  const lockTone = availability === "offline" || availability === "provider_disconnected" || availability === "setup_incomplete"
    ? "border-white/10 bg-white/[0.04] text-white/38"
    : batteryLevel === "critical"
      ? "border-rose-300/20 bg-rose-400/10 text-rose-100"
      : locked !== false
        ? "border-emerald-300/18 bg-emerald-400/10 text-emerald-100"
        : "border-amber-300/20 bg-amber-400/10 text-amber-100";
  const availabilityCopy = smartAccessAvailabilityCopy(providerConnectionState, deviceReachability, availability, availabilityReason);
  const timingCopy = availabilityReason === "provider_reports_offline"
    ? (lastChecked ? ` · checked ${timeAgo(lastChecked)}` : "")
    : availability === "offline"
      ? (lastSeen ? ` · last seen ${timeAgo(lastSeen)}` : "")
      : availability === "stale"
        ? (lastSeen ? ` · last updated ${timeAgo(lastSeen)}` : "")
        : "";
  const stateConfidenceCopy = smartAccessStateConfidenceCopy({
    primaryConfidence,
    providerUnavailable,
    lastConfirmed,
    lockFreshness,
  });
  const lockTitle = providerUnavailable && locked !== null
    ? `Last known: ${locked ? "Locked" : "Unlocked"}`
    : lockFreshness === "expired"
      ? "Status unavailable"
      : locked === null
        ? "Lock position unavailable"
        : locked ? "Locked" : "Unlocked";
  const lockUnavailableNote = locked !== false
    ? capabilityNote(smartAccess, "control", "unlock", {
        missing: truth?.remote_unlock_unavailable_reason || "Remote unlock is unavailable through this connection.",
        declared: truth?.remote_unlock_unavailable_reason || "Remote unlock is detected, but provider setup is not verified.",
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
    <RemotePanel title={smartAccess?.device?.name || "Smart Access"} subtitle={`${roomName} · ${availabilityCopy}`} lastUpdated={lastUpdated}>
      {err && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      <section className={`rounded-[28px] border px-4 py-5 text-center ${lockTone}`}>
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-current/20 bg-black/18">
          <LockIcon className="h-9 w-9" />
        </div>
        <div className="mt-4 text-2xl font-semibold tracking-[-0.05em] text-white">
          {lockTitle}
        </div>
        <div className="mt-1 text-xs text-white/54">
          {stateConfidenceCopy}
          {" · "}
          {availabilityCopy}
          {timingCopy}
          {(pending || loading) ? " · syncing..." : ""}
        </div>
        {stateSummary ? <div className="mx-auto mt-2 max-w-[280px] text-xs text-white/46">{stateSummary}</div> : null}
        {providerUnavailable ? (
          <div className="mx-auto mt-2 max-w-[280px] text-xs text-white/50">
            Reconnect provider to resume live updates.
          </div>
        ) : null}
        {smartLoading ? <div className="mt-2 text-xs text-white/42">Checking access capabilities...</div> : null}
        {!nextControlSupported ? (
          <div className="mx-auto mt-4 max-w-[290px] rounded-2xl border border-white/10 bg-black/18 px-3 py-2 text-xs leading-5 text-white/58">
            {lockUnavailableNote || truth?.remote_unlock_unavailable_reason || `Remote ${locked !== false ? "unlock" : "lock"} is unavailable through this connection.`}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (locked) setConfirmingUnlock(true);
              else void sendLock(true);
            }}
            disabled={disabled}
            className={`mt-4 h-11 min-w-[150px] rounded-full text-sm font-semibold transition disabled:opacity-50 ${
              locked ? "bg-white text-black" : "border border-white/10 bg-white/[0.08] text-white hover:bg-white/[0.12]"
            }`}
          >
            {actionLabel}
          </button>
        )}
      </section>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className={`rounded-2xl border px-3 py-2 ${batteryLow || batteryLevel === "critical" ? "border-rose-300/22 bg-rose-400/10 text-rose-50" : "border-white/10 bg-white/5 text-white/72"}`}>
          <Battery className="mb-2 h-4 w-4 opacity-80" />
          <div className="text-white/45">Battery</div>
          <div className="mt-0.5 font-semibold">{batteryTruthLabel(battery, batteryLevel, batteryConfirmedAt, batteryFreshness, providerConnectionState) || batteryLabel(battery, batteryLevel)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white/72">
          <Wifi className="mb-2 h-4 w-4 opacity-80" />
          <div className="text-white/45">Connection</div>
          <div className="mt-0.5 font-semibold">{availabilityCopy}</div>
        </div>
        <div className={`rounded-2xl border px-3 py-2 ${securityAlert ? "border-red-300/25 bg-red-500/10 text-red-50" : "border-white/10 bg-white/5 text-white/72"}`}>
          {securityAlert ? <AlertTriangle className="mb-2 h-4 w-4 opacity-90" /> : <ShieldCheck className="mb-2 h-4 w-4 opacity-80" />}
          <div className="text-white/45">Security</div>
          <div className="mt-0.5 font-semibold">{securityAlert ? "Alert" : "Clear"}</div>
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

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => { touch(); router.push("/activity"); }} className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-3 text-xs text-white/76">
          <Activity className="mx-auto mb-2 h-4 w-4" />
          Show activity
        </button>
        <button type="button" onClick={() => { touch(); router.push("/settings"); }} className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-3 text-xs text-white/76">
          <Settings className="mx-auto mb-2 h-4 w-4" />
          Settings
        </button>
      </div>

      <div className="mt-3 flex gap-2">
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

          {(temporaryAccessNote || accessRecordsNote || doorbellNote || batteryUnavailableNote || operationMatrix.length) ? (
        <details className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/62">
          <summary className="cursor-pointer text-white/76">Check lock health</summary>
          <div className="mt-2 space-y-1 leading-5">
            <p>Additional lock features detected. Temporary access, access history and doorbell features require additional provider setup when listed below.</p>
            {batteryUnavailableNote && typeof battery !== "number" ? <p>{batteryUnavailableNote}</p> : null}
            {temporaryAccessNote ? <p>{temporaryAccessNote}</p> : null}
            {accessRecordsNote ? <p>{accessRecordsNote}</p> : null}
            {doorbellNote ? <p>{doorbellNote}</p> : null}
            {operationMatrix.length ? (
              <p className="pt-1 text-white/40">
                {operationMatrix.filter((item: any) => item.executable === true).length} executable operation(s),{" "}
                {operationMatrix.filter((item: any) => item.provider_declared === true && item.executable !== true).length} provider-declared only.
              </p>
            ) : null}
          </div>
        </details>
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
