"use client";

import { useEffect } from "react";
import { listMyNotifications } from "@/services/notificationsService";
import { useNotificationStore } from "@/store/useNotificationStore";
import useAuth from "@/hooks/useAuth";
import { getSocket } from "@/services/socket";

/**
 * Pull notifications into zustand store.
 * - polls lightly (15s)
 * - updates unread badge
 */
export default function NotificationsBridge() {
  const { token } = useAuth();
  const upsertMany = useNotificationStore((s) => s.upsertMany);
  const upsert = useNotificationStore((s) => s.upsert);
  const setItems = useNotificationStore((s) => s.setItems);

  useEffect(() => {
    if (!token) {
      setItems([]);
      return;
    }

    let cancelled = false;

    async function load() {
      const res: any = await listMyNotifications();
      if (cancelled) return;

      // notificationsService returns array OR {error}
      if (Array.isArray(res)) {
        upsertMany(res);
      }
    }

    load();
    const t = window.setInterval(load, 15_000);

    const socket = getSocket();
    const onNotification = (notification: any) => {
      if (notification?.id) {
        upsert(notification);
      } else {
        void load();
      }
    };

    if (socket) {
      socket.emit("subscribe:user", userIdFromToken(token));
      socket.on("notification:new", onNotification);
    }

    return () => {
      cancelled = true;
      window.clearInterval(t);
      socket?.off("notification:new", onNotification);
    };
  }, [token, upsert, upsertMany, setItems]);

  return null;
}

function userIdFromToken(token: string) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    return String(payload?.id || "");
  } catch {
    return "";
  }
}
