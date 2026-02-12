// src/services/deviceService.ts
import API from "./api";

export type AssignDevicesPayload = {
  deviceIds: string[];
  room?: string | null;
  room_id?: string | null;
};

export type DeviceStateResponse = {
  deviceId?: string;
  external_id?: string;
  vendor?: string;
  state: Record<string, any>;
  lastSeen?: string | null;
  source?: "cache" | "live" | "none" | "live_failed" | string;
  warning?: string;
  error?: string;
};

export const deviceService = {
  /**
   * If estateId exists -> fetch bound devices for that estate
   * Else -> discovery (new/unbound devices)
   */
  async getDevices(estateId?: string) {
    const url = estateId ? `/devices/estate/${estateId}` : `/devices/discover`;
    const res = await API.get(url);

    // supports:
    // - { devices: [...] }
    // - { count, devices, adapter }
    // - plain array
    return res.data?.devices ?? res.data ?? [];
  },

  async getDeviceState(deviceId: string): Promise<DeviceStateResponse> {
    try {
      const res = await API.get(`/devices/${encodeURIComponent(deviceId)}/state`);
      // backend returns { deviceId, state, lastSeen, source... }
      return (res.data ?? { state: {} }) as DeviceStateResponse;
    } catch (e: any) {
      // ✅ don’t return null — return something the UI can render
      return {
        state: {},
        error: e?.response?.data?.error || e?.message || "Failed to load device state",
        source: "live_failed",
      };
    }
  },

  async assignDevices(payload: AssignDevicesPayload) {
    const res = await API.post("/devices/assign", payload);
    return res.data;
  },

  /**
   * Canonical command execution
   * Used by chat, panels, automations
   */
  async commandDevice(deviceId: string, command: Record<string, any>) {
    const res = await API.post(`/devices/${encodeURIComponent(deviceId)}/command`, { command });
    return res.data as { ok?: boolean; status: "command_queued" | string };
  },
};
