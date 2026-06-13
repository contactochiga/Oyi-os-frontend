import API from "./api";

export type NotificationPreference = {
  category: string;
  push_enabled: boolean;
  in_app_enabled: boolean;
  critical_only: boolean;
  digest_mode: boolean;
  cooldown_minutes: number;
  quiet_hours?: Record<string, any>;
};

function pickItems(value: any): NotificationPreference[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  return [];
}

export const notificationPreferencesService = {
  async list() {
    const response = await API.get("/notifications/preferences");
    return pickItems(response.data);
  },

  async update(category: string, patch: Partial<NotificationPreference>) {
    const response = await API.patch(`/notifications/preferences/${encodeURIComponent(category)}`, patch);
    return response.data?.item || response.data;
  },
};
