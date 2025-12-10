import API from "./api";

export const deviceService = {
  async getDevices(estateId?: string) {
    const url = estateId ? `/devices/estate/${estateId}` : "/devices/discover";
    try {
      const res = await API.get("/devices/discover"); // your backend route used earlier
      return res.data.devices || res.data || [];
    } catch (err) {
      console.warn("deviceService error", err);
      return [];
    }
  }
};
