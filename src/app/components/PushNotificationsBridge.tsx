"use client";

import { useEffect, useState } from "react";
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
  const [status, setStatus] = useState<string>("idle");
  const [mounted, setMounted] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  useEffect(() => {
    if (!ready || !token) return;
    if (typeof window === "undefined") return;
    if (!mounted || !isNative) return;

    let unmounted = false;
    const listeners: Array<{ remove: () => Promise<void> }> = [];

    function updateStatus(next: string, nextDetail = "") {
      if (unmounted) return;
      setStatus(next);
      try {
        localStorage.setItem(
          "oyi_push_debug",
          JSON.stringify({
            status: next,
            detail: nextDetail,
            at: new Date().toISOString(),
          })
        );
      } catch {}
      console.log("[push]", next, nextDetail);
    }

    async function registerToken(rawToken: string) {
      const cleanToken = String(rawToken || "").trim();
      if (!cleanToken) return;
      updateStatus("registering-token", cleanToken.slice(0, 12));
      let deviceInfo: any = null;
      try {
        deviceInfo = await Device.getInfo();
      } catch {}

      await API.post("/push/register", {
        token: cleanToken,
        platform: Capacitor.getPlatform(),
        device_id: deviceInfo?.identifier || deviceInfo?.model || null,
        app_version: deviceInfo?.appVersion || null,
      })
        .then(() => updateStatus("registered", cleanToken.slice(0, 12)))
        .catch((err) => {
          const msg =
            err?.response?.data?.error ||
            err?.message ||
            "Failed to POST /push/register";
          updateStatus("register-api-failed", String(msg));
        });
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
        updateStatus("requesting-permission");
        const localPerms = await LocalNotifications.requestPermissions().catch(() => null);
        const pushPerms = await PushNotifications.requestPermissions();
        if (pushPerms.receive !== "granted") {
          updateStatus("permission-denied", String(pushPerms.receive || "not-granted"));
          return;
        }
        if (localPerms && localPerms.display !== "granted") {
          // fail soft: remote push can still work
        }
        updateStatus("permission-granted");

        listeners.push(
          await PushNotifications.addListener("registration", (tokenInfo) => {
            if (unmounted) return;
            const value = String(tokenInfo?.value || "");
            updateStatus("native-token-received", value.slice(0, 12));
            void registerToken(value);
          })
        );

        listeners.push(
          await PushNotifications.addListener("registrationError", (error) => {
            updateStatus(
              "registration-error",
              String((error as any)?.error || (error as any)?.message || "unknown")
            );
          })
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

        updateStatus("calling-register");
        await PushNotifications.register();
      } catch {
        updateStatus("bridge-failed", "Push initialization crashed");
      }
    }

    void init();

    return () => {
      unmounted = true;
      for (const listener of listeners) {
        listener.remove().catch(() => {});
      }
    };
  }, [ready, token, upsert, mounted, isNative]);

  if (!mounted || !isNative) return null;

  return null;
}
