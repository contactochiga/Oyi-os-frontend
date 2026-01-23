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
import { getSocket } from "@/services/socket";

/* =================================================
   RENDERER
================================================= */

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

  // estateId is needed so socket can join the right estate room
  const estateId = useMemo(
    () =>
      user?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user?.estate_id]
  );

  // Central "control room" timestamp
  const [computedLastUpdated, setComputedLastUpdated] = useState<number>(
    lastUpdated ?? Date.now()
  );

  // Keep in sync if parent sends a newer value
  useEffect(() => {
    if (!lastUpdated) return;
    setComputedLastUpdated((prev) => (lastUpdated > prev ? lastUpdated : prev));
  }, [lastUpdated]);

  // Wrap interaction: bump time + call parent callback
  function handleInteraction() {
    setComputedLastUpdated(Date.now());
    onInteraction?.();
  }

  // Listen for device:update and bump time when it matches current deviceId
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onConnect = () => {
      if (estateId) socket.emit("subscribe:estate", estateId);
    };

    const onUpdate = (payload: any) => {
      // payload: { deviceId, state, topic }
      if (!payload?.deviceId) return;

      // If this renderer is bound to a specific deviceId, update only when that device updates.
      if (deviceId && payload.deviceId === deviceId) {
        setComputedLastUpdated(Date.now());
      }
    };

    socket.on("connect", onConnect);
    socket.on("device:update", onUpdate);

    // If already connected, join immediately
    if (socket.connected && estateId) socket.emit("subscribe:estate", estateId);

    return () => {
      socket.off("connect", onConnect);
      socket.off("device:update", onUpdate);
    };
  }, [estateId, deviceId]);

  if (!panel) return null;

  switch (panel) {
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
       VISITORS (ESTATE FLOW)
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
