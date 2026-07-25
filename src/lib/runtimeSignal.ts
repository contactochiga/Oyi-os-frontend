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
  return {
    deviceId,
    state,
    canonical_state: payload?.canonical_state || payload?.canonicalState || signalMetadata?.canonical_state || null,
    canonicalState: payload?.canonical_state || payload?.canonicalState || signalMetadata?.canonicalState || null,
    canonical_presentation: payload?.canonical_presentation || payload?.presentation || signalMetadata?.canonical_presentation || null,
    presentation: payload?.canonical_presentation || payload?.presentation || signalMetadata?.presentation || null,
    normalized_state: payload?.normalized_state || signalMetadata?.normalized_state || null,
    primary_state: payload?.primary_state || signalMetadata?.primary_state || null,
    activity_summary: payload?.activity_summary || signalMetadata?.activity_summary || null,
    room_id: payload?.room_id || payload?.roomId || signalMetadata?.room_id || null,
    room_name: payload?.room_name || signalMetadata?.room_name || null,
  };
}
