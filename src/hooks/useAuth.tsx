"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/services/supabaseClient";

type User = {
  id: string;
  email?: string;
  username?: string;
  role?: string;
  estate_id?: string;
};

const AuthContext = createContext<{ user: User | null; setUser: (u: User | null) => void; logout: () => Promise<void> } | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // try restore from localStorage
    const raw = localStorage.getItem("ochiga_user");
    if (raw) setUser(JSON.parse(raw));
  }, []);

  async function logout() {
    localStorage.removeItem("ochiga_token");
    localStorage.removeItem("ochiga_user");
    setUser(null);
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    if (typeof window !== "undefined") window.location.href = "/auth";
  }

  return <AuthContext.Provider value={{ user, setUser, logout }}>{children}</AuthContext.Provider>;
}

export default function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
