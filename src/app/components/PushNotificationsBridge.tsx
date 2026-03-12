"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import useAuth from "@/hooks/useAuth";
import API from "@/services/api";

export default function PushNotificationsBridge() {
  const { token, ready } = useAuth();

  useEffect(() => {
    if (!ready || !token) return;
    if (typeof window === "undefined") return;
    if (!Capacitor.isNativePlatform()) return;

    const push = (window as any)?.Capacitor?.Plugins?.PushNotifications;
    const device = (window as any)?.Capacitor?.Plugins?.Device;
    if (!push) return;

    let unmounted = false;
    const listeners: Array<{ remove: () => Promise<void> }> = [];

    async function registerToken(rawToken: string) {
      const t = String(rawToken || "").trim();
      if (!t) return;
      let deviceInfo: any = null;
      try {
        deviceInfo = await device?.getInfo?.();
      } catch {}

      await API.post("/push/register", {
        token: t,
        platform: Capacitor.getPlatform(),
        device_id: deviceInfo?.identifier || deviceInfo?.model || null,
        app_version: deviceInfo?.appVersion || null,
      }).catch(() => {});
    }

    async function init() {
      try {
        const registrationListener = await push.addListener("registration", (result: any) => {
          if (unmounted) return;
          const value = result?.value || result?.token || "";
          void registerToken(String(value));
        });
        listeners.push(registrationListener);

        const errorListener = await push.addListener("registrationError", () => {});
        listeners.push(errorListener);

        const receivedListener = await push.addListener("pushNotificationReceived", () => {});
        listeners.push(receivedListener);

        const actionListener = await push.addListener("pushNotificationActionPerformed", () => {});
        listeners.push(actionListener);

        const perm = await push.requestPermissions();
        if (perm?.receive === "granted") {
          await push.register();
        }
      } catch {
        // fail-soft
      }
    }

    void init();

    return () => {
      unmounted = true;
      for (const l of listeners) {
        l.remove().catch(() => {});
      }
    };
  }, [ready, token]);

  return null;
}

