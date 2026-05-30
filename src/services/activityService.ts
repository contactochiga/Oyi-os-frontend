import API from "./api";
import { listMyNotifications } from "./notificationsService";
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
    ...notifications.map((item: any) => ({
      id: `notification:${item.id}`,
      category: categoryFrom(`${item.type} ${item.title} ${item.message}`),
      severity: severityFrom(`${item.status} ${item.title} ${item.type}`),
      title: String(item.title || "Home update"),
      description: String(item.message || "Oyi activity"),
      occurred_at: String(item.created_at || new Date().toISOString()),
      source: "notifications",
      label: String(item.type || "Activity"),
      thumbnail_url: typeof item?.payload?.thumbnail_url === "string" ? item.payload.thumbnail_url : null,
    })),
    ...visitors.map((item: any) => ({
      id: `visitor:${item.id}`,
      category: "visitor" as ActivityCategory,
      severity: severityFrom(item.status),
      title: `${String(item.visitor_name || item.name || "Visitor")} ${String(item.status || "updated").replaceAll("_", " ")}`,
      description: String(item.purpose || "Visitor access activity"),
      occurred_at: String(item.updated_at || item.created_at || new Date().toISOString()),
      source: "visitors",
      label: "People",
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
    return {
      items: Array.isArray(res.data?.items) ? res.data.items : [],
      summary: res.data?.summary || emptySummary(),
      sources: res.data?.sources || {},
      generated_at: res.data?.generated_at,
    };
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 404) {
      try {
        const prefixed = await API.get("/api/activity/feed");
        return {
          items: Array.isArray(prefixed.data?.items) ? prefixed.data.items : [],
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
