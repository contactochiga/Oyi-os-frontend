"use client";

import { useEffect } from "react";

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

    const setVars = () => {
      const vv = window.visualViewport;

      // Fallbacks
      const vvHeight = vv?.height ?? window.innerHeight;
      root.style.setProperty("--vvh", `${Math.round(vvHeight)}px`);

      // Keyboard offset: how much visual viewport shrank from layout viewport
      // This is what makes “fixed bottom” elements float correctly above keyboard.
      if (vv) {
        const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        root.style.setProperty("--kb", `${Math.round(keyboard)}px`);
      } else {
        root.style.setProperty("--kb", `0px`);
      }
    };

    setVars();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", setVars);
    vv?.addEventListener("scroll", setVars);
    window.addEventListener("resize", setVars);

    return () => {
      vv?.removeEventListener("resize", setVars);
      vv?.removeEventListener("scroll", setVars);
      window.removeEventListener("resize", setVars);
    };
  }, []);

  return null;
}
