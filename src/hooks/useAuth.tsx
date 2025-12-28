"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/services/supabaseClient";

/**
 * User type — aligned with estate + unit context
 * This is the single source of truth for authenticated user data
 */
type User = {
  id: string;

  email?: string;
  username?: string;

  role?: "resident" | "admin" | "security" | string;

  // Estate context
  estate_id?: string;
  estate_name?: string;

  // Unit context
  unit_id?: string;
  unit_name?: string;
};

type AuthContextType = {
  user: User | null;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Restore user from localStorage on load
  useEffect(() => {
    const raw = localStorage.getItem("ochiga_user");
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        localStorage.removeItem("ochiga_user");
      }
    }
  }, []);

  async function logout() {
    localStorage.removeItem("ochiga_token");
    localStorage.removeItem("ochiga_user");
    setUser(null);

    try {
      await supabase.auth.signOut();
    } catch {
      // ignore supabase errors
    }

    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    }
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export default function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
