"use client";

/* =================================================
   CORE DEVICE REMOTES
================================================= */

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
   SYSTEM DASHBOARDS (NEW)
================================================= */

import HomeSummaryPanel from "./HomeSummaryPanel";
import UtilitiesPanel from "./UtilitiesPanel";

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
  if (!panel) return null;

  switch (panel) {
    /* -----------------------
       CORE DEVICE CONTROLS
    ------------------------ */

    case "light":
      return (
        <LightPanel
          deviceId={deviceId}
          lastUpdated={lastUpdated ?? Date.now()}
          onInteraction={onInteraction}
        />
      );

    case "ac":
      return (
        <AcPanel
          deviceId={deviceId}
          lastUpdated={lastUpdated ?? Date.now()}
          onInteraction={onInteraction}
        />
      );

    case "tv":
      return (
        <TvPanel
          deviceId={deviceId}
          lastUpdated={lastUpdated ?? Date.now()}
          onInteraction={onInteraction}
        />
      );

    /* -----------------------
       SECURITY & ACCESS
    ------------------------ */

    case "door":
      return (
        <DoorPanel
          deviceId={deviceId}
          lastUpdated={lastUpdated ?? Date.now()}
          onInteraction={onInteraction}
        />
      );

    case "cctv":
      return (
        <CctvPanel
          deviceId={deviceId}
          lastUpdated={lastUpdated ?? Date.now()}
          onInteraction={onInteraction}
        />
      );

    case "sensor":
    case "sensors":
      return (
        <SensorsPanel
          deviceId={deviceId}
          lastUpdated={lastUpdated ?? Date.now()}
          onInteraction={onInteraction}
        />
      );

    /* -----------------------
       VISITORS (ESTATE FLOW)
    ------------------------ */

    case "visitor":
    case "visitors":
      return (
        <VisitorPanel
          lastUpdated={lastUpdated ?? Date.now()}
          onInteraction={onInteraction}
        />
      );

    /* -----------------------
       ROOMS & STRUCTURE
    ------------------------ */

    case "rooms":
      return (
        <RoomsPanel
          lastUpdated={lastUpdated ?? Date.now()}
          onInteraction={onInteraction}
        />
      );

    /* -----------------------
       FINANCE & UTILITIES
    ------------------------ */

    case "wallet":
      return (
        <WalletPanel
          lastUpdated={lastUpdated ?? Date.now()}
          onInteraction={onInteraction}
        />
      );

    case "utilities":
      return (
        <UtilitiesPanel
          lastUpdated={lastUpdated ?? Date.now()}
        />
      );

    /* -----------------------
       COMMUNITY
    ------------------------ */

    case "community":
      return (
        <CommunityPanel
          lastUpdated={lastUpdated ?? Date.now()}
          onInteraction={onInteraction}
        />
      );

    /* -----------------------
       SYSTEM OVERVIEW
    ------------------------ */

    case "home":
    case "home_summary":
    case "summary":
      return (
        <HomeSummaryPanel
          lastUpdated={lastUpdated ?? Date.now()}
        />
      );

    /* -----------------------
       FALLBACK
    ------------------------ */

    default:
      return null;
  }
}
