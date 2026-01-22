"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { deleteCookie } from "@/lib/auth";
import { useSessionStore, type SessionUser } from "@/store/useSessionStore";

type AuthContextType = {
  user: SessionUser | null;
  token: string | null;
  setSession: (token: string, user?: SessionUser | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, user, setSession, hydrate, clear } = useSessionStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  function logout() {
    deleteCookie("oyi_consumer_token");
    clear();
    router.replace("/auth/login");
  }

  const value = useMemo<AuthContextType>(
    () => ({ user, token, setSession, logout }),
    [user, token, setSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
