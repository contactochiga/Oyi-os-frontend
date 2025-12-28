import LightPanel from "./LightPanel";
// later: import AcPanel, TvPanel, etc.

export default function RemotePanelRenderer({
  panel,
  deviceId,
}: {
  panel?: string | null;
  deviceId?: string;
}) {
  if (!panel) return null;

  switch (panel) {
    case "light":
      return <LightPanel deviceId={deviceId} />;

    // case "ac":
    // case "tv":
    // case "door":
    // case "cctv":

    default:
      return null;
  }
}
