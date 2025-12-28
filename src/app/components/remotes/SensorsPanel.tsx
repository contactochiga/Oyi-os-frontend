"use client";

import RemotePanel from "./RemotePanel";

type SensorStatus = "normal" | "warning" | "critical";

type Sensor = {
  id: string;
  name: string;
  value: string;
  status: SensorStatus;
};

export default function SensorsPanel({
  deviceId,
  lastUpdated,
  onInteraction,
}: {
  deviceId?: string;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const sensors: Sensor[] = [
    {
      id: "motion",
      name: "Motion Sensor",
      value: "No movement",
      status: "normal",
    },
    {
      id: "smoke",
      name: "Smoke Detector",
      value: "Clear",
      status: "normal",
    },
    {
      id: "gas",
      name: "Gas Sensor",
      value: "Leak detected",
      status: "warning",
    },
    {
      id: "water",
      name: "Water Leak",
      value: "Dry",
      status: "normal",
    },
  ];

  const timeLabel =
    lastUpdated &&
    new Date(lastUpdated).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

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
    <RemotePanel title="Sensors" timestamp={timeLabel}>
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
    </RemotePanel>
  );
}
