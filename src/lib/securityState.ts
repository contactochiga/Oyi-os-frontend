// Canonical resident-visible security state, shared by the Security page
// and the Home operating strip so the two surfaces can never disagree.
export function isSecurityDevice(device: any) {
  const text = `${device?.name || ""} ${device?.type || ""} ${device?.category || ""} ${device?.device_type || ""}`.toLowerCase();
  return ["lock", "door", "gate", "security", "access", "motion", "sensor"].some((x) => text.includes(x));
}

export function isSecurityDeviceOnline(device: any) {
  if (typeof device?.online === "boolean") return device.online;
  const status = String(device?.status || device?.state || "").toLowerCase();
  return ["online", "active", "connected", "on"].some((x) => status.includes(x));
}

export type ResolvedSecurityState = { label: string; secure: boolean | null };

// Security state is never a restatement of the visitor count — an active
// visitor is one real input into whether the home reads as fully secure,
// not the value itself. "Protected" is only ever returned when devices
// have actually loaded and none are offline.
export function resolveSecurityState(devices: any[], activeVisitorCount: number, loading: boolean): ResolvedSecurityState {
  if (loading) return { label: "Checking…", secure: null };
  const securityDevices = devices.filter(isSecurityDevice);
  const offline = securityDevices.filter((d) => !isSecurityDeviceOnline(d));
  if (offline.length > 0) return { label: offline.length === 1 ? "1 device offline" : `${offline.length} devices offline`, secure: false };
  if (activeVisitorCount > 0) return { label: "Visitor present", secure: false };
  return { label: "Protected", secure: true };
}
