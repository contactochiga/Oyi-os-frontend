"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import API from "@/services/api";
import useAuth from "@/hooks/useAuth";

type EstateContext = {
  id: string;
  name: string;
};

type HomeContext = {
  id: string;
  name?: string | null;
  block?: string | null;
  unit?: string | null;
  electricity_meter?: string | null;
  water_meter?: string | null;
  internet_id?: string | null;
  gate_code?: string | null;
};

export type AvailableHomeContext = {
  estate_id: string;
  estate_name?: string | null;
  home_id: string;
  home_name?: string | null;
  block?: string | null;
  unit?: string | null;
  electricity_meter?: string | null;
  water_meter?: string | null;
  internet_id?: string | null;
  gate_code?: string | null;
  is_active?: boolean;
};

export type ActiveContextState = {
  estate: EstateContext | null;
  home: HomeContext | null;
  estate_id: string | null;
  home_id: string | null;
  available_contexts: AvailableHomeContext[];
};

type ResolvedContext = {
  estate_id?: string | null;
  home_id?: string | null;
  estate?: EstateContext | null;
  home?: HomeContext | null;
  available_estates?: EstateContext[];
  available_homes?: Array<{ id: string; name?: string | null; block?: string | null; unit?: string | null; estate_id: string; electricity_meter?: string | null; water_meter?: string | null; internet_id?: string | null; gate_code?: string | null }>;
};

function contextHomeName(ctx: AvailableHomeContext) {
  return (
    String(ctx.home_name || "").trim() ||
    [ctx.block, ctx.unit].map((part) => String(part || "").trim()).filter(Boolean).join(" / ") ||
    "Home"
  );
}

function rememberContext(ctx: AvailableHomeContext) {
  if (typeof window === "undefined") return;
  if (ctx.estate_id) {
    window.localStorage.setItem("oyi_estate_id", String(ctx.estate_id));
    window.localStorage.setItem("estate_id", String(ctx.estate_id));
    window.localStorage.setItem("ochiga_estate", String(ctx.estate_id));
  }
  if (ctx.home_id) {
    window.localStorage.setItem("oyi_home_id", String(ctx.home_id));
    window.localStorage.setItem("home_id", String(ctx.home_id));
    window.localStorage.setItem("ochiga_home", String(ctx.home_id));
  }
}

function applyRememberedContext(state: ActiveContextState): ActiveContextState {
  if (typeof window === "undefined" || !state.available_contexts.length) return state;
  const rememberedHome = window.localStorage.getItem("oyi_home_id") || window.localStorage.getItem("home_id") || window.localStorage.getItem("ochiga_home");
  const rememberedEstate = window.localStorage.getItem("oyi_estate_id") || window.localStorage.getItem("estate_id") || window.localStorage.getItem("ochiga_estate");
  const selected = state.available_contexts.find((ctx) => {
    const homeMatch = rememberedHome ? String(ctx.home_id) === String(rememberedHome) : true;
    const estateMatch = rememberedEstate ? String(ctx.estate_id) === String(rememberedEstate) : true;
    return homeMatch && estateMatch;
  });
  if (!selected) return state;
  return {
    ...state,
    estate: selected.estate_id ? { id: String(selected.estate_id), name: selected.estate_name || state.estate?.name || "Estate" } : state.estate,
    home: selected.home_id
      ? {
          id: String(selected.home_id),
          name: contextHomeName(selected),
          block: selected.block || null,
          unit: selected.unit || null,
          electricity_meter: selected.electricity_meter || null,
          water_meter: selected.water_meter || null,
          internet_id: selected.internet_id || null,
          gate_code: selected.gate_code || null,
        }
      : state.home,
    estate_id: selected.estate_id || state.estate_id,
    home_id: selected.home_id || state.home_id,
    available_contexts: state.available_contexts.map((ctx) => ({
      ...ctx,
      is_active: String(ctx.home_id) === String(selected.home_id) && String(ctx.estate_id) === String(selected.estate_id),
    })),
  };
}

function readSwitchingFlag() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("oyi_context_switching") === "1";
}

function setSwitchingFlag(value: boolean) {
  if (typeof window === "undefined") return;
  if (value) window.localStorage.setItem("oyi_context_switching", "1");
  else window.localStorage.removeItem("oyi_context_switching");
  window.dispatchEvent(new CustomEvent(value ? "oyi:context-switch-start" : "oyi:context-switch-end"));
}

function emptyState(): ActiveContextState {
  return {
    estate: null,
    home: null,
    estate_id: null,
    home_id: null,
    available_contexts: [],
  };
}

