// src/services/deviceService.ts
import API from "./api";

export type AssignDevicesPayload = {
  deviceIds: string[];
  room?: string | null;
};

export type DeviceStateResponse = {
  deviceId: string;
  state: Record<string, any>;
  lastSeen?: string;
};

export const deviceService = {
  /* ---------------------------------
     GET DEVICES
     - Estate devices if estateId exists
     - Otherwise discovery list
  ---------------------------------- */
  async getDevices(estateId?: string) {
    try {
      const url = estateId ? `/devices/estate/${estateId}` : `/devices/discover`;
      const res = await API.get(url);
      return res.data?.devices ?? res.data ?? [];
    } catch (err) {
      console.warn("deviceService.getDevices error:", err);
      return [];
    }
  },

  /* ---------------------------------
     DEVICE STATE (initial fetch)
     GET /devices/:deviceId/state
  ---------------------------------- */
  async getDeviceState(deviceId: string): Promise<DeviceStateResponse | null> {
    try {
      const res = await API.get(`/devices/${encodeURIComponent(deviceId)}/state`);
      return res.data ?? null;
    } catch (err) {
      // 404 = no state yet (normal early)
      return null;
    }
  },

  /* ---------------------------------
     ASSIGN DEVICES TO ROOM / UNIT
  ---------------------------------- */
  async assignDevices(payload: AssignDevicesPayload) {
    try {
      const res = await API.post("/devices/assign", payload);
      return res.data;
    } catch (err) {
      console.warn("deviceService.assignDevices error:", err);
      throw err;
    }
  },
};
