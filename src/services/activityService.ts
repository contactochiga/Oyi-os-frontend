import API from "./api";
import { acknowledgeNotification } from "./notificationsService";
import { awarenessFromRuntimeSignal, cleanRuntimeText } from "@/lib/consumerAwareness";

export type ActivityCategory =
  | "device"
  | "visitor"
  | "message"
  | "community"
  | "maintenance"
  | "wallet"
  | "service"
  | "security"
  | "invite"
  | "scene"
  | "automation"
  | "system"
  | "profile"
  | "watch"
  | "ai";

export type ActivitySeverity = "info" | "success" | "attention" | "warning" | "critical" | "low" | "medium" | "high";

export type ActivityAction = {
  kind?: string;
  route?: string;
  href: string;
  label?: string;
  entity_id?: string | null;
};

export type ActivityEvent = {
  id: string;
  source: string;
  type?: string;
  category: ActivityCategory;
  severity: ActivitySeverity;
  title: string;
  summary?: string;
  description: string;
  occurred_at: string;
  actor?: Record<string, any> | null;
  target?: Record<string, any> | null;
  estate_id?: string | null;
  home_id?: string | null;
  user_id?: string | null;
  label?: string;
  thumbnail_url?: string | null;
  action?: ActivityAction | null;
  metadata?: Record<string, any>;
};

export type ActivitySummary = {
  events?: number;
  total_events: number;
  alerts: number;
  visitors: number;
  actions: number;
  unread?: number;
  critical?: number;
  attention?: number;
};

export type ActivityResponse = {
  items: ActivityEvent[];
  summary: ActivitySummary;
  generated_at?: string;
};

function emptySummary(): ActivitySummary {
  return { events: 0, total_events: 0, alerts: 0, visitors: 0, actions: 0, unread: 0, critical: 0, attention: 0 };
}

function pickError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;
}

