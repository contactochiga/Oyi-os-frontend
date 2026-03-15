import API from "./api";

export type NotificationStatus = "unread" | "read";

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
