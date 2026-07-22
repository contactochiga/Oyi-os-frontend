import API from "@/services/api";

export type ProximityState = "near_home" | "leaving_home" | "away" | "approaching_estate";

export type ProximitySettings = {
  available?: boolean;
  enabled: boolean;
  radius_meters: 20 | 100 | 500 | 1000;
  home_id?: string | null;
  estate_id?: string | null;
  home_lat?: number | null;
  home_lng?: number | null;
  estate_lat?: number | null;
  estate_lng?: number | null;
  last_state?: ProximityState | null;
  last_notification_at?: string | null;
};

export type ProximityScope = {
  estate_id?: string | null;
  home_id?: string | null;
};

export const DEFAULT_PROXIMITY_SETTINGS: ProximitySettings = {
  available: true,
  enabled: false,
  radius_meters: 100,
  home_id: null,
  estate_id: null,
  home_lat: null,
  home_lng: null,
  estate_lat: null,
  estate_lng: null,
  last_state: null,
  last_notification_at: null,
};

function normalizeSettings(value: any): ProximitySettings {
  const raw = value?.settings || value?.data?.settings || value || {};
  const radius = Number(raw.radius_meters);
  const safeRadius = [20, 100, 500, 1000].includes(radius) ? radius : 100;
  return {
    ...DEFAULT_PROXIMITY_SETTINGS,
    ...raw,
    enabled: raw.enabled === true,
    radius_meters: safeRadius as ProximitySettings["radius_meters"],
    home_lat: raw.home_lat === null || raw.home_lat === undefined ? null : Number(raw.home_lat),
    home_lng: raw.home_lng === null || raw.home_lng === undefined ? null : Number(raw.home_lng),
    estate_lat: raw.estate_lat === null || raw.estate_lat === undefined ? null : Number(raw.estate_lat),
    estate_lng: raw.estate_lng === null || raw.estate_lng === undefined ? null : Number(raw.estate_lng),
  };
}

export const proximityService = {
  async getSettings(scope?: ProximityScope) {
    const response = await API.get("/proximity/settings", {
      params: {
        estate_id: scope?.estate_id || undefined,
        home_id: scope?.home_id || undefined,
      },
    });
    return normalizeSettings(response.data);
  },

  async updateSettings(patch: Partial<ProximitySettings>, scope?: ProximityScope) {
    const response = await API.patch("/proximity/settings", {
      ...patch,
      estate_id: patch.estate_id ?? scope?.estate_id ?? undefined,
      home_id: patch.home_id ?? scope?.home_id ?? undefined,
    });
    return normalizeSettings(response.data);
  },

  async recordEvent(input: {
    state: ProximityState;
    distance_meters?: number | null;
    home_id?: string | null;
    estate_id?: string | null;
    occurred_at?: string;
  }) {
    const response = await API.post("/proximity/event", input);
    return response.data;
  },
};
