// src/services/deviceService.ts
import API from "./api";

export type AssignDevicesPayload = {
  deviceIds: string[];
  room?: string | null;
};

export type DeviceStateResponse = {
  deviceId?: string;
  state: Record<string, any>;
  lastSeen?: string | null;
  error?: string;
};

/**
 * ✅ RULES (keep it simple)
 * - DISCOVERY = /devices/discover  (things Tuya can see, not yet “bound”)
 * - ASSIGNED  = /devices/estate/:estateId  (things saved to your DB for that estate)
 * - STATE     = /devices/:deviceId/state  (works for internal UUID OR external_id — your backend resolves it)
 * - COMMAND   = /devices/:deviceId/command
 */
export const deviceService = {
  /**
   * ✅ DISCOVERY ONLY
   * Always scans discoverable devices (Tuya / adapter).
   */
  async discoverDevices() {
    try {
      const res = await API.get("/devices/discover");
      return res.data?.devices ?? res.data ?? [];
    } catch (err: any) {
      const status = Number(err?.response?.status || 0);
      if (status && status < 500) return [];
      console.warn("deviceService.discoverDevices error:", err);
      return [];
    }
  },

  /**
   * ✅ ASSIGNED (BOUND) DEVICES ONLY
   * Pull devices that belong to this estate in your DB.
   */
  async getAssignedDevices(estateId?: string) {
    if (!estateId) return [];
    try {
      const res = await API.get(`/devices/estate/${encodeURIComponent(estateId)}`);
      return res.data?.devices ?? res.data ?? [];
    } catch (err) {
      console.warn("deviceService.getAssignedDevices error:", err);
      return [];
    }
  },

  /**
   * Registry view for the Devices page. Includes estate-scoped provider devices
   * waiting for room/home assignment without leaking them into Home controls.
   */
  async getRegistryDevices(estateId?: string) {
    if (!estateId) return [];
    try {
      const res = await API.get(`/devices/estate/${encodeURIComponent(estateId)}`, {
        params: { include_unassigned: true },
      });
      return res.data?.devices ?? res.data ?? [];
    } catch (err) {
      console.warn("deviceService.getRegistryDevices error:", err);
      return [];
    }
  },

  /**
   * ✅ Backward-compatible helper
   * - If estateId provided -> ASSIGNED
   * - If not -> DISCOVERY
   *
   * (Keep this so existing screens don’t break.)
   */
  async getDevices(estateId?: string) {
    if (estateId) return this.getAssignedDevices(estateId);
    return this.discoverDevices();
  },

  /**
   * ✅ STATE FETCH
   * Your backend controller resolves deviceId as:
   * - UUID in devices.id OR
   * - external_id in devices.external_id (scoped to estate)
   *
   * IMPORTANT:
   * - If backend returns 404 (device not found in DB / wrong estate), we return { state: {} }
   * - We DO NOT throw
   */
  async getDeviceState(deviceId: string): Promise<DeviceStateResponse> {
    try {
      const res = await API.get(`/devices/${encodeURIComponent(deviceId)}/state`);

      return {
        deviceId: res.data?.deviceId,
        state: res.data?.state ?? {},
        lastSeen: res.data?.lastSeen ?? null,
        error: res.data?.error,
      };
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return { state: {}, error: "Device not found / not assigned to this estate" };
      }

      return {
        state: {},
        error: err?.response?.data?.error || err?.message || "Failed to load device state",
      };
    }
  },

  /**
   * ✅ ASSIGN / BIND devices into DB (estate/home/room)
   */
  async assignDevices(payload: AssignDevicesPayload) {
    const res = await API.post("/devices/assign", payload);
    return res.data;
  },

  /**
   * ✅ COMMAND execution
   */
  async commandDevice(deviceId: string, command: Record<string, any>) {
    const res = await API.post(`/devices/${encodeURIComponent(deviceId)}/command`, { command });
    return res.data as { ok?: boolean; status?: string; error?: string; details?: string; state?: Record<string, any> };
  },
};
