import API from "./api";

export type AssignDevicesPayload = {
  deviceIds: string[];
  room?: string | null;
};

export const deviceService = {
  /* ---------------------------------
     GET DEVICES
     - Estate devices if estateId exists
     - Otherwise discovery list
  ---------------------------------- */
  async getDevices(estateId?: string) {
    try {
      const url = estateId
        ? `/devices/estate/${estateId}`
        : `/devices/discover`;

      const res = await API.get(url);
      return res.data?.devices ?? res.data ?? [];
    } catch (err) {
      console.warn("deviceService.getDevices error:", err);
      return [];
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
