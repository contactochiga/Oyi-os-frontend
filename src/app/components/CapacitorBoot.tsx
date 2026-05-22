"use client";

import { useEffect } from "react";

export default function CapacitorBoot() {
  useEffect(() => {
    // Run only on client
    if (typeof window === "undefined") return;

    (async () => {
      try {
        // ✅ Dynamic import so Vercel/web never needs these modules
        const { Capacitor } = await import("@capacitor/core");

        if (!Capacitor.isNativePlatform()) return;
        if (Capacitor.getPlatform() !== "ios") return;

        // Only on iOS native. Use runtime import so web builds do not require the optional plugin.
        const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;
        const kb = await dynamicImport("@capacitor/keyboard");
        const { Keyboard, KeyboardResize } = kb;

        await Keyboard.setResizeMode({ mode: KeyboardResize.None });
        await Keyboard.setScroll({ isDisabled: false });
        await Keyboard.setAccessoryBarVisible({ isVisible: false });
      } catch {
        // ignore
      }
    })();
  }, []);

  return null;
}