export default function useActiveContext() {
  const { token, user } = useAuth();
  const [context, setContext] = useState<ActiveContextState>(emptyState);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [externalSwitching, setExternalSwitching] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) {
      setContext(emptyState());
      return;
    }

    setLoading(true);
    try {
      let resolved: ResolvedContext;
      try {
        const res = await API.get("/me/context/resolved", { params: { surface: "consumer" } });
        const payload = (res as any)?.data?.data ?? (res as any)?.data ?? {};
        resolved = (payload?.context || payload) as ResolvedContext;
      } catch (error: any) {
        // Preserve existing consumer behavior while older deployed backends roll forward.
        if (Number(error?.response?.status || 0) !== 404) throw error;
        const legacy = await API.get("/me/context");
        const payload = (legacy as any)?.data?.data ?? (legacy as any)?.data ?? {};
        resolved = {
          estate: payload?.estate ?? null,
          home: payload?.home ?? null,
          estate_id: payload?.estate_id ?? payload?.estate?.id ?? null,
          home_id: payload?.home_id ?? payload?.home?.id ?? null,
          available_homes: Array.isArray(payload?.available_contexts) ? payload.available_contexts.map((home: any) => ({ id: home.home_id, name: home.home_name, block: home.block, unit: home.unit, estate_id: home.estate_id, electricity_meter: home.electricity_meter, water_meter: home.water_meter, internet_id: home.internet_id, gate_code: home.gate_code })) : [],
          available_estates: [],
        };
      }
      const nextState = applyRememberedContext({
        estate: resolved?.estate ?? null,
        home: resolved?.home ?? null,
        estate_id: resolved?.estate_id ?? resolved?.estate?.id ?? null,
        home_id: resolved?.home_id ?? resolved?.home?.id ?? null,
        available_contexts: Array.isArray(resolved?.available_homes) ? resolved.available_homes.map((home) => ({
          estate_id: home.estate_id,
          estate_name: resolved.available_estates?.find((estate) => estate.id === home.estate_id)?.name || null,
          home_id: home.id,
          home_name: home.name || null,
          block: home.block || null,
          unit: home.unit || null,
          electricity_meter: home.electricity_meter || null,
          water_meter: home.water_meter || null,
          internet_id: home.internet_id || null,
          gate_code: home.gate_code || null,
          is_active: home.id === resolved.home_id,
        })) : [],
      });
      setContext(nextState);
    } catch {
      setContext(emptyState());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh, user?.estate_id, user?.home_id]);

  const selectContext = useCallback(
    async (next: AvailableHomeContext) => {
      if (!next?.home_id) return { ok: false, error: "home_id_missing" };
      setSelecting(true);
      setSwitchingFlag(true);
      rememberContext(next);
      setContext((previous) => ({
        ...previous,
        estate: next.estate_id ? { id: String(next.estate_id), name: next.estate_name || previous.estate?.name || "Estate" } : previous.estate,
        home: {
          id: String(next.home_id),
          name: contextHomeName(next),
          block: next.block || null,
          unit: next.unit || null,
          electricity_meter: next.electricity_meter || null,
          water_meter: next.water_meter || null,
          internet_id: next.internet_id || null,
          gate_code: next.gate_code || null,
        },
        estate_id: next.estate_id || previous.estate_id,
        home_id: next.home_id || previous.home_id,
        available_contexts: previous.available_contexts.map((ctx) => ({
          ...ctx,
          is_active: String(ctx.home_id) === String(next.home_id) && String(ctx.estate_id) === String(next.estate_id),
        })),
      }));

      try {
        await API.post("/me/context/select", { home_id: next.home_id });
        await refresh();
        if (typeof window !== "undefined") window.dispatchEvent(new Event("oyi:context-changed"));
        return { ok: true };
      } catch (err: any) {
        if (typeof window !== "undefined") window.dispatchEvent(new Event("oyi:context-changed"));
        return { ok: false, error: err?.response?.data?.error || err?.message || "context_select_failed" };
      } finally {
        setSelecting(false);
        setSwitchingFlag(false);
      }
    },
    [refresh],
  );

  useEffect(() => {
    const handler = () => {
      setExternalSwitching(readSwitchingFlag());
      void refresh();
    };
    const switchStart = () => setExternalSwitching(true);
    const switchEnd = () => setExternalSwitching(false);

    if (typeof window !== "undefined") {
      window.addEventListener("oyi:context-changed", handler);
      window.addEventListener("oyi:context-switch-start", switchStart);
      window.addEventListener("oyi:context-switch-end", switchEnd);
      window.addEventListener("focus", handler);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("oyi:context-changed", handler);
        window.removeEventListener("oyi:context-switch-start", switchStart);
        window.removeEventListener("oyi:context-switch-end", switchEnd);
        window.removeEventListener("focus", handler);
      }
    };
  }, [refresh]);

  const switching = selecting || externalSwitching;
  const contextKey = useMemo(() => `${context.estate_id || ""}:${context.home_id || ""}`, [context.estate_id, context.home_id]);
  const ready = Boolean(token && context.estate_id && context.home_id && !loading && !switching);

  return {
    ...context,
    loading,
    selecting,
    switching,
    ready,
    contextKey,
    refresh,
    selectContext,
  };
}
