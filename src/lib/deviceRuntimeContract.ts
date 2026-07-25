export type RuntimeStateRecord = Record<string, any>;

export type CanonicalDeviceState = {
  availability:
    | "online"
    | "offline"
    | "stale"
    | "unknown"
    | "provider_disconnected"
    | "setup_incomplete";
  lastSeenAt: string | null;
  lastProviderSyncAt: string | null;
  staleAfterMs: number | null;
  primaryState: {
    key: string;
    value: string | number | boolean | null;
    label: string;
  };
  secondaryState?: {
    key: string;
    value: string | number | boolean | null;
    label: string;
  };
  batteryPercentage?: number | null;
  batteryLevel?: "normal" | "low" | "critical" | "unknown";
  alerts: Array<{
    type: string;
    severity: "info" | "warning" | "critical";
    message: string;
  }>;
  supportedActions: string[];
  executableActions: string[];
  providerEvidence: Record<string, unknown>;
};

export type CanonicalDevicePresentation = {
  availability: CanonicalDeviceState["availability"];
  availabilityReason:
    | "provider_reports_online"
    | "provider_reports_offline"
    | "last_success_too_old"
    | "provider_connection_missing"
    | "provider_permission_denied"
    | "gateway_offline"
    | "local_only_unreachable"
    | "setup_incomplete"
    | "unknown";
  assignment: {
    estateId: string | null;
    buildingId: string | null;
    homeId: string | null;
    roomId: string | null;
    roomName: string | null;
  };
  lastSeenAt: string | null;
  lastCheckedAt: string | null;
  lastConfirmedStateAt: string | null;
  staleAfterMs: number | null;
  primaryState: CanonicalDeviceState["primaryState"] & {
    confidence: "live" | "last_confirmed" | "inferred" | "unknown";
  };
  secondaryState?: CanonicalDeviceState["secondaryState"];
  batteryPercentage: number | null;
  batteryLevel: "normal" | "low" | "critical" | "unknown";
  supportedActions: string[];
  executableActions: string[];
  alerts: CanonicalDeviceState["alerts"];
  summary: string;
};

export type DeviceRuntimeContract = {
  deviceId?: string;
  state: RuntimeStateRecord;
  normalized_state?: RuntimeStateRecord | null;
  capabilities?: any[];
  supported_controls?: string[];
  capability_codes?: string[];
  channel_definitions?: Array<{
    index: number;
    code: string;
    name: string;
    state: boolean | null;
    controllable: boolean;
    last_update: string | null;
  }>;
  control_profile?: string | null;
  health_status?: string | null;
  provider_health?: string | null;
  primary_state?: string | null;
  canonical_state?: CanonicalDeviceState | null;
  canonicalState?: CanonicalDeviceState | null;
  canonical_presentation?: CanonicalDevicePresentation | null;
  presentation?: CanonicalDevicePresentation | null;
  telemetry_summary?: RuntimeStateRecord | null;
  last_signal?: string | null;
  activity_summary?: string | null;
  device_family?: string | null;
  device_type?: string | null;
  memory_summary?: Record<string, any> | null;
  relationships?: Record<string, any> | null;
  predictive_findings?: Array<Record<string, any>>;
  recent_executions?: Array<Record<string, any>>;
  active_scenes?: Array<Record<string, any>>;
  active_automations?: Array<Record<string, any>>;
  conversation_context?: Record<string, any> | null;
  lastSeen?: string | null;
  error?: string;
};

function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function text(...values: any[]) {
  for (const value of values) {
    const next = String(value ?? "").trim();
    if (next) return next;
  }
  return "";
}

function boolValue(value: any): boolean | null {
  if (value === true || value === false) return value;
  const raw = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "on", "yes", "active", "open", "online", "healthy"].includes(raw)) return true;
  if (["0", "false", "off", "no", "inactive", "closed", "offline", "unavailable"].includes(raw)) return false;
  return null;
}

