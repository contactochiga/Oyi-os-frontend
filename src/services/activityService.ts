import API from "./api";
import { acknowledgeNotification, listMyNotifications } from "./notificationsService";
import { maintenanceService } from "./maintenanceService";
import { visitorService } from "./visitorService";

export type ActivityCategory =
  | "security"
  | "visitor"
  | "device"
  | "maintenance"
  | "ai"
  | "wallet"
  | "community"
  | "system";

export type ActivitySeverity = "low" | "medium" | "high" | "info";

export type ActivityEvent = {
  id: string;
  category: ActivityCategory;
  severity: ActivitySeverity;
  title: string;
  description: string;
  occurred_at: string;
  source: string;
  label?: string;
  thumbnail_url?: string | null;
  action?: {
    href: string;
    label?: string;
    kind?: string;
    entity_id?: string | null;
  } | null;
};

export type ActivitySummary = {
  total_events: number;
  alerts: number;
  visitors: number;
  actions: number;
};

export type ActivityResponse = {
  items: ActivityEvent[];
  summary: ActivitySummary;
  sources?: Record<string, { available: boolean; reason?: string | null }>;
  generated_at?: string;
};

function emptySummary(): ActivitySummary {
  return { total_events: 0, alerts: 0, visitors: 0, actions: 0 };
}

function pickError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;
}

function categoryFrom(value: any): ActivityCategory {
  const text = String(value || "").toLowerCase();
  if (/visitor|guest|gate|access|people/.test(text)) return "visitor";
  if (/device|light|switch|climate|ac|sensor|camera|door/.test(text)) return "device";
  if (/maintenance|support|repair|service/.test(text)) return "maintenance";
  if (/ai|oyi|command/.test(text)) return "ai";
  if (/wallet|payment|billing/.test(text)) return "wallet";
  if (/community|notice|announcement/.test(text)) return "community";
  if (/security|alert|incident|alarm/.test(text)) return "security";
  return "system";
}

function severityFrom(value: any): ActivitySeverity {
  const text = String(value || "").toLowerCase();
  if (/high|critical|failed|denied|error|alarm/.test(text)) return "high";
  if (/medium|warning|pending|attention/.test(text)) return "medium";
  if (/low|ok|success|executed|resolved|read/.test(text)) return "low";
  return "info";
}

function calculateSummary(items: ActivityEvent[]): ActivitySummary {
  return {
    total_events: items.length,
    alerts: items.filter((item) => item.category === "security" || item.severity === "high").length,
    visitors: items.filter((item) => item.category === "visitor").length,
    actions: items.filter((item) => item.category === "ai" || item.category === "device").length,
  };
}

