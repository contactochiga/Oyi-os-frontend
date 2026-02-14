"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCookie } from "@/lib/auth";
import { useSessionStore, type SessionUser } from "@/store/useSessionStore";
import { setApiAuthToken } from "@/services/api";

type AuthContextType = {
  user: SessionUser | null;
  token: string | null;
  setSession: (token: string, user?: SessionUser | null) => void;
  logout: () => void;
  ready: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, user, setSession, hydrate, clear } = useSessionStore();
  const [ready, setReady] = useState(false);

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

  function logout() {
    deleteCookie("oyi_consumer_token");
    setApiAuthToken(null);
    clear();
    router.replace("/auth/login");
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
