import { create } from "zustand";

type DeviceStateStore = {
  stateByDeviceId: Record<string, Record<string, any>>;
  updatedAtByDeviceId: Record<string, number>;
  upsertState: (deviceId: string, state: Record<string, any>) => void;
};

export const useDeviceStateStore = create<DeviceStateStore>((set) => ({
  stateByDeviceId: {},
  updatedAtByDeviceId: {},
  upsertState: (deviceId, state) =>
    set((s) => ({
      stateByDeviceId: {
        ...s.stateByDeviceId,
        [deviceId]: { ...(s.stateByDeviceId[deviceId] || {}), ...state },
      },
      updatedAtByDeviceId: { ...s.updatedAtByDeviceId, [deviceId]: Date.now() },
    })),
}));
