"use client";

import { useEffect, useMemo, useState } from "react";
import RemotePanel from "./RemotePanel";
import useActiveContext from "@/hooks/useActiveContext";
import { deviceService } from "@/services/deviceService";
import { maintenanceService } from "@/services/maintenanceService";
import { useNotificationStore } from "@/store/useNotificationStore";

function buildHomeLabel(home: any): string | null {
  if (!home) return null;
  const block = String(home.block || "").trim();
  const unit = String(home.unit || "").trim();
  if (block && unit) return `${block} / ${unit}`;
  if (block) return block;
  if (unit) return unit;
  const name = String(home.name || "").trim();
  return name || null;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] text-white/45">{label}</div>
      <div className="text-[13px] text-white/90 font-semibold mt-1">{value}</div>
    </div>
  );
}

export default function HomeSummaryPanel({
  lastUpdated,
}: {
  lastUpdated?: number;
}) {
  const activeContext = useActiveContext();

  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const [estateName, setEstateName] = useState<string | null>(null);
  const [homeLabel, setHomeLabel] = useState<string | null>(null);

  const [deviceCount, setDeviceCount] = useState<number | null>(null);
  const [openMaintenance, setOpenMaintenance] = useState<number | null>(null);

  useEffect(() => {
    setEstateName(activeContext.estate?.name ? String(activeContext.estate.name) : null);
    setHomeLabel(activeContext.home ? buildHomeLabel(activeContext.home) : null);
  }, [activeContext.contextKey, activeContext.estate, activeContext.home]);

  // Devices count
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!activeContext.ready || !activeContext.home_id) {
        setDeviceCount(null);
        return;
      }
      try {
        const list = await deviceService.getRuntimeDevices(activeContext.home_id);
        if (cancelled) return;
        setDeviceCount(Array.isArray(list) ? list.length : 0);
      } catch {
        if (cancelled) return;
        setDeviceCount(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeContext.ready, activeContext.contextKey, activeContext.home_id]);

  // Maintenance open count (only if service exists)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!activeContext.ready || !activeContext.home_id) {
        setOpenMaintenance(null);
        return;
      }
      try {
        const res: any = await maintenanceService.listMyTickets({ estate_id: activeContext.estate_id, homeId: activeContext.home_id });
        const arr = Array.isArray(res) ? res : [];
        const open = arr.filter((t: any) => String(t.status || "open").toLowerCase() !== "resolved").length;
        if (cancelled) return;
        setOpenMaintenance(open);
      } catch {
        if (cancelled) return;
        setOpenMaintenance(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeContext.ready, activeContext.contextKey, activeContext.estate_id, activeContext.home_id]);

  const tiles = useMemo(() => {
    const out: Array<{ label: string; value: string }> = [];

    if (estateName) out.push({ label: "Estate", value: estateName });
    if (homeLabel) out.push({ label: "Home", value: homeLabel });

    if (deviceCount !== null) out.push({ label: "Devices", value: String(deviceCount) });

    if (openMaintenance !== null) {
      out.push({ label: "Maintenance", value: openMaintenance ? `${openMaintenance} open` : "0 open" });
    }

    out.push({ label: "Notifications", value: unreadCount ? `${unreadCount} unread` : "0 unread" });

    return out;
  }, [estateName, homeLabel, deviceCount, openMaintenance, unreadCount]);

  return (
    <RemotePanel title="Summary" lastUpdated={lastUpdated}>
      {tiles.length ? (
        <div className="grid grid-cols-2 gap-3">
          {tiles.slice(0, 4).map((t) => (
            <Tile key={t.label} label={t.label} value={t.value} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          No home context yet.
        </div>
      )}
    </RemotePanel>
  );
}
