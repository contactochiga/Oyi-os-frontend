"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  FiActivity,
  FiCreditCard,
  FiGrid,
  FiHome,
  FiLayers,
  FiTool,
  FiUser,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { useNotificationStore } from "@/store/useNotificationStore";
import useAuth from "@/hooks/useAuth";
import { getSocket } from "@/services/socket";

type Item = {
  key:
    | "home"
    | "spaces"
    | "activity"
    | "community"
    | "devices"
    | "visitors"
    | "maintenance"
    | "wallet"
    | "profile";
  label: string;
  href: string;
  icon: any;
  activeRoutes?: string[];
  indicatorPattern?: RegExp;
};

const ITEMS: Item[] = [
  { key: "home", label: "Home", href: "/home", icon: FiHome },
  { key: "spaces", label: "Spaces", href: "/spaces", icon: FiLayers, activeRoutes: ["/spaces", "/rooms", "/room"], indicatorPattern: /space|room assignment|room/i },
  { key: "devices", label: "Devices", href: "/devices", icon: FiGrid, activeRoutes: ["/devices"], indicatorPattern: /device|switch|light|socket|plug|climate|ac|tv|provider|tuya|sync/i },
  { key: "community", label: "Community", href: "/community", icon: FiUsers, indicatorPattern: /community|announcement|notice|post|comment|reply|urgent|official/i },
  { key: "activity", label: "Activity", href: "/activity", icon: FiActivity, activeRoutes: ["/activity", "/notifications"], indicatorPattern: /activity|device|scene|automation|sync|watch|wallet|payment|transaction|visitor|guest|gate|maintenance|repair|service|security|alert|incident/i },
  { key: "visitors", label: "Visitors", href: "/visitors", icon: FiUserCheck, activeRoutes: ["/visitors"], indicatorPattern: /visitor|guest|gate|access/i },
  { key: "wallet", label: "Wallet", href: "/wallet", icon: FiCreditCard, activeRoutes: ["/wallet"], indicatorPattern: /wallet|payment|transaction|billing|dues|fund/i },
  { key: "maintenance", label: "Maint.", href: "/maintenance", icon: FiTool, activeRoutes: ["/maintenance", "/reports"], indicatorPattern: /maintenance|repair|work order|ticket/i },
  { key: "profile", label: "Profile", href: "/profile", icon: FiUser, activeRoutes: ["/profile", "/account", "/settings"], indicatorPattern: /profile|verify|verification|account|invite/i },
];

const NAV_GROUPS: Item[][] = [
  ITEMS.filter((item) => ["home", "spaces", "devices", "community", "activity"].includes(item.key)),
  ITEMS.filter((item) => ["visitors", "wallet", "maintenance", "profile"].includes(item.key)),
];

function pageForKey(key: Item["key"]) {
  const index = NAV_GROUPS.findIndex((group) => group.some((item) => item.key === key));
  return Math.max(0, index);
}

