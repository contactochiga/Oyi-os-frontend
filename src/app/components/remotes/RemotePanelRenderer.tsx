// src/app/components/remotes/RemotePanelRenderer.tsx
"use client";

/* =================================================
   CORE DEVICE REMOTES
================================================= */

import { useEffect, useMemo, useState } from "react";

import LightPanel from "./LightPanel";
import AcPanel from "./AcPanel";
import TvPanel from "./TvPanel";

/* =================================================
   SECURITY & ACCESS
================================================= */

import DoorPanel from "./DoorPanel";
import CctvPanel from "./CctvPanel";
import SensorsPanel from "./SensorsPanel";

/* =================================================
   PEOPLE, SYSTEM & OPERATIONS
================================================= */

import VisitorPanel from "./VisitorPanel";
import CommunityPanel from "./CommunityPanel";
import WalletPanel from "./WalletPanel";
import RoomsPanel from "./RoomsPanel";

/* =================================================
   SYSTEM DASHBOARDS
================================================= */

import HomeSummaryPanel from "./HomeSummaryPanel";
import UtilitiesPanel from "./UtilitiesPanel";
import MaintenancePanel from "./MaintenancePanel";

/* =================================================
   SOCKET + AUTH (for estate subscribe)
================================================= */

import useAuth from "@/hooks/useAuth";
import useActiveContext from "@/hooks/useActiveContext";
import { scopeMatches } from "@/lib/footerBadges";
import { getSocket } from "@/services/socket";

/* =================================================
   RENDERER
================================================= */

function needsDeviceId(panel: string) {
  return ["light", "ac", "tv", "door", "cctv", "sensor", "sensors"].includes(panel);
}

export default function RemotePanelRenderer({
  panel,
  deviceId,
  lastUpdated,
  onInteraction,
}: {
  panel?: string | null;
  deviceId?: string;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const { user } = useAuth();
  const activeContext = useActiveContext();

  const estateId = useMemo(
    () =>
      activeContext.estate_id ??
      user?.estate_id ??
      (typeof window !== "undefined"
        ? localStorage.getItem("ochiga_estate")
        : null),
    [activeContext.estate_id, user?.estate_id]
  );

  const [computedLastUpdated, setComputedLastUpdated] = useState<number>(
    lastUpdated ?? Date.now()
  );

  useEffect(() => {
    if (!lastUpdated) return;
    setComputedLastUpdated((prev) => (lastUpdated > prev ? lastUpdated : prev));
  }, [lastUpdated]);

  function handleInteraction() {
    setComputedLastUpdated(Date.now());
    onInteraction?.();
  }

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onConnect = () => {
      if (estateId) socket.emit("subscribe:estate", estateId);
      if (activeContext.home_id) socket.emit("subscribe:home", activeContext.home_id);
    };

    // If backend emits device:update, bump lastUpdated for matching device
    const onUpdate = (payload: any) => {
      const eventDeviceId = String(payload?.deviceId || payload?.device_id || "");
      if (!eventDeviceId) return;
      if ((payload?.estate_id || payload?.estateId || payload?.home_id || payload?.homeId) && !scopeMatches(
        { estateId: payload?.estate_id || payload?.estateId, homeId: payload?.home_id || payload?.homeId },
        { estateId: activeContext.estate_id, homeId: activeContext.home_id },
        { allowUnscoped: false },
      )) return;
      if (deviceId && eventDeviceId === String(deviceId)) {
        setComputedLastUpdated(Date.now());
      }
    };

    socket.on("connect", onConnect);
    socket.on("device:update", onUpdate);

    if (socket.connected && estateId) socket.emit("subscribe:estate", estateId);
    if (socket.connected && activeContext.home_id) socket.emit("subscribe:home", activeContext.home_id);

    return () => {
      socket.off("connect", onConnect);
      socket.off("device:update", onUpdate);
    };
  }, [estateId, deviceId, activeContext.contextKey]);

  if (!panel) return null;

  // Normalize panel aliases
  const normalized = String(panel || "").toLowerCase().trim();

  // ✅ HARD RULE: if panel needs a deviceId but none is provided, don’t render it
  // This prevents “panel not bound to device” issues.
  if (needsDeviceId(normalized) && !deviceId) {
    return null;
  }

  switch (normalized) {
    /* -----------------------
       CORE DEVICE CONTROLS
    ------------------------ */
    case "light":
      return (
        <LightPanel
          deviceId={deviceId}
          lastUpdated={computedLastUpdated}
          onInteraction={handleInteraction}
        />
      );

    case "ac":
      return (
        <AcPanel
          deviceId={deviceId}
          lastUpdated={computedLastUpdated}
          onInteraction={handleInteraction}
        />
      );

    case "tv":
      return (
        <TvPanel
          deviceId={deviceId}
          lastUpdated={computedLastUpdated}
          onInteraction={handleInteraction}
        />
      );

    /* -----------------------
       SECURITY & ACCESS
    ------------------------ */
    case "door":
      return (
        <DoorPanel
          deviceId={deviceId}
          lastUpdated={computedLastUpdated}
          onInteraction={handleInteraction}
        />
      );

    case "cctv":
      return (
        <CctvPanel
          deviceId={deviceId}
          lastUpdated={computedLastUpdated}
          onInteraction={handleInteraction}
        />
      );

    case "sensor":
    case "sensors":
      return (
        <SensorsPanel
          deviceId={deviceId}
          lastUpdated={computedLastUpdated}
          onInteraction={handleInteraction}
        />
      );

    /* -----------------------
       VISITORS
    ------------------------ */
    case "visitor":
    case "visitors":
      return (
        <VisitorPanel
          lastUpdated={computedLastUpdated}
          onInteraction={handleInteraction}
        />
      );

    /* -----------------------
       ROOMS & STRUCTURE
    ------------------------ */
    case "rooms":
      return (
        <RoomsPanel
          lastUpdated={computedLastUpdated}
          onInteraction={handleInteraction}
        />
      );

    // Aliases that should not open a “remote”
    case "devices":
    case "device":
      // safest: show rooms panel (device list lives inside rooms for consumers)
      return (
        <RoomsPanel
          lastUpdated={computedLastUpdated}
          onInteraction={handleInteraction}
        />
      );

    /* -----------------------
       FINANCE & UTILITIES
    ------------------------ */
    case "wallet":
      return (
        <WalletPanel
          lastUpdated={computedLastUpdated}
          onInteraction={handleInteraction}
        />
      );

    case "utilities":
      return <UtilitiesPanel lastUpdated={computedLastUpdated} />;

    /* -----------------------
       MAINTENANCE & SUPPORT
    ------------------------ */
    case "maintenance":
    case "support":
    case "issue":
    case "repair":
      return (
        <MaintenancePanel
          lastUpdated={computedLastUpdated}
          onInteraction={handleInteraction}
        />
      );

    /* -----------------------
       COMMUNITY
    ------------------------ */
    case "community":
      return (
        <CommunityPanel
          lastUpdated={computedLastUpdated}
          onInteraction={handleInteraction}
        />
      );

    /* -----------------------
       SYSTEM OVERVIEW
    ------------------------ */
    case "home":
    case "home_summary":
    case "summary":
      return <HomeSummaryPanel lastUpdated={computedLastUpdated} />;

    default:
      return null;
  }
}