function firstString(...values: any[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function actionForNotification(item: any, category: ActivityCategory) {
  const payload = item?.payload || {};
  const typeText = `${item?.type || ""} ${item?.title || ""} ${item?.message || ""}`.toLowerCase();
  const postId = firstString(payload.post_id, payload.postId, payload.community_post_id, item.post_id);
  const commentId = firstString(payload.comment_id, payload.commentId);
  const threadId = firstString(payload.thread_id, payload.threadId, payload.conversation_id, payload.message_thread_id);
  const inviteId = firstString(payload.invite_id, payload.inviteId, payload.invitation_id);
  const visitorId = firstString(payload.visitor_id, payload.visitorId);
  const maintenanceId = firstString(payload.ticket_id, payload.ticketId, payload.maintenance_id, payload.maintenanceId, payload.request_id);
  const transactionId = firstString(payload.transaction_id, payload.transactionId, payload.wallet_transaction_id);
  const serviceId = firstString(payload.service_id, payload.serviceId);
  const deviceId = firstString(payload.device_id, payload.deviceId);
  const roomId = firstString(payload.room_id, payload.roomId, payload.space_id, payload.spaceId);
  const automationId = firstString(payload.automation_id, payload.automationId);

  if (inviteId) return { href: `/invites?inviteId=${encodeURIComponent(inviteId)}`, label: "Open invite", kind: "invite" };
  if (postId) return { href: `/community?postId=${encodeURIComponent(postId)}${commentId ? `&commentId=${encodeURIComponent(commentId)}` : ""}`, label: commentId ? "Open thread" : "Open post", kind: "community" };
  if (threadId || category === "community" && /message|comment|reply/.test(typeText)) return { href: `/messages${threadId ? `?threadId=${encodeURIComponent(threadId)}` : ""}`, label: "Open thread", kind: "message" };
  if (visitorId) return { href: `/visitors?visitorId=${encodeURIComponent(visitorId)}`, label: "Open visitor", kind: "visitor" };
  if (maintenanceId) return { href: `/maintenance?requestId=${encodeURIComponent(maintenanceId)}`, label: "Open request", kind: "maintenance" };
  if (transactionId) return { href: `/wallet?transactionId=${encodeURIComponent(transactionId)}`, label: "Open transaction", kind: "wallet" };
  if (serviceId) return { href: `/services?serviceId=${encodeURIComponent(serviceId)}`, label: "Open service", kind: "service" };
  if (deviceId) return { href: `/devices?deviceId=${encodeURIComponent(deviceId)}`, label: "Open device", kind: "device" };
  if (roomId) return { href: `/spaces?roomId=${encodeURIComponent(roomId)}`, label: "Open space", kind: "space" };
  if (automationId) return { href: `/scenes?tab=automations&automationId=${encodeURIComponent(automationId)}`, label: "Open automation", kind: "automation" };

  if (category === "community" && /post|announcement|notice|comment|reply/.test(typeText)) return { href: "/community", label: "Open community", kind: "community" };
  if (category === "visitor" && !/heartbeat|sync|completed/.test(typeText)) return { href: "/visitors", label: "Open visitors", kind: "visitor" };
  if (category === "maintenance" && !/sync|completed/.test(typeText)) return { href: "/maintenance", label: "Open maintenance", kind: "maintenance" };
  if (category === "wallet" && !/sync|completed/.test(typeText)) return { href: "/wallet", label: "Open wallet", kind: "wallet" };
  return null;
}

async function getLocalFallbackFeed(): Promise<ActivityResponse> {
  const [notificationRes, visitorRes, maintenanceRes] = await Promise.allSettled([
    listMyNotifications(),
    visitorService.listMine(),
    maintenanceService.listMyTickets(),
  ]);

  const notifications = notificationRes.status === "fulfilled" && Array.isArray(notificationRes.value) ? notificationRes.value : [];
  const visitors = visitorRes.status === "fulfilled" && Array.isArray(visitorRes.value) ? visitorRes.value : [];
  const maintenance = maintenanceRes.status === "fulfilled" && Array.isArray(maintenanceRes.value as any) ? (maintenanceRes.value as any[]) : [];

  const items: ActivityEvent[] = [
    ...notifications.map((item: any) => {
      const category = categoryFrom(`${item.type} ${item.title} ${item.message}`);
      return {
        id: `notification:${item.id}`,
        category,
        severity: severityFrom(`${item.status} ${item.title} ${item.type}`),
        title: String(item.title || "Home update"),
        description: String(item.message || "Oyi activity"),
        occurred_at: String(item.created_at || new Date().toISOString()),
        source: "notifications",
        label: String(item.type || "Activity"),
        thumbnail_url: typeof item?.payload?.thumbnail_url === "string" ? item.payload.thumbnail_url : null,
        action: actionForNotification(item, category),
      };
    }),
    ...visitors.map((item: any) => ({
      id: `visitor:${item.id}`,
      category: "visitor" as ActivityCategory,
      severity: severityFrom(item.status),
      title: `${String(item.visitor_name || item.name || "Visitor")} ${String(item.status || "updated").replaceAll("_", " ")}`,
      description: String(item.purpose || "Visitor access activity"),
      occurred_at: String(item.updated_at || item.created_at || new Date().toISOString()),
      source: "visitors",
      label: "People",
      action: item.id ? { href: `/visitors?visitorId=${encodeURIComponent(String(item.id))}`, label: "Open visitor", kind: "visitor" } : null,
    })),
    ...maintenance.map((item: any) => ({
      id: `maintenance:${item.id}`,
      category: "maintenance" as ActivityCategory,
      severity: severityFrom(`${item.priority} ${item.status}`),
      title: String(item.title || "Maintenance request"),
      description: String(item.description || item.status || "Service update"),
      occurred_at: String(item.updated_at || item.created_at || new Date().toISOString()),
      source: "maintenance_requests",
      label: "Service",
      action: item.id ? { href: `/maintenance?requestId=${encodeURIComponent(String(item.id))}`, label: "Open request", kind: "maintenance" } : null,
    })),
  ].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  return {
    items,
    summary: calculateSummary(items),
    sources: {
      activity_endpoint: { available: false, reason: "backend_route_unavailable_fallback_used" },
      notifications: { available: notificationRes.status === "fulfilled", reason: null },
      visitors: { available: visitorRes.status === "fulfilled", reason: null },
      maintenance: { available: maintenanceRes.status === "fulfilled", reason: null },
    },
    generated_at: new Date().toISOString(),
  };
}

export async function getActivityFeed(): Promise<ActivityResponse | { error: string }> {
  try {
    const res = await API.get("/activity/feed");
    const items = Array.isArray(res.data?.items) ? res.data.items : [];
    return {
      items: items.map(normalizeActivityItem),
      summary: res.data?.summary || emptySummary(),
      sources: res.data?.sources || {},
      generated_at: res.data?.generated_at,
    };
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 404) {
      try {
        const prefixed = await API.get("/api/activity/feed");
        const items = Array.isArray(prefixed.data?.items) ? prefixed.data.items : [];
        return {
          items: items.map(normalizeActivityItem),
          summary: prefixed.data?.summary || emptySummary(),
          sources: prefixed.data?.sources || {},
          generated_at: prefixed.data?.generated_at,
        };
      } catch (prefixedErr: any) {
        if (prefixedErr?.response?.status === 404) return getLocalFallbackFeed();
        return { error: pickError(prefixedErr, "Failed to load activity") };
      }
    }
    return { error: pickError(err, "Failed to load activity") };
  }
}

function normalizeActivityItem(item: any): ActivityEvent {
  const category = categoryFrom(`${item.category} ${item.type} ${item.title} ${item.description}`);
  const action = item.action && typeof item.action?.href === "string"
    ? item.action
    : item.metadata?.action || actionForNotification(item, category);
  return { ...item, category: item.category || category, action };
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
    .filter((item) => item.category !== "security" && item.severity !== "high")
    .map(notificationIdFromActivity)
    .filter(Boolean);

  await Promise.allSettled(ids.map((id) => acknowledgeNotification(id)));
  return Array.from(new Set(ids));
}

export async function getActivitySummary(): Promise<ActivitySummary | { error: string }> {
  try {
    const res = await API.get("/activity/summary");
    return res.data?.summary || emptySummary();
  } catch (err: any) {
    if (err?.response?.status === 404) {
      const fallback = await getLocalFallbackFeed();
      return fallback.summary;
    }
    return { error: pickError(err, "Failed to load activity summary") };
  }
}
