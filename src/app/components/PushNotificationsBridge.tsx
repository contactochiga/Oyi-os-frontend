"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { Device } from "@capacitor/device";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import useAuth from "@/hooks/useAuth";
import API from "@/services/api";
import { useNotificationStore } from "@/store/useNotificationStore";

export default function PushNotificationsBridge() {
  const { token, ready } = useAuth();
  const upsert = useNotificationStore((s) => s.upsert);

  useEffect(() => {
    if (!ready || !token) return;
    if (typeof window === "undefined") return;
    if (!Capacitor.isNativePlatform()) return;

    let unmounted = false;
    const listeners: Array<{ remove: () => Promise<void> }> = [];

    async function registerToken(rawToken: string) {
      const cleanToken = String(rawToken || "").trim();
      if (!cleanToken) return;
      let deviceInfo: any = null;
      try {
        deviceInfo = await Device.getInfo();
      } catch {}

      await API.post("/push/register", {
        token: cleanToken,
        platform: Capacitor.getPlatform(),
        device_id: deviceInfo?.identifier || deviceInfo?.model || null,
        app_version: deviceInfo?.appVersion || null,
      }).catch(() => {});
    }

    async function presentForegroundNotification(notification: any) {
      const title = String(notification?.title || notification?.data?.title || "Oyi");
      const body = String(notification?.body || notification?.data?.body || "");
      if (!title && !body) return;

      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now(),
              title,
              body,
              schedule: { at: new Date(Date.now() + 250) },
              sound: "default",
            },
          ],
        });
      } catch {}

      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch {}
    }

    async function init() {
      try {
        const localPerms = await LocalNotifications.requestPermissions().catch(() => null);
        const pushPerms = await PushNotifications.requestPermissions();
        if (pushPerms.receive !== "granted") return;
        if (localPerms && localPerms.display !== "granted") {
          // fail soft: remote push can still work
        }

        listeners.push(
          await PushNotifications.addListener("registration", (tokenInfo) => {
            if (unmounted) return;
            const value = String(tokenInfo?.value || "");
            void registerToken(value);
          })
        );

        listeners.push(
          await PushNotifications.addListener("registrationError", () => {})
        );

        listeners.push(
          await PushNotifications.addListener("pushNotificationReceived", (notification) => {
            if (unmounted) return;
            const payload = notification?.data || {};
            if (payload?.id) upsert(payload);
            void presentForegroundNotification(notification);
          })
        );

        listeners.push(
          await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
            if (unmounted) return;
            const payload = action?.notification?.data || {};
            if (payload?.id) upsert(payload);
          })
        );

        await PushNotifications.register();
      } catch {
        // fail-soft
      }
    }

    void init();

    return () => {
      unmounted = true;
      for (const listener of listeners) {
        listener.remove().catch(() => {});
      }
    };
  }, [ready, token, upsert]);

  return null;
}
