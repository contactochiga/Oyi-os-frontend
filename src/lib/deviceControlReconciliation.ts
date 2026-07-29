import { normalizeRuntimeContract, type DeviceRuntimeContract } from "@/lib/deviceRuntimeContract";

type RuntimePatchInput = {
  state?: Record<string, any> | null;
  runtime?: Partial<DeviceRuntimeContract> | null;
  commandCode?: string | null;
  confirmedValue?: boolean | null;
  observedAt?: string | null;
};

function isSwitchChannel(code: string) {
  return code === "switch" || /^switch_\d+$/i.test(code);
}

function booleanSwitchEntries(patch: Record<string, any>) {
  return Object.entries(patch).filter(([key, value]) => isSwitchChannel(key) && typeof value === "boolean") as Array<[string, boolean]>;
}

export function mergeDeviceRuntimePatch(input: RuntimePatchInput) {
  const baseState = { ...(input.state || {}) };
  const baseRuntime = normalizeRuntimeContract(null, input.runtime || { state: baseState });
  const runtimeState = { ...(baseRuntime.state || {}) };
  const normalized = {
    ...((baseRuntime.normalized_state || {}) as Record<string, any>),
  };
  const switches = {
    ...(((baseRuntime.normalized_state as any)?.switches || {}) as Record<string, any>),
  };
  const observedAt = input.observedAt || new Date().toISOString();

  if (input.commandCode && typeof input.confirmedValue === "boolean") {
    baseState[input.commandCode] = input.confirmedValue;
  }

  for (const [key, value] of booleanSwitchEntries(baseState)) {
    runtimeState[key] = value;
    switches[key] = value;
  }

  if (Object.keys(switches).length) {
    normalized.switches = switches;
    const switchValues = Object.values(switches).filter((value) => typeof value === "boolean") as boolean[];
    if (switchValues.length) normalized.power = switchValues.includes(true);
  }

  const channelDefinitions = Array.isArray(baseRuntime.channel_definitions)
    ? baseRuntime.channel_definitions.map((channel) => {
      const code = String(channel?.code || "");
      return Object.prototype.hasOwnProperty.call(switches, code)
        ? { ...channel, state: switches[code] === true, last_update: observedAt }
        : channel;
    })
    : [];

  const primaryState = typeof normalized.power === "boolean"
    ? (normalized.power ? "on" : "off")
    : baseRuntime.primary_state || null;
  const primaryLabel = primaryState === "on" ? "On" : primaryState === "off" ? "Off" : baseRuntime.canonical_state?.primaryState?.label || "State unknown";
  const canonicalState = baseRuntime.canonical_state
    ? {
      ...baseRuntime.canonical_state,
      lastSeenAt: observedAt,
      lastProviderSyncAt: observedAt,
      primaryState: {
        ...(baseRuntime.canonical_state.primaryState || { key: "power" }),
        key: typeof normalized.power === "boolean" ? "power" : baseRuntime.canonical_state.primaryState?.key || "primary_state",
        value: typeof normalized.power === "boolean" ? normalized.power : baseRuntime.canonical_state.primaryState?.value ?? null,
        label: primaryLabel,
      },
    }
    : null;
  const canonicalPresentation = baseRuntime.canonical_presentation
    ? {
      ...baseRuntime.canonical_presentation,
      lastSeenAt: observedAt,
      lastCheckedAt: observedAt,
      lastConfirmedStateAt: observedAt,
      primaryState: {
        ...baseRuntime.canonical_presentation.primaryState,
        key: typeof normalized.power === "boolean" ? "power" : baseRuntime.canonical_presentation.primaryState?.key || "primary_state",
        value: typeof normalized.power === "boolean" ? normalized.power : baseRuntime.canonical_presentation.primaryState?.value ?? null,
        label: primaryLabel,
      },
      summary: primaryLabel,
    }
    : null;

  const nextRuntime = normalizeRuntimeContract(null, {
    ...baseRuntime,
    state: { ...runtimeState, ...baseState },
    normalized_state: normalized,
    channel_definitions: channelDefinitions,
    canonical_state: canonicalState || undefined,
    canonicalState: canonicalState || undefined,
    canonical_presentation: canonicalPresentation || undefined,
    presentation: canonicalPresentation || undefined,
    telemetry_summary: {
      ...((baseRuntime.telemetry_summary || {}) as Record<string, any>),
      ...(typeof normalized.power === "boolean" ? { power_state: primaryState } : {}),
    },
    primary_state: primaryState,
    state_confirmed_at: observedAt,
    state_updated_at: observedAt,
    runtime_timestamp: observedAt,
  } as Partial<DeviceRuntimeContract>);

  return {
    state: {
      ...baseState,
      normalized_state: normalized,
      _oyi_runtime: {
        ...((baseState._oyi_runtime || {}) as Record<string, any>),
        state_confirmed_at: observedAt,
        runtime_timestamp: observedAt,
      },
    },
    runtime: nextRuntime,
  };
}

export function readConfirmedSwitchChannel(
  channelCode: string,
  state?: Record<string, any> | null,
  runtime?: Partial<DeviceRuntimeContract> | null,
) {
  const stateNormalized = state?.normalized_state && typeof state.normalized_state === "object" ? state.normalized_state as Record<string, any> : {};
  const stateSwitches = stateNormalized.switches && typeof stateNormalized.switches === "object" ? stateNormalized.switches as Record<string, any> : {};
  const direct = state?.[channelCode] ?? stateSwitches[channelCode];
  if (typeof direct === "boolean") return direct;

  const contract = normalizeRuntimeContract(null, runtime || null);
  const runtimeSwitches = contract.normalized_state?.switches && typeof contract.normalized_state.switches === "object" ? contract.normalized_state.switches as Record<string, any> : {};
  const runtimeValue = runtimeSwitches[channelCode] ?? contract.state?.[channelCode];
  if (typeof runtimeValue === "boolean") return runtimeValue;

  const channel = Array.isArray(contract.channel_definitions)
    ? contract.channel_definitions.find((item) => String(item?.code || "") === channelCode)
    : null;
  return typeof channel?.state === "boolean" ? channel.state : null;
}
