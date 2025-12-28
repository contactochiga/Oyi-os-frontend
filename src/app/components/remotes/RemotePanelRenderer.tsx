import LightPanel from "./LightPanel";
import AcPanel from "./AcPanel";
import TvPanel from "./TvPanel";
import DoorPanel from "./DoorPanel";

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
    case "light":
      return (
        <LightPanel
          deviceId={deviceId}
          lastUpdated={lastUpdated!}
          onInteraction={onInteraction!}
        />
      );

    case "ac":
      return (
        <AcPanel
          deviceId={deviceId}
          onInteraction={onInteraction}
        />
      );

    case "tv":
      return (
        <TvPanel
          deviceId={deviceId}
          lastUpdated={lastUpdated}
          onInteraction={onInteraction}
        />
      );

    case "door":
      return (
        <DoorPanel
          deviceId={deviceId}
          hasCamera={true} // toggle per device later
          lastUpdated={lastUpdated}
          onInteraction={onInteraction}
        />
      );

    default:
      return null;
  }
}
