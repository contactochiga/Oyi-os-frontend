import type { OyiAwareness } from "@/services/oyiService";
import { activitySummary as runtimeActivitySummary, displayPrimaryState, healthLabel, originLabel } from "@/lib/deviceRuntimeContract";

export type ConsumerAwarenessItem = {
  id: string;
  title: string;
  summary: string;
  actionLabel: string;
  destination: string;
  urgency: "critical" | "warning" | "normal";
  icon: "device" | "visitor" | "service" | "wallet" | "maintenance" | "community" | "security" | "automation" | "activity";
  priority: number;
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

function sentence(value: string, fallback: string) {
  const next = value.trim();
  if (!next) return fallback;
  const clean = next.endsWith(".") ? next : `${next}.`;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function titleize(value: string, fallback: string) {
  const normalized = value.replace(/[_-]+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized
    .split(/\s+/)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function providerLabel(value: any) {
  const raw = text(value).toLowerCase();
  if (!raw) return "connected device provider";
  if (raw === "tuya") return "connected device provider";
  return raw.replace(/_/g, " ");
}

function truthItem(raw: Record<string, any>): ConsumerAwarenessItem | null {
  const truth = record(raw.truth);
  if (!Object.keys(truth).length) return null;
  const operationalObject = record(truth.object || raw.operational_object);
  const title = cleanRuntimeText(text(truth.title, raw.title), "Home status available");
  const summary = cleanRuntimeText(text(truth.body, raw.summary, raw.description), "No important activity needs your attention.");
  const truthState = text(truth.truth_state).toLowerCase();
  const severity = text(truth.severity).toLowerCase();
  const icon = iconFor(text(operationalObject.object_type, raw.type), title, summary);
  const urgency: ConsumerAwarenessItem["urgency"] =
    /critical/.test(severity) ? "critical" : /warning|attention|pending|unavailable|unsupported|permission/.test(`${severity} ${truthState}`) ? "warning" : "normal";
  const entityId = text(operationalObject.canonical_id);
  return {
    id: text(raw.id, truth.source_event, title),
    title,
    summary: sentence(summary, "No important activity needs your attention."),
    actionLabel: actionLabelFor(icon, text(operationalObject.object_type, raw.type), urgency),
    destination: icon === "device" && entityId
      ? `/devices?deviceId=${encodeURIComponent(entityId)}`
      : icon === "visitor" && entityId
        ? `/visitors?visitorId=${encodeURIComponent(entityId)}`
        : (icon === "service" || icon === "wallet") && entityId
          ? `/services?serviceId=${encodeURIComponent(entityId)}`
          : "/activity",
    urgency,
    icon,
    priority: priorityFor(icon, urgency, text(operationalObject.object_type, raw.type)),
  };
}

export function runtimeSourceLabel(value: any) {
  return originLabel(value, "System activity").toLowerCase();
}

export function cleanRuntimeText(value: any, fallback = "Home activity") {
  const raw = text(value);
  if (!raw) return fallback;
  const normalized = raw
    .replace(/consumer_app/gi, "from your phone")
    .replace(/facility_app/gi, "from facility")
    .replace(/physical_switch/gi, "manual switch action")
    .replace(/\btelemetry\b/gi, "device update")
    .replace(/\bprovider_reported\b/gi, "provider sync")
    .replace(/\bprovider_app\b/gi, "provider sync")
    .replace(/\btuya\b/gi, "connected device provider")
    .replace(/\bfailed\b/gi, "did not respond")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : fallback;
}

function urgencyFrom(value: any): ConsumerAwarenessItem["urgency"] {
  const textValue = text(value).toLowerCase();
  if (/critical|high|security|alarm|emergency/.test(textValue)) return "critical";
  if (/warning|attention|failed|offline|issue|pending|review|degraded/.test(textValue)) return "warning";
  return "normal";
}

function priorityFor(icon: ConsumerAwarenessItem["icon"], urgency: ConsumerAwarenessItem["urgency"], eventType = "") {
  if (urgency === "critical" || icon === "security") return 100;
  if (/command\.failed/.test(eventType)) return 90;
  if (icon === "visitor") return 80;
  if (icon === "service" || icon === "wallet") return 70;
  if (icon === "maintenance") return 60;
  if (/physical_switch|device\.power/.test(eventType)) return 50;
  if (icon === "automation") return 40;
  if (/provider\.sync|telemetry/.test(eventType)) return 10;
  return 30;
}

function iconFor(eventType: string, title = "", summary = ""): ConsumerAwarenessItem["icon"] {
  const haystack = `${eventType} ${title} ${summary}`.toLowerCase();
  if (/security|incident|alarm|lock|door/.test(haystack)) return "security";
  if (/visitor|guest|gate|access/.test(haystack)) return "visitor";
  if (/service|vending|electricity|water|gas|internet|generator|solar|billing/.test(haystack)) return "service";
  if (/wallet|payment|transaction|settlement/.test(haystack)) return "wallet";
  if (/maintenance|repair|ticket/.test(haystack)) return "maintenance";
  if (/community|announcement|comment|post/.test(haystack)) return "community";
  if (/scene|automation/.test(haystack)) return "automation";
  if (/device|switch|light|climate|sensor|camera|plug/.test(haystack)) return "device";
  return "activity";
}

function destinationFor(eventType: string, raw: Record<string, any>, icon: ConsumerAwarenessItem["icon"]) {
  const metadata = record(raw.metadata);
  const entity = record(raw.entity);
  const entityId = text(entity.id, metadata.device_id, metadata.visitor_id, metadata.service_id);
  if (icon === "visitor") return entityId ? `/visitors?visitorId=${encodeURIComponent(entityId)}` : "/visitors";
  if (icon === "service" || icon === "wallet") return entityId ? `/services?serviceId=${encodeURIComponent(entityId)}` : "/services";
  if (icon === "maintenance") return "/maintenance";
  if (icon === "community") return "/community";
  if (icon === "security") return "/security";
  if (icon === "device") return entityId ? `/devices?deviceId=${encodeURIComponent(entityId)}` : "/devices";
  if (/activity|timeline|execution/.test(eventType)) return "/activity";
  return "/activity";
}

function actionLabelFor(icon: ConsumerAwarenessItem["icon"], eventType: string, urgency: ConsumerAwarenessItem["urgency"]) {
  if (icon === "visitor") return "View visitor";
  if (icon === "service" || icon === "wallet") return "Open services";
  if (icon === "maintenance") return "Open maintenance";
  if (icon === "community") return "Open community";
  if (icon === "security") return "Review security";
  if (icon === "device" && /failed/.test(eventType)) return "Check device";
  if (icon === "device") return urgency === "warning" ? "Check device" : "View activity";
  if (icon === "automation") return "View activity";
  return "View activity";
}

function deviceName(raw: Record<string, any>) {
  const entity = record(raw.entity);
  const metadata = record(raw.metadata);
  return text(entity.name, metadata.device_name, metadata.name, "Device");
}

export function awarenessFromRuntimeSignal(rawSignal: Record<string, any> | null | undefined): ConsumerAwarenessItem | null {
  const raw = record(rawSignal);
  if (!Object.keys(raw).length) return null;
  const canonicalTruth = truthItem(raw);
  if (canonicalTruth) return canonicalTruth;
  const metadata = record(raw.metadata);
  const context = record(raw.context);
  const entity = record(raw.entity);
  const eventType = text(context.event_type, metadata.event_type, raw.type, entity.status).toLowerCase();
  const provider = providerLabel(metadata.provider || raw.provider);
  const observedSource = text(metadata.observed_source, context.command_source, raw.origin).toLowerCase();
  const name = deviceName(raw);
  const stateSummary = runtimeActivitySummary({
    name,
    activity_summary: metadata.activity_summary || raw.activity_summary,
    last_signal: metadata.last_signal || raw.last_signal,
  }, {
    state: metadata.new_state || context.new_state || {},
    normalized_state: metadata.normalized_state || {},
    primary_state: metadata.primary_state || context.primary_state,
    health_status: metadata.health_status || context.health_status,
    activity_summary: metadata.activity_summary || raw.summary,
    last_signal: metadata.last_signal,
  }, "");
  const primaryState = displayPrimaryState(
    { name },
    {
      state: metadata.new_state || context.new_state || {},
      normalized_state: metadata.normalized_state || {},
      primary_state: metadata.primary_state || context.primary_state,
    },
  );
  const health = healthLabel(metadata.health_status || context.health_status || raw.severity, "");

  let title = "";
  let summary = "";

  if (eventType === "device.command.failed") {
    title = `${name} did not respond`;
    summary = "The command was sent from your phone, but the provider did not confirm it.";
  } else if ((eventType === "device.power.on" || eventType === "device.power.off") && observedSource.includes("physical")) {
    title = `${name} ${eventType.endsWith("on") ? "turned on" : "turned off"}`;
    summary = "This looks like a manual wall switch action.";
  } else if (eventType === "device.physical_switch.detected") {
    title = `${name} changed state`;
    summary = "This looks like a manual wall switch action.";
  } else if (eventType === "device.command.executed") {
    title = `${name} responded`;
    summary = `The command completed ${runtimeSourceLabel(observedSource)}.`;
  } else if (eventType === "device.offline") {
    title = `${name} is offline`;
    summary = `Oyi has not heard from this device recently through the ${provider}.`;
  } else if (eventType === "device.online") {
    title = `${name} is back online`;
    summary = "The device has resumed reporting normally.";
  } else if (eventType === "device.provider.sync") {
    title = `${name} updated`;
    summary = stateSummary || `The ${provider} reported a new device update.`;
  } else if (eventType === "device.telemetry.received") {
    title = `${name} updated`;
    summary = stateSummary || "Oyi received a fresh device update.";
  } else if (eventType === "device.health.degraded") {
    title = `${name} needs attention`;
    summary = health ? `${name} health is now ${health.toLowerCase()}.` : "A connected device reported a health issue.";
  } else if (eventType === "visitor.access.used") {
    title = "Visitor access used";
    summary = "A visitor code was used at the gate.";
  } else if (eventType === "service.vending.ready") {
    title = "Electricity service ready";
    summary = "This home can now request electricity tokens when provider integration is active.";
  } else if (eventType === "service.transaction.failed") {
    title = "Service payment needs attention";
    summary = "A recent service transaction could not complete.";
  } else if (eventType === "service.issue.reported") {
    title = "Service issue reported";
    summary = "One of your home services requires attention.";
  } else if (/scene|automation/.test(eventType)) {
    title = `${titleize(text(entity.name, metadata.scene_name, "Automation"), "Automation")} ran successfully`;
    summary = "Your automation completed normally.";
  } else if (/maintenance/.test(eventType)) {
    title = "Maintenance update available";
    summary = cleanRuntimeText(text(raw.summary, metadata.summary), "A maintenance update is available.");
  } else if (/wallet|payment/.test(eventType)) {
    title = "Wallet update available";
    summary = cleanRuntimeText(text(raw.summary, metadata.summary), "A wallet update is available.");
  }

  if (!title) {
    if (eventType.startsWith("device.") && primaryState && primaryState !== "Awaiting sync") {
      title = `${name} ${primaryState.toLowerCase()}`;
    }
    const fallbackTitle = cleanRuntimeText(text(raw.title, raw.headline, metadata.title, eventType), "Home activity");
    const fallbackSummary = cleanRuntimeText(
      text(stateSummary, raw.summary, raw.description, metadata.summary, metadata.reason, context.reason),
      "Oyi observed new home activity.",
    );
    title = title || fallbackTitle;
    summary = summary || fallbackSummary;
  }

  const icon = iconFor(eventType, title, summary);
  const urgency = urgencyFrom(text(raw.severity, metadata.severity, raw.status, eventType));
  return {
    id: text(raw.id, eventType, title),
    title,
    summary: sentence(summary, "Oyi observed new home activity."),
    actionLabel: actionLabelFor(icon, eventType, urgency),
    destination: destinationFor(eventType, raw, icon),
    urgency,
    icon,
    priority: priorityFor(icon, urgency, eventType),
  };
}

export function awarenessFromBackend(awareness: OyiAwareness | null | undefined): ConsumerAwarenessItem | null {
  if (!awareness?.headline) return null;
  const title = cleanRuntimeText(awareness.headline, "Home status available");
  const summary = cleanRuntimeText(
    awareness.summary || awareness.body || awareness.recommended_action || "",
    "No important activity needs your attention.",
  );
  const icon = iconFor("", title, summary);
  const urgency = urgencyFrom(awareness.severity);
  return {
    id: `backend-awareness:${title}`,
    title,
    summary: sentence(summary, "No important activity needs your attention."),
    actionLabel: awareness.recommended_action ? "Open details" : "View activity",
    destination: awareness.destination || "/activity",
    urgency,
    icon,
    priority: priorityFor(icon, urgency, title.toLowerCase()),
  };
}

export function dedupeAwareness(items: Array<ConsumerAwarenessItem | null | undefined>) {
  const seen = new Set<string>();
  return items
    .filter(Boolean)
    .filter((item): item is ConsumerAwarenessItem => Boolean(item))
    .sort((a, b) => b.priority - a.priority)
    .filter((item) => {
      const key = `${item.title.toLowerCase()}::${item.destination}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
