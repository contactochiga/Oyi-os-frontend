import type { OyiTarget } from "./oyiService";

type Router = { push: (href: string) => void };
export type TargetResolution = { handled: boolean; error?: string; legacy?: boolean };

/** Consumer is intentionally restricted to resident-safe source surfaces. */
export function resolveConsumerOyiTarget(target: OyiTarget | null | undefined, router: Router, context?: { homeId?: string | null }): TargetResolution {
  if (!target || target.target_type === "none" || target.open_as === "none") return { handled: false, error: "No source destination is available." };
  if (target.target_type === "camera") {
    const activeHome = String(context?.homeId || "");
    const targetHome = String(target.home_id || "");
    if (target.camera_scope === "home" && activeHome && targetHome === activeHome && target.target_id) {
      router.push(`/cameras?cameraId=${encodeURIComponent(target.target_id)}`);
      return { handled: true };
    }
    return { handled: false, error: "This camera is not available in the active home context." };
  }
  if (target.target_type === "infrastructure") {
    return { handled: false, error: "This infrastructure detail is available to facility operators only." };
  }
  const id = target.target_id ? encodeURIComponent(target.target_id) : "";
  const pages: Record<string, string> = {
    maintenance: id ? `/maintenance?requestId=${id}` : "/maintenance",
    visitor: id ? `/visitors?visitorId=${id}` : "/visitors",
    device: id ? `/devices?deviceId=${id}` : "/devices",
    wallet: id ? `/wallet?transactionId=${id}` : "/wallet",
    service: id ? `/services?serviceId=${id}` : "/services",
    community: id ? `/community?postId=${id}` : "/community",
    message: id ? `/messages?threadId=${id}` : "/messages",
    incident: id ? `/security?incidentId=${id}` : "/security",
    workflow: "/maintenance",
    prediction: "/activity",
    handover: "/activity",
  };
  const href = pages[target.target_type];
  if (!href) return { handled: false, error: "This source is unavailable in Consumer OS." };
  router.push(href);
  return { handled: true };
}
