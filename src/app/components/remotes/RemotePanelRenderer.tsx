"use client";

// CORE REMOTES
import LightPanel from "./LightPanel";
import AcPanel from "./AcPanel";
import TvPanel from "./TvPanel";

// ACCESS & SECURITY
import DoorPanel from "./DoorPanel";
import CctvPanel from "./CctvPanel";
import SensorsPanel from "./SensorsPanel";

// PEOPLE & SYSTEM
import VisitorPanel from "./VisitorPanel";
import CommunityPanel from "./CommunityPanel";
import WalletPanel from "./WalletPanel";
import RoomsPanel from "./RoomsPanel";

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
      return (
        <SensorsPanel
          deviceId={deviceId}
          lastUpdated={lastUpdated ?? Date.now()}
          onInteraction={onInteraction}
        />
      );

    /* -----------------------
       PEOPLE & OPERATIONS
    ------------------------ */

    case "visitor":
      return (
        <VisitorPanel
          lastUpdated={lastUpdated ?? Date.now()}
          onInteraction={onInteraction}
        />
      );

    case "rooms":
      return (
        <RoomsPanel
          lastUpdated={lastUpdated ?? Date.now()}
          onInteraction={onInteraction}
        />
      );

    case "wallet":
      return (
        <WalletPanel
          lastUpdated={lastUpdated ?? Date.now()}
          onInteraction={onInteraction}
        />
      );

    case "community":
      return (
        <CommunityPanel
          lastUpdated={lastUpdated ?? Date.now()}
          onInteraction={onInteraction}
        />
      );

    /* -----------------------
       FALLBACK
    ------------------------ */

    default:
      return null;
  }
}
