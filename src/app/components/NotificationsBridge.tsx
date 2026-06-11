"use client";

import { useEffect, useMemo } from "react";
import { listMyNotifications } from "@/services/notificationsService";
import { contextScopeKey, useNotificationStore } from "@/store/useNotificationStore";
import useAuth from "@/hooks/useAuth";
import useActiveContext from "@/hooks/useActiveContext";
import { getSocket } from "@/services/socket";
import { isInActiveScope, type BadgeScope } from "@/lib/footerBadges";

function filterScoped(items: any[], scope: BadgeScope) {
  return items.filter((item) => isInActiveScope(item, scope, { allowUnscoped: false, profileGlobal: true }));
}

export default function NotificationsBridge() {
  const { token, user } = useAuth();
  const activeContext = useActiveContext();
  const upsertMany = useNotificationStore((s) => s.upsertMany);
  const upsert = useNotificationStore((s) => s.upsert);
  const setItems = useNotificationStore((s) => s.setItems);
  const clear = useNotificationStore((s) => s.clear);
  const setScopeKey = useNotificationStore((s) => s.setScopeKey);

  const scope = useMemo<BadgeScope>(() => ({ userId: (user as any)?.id || null, estateId: activeContext.estate_id, homeId: activeContext.home_id }), [user, activeContext.estate_id, activeContext.home_id]);
  const scopeKey = useMemo(() => contextScopeKey(scope), [scope]);

  useEffect(() => {
    setScopeKey(scopeKey);
  }, [scopeKey, setScopeKey]);

  useEffect(() => {
    if (!token || !activeContext.ready) {
      clear();
      return;
    }

    let cancelled = false;
    const currentScopeKey = scopeKey;

    async function load() {
      const res: any = await listMyNotifications();
      if (cancelled) return;
      if (Array.isArray(res)) setItems(filterScoped(res, scope), currentScopeKey);
    }

    load();
    const t = window.setInterval(load, 15_000);

    const socket = getSocket();
    const onNotification = (notification: any) => {
      if (!isInActiveScope(notification, scope, { allowUnscoped: false, profileGlobal: true })) return;
      if (notification?.id) upsert(notification);
      else void load();
    };

    if (socket) {
      socket.emit("subscribe:user", userIdFromToken(token));
      socket.emit("subscribe:estate", activeContext.estate_id);
      socket.emit("subscribe:home", activeContext.home_id);
      socket.on("notification:new", onNotification);
    }

    return () => {
      cancelled = true;
      window.clearInterval(t);
      socket?.off("notification:new", onNotification);
    };
  }, [token, activeContext.ready, activeContext.contextKey, scopeKey, scope, upsert, upsertMany, setItems, clear]);

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
