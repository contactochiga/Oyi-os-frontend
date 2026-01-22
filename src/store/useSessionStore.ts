import { create } from "zustand";
import { decodeToken, deleteCookie, getCookie, isExpired } from "@/lib/auth";

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

  setToken: (t: string | null) => void;
  setUser: (u: SessionUser | null) => void;

  setSession: (token: string, user?: SessionUser | null) => void;
  hydrate: () => void;
  clear: () => void;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  token: null,
  user: null,

  setToken: (t) => set({ token: t }),
  setUser: (u) => set({ user: u }),

  setSession: (token, user) => {
    set({ token });

    // If backend returns user, trust it
    if (typeof user !== "undefined") {
      set({ user });
      return;
    }

    // Else infer minimal user from JWT
    const decoded = decodeToken(token);
    if (!decoded) return;

    set({
      user: {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        estate_id: decoded.estate_id,
        home_id: decoded.home_id,
      },
    });
  },

  hydrate: () => {
    if (get().token) return;

    const token = getCookie("oyi_consumer_token");
    if (!token) return;

    const decoded = decodeToken(token);
    if (!decoded || isExpired(decoded)) {
      deleteCookie("oyi_consumer_token");
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

  clear: () => {
    deleteCookie("oyi_consumer_token");
    set({ token: null, user: null });
  },
}));

// Optional: keeps compatibility if any file imports default
export default useSessionStore;
