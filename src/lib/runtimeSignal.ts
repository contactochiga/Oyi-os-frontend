type RuntimeSignalLike = {
  entity?: { id?: string; state?: Record<string, any> | null };
  metadata?: Record<string, any> | null;
};

function record(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : null;
}

function readState(value: unknown) {
  const next = record(value);
  return next && Object.keys(next).length ? next : null;
}

export function extractRuntimeDeviceUpdate(payload: any) {
  const signal = (payload?.operational_signal || payload?.signal || null) as RuntimeSignalLike | null;
  const signalEntity = record(signal?.entity);
  const signalMetadata = record(signal?.metadata);

  const deviceId =
    String(
      payload?.deviceId ||
      payload?.device_id ||
      signalEntity?.id ||
      signalMetadata?.deviceId ||
      signalMetadata?.device_id ||
      ""
    ).trim() || null;

  const state =
    readState(payload?.state) ||
    readState(signalEntity?.state) ||
    readState(signalMetadata?.state) ||
    readState(signalMetadata?.reported_state);

  if (!deviceId || !state) return null;
  return { deviceId, state };
}
