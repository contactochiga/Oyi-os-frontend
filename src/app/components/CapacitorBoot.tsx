"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";

export default function CapacitorBoot() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (Capacitor.getPlatform() !== "ios") return;

    (async () => {
      try {
        await Keyboard.setResizeMode({ mode: KeyboardResize.None });
        await Keyboard.setScroll({ isDisabled: true });
        await Keyboard.setAccessoryBarVisible({ isVisible: false });
      } catch {}
    })();
  }, []);

  return null;
}
