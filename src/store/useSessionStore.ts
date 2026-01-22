import { create } from "zustand";
import { decodeToken, isExpired, getCookie } from "@/lib/auth";

export type SessionUser = {
  id: string;
  email?: string;
  role?: string;

  estate_id?: string;
  home_id?: string;
};

type SessionState = {
  token: string | null;
  user: SessionUser | null;

  // actions
  setSession: (token: string | null, user?: SessionUser | null) => void;
  hydrate: () => void;
  clear: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  token: null,
  user: null,

  setSession: (token, user) => {
    // If user not provided, derive from token
    let derivedUser: SessionUser | null = user ?? null;

    if (token && !derivedUser) {
      const decoded = decodeToken(token);
      if (decoded && !isExpired(decoded)) {
        derivedUser = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          estate_id: decoded.estate_id,
          home_id: decoded.home_id,
        };
      }
    }

    set({ token: token ?? null, user: derivedUser });
  },

  hydrate: () => {
    // Safe in SSR/build
    if (typeof window === "undefined") return;

    const token = getCookie("oyi_consumer_token");
    if (!token) {
      set({ token: null, user: null });
      return;
    }

    const decoded = decodeToken(token);
    if (!decoded || isExpired(decoded)) {
      set({ token: null, user: null });
      return;
    }

    set({
      token,
      user: {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        estate_id: decoded.estate_id,
        home_id: decoded.home_id,
      },
    });
  },

  clear: () => set({ token: null, user: null }),
}));

// ✅ Also export default to avoid future mismatch
export default useSessionStore;
