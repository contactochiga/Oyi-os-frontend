import { create } from "zustand";
import { decodeToken, isExpired, getCookie } from "@/lib/auth";

export type SessionUser = {
  id: string;
  email?: string;
  username?: string;
  role?: string;
  estate_id?: string;
  home_id?: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string | null;
  profile_image_url?: string | null;
  estate_name?: string;
  unit_name?: string;
  unit_id?: string;
  permissions?: string[];
  permission_scopes?: string[];
  onboarding_complete?: boolean;
};

type SessionState = {
  token: string | null;
  user: SessionUser | null;

  setSession: (token: string | null, user?: SessionUser | null) => void;
  hydrate: () => void;
  clear: () => void;
};

const LS_TOKEN = "oyi_consumer_token_ls";
const LS_USER = "oyi_consumer_user_ls";

function safeReadLS(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteLS(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {}
}

function safeRemoveLS(key: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  } catch {}
}

function deriveUserFromToken(token: string): SessionUser | null {
  const decoded = decodeToken(token);
  if (!decoded || isExpired(decoded)) return null;

  return {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
    estate_id: decoded.estate_id,
    home_id: decoded.home_id,
    full_name: decoded.full_name,
    username: decoded.username,
    phone: decoded.phone,
    avatar_url: decoded.avatar_url,
    profile_image_url: decoded.profile_image_url,
    estate_name: decoded.estate_name,
    unit_name: decoded.unit_name,
    unit_id: decoded.unit_id,
    permissions: decoded.permissions,
    permission_scopes: decoded.permission_scopes,
  };
}

export const useSessionStore = create<SessionState>((set) => ({
  token: null,
  user: null,

  setSession: (token, user) => {
    // clear
    if (!token) {
      safeRemoveLS(LS_TOKEN);
      safeRemoveLS(LS_USER);
      set({ token: null, user: null });
      return;
    }

    // derive user if not provided
    let nextUser: SessionUser | null = user ?? null;
    if (!nextUser) nextUser = deriveUserFromToken(token);

    // persist for iOS (Capacitor)
    safeWriteLS(LS_TOKEN, token);
    if (nextUser) {
      safeWriteLS(LS_USER, JSON.stringify(nextUser));
    } else {
      safeRemoveLS(LS_USER);
    }

    set({ token, user: nextUser });
  },

  hydrate: () => {
    if (typeof window === "undefined") return;

    // ✅ Prefer localStorage first (works on iOS)
    const lsToken = safeReadLS(LS_TOKEN);

    // ✅ Web fallback: cookie
    const cookieToken = getCookie("oyi_consumer_token");

    const token = lsToken || cookieToken;

    if (!token) {
      set({ token: null, user: null });
      return;
    }

    const derived = deriveUserFromToken(token);
    if (!derived) {
      safeRemoveLS(LS_TOKEN);
      safeRemoveLS(LS_USER);
      set({ token: null, user: null });
      return;
    }

    // Try to restore richer user from LS (estate/home/full_name may come from /me/context)
    let lsUser: SessionUser | null = null;
    const rawUser = safeReadLS(LS_USER);
    if (rawUser) {
      try {
        lsUser = JSON.parse(rawUser);
      } catch {
        lsUser = null;
      }
    }

    set({
      token,
      user: lsUser || derived,
    });
  },

  clear: () => {
    safeRemoveLS(LS_TOKEN);
    safeRemoveLS(LS_USER);
    set({ token: null, user: null });
  },
}));

export default useSessionStore;