function titleCase(value: string, fallback: string) {
  const normalized = value.replace(/[_-]+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized
    .split(/\s+/)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function numberValue(value: any): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function batteryLevel(value: number | null): CanonicalDeviceState["batteryLevel"] {
  if (value == null) return "unknown";
  if (value <= 20) return "critical";
  if (value <= 35) return "low";
  return "normal";
}

function isoTimestamp(...values: any[]) {
  for (const value of values) {
    const raw = text(value);
    if (!raw) continue;
    const date = new Date(raw);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

export function statusLabel(value: any, fallback = "Awaiting sync") {
  const raw = text(value).toLowerCase();
  if (!raw) return fallback;
  if (raw === "on") return "On";
  if (raw === "off") return "Off";
  if (raw === "online") return "Online";
  if (raw === "offline") return "Offline";
  if (raw === "locked") return "Locked";
  if (raw === "unlocked") return "Unlocked";
  if (raw === "open") return "Open";
  if (raw === "closed") return "Closed";
  if (raw === "reporting") return "Reporting";
  if (raw === "fault") return "Attention";
  if (raw === "idle") return "Idle";
  return titleCase(raw, fallback);
}

export function healthLabel(value: any, fallback = "Unknown") {
  const raw = text(value).toLowerCase();
  if (!raw) return fallback;
  if (raw === "stable" || raw === "healthy") return "Healthy";
  if (raw === "offline") return "Offline";
  if (raw === "degraded") return "Degraded";
  if (raw === "battery_low") return "Battery low";
  if (/attention|warning|issue|review/.test(raw)) return "Attention";
  return titleCase(raw, fallback);
}

export function originLabel(value: any, fallback = "System activity") {
  const raw = text(value).toLowerCase();
  if (!raw) return fallback;
  if (raw.includes("consumer_app") || raw === "app" || raw === "watch") return "From your phone";
  if (raw.includes("facility")) return "From facility";
  if (raw.includes("office")) return "From office";
  if (raw.includes("physical")) return "Manual switch action";
  if (raw.includes("automation") || raw.includes("scene")) return "Automation";
  if (raw.includes("provider")) return "Provider sync";
  return titleCase(raw, fallback);
}

export function deviceFamilyLabel(value: any, fallback = "Device") {
  return titleCase(text(value).toLowerCase(), fallback);
}

export function controlProfileLabel(value: any, fallback = "Standard") {
  const raw = text(value).toLowerCase();
  if (!raw) return fallback;
  if (raw === "ir_remote") return "IR Remote";
  return titleCase(raw, fallback);
}

export function normalizeRuntimeContract(device: Record<string, any> | null | undefined, runtime?: Partial<DeviceRuntimeContract> | null) {
  const source = record(runtime);
  const state = record(source.state);
  const normalized = record(source.normalized_state);
  const family = text(source.device_family, device?.device_family, device?.category, device?.type).toLowerCase() || null;
  const profile = text(source.control_profile, device?.control_profile).toLowerCase() || null;
  const online = boolValue(normalized.online ?? state.online ?? device?.online ?? device?.connected);
  const power = boolValue(normalized.power ?? state.switch ?? state.power ?? state.on);
  const primary =
    text(source.primary_state).toLowerCase() ||
    (online === false ? "offline" : "") ||
    (power === true ? "on" : power === false ? "off" : "") ||
    text(normalized.lock_state).toLowerCase() ||
    "";
  const health =
    text(source.health_status).toLowerCase() ||
    (online === false ? "offline" : "") ||
    text(device?.status).toLowerCase() ||
    "stable";

  const contract = {
    deviceId: text(source.deviceId, source.deviceId, device?.id) || undefined,
    state,
    normalized_state: Object.keys(normalized).length ? normalized : null,
    capabilities: Array.isArray(source.capabilities) ? source.capabilities : Array.isArray(device?.capabilities) ? device.capabilities : [],
    supported_controls: Array.isArray(source.supported_controls) ? source.supported_controls : Array.isArray(device?.supported_controls) ? device.supported_controls : [],
    capability_codes: Array.isArray(source.capability_codes) ? source.capability_codes : [],
    channel_definitions: Array.isArray(source.channel_definitions) ? source.channel_definitions : [],
    control_profile: profile || null,
    health_status: health || null,
    provider_health: text(source.provider_health, device?.provider_health).toLowerCase() || null,
    primary_state: primary || null,
    canonical_state: source.canonical_state || source.canonicalState || null,
    canonicalState: source.canonical_state || source.canonicalState || null,
    canonical_presentation: source.canonical_presentation || source.presentation || null,
    presentation: source.canonical_presentation || source.presentation || null,
    telemetry_summary: record(source.telemetry_summary),
    last_signal: text(source.last_signal, device?.last_signal) || null,
    activity_summary: text(source.activity_summary, source.last_signal, device?.activity_summary, device?.last_signal) || null,
    device_family: family || null,
    device_type: text(source.device_type, device?.device_type, device?.type) || null,
    memory_summary: record(source.memory_summary),
    relationships: record(source.relationships),
    predictive_findings: Array.isArray(source.predictive_findings) ? source.predictive_findings : [],
    recent_executions: Array.isArray(source.recent_executions) ? source.recent_executions : [],
    active_scenes: Array.isArray(source.active_scenes) ? source.active_scenes : [],
    active_automations: Array.isArray(source.active_automations) ? source.active_automations : [],
    conversation_context: record(source.conversation_context),
    lastSeen: text(source.lastSeen, device?.last_seen_at, device?.updated_at) || null,
    error: text(source.error) || undefined,
  } satisfies DeviceRuntimeContract;
  if (!contract.canonical_state) {
    contract.canonical_state = deriveCanonicalDeviceState(device, contract);
    contract.canonicalState = contract.canonical_state;
  }
  if (!contract.canonical_presentation) {
    const canonical = contract.canonical_state;
    contract.canonical_presentation = {
      availability: canonical.availability,
      availabilityReason: (canonical as any).availabilityReason || "unknown",
      assignment: {
        estateId: text((source as any).estate_id, device?.estate_id) || null,
        buildingId: text((source as any).building_id, device?.building_id, device?.metadata?.building_id) || null,
        homeId: text((source as any).home_id, device?.home_id) || null,
        roomId: text((source as any).room_id, device?.room_id) || null,
        roomName: text((source as any).room_name, device?.room_name, device?.room?.name, device?.metadata?.room_name) || null,
      },
      lastSeenAt: canonical.lastSeenAt,
      lastCheckedAt: canonical.lastProviderSyncAt || text((source as any).last_refresh) || null,
      lastConfirmedStateAt: canonical.primaryState?.value !== null ? canonical.lastSeenAt || canonical.lastProviderSyncAt : null,
      staleAfterMs: canonical.staleAfterMs,
      primaryState: {
        ...canonical.primaryState,
        confidence: (canonical.primaryState as any).confidence || (canonical.availability === "online" ? "live" : ["offline", "stale"].includes(canonical.availability) ? "last_confirmed" : "unknown"),
      },
      secondaryState: canonical.secondaryState,
      batteryPercentage: typeof canonical.batteryPercentage === "number" ? canonical.batteryPercentage : null,
      batteryLevel: canonical.batteryLevel || "unknown",
      supportedActions: canonical.supportedActions || [],
      executableActions: canonical.executableActions || [],
      alerts: canonical.alerts || [],
      summary: text((source as any).activity_summary, canonical.primaryState?.label, canonical.availability) || "State unknown",
    };
    contract.presentation = contract.canonical_presentation;
  }
  return contract;
}

export function deriveCanonicalDeviceState(device: Record<string, any> | null | undefined, runtime?: Partial<DeviceRuntimeContract> | null): CanonicalDeviceState {
  const source = record(runtime);
  const state = record(source.state);
  const normalized = record(source.normalized_state);
  const family = text(source.device_family, device?.device_family, device?.category, device?.type).toLowerCase();
  const online = boolValue(normalized.online ?? state.online ?? device?.online ?? device?.connected);
  const power = boolValue(normalized.power ?? state.switch ?? state.power ?? state.on);
  const battery = numberValue(normalized.battery ?? state.battery_percentage ?? state.residual_electricity ?? state.battery_value ?? state.battery ?? device?.battery);
  const health = text(source.health_status, source.provider_health, device?.status).toLowerCase();
  const providerHealth = text(source.provider_health).toLowerCase();
  const stale = source.stale === true || text((source as any).freshness).toLowerCase() === "stale" || text((source as any).freshness).toLowerCase() === "expired";
  const availability: CanonicalDeviceState["availability"] =
    /authorization|required|permission|expired|disconnected|not_linked/.test(providerHealth) ? "provider_disconnected"
      : /setup/.test(providerHealth) ? "setup_incomplete"
        : online === false || /offline|unavailable|lost/.test(health) ? "offline"
          : stale ? "stale"
            : online === true || /healthy|stable|online/.test(health) ? "online"
              : "unknown";
  const lockState = text(normalized.lock_state ?? state.lock_state ?? state.closed_opened).toLowerCase();
  const primary =
    family === "lock" && lockState
      ? { key: "lock_state", value: lockState.includes("unlock") ? "unlocked" : "locked", label: lockState.includes("unlock") ? "Unlocked" : "Locked" }
      : power !== null
        ? { key: "power", value: power, label: power ? "On" : "Off" }
        : typeof normalized.temperature === "number"
          ? { key: "temperature", value: normalized.temperature, label: `${Math.round(Number(normalized.temperature))}°C` }
          : family === "ir_remote"
            ? { key: "remote", value: "ready", label: "Remote ready" }
            : { key: "primary_state", value: source.primary_state || null, label: statusLabel(source.primary_state, availability === "unknown" ? "State unknown" : statusLabel(availability)) };
  const level = batteryLevel(battery);
  const alerts: CanonicalDeviceState["alerts"] = [];
  if (availability === "offline") alerts.push({ type: "offline", severity: "warning", message: "Device is offline." });
  if (availability === "provider_disconnected") alerts.push({ type: "provider_disconnected", severity: "warning", message: "Provider connection needs attention." });
  if (level === "critical") alerts.push({ type: "battery_critical", severity: "critical", message: "Battery is critically low." });
  else if (level === "low") alerts.push({ type: "battery_low", severity: "warning", message: "Battery is low." });
  return {
    availability,
    lastSeenAt: isoTimestamp((source as any).lastSeen, (source as any).last_refresh, state?._oyi_runtime?.last_refresh, device?.last_seen_at, device?.updated_at),
    lastProviderSyncAt: isoTimestamp((source as any).provider_timestamp, state?._oyi_runtime?.provider_timestamp),
    staleAfterMs: Number((source as any).ttl || state?._oyi_runtime?.ttl || 0) || null,
    primaryState: primary,
    secondaryState: battery !== null ? { key: "battery", value: battery, label: `${Math.round(battery)}% battery` } : undefined,
    batteryPercentage: battery,
    batteryLevel: level,
    alerts,
    supportedActions: Array.isArray(source.supported_controls) ? source.supported_controls : [],
    executableActions: Array.isArray((source as any).executableActions) ? (source as any).executableActions : [],
    providerEvidence: record((source as any).providerEvidence),
  };
}

export function onlineState(device: Record<string, any> | null | undefined, runtime?: Partial<DeviceRuntimeContract> | null): boolean | null {
  const contract = normalizeRuntimeContract(device, runtime);
  const availability = contract.canonical_state?.availability;
  if (availability === "online") return true;
  if (["offline", "provider_disconnected", "setup_incomplete"].includes(String(availability))) return false;
  const direct = boolValue(contract.normalized_state?.online ?? contract.state?.online ?? device?.online ?? device?.connected);
  if (direct !== null) return direct;
  const status = text(contract.primary_state, contract.health_status, device?.status).toLowerCase();
  if (/offline|unavailable|down|lost/.test(status)) return false;
  if (/online|healthy|stable|active/.test(status)) return true;
  return null;
}

export function simplePowerState(device: Record<string, any> | null | undefined, runtime?: Partial<DeviceRuntimeContract> | null): boolean | null {
  const contract = normalizeRuntimeContract(device, runtime);
  const normalized = record(contract.normalized_state);
  const direct = boolValue(normalized.power ?? contract.state?.switch ?? contract.state?.power ?? contract.state?.on);
  if (direct !== null) return direct;
  const switches = record(normalized.switches);
  const values = Object.values(switches).map((value) => boolValue(value)).filter((value) => value !== null);
  if (values.includes(true)) return true;
  if (values.length) return false;
  return null;
}

export function displayPrimaryState(device: Record<string, any> | null | undefined, runtime?: Partial<DeviceRuntimeContract> | null) {
  const contract = normalizeRuntimeContract(device, runtime);
  const normalized = record(contract.normalized_state);
  if (contract.canonical_state?.primaryState?.label) return contract.canonical_state.primaryState.label;
  if (contract.primary_state) return statusLabel(contract.primary_state);
  if (normalized.lock_state) return statusLabel(normalized.lock_state);
  if (typeof normalized.temperature === "number") return `${Math.round(Number(normalized.temperature))}°C`;
  return statusLabel("", "Awaiting sync");
}

export function activitySummary(device: Record<string, any> | null | undefined, runtime?: Partial<DeviceRuntimeContract> | null, fallback = "No recent device activity.") {
  const contract = normalizeRuntimeContract(device, runtime);
  return contract.canonical_presentation?.summary || contract.presentation?.summary || contract.activity_summary || contract.last_signal || fallback;
}

export function activityTitle(device: Record<string, any> | null | undefined, runtime?: Partial<DeviceRuntimeContract> | null) {
  const name = text(device?.name, device?.device_name, "Device");
  const state = displayPrimaryState(device, runtime);
  return `${name} ${state.toLowerCase() === "awaiting sync" ? "updated" : state.toLowerCase()}`;
}
