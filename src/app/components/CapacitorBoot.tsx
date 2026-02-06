"use client";

import { useEffect } from "react";

export default function CapacitorBoot() {
  useEffect(() => {
    async function run() {
      try {
        const w = window as any;
        if (!w?.Capacitor?.isNativePlatform?.()) return;

        const { StatusBar } = await import("@capacitor/status-bar");

        // ✅ THIS IS THE KEY FIX: push webview below iOS status bar
        await StatusBar.setOverlaysWebView({ overlay: false });

        // Optional (nice): match your dark UI
        await StatusBar.setStyle({ style: "DARK" as any });
      } catch (e) {
        // ignore if running on web
      }
    }

    run();
  }, []);

  return null;
}
