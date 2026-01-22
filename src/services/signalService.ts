import API from "./api";

export type DeviceCommandPayload = {
  capability: string; // "power" | "temperature" | "mode" | ...
  value: any;
  meta?: Record<string, any>;

  // optional routing context (if you have it)
  estateId?: string;
  homeId?: string;
  roomId?: string;
};

export const signalService = {
  /**
   * ✅ Preferred if you add the alias route
   * POST /signals/device/:deviceId/command
   */
  async commandDevice(deviceId: string, payload: DeviceCommandPayload) {
    const res = await API.post(`/signals/device/${encodeURIComponent(deviceId)}/command`, payload);
    return res.data; // expect { ok, state? } or whatever ingestSignal returns
  },

  /**
   * ✅ Works right now even WITHOUT alias route
   * POST /signals
   */
  async emitSignal(payload: any) {
    const res = await API.post(`/signals`, payload);
    return res.data;
  },
};
