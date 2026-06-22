import API from "./api";

export type NotificationStatus = "unread" | "read";

export type NotificationRouting = {
  source_type: string;
  source_id: string | null;
  destination: "page" | "drawer" | "queue" | "attention" | "external" | "none";
  target: { target_type: string; target_id?: string | null; infrastructure_source?: string; open_as: string; action?: string } | null;
  actionability: string;
  attention_eligible: boolean;
  queue_eligible: boolean;
  acknowledgement_required: boolean;
};

export type AppNotification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string; // invite | device | wallet | maintenance | security | ...
  payload?: any;
  status: NotificationStatus;
  created_at: string;
  updated_at?: string;
  routing?: NotificationRouting;
};

function pickError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;
}

/**
 * GET /notifications
 */
export async function listMyNotifications() {
  try {
    const res = await API.get("/notifications");
    if (Array.isArray(res.data)) return res.data as AppNotification[];
    if (Array.isArray(res.data?.items)) return res.data.items as AppNotification[];
    return [];
  } catch (err: any) {
    return { error: pickError(err, "Failed to load notifications") } as any;
  }
}

/**
 * POST /notifications/read/:id
 */
export async function markNotificationRead(id: string) {
  try {
    const res = await API.post(`/notifications/read/${id}`);
    return (res.data?.item || res.data) as AppNotification;
  } catch (err: any) {
    return { error: pickError(err, "Failed to mark notification as read") } as any;
  }
}

/**
 * POST /notifications/ack/:id
 * Falls back to the legacy read endpoint if the backend has not deployed the alias yet.
 */
export async function acknowledgeNotification(id: string) {
  try {
    const res = await API.post(`/notifications/ack/${id}`);
    return (res.data?.item || res.data) as AppNotification;
  } catch (err: any) {
    if (err?.response?.status === 404) return markNotificationRead(id);
    return { error: pickError(err, "Failed to acknowledge notification") } as any;
  }
}
