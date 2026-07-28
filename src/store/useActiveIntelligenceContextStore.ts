"use client";

import { create } from "zustand";
import type { OperationalObject, OyiTarget, OyiSurface } from "@/services/oyiService";

export type ActiveIntelligenceContext = {
  context_id: string;
  context_version: number;
  registered_at: string;
  surface: OyiSurface;
  module: string;
  route: string;
  scope: {
    estate_id: string | null;
    building_id: string | null;
    home_id: string | null;
    unit_id: string | null;
    room_id: string | null;
  };
  primary_object: {
    object_type: string;
    canonical_id: string;
    label: string;
    privacy_class: string | null;
    source_module: string | null;
  } | null;
  selected_subobject: {
    object_type: string;
    canonical_id: string;
    label: string;
    parent_id: string | null;
    metadata: Record<string, unknown>;
  } | null;
  visible_state: {
    data_version: string | null;
    freshness: string | null;
    current_state: string | null;
    health: string | null;
    summary: Record<string, unknown>;
  } | null;
  source: "page" | "drawer" | "modal" | "selected_card" | "detail_panel" | "map" | "digital_twin" | "route_fallback";
  permissions: string[];
  ownership: Record<string, unknown> | null;
};

type ContextInput = Omit<ActiveIntelligenceContext, "context_id" | "context_version" | "registered_at"> & {
  context_id?: string;
};

type ActiveIntelligenceContextState = {
  stack: ActiveIntelligenceContext[];
  contextVersion: number;
  registerContext: (context: ContextInput) => ActiveIntelligenceContext;
  replaceContext: (context: ContextInput) => ActiveIntelligenceContext;
  pushContext: (context: ContextInput) => ActiveIntelligenceContext;
  updateContext: (contextId: string, patch: Partial<ContextInput>) => void;
  popContext: (contextId?: string) => void;
  clearContext: () => void;
  getActiveContext: () => ActiveIntelligenceContext | null;
};

export const ACTIVE_INTELLIGENCE_CONTEXT_SESSION_KEY = "oyi.active_intelligence_context";

function makeId(context: ContextInput) {
  const object = context.selected_subobject || context.primary_object;
  const raw = [context.surface, context.module, context.source, object?.object_type, object?.canonical_id, object?.label].filter(Boolean).join(":");
  return `ctx_${raw.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 96) || Math.random().toString(36).slice(2)}`;
}

function materialize(context: ContextInput, version: number): ActiveIntelligenceContext {
  return {
    ...context,
    context_id: context.context_id || makeId(context),
    context_version: version,
    registered_at: new Date().toISOString(),
    permissions: context.permissions || [],
    ownership: context.ownership || null,
  };
}

export const useActiveIntelligenceContextStore = create<ActiveIntelligenceContextState>((set, get) => ({
  stack: [],
  contextVersion: 0,
  registerContext: (context) => {
    const version = get().contextVersion + 1;
    const next = materialize(context, version);
    set({ contextVersion: version, stack: [next] });
    persistActiveIntelligenceContext(next);
    return next;
  },
  replaceContext: (context) => {
    const version = get().contextVersion + 1;
    const next = materialize(context, version);
    set((state) => ({ contextVersion: version, stack: [...state.stack.slice(0, -1), next] }));
    persistActiveIntelligenceContext(next);
    return next;
  },
  pushContext: (context) => {
    const version = get().contextVersion + 1;
    const next = materialize(context, version);
    set((state) => {
      const withoutDuplicate = state.stack.filter((item) => item.context_id !== next.context_id);
      return { contextVersion: version, stack: [...withoutDuplicate, next] };
    });
    persistActiveIntelligenceContext(next);
    return next;
  },
  updateContext: (contextId, patch) => {
    const version = get().contextVersion + 1;
    set((state) => {
      const stack = state.stack.map((item) => item.context_id === contextId ? { ...item, ...patch, context_version: version, registered_at: new Date().toISOString() } : item);
      const active = stack[stack.length - 1] || null;
      if (active) persistActiveIntelligenceContext(active);
      return { contextVersion: version, stack };
    });
  },
  popContext: (contextId) => {
    set((state) => {
      const stack = contextId ? state.stack.filter((item) => item.context_id !== contextId) : state.stack.slice(0, -1);
      const active = stack[stack.length - 1] || null;
      if (active) persistActiveIntelligenceContext(active);
      else clearPersistedActiveIntelligenceContext();
      return { stack };
    });
  },
  clearContext: () => {
    clearPersistedActiveIntelligenceContext();
    set({ stack: [] });
  },
  getActiveContext: () => {
    const stack = get().stack;
    return stack[stack.length - 1] || null;
  },
}));

export function persistActiveIntelligenceContext(context: ActiveIntelligenceContext | null) {
  if (typeof window === "undefined") return;
  if (!context) {
    window.sessionStorage.removeItem(ACTIVE_INTELLIGENCE_CONTEXT_SESSION_KEY);
    return;
  }
  window.sessionStorage.setItem(ACTIVE_INTELLIGENCE_CONTEXT_SESSION_KEY, JSON.stringify(context));
}

export function clearPersistedActiveIntelligenceContext() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(ACTIVE_INTELLIGENCE_CONTEXT_SESSION_KEY);
}

export function readPersistedActiveIntelligenceContext(): ActiveIntelligenceContext | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(ACTIVE_INTELLIGENCE_CONTEXT_SESSION_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed as ActiveIntelligenceContext : null;
  } catch {
    return null;
  }
}

export function operationalObjectFromActiveContext(context: ActiveIntelligenceContext | null): Partial<OperationalObject> | null {
  const object = context?.selected_subobject || context?.primary_object;
  if (!context || !object?.object_type || !object?.canonical_id) return null;
  return {
    object_type: object.object_type as OperationalObject["object_type"],
    canonical_id: object.canonical_id,
    label: object.label,
    estate_id: context.scope.estate_id,
    building_id: context.scope.building_id,
    home_id: context.scope.home_id,
    room_id: context.scope.room_id,
    parent_id: "parent_id" in object ? object.parent_id || null : context.primary_object?.canonical_id || null,
    source_module: context.primary_object?.source_module || context.module,
    current_state: context.visible_state?.current_state || null,
    health: context.visible_state?.health || null,
    permissions: context.permissions,
    relationships: {},
    evidence_references: [],
    metadata: {
      active_context: {
        context_id: context.context_id,
        context_version: context.context_version,
        source: context.source,
      },
      selected_subobject: context.selected_subobject || null,
      visible_state: context.visible_state || null,
    },
    freshness: context.visible_state?.freshness || null,
  };
}

export function targetFromActiveContext(context: ActiveIntelligenceContext | null): OyiTarget | null {
  const object = context?.selected_subobject || context?.primary_object;
  if (!object?.object_type || !object?.canonical_id) return null;
  const targetTypeMap: Record<string, OyiTarget["target_type"]> = {
    device: "device",
    device_channel: "device",
    room: "none",
    scene: "workflow",
    automation: "workflow",
    maintenance_request: "maintenance",
    transaction: "wallet",
    visitor: "visitor",
    service_account: "service",
    community_post: "community",
    infrastructure_asset: "infrastructure",
    camera: "camera",
    meter: "infrastructure",
    operational_incident: "incident",
    twin_node: "infrastructure",
  };
  return {
    target_type: targetTypeMap[object.object_type] || "none",
    target_id: object.canonical_id,
    open_as: "page",
    action: "inspect",
  };
}
