"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Fixes iOS keyboard “screen expands” issue in WKWebView/PWA by using VisualViewport.
 * Exposes CSS vars:
 *  --kb: keyboard offset in px
 *  --vvh: visual viewport height in px (optional)
 */
export default function ViewportKeyboardFix() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    let latestNativeKb = 0;
    const keyboardListeners: Array<{ remove: () => Promise<void> }> = [];

    const setVars = () => {
      const vv = window.visualViewport;

      // Fallbacks
      const vvHeight = vv?.height ?? window.innerHeight;
      root.style.setProperty("--vvh", `${Math.round(vvHeight)}px`);

      // Keyboard offset: how much visual viewport shrank from layout viewport
      // This is what makes “fixed bottom” elements float correctly above keyboard.
      if (vv) {
        const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        root.style.setProperty("--kb", `${Math.round(Math.max(keyboard, latestNativeKb))}px`);
      } else {
        root.style.setProperty("--kb", `${Math.round(latestNativeKb)}px`);
      }
    };

    setVars();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", setVars);
    vv?.addEventListener("scroll", setVars);
    window.addEventListener("resize", setVars);

    async function bindNativeKeyboard() {
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;
      try {
        const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;
        const mod = await dynamicImport("@capacitor/keyboard");
        const { Keyboard } = mod;
        keyboardListeners.push(
          await Keyboard.addListener("keyboardWillShow", (info: any) => {
            latestNativeKb = Math.max(0, Number(info?.keyboardHeight || 0));
            root.style.setProperty("--kb", `${Math.round(latestNativeKb)}px`);
          })
        );
        keyboardListeners.push(
          await Keyboard.addListener("keyboardDidShow", (info: any) => {
            latestNativeKb = Math.max(0, Number(info?.keyboardHeight || 0));
            root.style.setProperty("--kb", `${Math.round(latestNativeKb)}px`);
          })
        );
        keyboardListeners.push(
          await Keyboard.addListener("keyboardWillHide", () => {
            latestNativeKb = 0;
            root.style.setProperty("--kb", "0px");
          })
        );
        keyboardListeners.push(
          await Keyboard.addListener("keyboardDidHide", () => {
            latestNativeKb = 0;
            root.style.setProperty("--kb", "0px");
          })
        );
      } catch {
        // ignore
      }
    }

    void bindNativeKeyboard();

    return () => {
      vv?.removeEventListener("resize", setVars);
      vv?.removeEventListener("scroll", setVars);
      window.removeEventListener("resize", setVars);
      for (const listener of keyboardListeners) {
        listener.remove().catch(() => {});
      }
    };
  }, []);

  return null;
}
