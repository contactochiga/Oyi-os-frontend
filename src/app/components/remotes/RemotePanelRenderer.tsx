import LightPanel from "./LightPanel";

export default function RemotePanelRenderer({
  panel,
  deviceId,
  lastUpdated,
  onInteraction,
}: {
  panel?: string | null;
  deviceId?: string;
  lastUpdated: number;
  onInteraction: () => void;
}) {
  if (!panel) return null;

  switch (panel) {
    case "light":
      return (
        <LightPanel
          deviceId={deviceId}
          lastUpdated={lastUpdated}
          onInteraction={onInteraction}
        />
      );

    default:
      return null;
  }
}
