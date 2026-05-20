"use client";

import { useMemo } from "react";
import RemotePanel from "./RemotePanel";
import useAuth from "@/hooks/useAuth";
import { useDeviceLiveState } from "@/hooks/useDeviceLiveState";

type SensorStatus = "normal" | "warning" | "critical";

type Sensor = {
  id: string;
  name: string;
  value: string;
  status: SensorStatus;
};

function toStatus(v: any): SensorStatus {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("critical") || s.includes("alarm")) return "critical";
  if (s.includes("warn") || s.includes("leak") || s.includes("gas")) return "warning";
  return "normal";
}

function statusPill(status: SensorStatus) {
  if (status === "critical") return "border-red-500/20 bg-red-500/10 text-red-200";
  if (status === "warning") return "border-yellow-500/20 bg-yellow-500/10 text-yellow-200";
  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
}

function prettyName(k: string) {
  return String(k)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function SensorsPanel({
  deviceId,
  lastUpdated,
  onInteraction: _onInteraction,
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

  const { state, loading } = useDeviceLiveState(deviceId, estateId);

  const sensors: Sensor[] = useMemo(() => {
    const list = state?.sensors || state?.readings || null;

    if (!list) return [];

    if (Array.isArray(list)) {
      return list
        .map((x: any, idx: number) => ({
          id: String(x?.id ?? `s${idx}`),
          name: String(x?.name ?? x?.type ?? `Sensor ${idx + 1}`),
          value: String(x?.value ?? x?.reading ?? ""),
          status: toStatus(x?.status ?? x?.level ?? x?.value),
        }))
        .filter((s) => s.name || s.value);
    }

    if (typeof list === "object") {
      return Object.keys(list).map((k) => ({
        id: k,
        name: prettyName(k),
        value: String(list[k]),
        status: toStatus(list[k]),
      }));
    }

    return [];
  }, [state]);

  return (
    <RemotePanel title="Sensors" lastUpdated={lastUpdated}>
      {loading ? (
        <div className="mb-3 text-xs text-white/45">Syncing…</div>
      ) : null}

      {!deviceId ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          No sensor hub linked yet.
        </div>
      ) : sensors.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          No readings yet.
        </div>
      ) : (
        <div className="space-y-2">
          {sensors.map((s) => (
            <div
              key={s.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-white/90 truncate">{s.name}</div>
                <div className="text-[12px] text-white/60 break-words">{s.value || "—"}</div>
              </div>

              <span className={`shrink-0 text-[11px] px-2 py-1 rounded-full border ${statusPill(s.status)}`}>
                {s.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </RemotePanel>
  );
}
