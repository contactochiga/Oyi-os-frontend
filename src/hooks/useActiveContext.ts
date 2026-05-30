"use client";

import { useCallback, useEffect, useState } from "react";
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
  is_active?: boolean;
};

export type ActiveContextState = {
  estate: EstateContext | null;
  home: HomeContext | null;
  estate_id: string | null;
  home_id: string | null;
  available_contexts: AvailableHomeContext[];
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

  const refresh = useCallback(async () => {
    if (!token) {
      setContext(emptyState());
      return;
    }

    setLoading(true);
    try {
      const res = await API.get("/me/context");
      const payload = (res as any)?.data?.data ?? (res as any)?.data ?? {};
      const nextState = applyRememberedContext({
        estate: payload?.estate ?? null,
        home: payload?.home ?? null,
        estate_id: payload?.estate_id ?? payload?.estate?.id ?? null,
        home_id: payload?.home_id ?? payload?.home?.id ?? null,
        available_contexts: Array.isArray(payload?.available_contexts) ? payload.available_contexts : [],
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
      rememberContext(next);
      setContext((previous) => ({
        ...previous,
        estate: next.estate_id ? { id: String(next.estate_id), name: next.estate_name || previous.estate?.name || "Estate" } : previous.estate,
        home: {
          id: String(next.home_id),
          name: contextHomeName(next),
          block: next.block || null,
          unit: next.unit || null,
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
      }
    },
    [refresh],
  );

  useEffect(() => {
    const handler = () => {
      void refresh();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("oyi:context-changed", handler);
      window.addEventListener("focus", handler);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("oyi:context-changed", handler);
        window.removeEventListener("focus", handler);
      }
    };
  }, [refresh]);

  return {
    ...context,
    loading,
    refresh,
    selectContext,
  };
}
