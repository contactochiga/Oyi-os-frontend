// src/supabase/supabaseBrowser.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function isBrowser() {
  return typeof window !== "undefined";
}

/**
 * Detect if we're running inside a Capacitor native container
 * without importing any capacitor package at build-time.
 */
async function isCapacitorNative(): Promise<boolean> {
  if (!isBrowser()) return false;

  try {
    const mod = await import("@capacitor/core");
    return !!mod?.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/**
 * Storage adapter that:
 * - Uses localStorage on web
 * - Uses Capacitor Preferences on native (if installed)
 *
 * IMPORTANT:
 * No static imports of @capacitor/preferences so Vercel won’t fail build.
 */
const storage = {
  async getItem(key: string) {
    if (!isBrowser()) return null;

    // web
    const native = await isCapacitorNative();
    if (!native) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    }

    // native (Capacitor)
    try {
      const prefs = await import("@capacitor/preferences");
      const { value } = await prefs.Preferences.get({ key });
      return value ?? null;
    } catch {
      // if Preferences plugin not installed, fallback to localStorage
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    }
  },

  async setItem(key: string, value: string) {
    if (!isBrowser()) return;

    const native = await isCapacitorNative();
    if (!native) {
      try {
        window.localStorage.setItem(key, value);
      } catch {}
      return;
    }

    try {
      const prefs = await import("@capacitor/preferences");
      await prefs.Preferences.set({ key, value });
    } catch {
      try {
        window.localStorage.setItem(key, value);
      } catch {}
    }
  },

  async removeItem(key: string) {
    if (!isBrowser()) return;

    const native = await isCapacitorNative();
    if (!native) {
      try {
        window.localStorage.removeItem(key);
      } catch {}
      return;
    }

    try {
      const prefs = await import("@capacitor/preferences");
      await prefs.Preferences.remove({ key });
    } catch {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }
  },
};

export const supabaseBrowser = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
