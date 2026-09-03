import { create } from "zustand";

// Canonical cross-page "please open this device" request. Any surface that
// wants to open a device's real control surface (Room, Home favorites,
// future entry points) sets this before navigating to /devices, instead of
// relying solely on the ?deviceId= query string — Next's client-side router
// cache does not reliably re-run effects on query-only changes to a route
// that was already visited earlier in the session, which made the old
// URL-only deep link intermittently land on the plain Devices list instead
// of opening the target device.
type DeviceOpenRequestState = {
  requestedDeviceId: string | null;
  requestDeviceOpen: (deviceId: string) => void;
  clearRequestedDeviceOpen: () => void;
};

export const useDeviceOpenRequestStore = create<DeviceOpenRequestState>((set) => ({
  requestedDeviceId: null,
  requestDeviceOpen: (deviceId) => set({ requestedDeviceId: deviceId }),
  clearRequestedDeviceOpen: () => set({ requestedDeviceId: null }),
}));
