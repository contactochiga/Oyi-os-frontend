import API from "./api";

export const deviceService = {
  async getDevices(estateId?: string) {
    try {
      const url = estateId
        ? `/devices/estate/${estateId}`
        : `/devices/discover`;

      const res = await API.get(url);

      return res.data?.devices || res.data || [];
    } catch (err) {
      console.warn("deviceService.getDevices error:", err);
      return [];
    }
  }
};
