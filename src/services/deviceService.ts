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

export const deviceService = {
  async getDevices(estateId?: string) {
    try {
      const url = estateId
        ? `/devices/estate/${estateId}`
        : `/devices/discover`;

      const res = await API.get(url);

      // Supports:
      // { devices: [...] }
      // { count, devices }
      // plain array
      return res.data?.devices ?? res.data ?? [];
    } catch (err) {
      console.warn("deviceService.getDevices error:", err);
      return [];
    }
  },

  /**
   * IMPORTANT:
   * - If backend returns 404 (device not assigned yet)
   *   we return { state: {} }
   * - We DO NOT throw
   */
  async getDeviceState(deviceId: string): Promise<DeviceStateResponse> {
    try {
      const res = await API.get(
        `/devices/${encodeURIComponent(deviceId)}/state`
      );

      return {
        deviceId: res.data?.deviceId,
        state: res.data?.state ?? {},
        lastSeen: res.data?.lastSeen ?? null,
      };
    } catch (err: any) {
      // If device not assigned yet, backend returns 404
      if (err?.response?.status === 404) {
        return {
          state: {},
          error: "Device not assigned yet",
        };
      }

      return {
        state: {},
        error:
          err?.response?.data?.error ||
          err?.message ||
          "Failed to load device state",
      };
    }
  },

  async assignDevices(payload: AssignDevicesPayload) {
    const res = await API.post("/devices/assign", payload);
    return res.data;
  },

  /**
   * Canonical command execution
   */
  async commandDevice(deviceId: string, command: Record<string, any>) {
    const res = await API.post(
      `/devices/${encodeURIComponent(deviceId)}/command`,
      { command }
    );

    return res.data as { ok?: boolean; status: "command_queued" };
  },
};
