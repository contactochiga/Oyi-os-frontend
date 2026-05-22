"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import useAuth from "@/hooks/useAuth";
import API from "@/services/api";
import { useNotificationStore } from "@/store/useNotificationStore";

async function optionalImport(specifier: string) {
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;
    return await dynamicImport(specifier);
  } catch {
    return null;
  }
}

export default function PushNotificationsBridge() {
  const { token, ready } = useAuth();
  const upsert = useNotificationStore((s) => s.upsert);
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
      try {
        localStorage.setItem("oyi_push_debug", JSON.stringify({ status: next, detail: nextDetail, at: new Date().toISOString() }));
      } catch {}
      console.log("[push]", next, nextDetail);
    }

    async function init() {
      const [pushMod, deviceMod, localMod, hapticsMod] = await Promise.all([
        optionalImport("@capacitor/push-notifications"),
        optionalImport("@capacitor/device"),
        optionalImport("@capacitor/local-notifications"),
        optionalImport("@capacitor/haptics"),
      ]);
      const PushNotifications = pushMod?.PushNotifications;
      const Device = deviceMod?.Device;
      const LocalNotifications = localMod?.LocalNotifications;
      const Haptics = hapticsMod?.Haptics;
      const ImpactStyle = hapticsMod?.ImpactStyle || { Medium: "MEDIUM" };

      if (!PushNotifications) {
        updateStatus("push-plugin-missing", "Optional Capacitor push plugin is not installed in this build.");
        return;
      }

      async function registerToken(rawToken: string) {
        const cleanToken = String(rawToken || "").trim();
        if (!cleanToken) return;
        updateStatus("registering-token", cleanToken.slice(0, 12));
        let deviceInfo: any = null;
        try {
          deviceInfo = Device ? await Device.getInfo() : null;
        } catch {}

        await API.post("/push/register", {
          token: cleanToken,
          platform: Capacitor.getPlatform(),
          device_id: deviceInfo?.identifier || deviceInfo?.model || null,
          app_version: deviceInfo?.appVersion || null,
        })
          .then(() => updateStatus("registered", cleanToken.slice(0, 12)))
          .catch((err) => {
            const msg = err?.response?.data?.error || err?.message || "Failed to POST /push/register";
            updateStatus("register-api-failed", String(msg));
          });
      }

      async function presentForegroundNotification(notification: any) {
        const title = String(notification?.title || notification?.data?.title || "Oyi");
        const body = String(notification?.body || notification?.data?.body || "");
        if (!title && !body) return;
        try {
          if (LocalNotifications) {
            await LocalNotifications.schedule({ notifications: [{ id: Date.now(), title, body, schedule: { at: new Date(Date.now() + 250) }, sound: "default" }] });
          }
        } catch {}
        try {
          await Haptics?.impact?.({ style: ImpactStyle.Medium });
        } catch {}
      }

      try {
        updateStatus("requesting-permission");
        const localPerms = LocalNotifications ? await LocalNotifications.requestPermissions().catch(() => null) : null;
        const pushPerms = await PushNotifications.requestPermissions();
        if (pushPerms.receive !== "granted") {
          updateStatus("permission-denied", String(pushPerms.receive || "not-granted"));
          return;
        }
        if (localPerms && localPerms.display !== "granted") {
          // fail soft: remote push can still work
        }
        updateStatus("permission-granted");

        listeners.push(await PushNotifications.addListener("registration", (tokenInfo: any) => {
          if (unmounted) return;
          const value = String(tokenInfo?.value || "");
          updateStatus("native-token-received", value.slice(0, 12));
          void registerToken(value);
        }));

        listeners.push(await PushNotifications.addListener("registrationError", (error: any) => {
          updateStatus("registration-error", String(error?.error || error?.message || "unknown"));
        }));

        listeners.push(await PushNotifications.addListener("pushNotificationReceived", (notification: any) => {
          if (unmounted) return;
          const payload = notification?.data || {};
          if (payload?.id) upsert(payload);
          void presentForegroundNotification(notification);
        }));

        listeners.push(await PushNotifications.addListener("pushNotificationActionPerformed", (action: any) => {
          if (unmounted) return;
          const payload = action?.notification?.data || {};
          if (payload?.id) upsert(payload);
        }));

        updateStatus("calling-register");
        await PushNotifications.register();
      } catch {
        updateStatus("bridge-failed", "Push initialization crashed");
      }
    }

    void init();

    return () => {
      unmounted = true;
      for (const listener of listeners) listener.remove().catch(() => {});
    };
  }, [ready, token, upsert, mounted, isNative]);

  return null;
}
