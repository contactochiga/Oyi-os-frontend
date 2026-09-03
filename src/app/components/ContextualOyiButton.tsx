"use client";

import Link from "next/link";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import useActiveContext from "@/hooks/useActiveContext";
import {
  persistActiveIntelligenceContext,
  type ActiveIntelligenceContext,
  useActiveIntelligenceContextStore,
} from "@/store/useActiveIntelligenceContextStore";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function moduleFromPath(pathname: string) {
  const first = pathname.replace(/^\//, "").split("/")[0] || "home";
  if (first === "devices") return "device";
  if (first === "room" || first === "rooms") return "room";
  if (first === "scenes") return "scenes";
  if (first === "maintenance") return "maintenance";
  if (first === "wallet") return "wallet";
  if (first === "visitors") return "visitors";
  if (first === "services") return "services";
  if (first === "community") return "community";
  if (first === "security") return "security";
  return first;
}

function targetFor(module: string, search: URLSearchParams) {
  const map: Array<[string, string, string]> = [
    ["channel", "device_channel", "channel"],
    ["deviceId", "device", "deviceId"],
    ["roomId", "room", "roomId"],
    ["sceneId", "scene", "sceneId"],
    ["automationId", "automation", "automationId"],
    ["requestId", "maintenance_request", "ticketId"],
    ["ticketId", "maintenance_request", "ticketId"],
    ["transactionId", "transaction", "transactionId"],
    ["receipt", "transaction", "transactionId"],
    ["visitorId", "visitor", "visitorId"],
    ["serviceId", "service_account", "serviceId"],
    ["postId", "community_post", "postId"],
  ];
  for (const [param, type, outbound] of map) {
    const value = text(search.get(param));
    if (value) return { type, id: value, param: outbound };
  }
  if (module === "wallet") return { type: "wallet", id: "", param: "targetType" };
  if (module === "maintenance") return { type: "maintenance_request", id: "", param: "targetType" };
  if (module === "visitors") return { type: "visitor", id: "", param: "targetType" };
  if (module === "scenes") return { type: "scene", id: "", param: "targetType" };
  return { type: module || "home", id: "", param: "targetType" };
}

function starters(module: string) {
  if (module === "device") return ["Is this device working?", "Why is it unavailable?", "What changed recently?", "Is it used by a scene or automation?"];
  if (module === "scenes") return ["What will this do?", "Which devices will change?", "Why did the last run fail?"];
  if (module === "maintenance") return ["What happened?", "Who owns this?", "Is it overdue?"];
  if (module === "wallet") return ["Explain this transaction.", "Why did it fail?", "Show the receipt."];
  if (module === "visitors") return ["Can this person still enter?", "What is the current access state?"];
  if (module === "services") return ["Is this service active?", "What is the support path?"];
  if (module === "community") return ["What needs attention here?", "Summarize this update."];
  return ["What needs attention?", "What changed recently?", "What should I do next?"];
}

function fallbackActiveContext(module: string, pathname: string, search: URLSearchParams, activeContext: ReturnType<typeof useActiveContext>): ActiveIntelligenceContext {
  const routeTarget = targetFor(module, search);
  const deviceId = text(search.get("deviceId"));
  const channel = text(search.get("channel"));
  const canonicalId = routeTarget.type === "device_channel" && deviceId && channel ? `${deviceId}:${channel}` : routeTarget.id || `${module}:scope`;
  // IDs remain in the canonical context payload but must never become resident copy.
  const label = text(search.get("deviceName")) || text(search.get("roomName")) || activeContext.home?.name || "current context";
  return {
    context_id: `ctx_route_${module}_${canonicalId}`.replace(/[^a-zA-Z0-9_-]+/g, "_"),
    context_version: 0,
    registered_at: new Date().toISOString(),
    surface: "consumer",
    module,
    route: pathname,
    scope: {
      estate_id: activeContext.estate_id || null,
      building_id: null,
      home_id: activeContext.home_id || null,
      unit_id: null,
      room_id: text(search.get("roomId")) || null,
    },
    primary_object: routeTarget.type === "device_channel" && deviceId ? {
      object_type: "device",
      canonical_id: deviceId,
      label: text(search.get("deviceName")) || "Device",
      privacy_class: "home_private",
      source_module: "devices",
    } : routeTarget.id ? {
      object_type: routeTarget.type,
      canonical_id: canonicalId,
      label,
      privacy_class: "home_private",
      source_module: module,
    } : null,
    selected_subobject: routeTarget.type === "device_channel" && deviceId && channel ? {
      object_type: "device_channel",
      canonical_id: `${deviceId}:${channel}`,
      label: `${text(search.get("deviceName")) || "Device"} · ${channel}`,
      parent_id: deviceId,
      metadata: { channel_code: channel },
    } : null,
    visible_state: null,
    source: "route_fallback",
    permissions: [],
    ownership: null,
  };
}

function starterForContext(module: string, context: ActiveIntelligenceContext) {
  const objectType = context.selected_subobject?.object_type || context.primary_object?.object_type;
  if (objectType === "device_channel") return ["Is this channel on?", "What controls this channel?", "What changed on this channel?"];
  if (objectType === "device") return starters("device");
  if (objectType === "automation") return ["Why didn’t this run?", "What happens next?", "Show the last run."];
  if (objectType === "scene") return starters("scenes");
  return starters(module);
}

function ContextualOyiButtonInner({ label, contextOverride }: { label?: string; contextOverride?: ActiveIntelligenceContext | null }) {
  const pathname = usePathname() || "/home";
  const search = useSearchParams();
  const activeContext = useActiveContext();
  const registeredContext = useActiveIntelligenceContextStore((state) => state.stack[state.stack.length - 1] || null);
  const activeModule = moduleFromPath(pathname);
  const intelligenceContext = contextOverride || registeredContext || fallbackActiveContext(activeModule, pathname, search, activeContext);
  const object = intelligenceContext.selected_subobject || intelligenceContext.primary_object;
  const params = new URLSearchParams();
  params.set("module", intelligenceContext.module || activeModule);
  params.set("contextRef", intelligenceContext.context_id);
  params.set("contextVersion", String(intelligenceContext.context_version));
  if (object?.object_type) params.set("targetType", object.object_type);
  if (object?.canonical_id) params.set("targetId", object.canonical_id);
  if (intelligenceContext.primary_object?.object_type === "device") params.set("deviceId", intelligenceContext.primary_object.canonical_id);
  if (intelligenceContext.selected_subobject?.metadata?.channel_code) params.set("channel", String(intelligenceContext.selected_subobject.metadata.channel_code));
  if (intelligenceContext.scope.home_id) params.set("homeId", intelligenceContext.scope.home_id);
  if (intelligenceContext.scope.estate_id) params.set("estateId", intelligenceContext.scope.estate_id);
  params.set("starter", starterForContext(activeModule, intelligenceContext)[0]);
  const targetLabel = object?.label || activeContext.home?.name || "current context";
  return (
    <Link
      href={`/ai?${params.toString()}`}
      onClick={() => persistActiveIntelligenceContext(intelligenceContext)}
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-300/[0.08] px-3 py-2 text-xs font-semibold text-cyan-50/90 shadow-[0_0_24px_rgba(80,220,255,0.08)] transition active:scale-[0.98]"
      aria-label={`Ask Oyi about ${targetLabel}`}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-cyan-100/80" />
      <span className="truncate">{label || "Ask Oyi"}</span>
    </Link>
  );
}

export default function ContextualOyiButton({ label, contextOverride }: { label?: string; contextOverride?: ActiveIntelligenceContext | null }) {
  return (
    <Suspense fallback={<span className="inline-flex h-9 w-24 rounded-full border border-cyan-200/10 bg-cyan-300/[0.05]" aria-hidden="true" />}>
      <ContextualOyiButtonInner label={label} contextOverride={contextOverride} />
    </Suspense>
  );
}
