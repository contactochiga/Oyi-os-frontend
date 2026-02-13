"use client";

import { createClient } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const isNative =
  typeof window !== "undefined" &&
  (window as any)?.Capacitor &&
  (window as any)?.Capacitor?.isNativePlatform?.();

function makeCapacitorStorage() {
  return {
    getItem: async (key: string) => {
      const { value } = await Preferences.get({ key });
      return value ?? null;
    },
    setItem: async (key: string, value: string) => {
      await Preferences.set({ key, value });
    },
    removeItem: async (key: string) => {
      await Preferences.remove({ key });
    },
  };
}

export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: isNative ? (makeCapacitorStorage() as any) : undefined,
  },
});
