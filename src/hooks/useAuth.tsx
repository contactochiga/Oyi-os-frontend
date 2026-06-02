"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCookie } from "@/lib/auth";
import { useSessionStore, type SessionUser } from "@/store/useSessionStore";
import API, { setApiAuthToken } from "@/services/api";
import { syncOyiWatchSession } from "@/services/watchSyncService";
import { clearOnboardingTourTemporaryState } from "@/services/onboardingTour";

type AuthContextType = {
  user: SessionUser | null;
  token: string | null;
  setSession: (token: string, user?: SessionUser | null) => void;
  logout: () => void;
  ready: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function pickUserFromContext(payload: any) {
  return (
    payload?.user ||
    payload?.profile ||
    payload?.me ||
    payload?.resident ||
    payload?.account ||
    null
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, user, setSession, hydrate, clear } = useSessionStore();
  const [ready, setReady] = useState(false);

  // hydrate once
  useEffect(() => {
    (async () => {
      try {
        await hydrate();
      } finally {
        setReady(true);
      }
    })();
  }, [hydrate]);

  // ✅ ALWAYS attach auth header in one place
  useEffect(() => {
    setApiAuthToken(token);
  }, [token]);

  useEffect(() => {
    if (!token || !user) return;
    void syncOyiWatchSession(token, user).catch(() => {
      // Watch sync is opportunistic; login/session restore must never fail because a watch is absent.
    });
  }, [token, user]);

  // ✅ refresh context on boot (fix iOS “no estate linked / no home selected”)
  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await API.get("/me/context");
        const payload = (res as any)?.data?.data ?? (res as any)?.data ?? null;
        if (cancelled || !payload) return;

        const estate = payload?.estate ?? null;
        const home = payload?.home ?? null;

        const u = pickUserFromContext(payload);

        const mergedUser = {
          ...(user || {}),
          ...(u || {}),
          id: (u as any)?.id ?? user?.id,
          email: (u as any)?.email ?? user?.email,
          full_name: (u as any)?.full_name ?? (user as any)?.full_name,
          username: (u as any)?.username ?? (user as any)?.username,
          phone: (u as any)?.phone ?? (user as any)?.phone,
          avatar_url: (u as any)?.avatar_url ?? (user as any)?.avatar_url,
          profile_image_url: (u as any)?.profile_image_url ?? (user as any)?.profile_image_url,
          estate_id: (u as any)?.estate_id ?? estate?.id ?? payload?.estate_id ?? user?.estate_id,
          home_id: (u as any)?.home_id ?? home?.id ?? payload?.home_id ?? user?.home_id,
          onboarding_complete: payload?.onboarding_complete === true || (u as any)?.onboarding_complete === true,
        };

        setSession(token, mergedUser as any);

        // keep legacy keys too
        if (typeof window !== "undefined") {
          if (estate?.id) localStorage.setItem("ochiga_estate", String(estate.id));
          if (home?.id) localStorage.setItem("ochiga_home", String(home.id));
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function logout() {
    deleteCookie("oyi_consumer_token");
    setApiAuthToken(null);
    clear();
    clearOnboardingTourTemporaryState();
    if (typeof window !== "undefined") {
      [
        "oyi_estate_id",
        "estate_id",
        "ochiga_estate",
        "oyi_home_id",
        "home_id",
        "ochiga_home",
      ].forEach((key) => window.localStorage.removeItem(key));
    }
    router.replace("/");
  }

  const value = useMemo<AuthContextType>(
    () => ({ user, token, setSession, logout, ready }),
    [user, token, setSession, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
