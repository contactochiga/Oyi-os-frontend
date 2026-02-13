"use client";

import React, { createContext, useContext, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

import { deleteCookie } from "@/lib/auth";
import API from "@/services/api";
import { supabaseBrowser } from "@/supabase/supabaseBrowser";

import { useSessionStore, type SessionUser } from "@/store/useSessionStore";

type AuthContextType = {
  user: SessionUser | null;
  token: string | null;
  setSession: (token: string, user?: SessionUser | null) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchMe(accessToken: string) {
  const res = await API.get("/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, user, setSession, hydrate, clear } = useSessionStore();

  /**
   * ✅ Hydrate from:
   * 1) Supabase session (authoritative on iOS + web)
   * 2) Backend /auth/me (estate/home/role/name enrichment)
   */
  const refresh = useCallback(async () => {
    try {
      const { data } = await supabaseBrowser.auth.getSession();
      const session = data?.session;

      if (!session?.access_token) {
        // No supabase session => clear local store
        clear();
        return;
      }

      const accessToken = session.access_token;

      // Always at least set token so API calls can work
      // Then enrich user from backend
      try {
        const me = await fetchMe(accessToken);

        // Build a user object your UI can rely on
        const nextUser: SessionUser = {
          ...(me || {}),
          // Ensure these exist even if backend doesn’t send them
          id: me?.id || session.user.id,
          email: me?.email || session.user.email || null,
          estate_id: me?.estate_id ?? null,
          home_id: me?.home_id ?? null,
          role: me?.role ?? me?.user_type ?? null,
          estate_name: me?.estate_name ?? null,
        } as any;

        setSession(accessToken, nextUser);

        // Optional local cache (helps your pages that read localStorage)
        if (typeof window !== "undefined") {
          if (nextUser.estate_id) localStorage.setItem("ochiga_estate", String(nextUser.estate_id));
          if (nextUser.home_id) localStorage.setItem("ochiga_home", String(nextUser.home_id));
        }
      } catch {
        // Backend may be down — still show email from Supabase
        const fallbackUser: SessionUser = {
          id: session.user.id as any,
          email: session.user.email ?? null,
        } as any;

        setSession(accessToken, fallbackUser);
      }
    } catch {
      // If anything goes wrong, don’t crash UI
    }
  }, [clear, setSession]);

  // Keep your existing store hydrate (if it restores from local storage),
  // but immediately reconcile with Supabase session so iOS matches web.
  useEffect(() => {
    hydrate();
    refresh();
  }, [hydrate, refresh]);

  // ✅ React to login/logout/token refresh events from Supabase
  useEffect(() => {
    const { data: sub } = supabaseBrowser.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, [refresh]);

  // ✅ Full logout: Supabase + cookie + local store
  const logout = useCallback(async () => {
    try {
      await supabaseBrowser.auth.signOut();
    } catch {
      // ignore
    }

    // If you used a legacy cookie token before, keep clearing it.
    deleteCookie("oyi_consumer_token");

    clear();

    // Optional: clear cached ids
    if (typeof window !== "undefined") {
      localStorage.removeItem("ochiga_estate");
      localStorage.removeItem("ochiga_home");
    }

    router.replace("/auth/login");
  }, [clear, router]);

  const value = useMemo<AuthContextType>(
    () => ({ user, token, setSession, logout, refresh }),
    [user, token, setSession, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