function routeMatches(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isActive(pathname: string, item: Item) {
  return (item.activeRoutes || [item.href]).some((route) => routeMatches(pathname, route));
}

function notificationText(item: any) {
  return `${item?.type || ""} ${item?.title || ""} ${item?.message || ""} ${item?.payload?.kind || ""}`.toLowerCase();
}

function isUnread(item: any) {
  return String(item?.status || "").toLowerCase() !== "read";
}

export default function BottomNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { user } = useAuth();
  const railRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const notifications = useNotificationStore((state) => state.items);
  const unreadByBucket = useNotificationStore((state) => state.unreadByBucket);
  const markBucketViewed = useNotificationStore((state) => state.markBucketViewed);
  const scopeKey = useMemo(() => {
    const identity = String((user as any)?.id || "guest");
    const estate = String((user as any)?.estate_id || "estate");
    const home = String((user as any)?.home_id || "home");
    return `${identity}:${estate}:${home}`;
  }, [user]);
  const [localDots, setLocalDots] = useState<Record<string, boolean>>({});
  const storageKey = useMemo(() => `oyi:footer-nav-page:${scopeKey}:v1`, [scopeKey]);
  const initialPage = useMemo(() => {
    const activeItem = ITEMS.find((item) => isActive(pathname, item));
    return activeItem ? pageForKey(activeItem.key) : 0;
  }, [pathname]);
  const [page, setPage] = useState(initialPage);

  function persistPage(nextPage: number) {
    const bounded = Math.max(0, Math.min(NAV_GROUPS.length - 1, nextPage));
    setPage(bounded);
    try {
      localStorage.setItem(storageKey, String(bounded));
    } catch {}
  }

  function scrollToPage(nextPage: number, behavior: ScrollBehavior = "smooth") {
    const bounded = Math.max(0, Math.min(NAV_GROUPS.length - 1, nextPage));
    const rail = railRef.current;
    if (rail) {
      rail.scrollTo({ left: bounded * rail.clientWidth, behavior });
    }
    persistPage(bounded);
  }

  function clearLocalDot(bucket: Item["key"] | "messages") {
    setLocalDots((current) => ({ ...current, [bucket]: false }));
    try {
      localStorage.setItem(`oyi:last-seen:${scopeKey}:${bucket}`, new Date().toISOString());
    } catch {}
  }

  useEffect(() => {
    let nextPage = initialPage;
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (Number.isFinite(saved)) nextPage = Math.max(0, Math.min(NAV_GROUPS.length - 1, saved));
    } catch {}
    window.setTimeout(() => scrollToPage(nextPage, "auto"), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    const activeItem = ITEMS.find((item) => isActive(pathname, item));
    if (!activeItem) return;
    clearLocalDot(activeItem.key);
    if (activeItem.key === "activity") {
      clearLocalDot("activity");
      markBucketViewed("activity");
      markBucketViewed("messages");
    }
    if (activeItem.key === "community") {
      clearLocalDot("community");
      markBucketViewed("community");
    }
    if (activeItem.key === "profile") {
      clearLocalDot("profile");
      markBucketViewed("profile");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, scopeKey, markBucketViewed]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const markActivity = () => {
      const activeItem = ITEMS.find((item) => isActive(pathname, item));
      if (activeItem?.key !== "activity") setLocalDots((current) => ({ ...current, activity: true }));
    };
    const markCommunity = () => {
      const activeItem = ITEMS.find((item) => isActive(pathname, item));
      if (activeItem?.key !== "community") setLocalDots((current) => ({ ...current, community: true }));
    };
    const markModule = (key: Item["key"]) => {
      const activeItem = ITEMS.find((item) => isActive(pathname, item));
      if (activeItem?.key !== key) setLocalDots((current) => ({ ...current, [key]: true, activity: true }));
    };
    const activityEvents = ["notification:new", "audit.recorded"];
    const communityEvents = ["community.updated"];
    const moduleEvents: Array<[string, Item["key"]]> = [
      ["device.status.updated", "devices"],
      ["device.registry.updated", "devices"],
      ["visitor.updated", "visitors"],
      ["visitor.created", "visitors"],
      ["maintenance.updated", "maintenance"],
      ["wallet.updated", "wallet"],
    ];
    const activityOnlyEvents = ["service.updated", "security.alert", "utility.telemetry.updated", "watch.sync.updated"];
    const moduleHandlers = moduleEvents.map(([eventName, key]) => {
      const handler = () => markModule(key);
      return { eventName, handler };
    });
    const activityOnlyHandlers = activityOnlyEvents.map((eventName) => ({ eventName, handler: markActivity }));
    activityEvents.forEach((eventName) => socket.on(eventName, markActivity));
    communityEvents.forEach((eventName) => socket.on(eventName, markCommunity));
    moduleHandlers.forEach(({ eventName, handler }) => socket.on(eventName, handler));
    activityOnlyHandlers.forEach(({ eventName, handler }) => socket.on(eventName, handler));
    return () => {
      activityEvents.forEach((eventName) => socket.off(eventName, markActivity));
      communityEvents.forEach((eventName) => socket.off(eventName, markCommunity));
      moduleHandlers.forEach(({ eventName, handler }) => socket.off(eventName, handler));
      activityOnlyHandlers.forEach(({ eventName, handler }) => socket.off(eventName, handler));
    };
  }, [pathname]);

  function handlePageScroll() {
    const rail = railRef.current;
    if (!rail) return;
    if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      const nextPage = Math.round(rail.scrollLeft / Math.max(1, rail.clientWidth));
      scrollToPage(nextPage, "smooth");
    }, 90);
  }

  const badgeFor = (key: Item["key"]) => {
    if (key === "activity") return unreadByBucket.activity || unreadByBucket.messages || (localDots.activity ? 1 : 0);
    if (key === "community") return unreadByBucket.community || (localDots.community ? 1 : 0);
    if (key === "profile") return unreadByBucket.profile || (localDots.profile ? 1 : 0);
    const item = ITEMS.find((entry) => entry.key === key);
    const count = item?.indicatorPattern
      ? notifications.filter((notification) => isUnread(notification) && item.indicatorPattern!.test(notificationText(notification))).length
      : 0;
    return count || (localDots[key] ? 1 : 0);
  };

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[95] px-3"
      style={{ paddingBottom: "calc(8px + var(--sab))" }}
      aria-label="Oyi Home navigation"
    >
      <div className="pointer-events-auto mx-auto max-w-[520px] overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#040911]/86 px-2 py-1.5 shadow-[0_16px_54px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div ref={railRef} onScroll={handlePageScroll} className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={groupIndex} className="grid w-full min-w-full shrink-0 snap-center grid-cols-5 gap-1 px-0.5">
              {group.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                const badge = badgeFor(item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      scrollToPage(pageForKey(item.key));
                      clearLocalDot(item.key);
                      if (item.key === "activity") {
                        markBucketViewed("activity");
                        markBucketViewed("messages");
                      }
                      if (item.key === "community") {
                        markBucketViewed("community");
                      }
                      if (item.key === "profile") {
                        markBucketViewed("profile");
                      }
                      router.push(item.href);
                    }}
                    className={`group rounded-[21px] px-1.5 py-1.5 text-center transition active:scale-[0.98] ${
                      active ? "text-white" : "text-white/46 hover:text-white/78"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <div className="flex justify-center">
                      <span
                        className={`relative grid h-7 w-7 place-items-center rounded-[13px] transition ${
                          active
                            ? "bg-sky-300/14 text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.32)]"
                            : "text-white/52 group-hover:bg-white/[0.05] group-hover:text-white/78"
                        }`}
                      >
                        <Icon className="text-[18px]" />
                        {badge ? (
                          <span className={`absolute ${badge > 1 ? "-right-1 -top-1 min-w-[16px] px-1" : "right-0.5 top-0.5 h-2 w-2"} rounded-full bg-sky-300 text-[9px] font-bold leading-4 text-slate-950 shadow-[0_0_12px_rgba(56,189,248,0.8)]`}>
                            {badge > 1 ? Math.min(badge, 9) : ""}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div
                      className={`mt-0.5 truncate whitespace-nowrap text-[10px] font-medium tracking-[-0.025em] ${
                        active ? "text-white" : "text-white/48"
                      }`}
                    >
                      {item.label}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-0.5 flex justify-center gap-1" aria-hidden="true">
          {NAV_GROUPS.map((_, index) => (
            <span key={index} className={`h-1 rounded-full transition-all ${page === index ? "w-3 bg-sky-200/70" : "w-1 bg-white/18"}`} />
          ))}
        </div>
      </div>
    </nav>
  );
}
