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

export default function SensorsPanel({
  deviceId,
  lastUpdated,
}: {
  deviceId?: string;
  lastUpdated?: number;
}) {
  const { user } = useAuth();
  const estateId = useMemo(
    () =>
      user?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user?.estate_id]
  );

  const { state, loading } = useDeviceLiveState(deviceId, estateId);

  const sensorsFromState: Sensor[] | null = useMemo(() => {
    const list = state?.sensors || state?.readings || null;
    if (!list) return null;

    if (Array.isArray(list)) {
      return list.map((x: any, idx: number) => ({
        id: x?.id || `s${idx}`,
        name: x?.name || x?.type || `Sensor ${idx + 1}`,
        value: String(x?.value ?? x?.reading ?? ""),
        status: toStatus(x?.status ?? x?.level ?? x?.value),
      }));
    }

    if (typeof list === "object") {
      return Object.keys(list).map((k) => ({
        id: k,
        name: k.replace(/_/g, " "),
        value: String(list[k]),
        status: toStatus(list[k]),
      }));
    }

    return null;
  }, [state]);

  const sensors: Sensor[] = sensorsFromState ?? [
    { id: "motion", name: "Motion Sensor", value: "No movement", status: "normal" },
    { id: "smoke", name: "Smoke Detector", value: "Clear", status: "normal" },
    { id: "gas", name: "Gas Sensor", value: "Leak detected", status: "warning" },
    { id: "water", name: "Water Leak", value: "Dry", status: "normal" },
  ];

  function color(status: SensorStatus) {
    switch (status) {
      case "critical":
        return "text-red-500";
      case "warning":
        return "text-yellow-400";
      default:
        return "text-green-400";
    }
  }

  return (
    <RemotePanel title="Sensors" lastUpdated={lastUpdated}>
      {loading && <div className="mb-3 text-xs text-gray-400">Syncing sensor state…</div>}

      <div className="space-y-3">
        {sensors.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3 border border-gray-700"
          >
            <div>
              <div className="text-sm text-white">{s.name}</div>
              <div className="text-xs text-gray-400">{s.value}</div>
            </div>

            <div className={`text-xs font-medium ${color(s.status)}`}>
              {s.status.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {!deviceId && (
        <div className="mt-3 text-[11px] text-gray-500">
          No Sensors device bound yet. Bind a sensors hub to enable live readings.
        </div>
      )}
    </RemotePanel>
  );
}