function firstString(...values: any[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function categoryFrom(value: any): ActivityCategory {
  const text = String(value || "").toLowerCase();
  if (/watch/.test(text)) return "watch";
  if (/invite|invitation|membership|access/.test(text)) return "invite";
  if (/profile|verification|avatar/.test(text)) return "profile";
  if (/automation/.test(text)) return "automation";
  if (/scene/.test(text)) return "scene";
  if (/message|thread|chat|inbox|dm/.test(text)) return "message";
  if (/visitor|guest|gate/.test(text)) return "visitor";
  if (/device|light|switch|climate|ac|sensor|camera|door/.test(text)) return "device";
  if (/maintenance|support|repair|ticket/.test(text)) return "maintenance";
  if (/service/.test(text)) return "service";
  if (/wallet|payment|billing|transaction/.test(text)) return "wallet";
  if (/community|notice|announcement|post|comment/.test(text)) return "community";
  if (/security|alert|incident|alarm|emergency/.test(text)) return "security";
  if (/ai|oyi|command/.test(text)) return "system";
  return "system";
}

function severityFrom(value: any): ActivitySeverity {
  const text = String(value || "").toLowerCase();
  if (/critical|high|failed|denied|error|alarm|emergency|rejected/.test(text)) return "critical";
  if (/warning|medium|offline|expired|cancelled/.test(text)) return "warning";
  if (/pending|attention|waiting|open|new|requested|created|invited/.test(text)) return "attention";
  if (/low|ok|success|executed|resolved|read|active|approved|accepted|completed|paid|online|synced/.test(text)) return "success";
  return "info";
}

function humanizeActivityText(value: any, fallback = "Home activity") {
  const raw = String(value || "").trim();
  const text = raw.toLowerCase().replace(/[_-]+/g, " ");
  if (!raw) return fallback;
  if (text === "permission denied" || text === "denied" || /permission.*denied/.test(text)) return "Permission required";
  if (/control.*denied|command.*denied|request.*denied/.test(text)) return "Control request denied";
  if (/access.*denied|blocked/.test(text)) return "Access attempt blocked";
  if (/device command executed/.test(text)) return "Device control completed";
  if (/device command requested/.test(text)) return "Device control requested";
  if (/ai tool requested|ai command received|tool registry|audit|schema|route|database/.test(text)) return "Oyi processed a home request";
  return cleanRuntimeText(raw, fallback);
}

function calculateSummary(items: ActivityEvent[]): ActivitySummary {
  return {
    events: items.length,
    total_events: items.length,
    alerts: items.filter((item) => item.category === "security" || item.severity === "critical" || item.severity === "warning" || item.severity === "high" || item.severity === "medium").length,
    visitors: items.filter((item) => item.category === "visitor").length,
    actions: items.filter((item) => Boolean(item.action?.href)).length,
    unread: 0,
    critical: items.filter((item) => item.severity === "critical" || item.severity === "high").length,
    attention: items.filter((item) => item.severity === "attention" || item.severity === "warning" || item.severity === "medium").length,
  };
}

function actionForNotification(item: any, category: ActivityCategory): ActivityAction | null {
  const payload = item?.payload || {};
  const typeText = `${item?.type || ""} ${item?.title || ""} ${item?.message || ""}`.toLowerCase();
  const entityId = firstString(item?.entity_id, payload.entity_id, payload.id);
  const postId = firstString(payload.post_id, payload.postId, payload.community_post_id, item.post_id, entityId && /community|post|announcement|notice/.test(typeText) ? entityId : "");
  const commentId = firstString(payload.comment_id, payload.commentId);
  const threadId = firstString(payload.thread_id, payload.threadId, payload.conversation_id, payload.message_thread_id, entityId && /message|thread|chat|inbox/.test(typeText) ? entityId : "");
  const inviteId = firstString(payload.invite_id, payload.inviteId, payload.invitation_id, entityId && /invite|invitation/.test(typeText) ? entityId : "");
  const visitorId = firstString(payload.visitor_id, payload.visitorId, entityId && /visitor|guest|gate/.test(typeText) ? entityId : "");
  const maintenanceId = firstString(payload.ticket_id, payload.ticketId, payload.maintenance_id, payload.maintenanceId, payload.request_id, entityId && /maintenance|repair|support/.test(typeText) ? entityId : "");
  const transactionId = firstString(payload.transaction_id, payload.transactionId, payload.wallet_transaction_id, entityId && /wallet|payment|transaction/.test(typeText) ? entityId : "");
  const serviceId = firstString(payload.service_id, payload.serviceId, entityId && /service/.test(typeText) ? entityId : "");
  const deviceId = firstString(payload.device_id, payload.deviceId, entityId && /device|light|switch|climate|sensor/.test(typeText) ? entityId : "");
  const roomId = firstString(payload.room_id, payload.roomId, payload.space_id, payload.spaceId, entityId && /room|space/.test(typeText) ? entityId : "");
  const sceneId = firstString(payload.scene_id, payload.sceneId, entityId && /scene/.test(typeText) ? entityId : "");
  const automationId = firstString(payload.automation_id, payload.automationId, entityId && /automation/.test(typeText) ? entityId : "");
  const incidentId = firstString(payload.incident_id, payload.incidentId, entityId && /security|incident|alert/.test(typeText) ? entityId : "");

  if (inviteId) return { href: `/invites?inviteId=${encodeURIComponent(inviteId)}`, route: `/invites?inviteId=${encodeURIComponent(inviteId)}`, label: "Open invite", kind: "invite", entity_id: inviteId };
  if (postId) return { href: `/community?postId=${encodeURIComponent(postId)}${commentId ? `&commentId=${encodeURIComponent(commentId)}` : ""}`, route: `/community?postId=${encodeURIComponent(postId)}${commentId ? `&commentId=${encodeURIComponent(commentId)}` : ""}`, label: commentId ? "Open thread" : "Open post", kind: commentId ? "community_comment" : "community_post", entity_id: postId };
  if (threadId) return { href: `/messages?threadId=${encodeURIComponent(threadId)}`, route: `/messages?threadId=${encodeURIComponent(threadId)}`, label: "Open thread", kind: "message", entity_id: threadId };
  if (visitorId) return { href: `/visitors?visitorId=${encodeURIComponent(visitorId)}`, route: `/visitors?visitorId=${encodeURIComponent(visitorId)}`, label: "Open visitor", kind: "visitor", entity_id: visitorId };
  if (maintenanceId) return { href: `/maintenance?requestId=${encodeURIComponent(maintenanceId)}`, route: `/maintenance?requestId=${encodeURIComponent(maintenanceId)}`, label: "Open request", kind: "maintenance", entity_id: maintenanceId };
  if (transactionId) return { href: `/wallet?transactionId=${encodeURIComponent(transactionId)}`, route: `/wallet?transactionId=${encodeURIComponent(transactionId)}`, label: "Open transaction", kind: "wallet", entity_id: transactionId };
  if (serviceId) return { href: `/services?serviceId=${encodeURIComponent(serviceId)}`, route: `/services?serviceId=${encodeURIComponent(serviceId)}`, label: "Open service", kind: "service", entity_id: serviceId };
  if (deviceId && !/heartbeat|sync completed|telemetry|turned on|turned off|command.executed/.test(typeText)) return { href: `/devices?deviceId=${encodeURIComponent(deviceId)}`, route: `/devices?deviceId=${encodeURIComponent(deviceId)}`, label: "Open device", kind: "device", entity_id: deviceId };
  if (roomId) return { href: `/spaces?roomId=${encodeURIComponent(roomId)}`, route: `/spaces?roomId=${encodeURIComponent(roomId)}`, label: "Open space", kind: "space", entity_id: roomId };
  if (sceneId && !/executed/.test(typeText)) return { href: `/scenes?sceneId=${encodeURIComponent(sceneId)}`, route: `/scenes?sceneId=${encodeURIComponent(sceneId)}`, label: "Open scene", kind: "scene", entity_id: sceneId };
  if (automationId) return { href: `/scenes?tab=automations&automationId=${encodeURIComponent(automationId)}`, route: `/scenes?tab=automations&automationId=${encodeURIComponent(automationId)}`, label: "Open automation", kind: "automation", entity_id: automationId };
  if (incidentId || category === "security") return { href: `/security${incidentId ? `?incidentId=${encodeURIComponent(incidentId)}` : ""}`, route: `/security${incidentId ? `?incidentId=${encodeURIComponent(incidentId)}` : ""}`, label: "Open security", kind: "security", entity_id: incidentId || null };
  return null;
}

function normalizeActivityItem(item: any): ActivityEvent {
  const canonicalTruth = item?.truth && typeof item.truth === "object" ? item.truth : item?.metadata?.truth;
  const canonicalObject = item?.operational_object && typeof item.operational_object === "object"
    ? item.operational_object
    : item?.metadata?.operational_object && typeof item.metadata.operational_object === "object"
      ? item.metadata.operational_object
      : null;
  const category = categoryFrom(`${item.category} ${item.source} ${item.type} ${item.title} ${item.summary || item.description}`);
  const severity = severityFrom(`${item.severity} ${item.type} ${item.title}`);
  const rawAction = item.action && typeof item.action === "object" ? item.action : item.metadata?.action;
  const route = firstString(rawAction?.route, rawAction?.href);
  const runtimeAwareness = awarenessFromRuntimeSignal({
    id: item.id,
    type: item.type,
    title: item.title,
    summary: item.summary,
    description: item.description,
    severity: item.severity,
    entity: item.target,
    metadata: item.metadata,
    context: item.metadata?.context,
  });
  const runtimeCategory: ActivityCategory | null =
    runtimeAwareness?.icon === "visitor"
      ? "visitor"
      : runtimeAwareness?.icon === "service"
        ? "service"
        : runtimeAwareness?.icon === "wallet"
          ? "wallet"
          : runtimeAwareness?.icon === "maintenance"
            ? "maintenance"
            : runtimeAwareness?.icon === "community"
              ? "community"
              : runtimeAwareness?.icon === "security"
                ? "security"
                : runtimeAwareness?.icon === "automation"
                  ? "automation"
                  : runtimeAwareness?.icon === "device"
                    ? "device"
                    : runtimeAwareness?.icon === "activity"
                      ? "system"
                      : null;
  const runtimeSeverity: ActivitySeverity | null =
    runtimeAwareness?.urgency === "critical"
      ? "critical"
      : runtimeAwareness?.urgency === "warning"
        ? "warning"
        : runtimeAwareness?.urgency === "normal"
          ? "info"
          : null;
  const action = route
    ? { ...rawAction, route, href: route, label: rawAction?.label || "Open", entity_id: rawAction?.entity_id || null }
    : runtimeAwareness
      ? { href: runtimeAwareness.destination, route: runtimeAwareness.destination, label: runtimeAwareness.actionLabel, entity_id: null }
      : actionForNotification(item, category);
  const title = canonicalTruth?.title
    ? cleanRuntimeText(canonicalTruth.title, "Home activity")
    : runtimeAwareness?.title || humanizeActivityText(item.title || item.type || item.source, "Home activity");
  const description = canonicalTruth?.body
    ? cleanRuntimeText(canonicalTruth.body, title)
    : runtimeAwareness?.summary || humanizeActivityText(item.summary || item.description || title, "Home activity");
  const objectType = String(canonicalObject?.object_type || "").toLowerCase();
  const truthState = String(canonicalTruth?.truth_state || "").toLowerCase();
  const truthSeverity = String(canonicalTruth?.severity || "").toLowerCase();
  return {
    ...item,
    category: (
      item.category
      || (objectType === "wallet" || objectType === "transaction" ? "wallet" : null)
      || (objectType === "service_account" ? "service" : null)
      || (objectType === "maintenance_request" ? "maintenance" : null)
      || (objectType === "message_thread" ? "message" : null)
      || (objectType === "community_post" ? "community" : null)
      || (objectType === "visitor" || objectType === "access_pass" ? "visitor" : null)
      || (objectType === "device" || objectType === "device_channel" ? "device" : null)
      || runtimeCategory
      || category
    ) as ActivityCategory,
    severity: (
      item.severity
      || (/critical/.test(truthSeverity) ? "critical" : /warning|attention/.test(`${truthSeverity} ${truthState}`) ? "warning" : null)
      || runtimeSeverity
      || severity
    ) as ActivitySeverity,
    title,
    description,
    summary: item.summary || description,
    action,
  };
}

export async function getActivityFeed(): Promise<ActivityResponse | { error: string }> {
  try {
    const res = await API.get("/activity/feed");
    const items = Array.isArray(res.data?.items) ? res.data.items.map(normalizeActivityItem) : [];
    return {
      items,
      summary: res.data?.summary || calculateSummary(items),
      generated_at: res.data?.generated_at,
    };
  } catch (err: any) {
    if (err?.response?.status === 404) {
      try {
        const prefixed = await API.get("/api/activity/feed");
        const items = Array.isArray(prefixed.data?.items) ? prefixed.data.items.map(normalizeActivityItem) : [];
        return {
          items,
          summary: prefixed.data?.summary || calculateSummary(items),
          generated_at: prefixed.data?.generated_at,
        };
      } catch (prefixedErr: any) {
        return { error: pickError(prefixedErr, "Failed to load activity") };
      }
    }
    return { error: pickError(err, "Failed to load activity") };
  }
}

export function notificationIdFromActivity(item: ActivityEvent) {
  const id = String(item?.id || "");
  return id.startsWith("notification:") ? id.slice("notification:".length) : "";
}

export async function acknowledgeActivityEvent(item: ActivityEvent) {
  const notificationId = notificationIdFromActivity(item);
  if (!notificationId) return { ok: true, skipped: true };
  return acknowledgeNotification(notificationId);
}

export async function acknowledgeSeenActivityEvents(items: ActivityEvent[]) {
  const ids = items
    .filter((item) => item.source === "notifications" || String(item.id || "").startsWith("notification:"))
    .filter((item) => item.category !== "security" && item.severity !== "critical" && item.severity !== "high")
    .map(notificationIdFromActivity)
    .filter(Boolean);

  await Promise.allSettled(Array.from(new Set(ids)).map((id) => acknowledgeNotification(id)));
  return Array.from(new Set(ids));
}

export async function getActivitySummary(): Promise<ActivitySummary | { error: string }> {
  try {
    const res = await API.get("/activity/summary");
    return res.data?.summary || emptySummary();
  } catch (err: any) {
    if (err?.response?.status === 404) {
      try {
        const prefixed = await API.get("/api/activity/summary");
        return prefixed.data?.summary || emptySummary();
      } catch (prefixedErr: any) {
        return { error: pickError(prefixedErr, "Failed to load activity summary") };
      }
    }
    return { error: pickError(err, "Failed to load activity summary") };
  }
}
