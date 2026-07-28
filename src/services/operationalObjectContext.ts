import type { OperationalObject, OyiTarget } from "@/services/oyiService";

type RouteContextInput = {
  module: string;
  pathname: string;
  estate_id?: string | null;
  home_id?: string | null;
  searchParams: Pick<URLSearchParams, "get">;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function candidateLabel(objectType: OperationalObject["object_type"], module: string) {
  const byType: Record<string, string> = {
    room: "Room",
    device: "Device",
    visitor: "Visitor",
    maintenance_request: "Maintenance request",
    transaction: "Transaction",
    wallet: "Wallet",
    service_account: "Service",
    scene: "Scene",
    automation: "Automation",
    device_channel: "Device channel",
    message_thread: "Message thread",
    community_post: "Community post",
    notification: "Notification",
  };
  return byType[objectType] || module || "Operational object";
}

export function deriveConsumerOperationalObject(input: RouteContextInput): Partial<OperationalObject> | null {
  const routeCandidates: Array<{ object_type: OperationalObject["object_type"]; id: string; source_module: string }> = [
    { object_type: "device", id: text(input.searchParams.get("deviceId")), source_module: "devices" },
    { object_type: "device_channel", id: text(input.searchParams.get("deviceId") && input.searchParams.get("channel") ? `${input.searchParams.get("deviceId")}:${input.searchParams.get("channel")}` : ""), source_module: "devices" },
    { object_type: "room", id: text(input.searchParams.get("roomId")), source_module: "rooms" },
    { object_type: "scene", id: text(input.searchParams.get("sceneId")), source_module: "scenes" },
    { object_type: "automation", id: text(input.searchParams.get("automationId")), source_module: "automations" },
    { object_type: "visitor", id: text(input.searchParams.get("visitorId")), source_module: "visitors" },
    { object_type: "maintenance_request", id: text(input.searchParams.get("requestId") || input.searchParams.get("ticketId")), source_module: "maintenance" },
    { object_type: "transaction", id: text(input.searchParams.get("transactionId") || input.searchParams.get("receipt")), source_module: "wallet" },
    { object_type: "notification", id: text(input.searchParams.get("notificationId")), source_module: "notifications" },
    { object_type: "message_thread", id: text(input.searchParams.get("threadId")), source_module: "messages" },
    { object_type: "community_post", id: text(input.searchParams.get("postId")), source_module: "community" },
    { object_type: "service_account", id: text(input.searchParams.get("serviceId")), source_module: "services" },
  ];
  const selected = routeCandidates.find((item) => item.id);
  if (!selected) return null;
  return {
    object_type: selected.object_type,
    canonical_id: selected.id,
    label: candidateLabel(selected.object_type, input.module),
    estate_id: input.estate_id || null,
    home_id: input.home_id || null,
    room_id: selected.object_type === "room" ? selected.id : text(input.searchParams.get("roomId")) || null,
    source_module: selected.source_module,
    metadata: {
      route: input.pathname,
      module: input.module,
      source: "consumer_route_context",
      channel_code: selected.object_type === "device_channel" ? text(input.searchParams.get("channel")) : null,
      device_id: selected.object_type === "device_channel" ? text(input.searchParams.get("deviceId")) : null,
    },
  };
}

export function deriveConsumerTarget(input: RouteContextInput): OyiTarget | null {
  const object = deriveConsumerOperationalObject(input);
  if (!object?.object_type || !object.canonical_id) return null;
  const targetTypeMap: Partial<Record<OperationalObject["object_type"], OyiTarget["target_type"]>> = {
    device: "device",
    device_channel: "device",
    visitor: "visitor",
    maintenance_request: "maintenance",
    wallet: "wallet",
    transaction: "wallet",
    service_account: "service",
    scene: "workflow",
    automation: "workflow",
    message_thread: "message",
    community_post: "community",
    notification: "message",
  };
  const target_type = targetTypeMap[object.object_type] || "none";
  return {
    target_type,
    target_id: object.canonical_id,
    open_as: "page",
    action: "inspect",
  };
}
