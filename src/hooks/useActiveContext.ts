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
      setContext({
        estate: payload?.estate ?? null,
        home: payload?.home ?? null,
        estate_id: payload?.estate_id ?? payload?.estate?.id ?? null,
        home_id: payload?.home_id ?? payload?.home?.id ?? null,
        available_contexts: Array.isArray(payload?.available_contexts) ? payload.available_contexts : [],
      });
    } catch {
      setContext(emptyState());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh, user?.estate_id, user?.home_id]);

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
  };
}
