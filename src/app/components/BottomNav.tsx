"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  FiActivity,
  FiCreditCard,
  FiGrid,
  FiHelpCircle,
  FiHome,
  FiLayers,
  FiTool,
  FiUser,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { useNotificationStore } from "@/store/useNotificationStore";
import useAuth from "@/hooks/useAuth";
import useActiveContext from "@/hooks/useActiveContext";
import { getSocket } from "@/services/socket";
import {
  deriveFooterBadges,
  eventIndicatesAttention,
  eventScope,
  isInActiveScope,
  markViewedLocal,
  notificationText,
  scopeMatches,
  type BadgeScope,
  type FooterBadgeKey,
} from "@/lib/footerBadges";

type Item = {
  key: "home" | "spaces" | "activity" | "community" | "devices" | "visitors" | "maintenance" | "services" | "wallet" | "profile";
  label: string;
  href: string;
  icon: any;
  activeRoutes?: string[];
};

const ITEMS: Item[] = [
  { key: "home", label: "Home", href: "/home", icon: FiHome },
  { key: "spaces", label: "Spaces", href: "/spaces", icon: FiLayers, activeRoutes: ["/spaces", "/rooms", "/room"] },
  { key: "devices", label: "Devices", href: "/devices", icon: FiGrid, activeRoutes: ["/devices"] },
  { key: "community", label: "Community", href: "/community", icon: FiUsers },
  { key: "activity", label: "Activity", href: "/activity", icon: FiActivity, activeRoutes: ["/activity", "/notifications"] },
  { key: "visitors", label: "Visitors", href: "/visitors", icon: FiUserCheck, activeRoutes: ["/visitors"] },
  { key: "wallet", label: "Wallet", href: "/wallet", icon: FiCreditCard, activeRoutes: ["/wallet"] },
  { key: "maintenance", label: "Maint.", href: "/maintenance", icon: FiTool, activeRoutes: ["/maintenance", "/reports"] },
  { key: "services", label: "Services", href: "/services", icon: FiHelpCircle, activeRoutes: ["/services"] },
  { key: "profile", label: "Profile", href: "/profile", icon: FiUser, activeRoutes: ["/profile", "/account", "/settings"] },
];

const NAV_GROUPS: Item[][] = [
  ITEMS.filter((item) => ["home", "spaces", "devices", "community", "activity"].includes(item.key)),
  ITEMS.filter((item) => ["visitors", "wallet", "maintenance", "services", "profile"].includes(item.key)),
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

function hasBadge(value: { count: number; dot: boolean }) {
  return value.count > 0 || value.dot;
}

function eventBucket(eventName: string, payload: any): FooterBadgeKey {
  const text = `${eventName} ${notificationText(payload)}`.toLowerCase();
  if (/community|post|comment|notice|announcement/.test(text)) return "community";
  if (/visitor|guest|gate|access/.test(text)) return "visitors";
  if (/maintenance|repair|ticket/.test(text)) return "maintenance";
  if (/wallet|payment|transaction/.test(text)) return "wallet";
  if (/service/.test(text)) return "services";
  if (/space|room/.test(text)) return "spaces";
  if (/device|switch|light|socket|plug|climate|ac|tv|provider|sync/.test(text)) return "devices";
  if (/profile|verification|account/.test(text)) return "profile";
  return "activity";
}

export default function BottomNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { user } = useAuth();
  const activeContext = useActiveContext();
  const railRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const collapseTimerRef = useRef<number | null>(null);
  const scrollIntentResetRef = useRef<number | null>(null);
  const collapsedRef = useRef(false);
  const lastScrollY = useRef(0);
  const lastCollapseChangeAt = useRef(0);
  const scrollIntent = useRef(0);
  const notifications = useNotificationStore((state) => state.items);
  const markBucketViewed = useNotificationStore((state) => state.markBucketViewed);
  const markNotificationsRead = useNotificationStore((state) => state.markNotificationsRead);
  const scope = useMemo<BadgeScope>(() => ({ userId: (user as any)?.id || null, estateId: activeContext.estate_id, homeId: activeContext.home_id }), [user, activeContext.estate_id, activeContext.home_id]);
  const scopeKey = useMemo(() => `${scope.userId || "user"}:${scope.estateId || "estate"}:${scope.homeId || "home"}`, [scope]);
  const [localDots, setLocalDots] = useState<Partial<Record<FooterBadgeKey, boolean>>>({});
  const [collapsed, setCollapsed] = useState(false);
  const storageKey = useMemo(() => `oyi:footer-nav-page:${scopeKey}:v2`, [scopeKey]);
  const activeItem = useMemo(() => ITEMS.find((item) => isActive(pathname, item)), [pathname]);
  const initialPage = useMemo(() => (activeItem ? pageForKey(activeItem.key) : 0), [activeItem]);
  const [, setPage] = useState(initialPage);
  const avatarUrl = String((user as any)?.profile_image_url || (user as any)?.avatar_url || (user as any)?.photo_url || (user as any)?.profile_image || "").trim();

  const badges = useMemo(() => deriveFooterBadges(notifications, scope, localDots), [notifications, scope, localDots]);

  function persistPage(nextPage: number) {
    const bounded = Math.max(0, Math.min(NAV_GROUPS.length - 1, nextPage));
    setPage(bounded);
    try { localStorage.setItem(storageKey, String(bounded)); } catch {}
  }

  function scrollToPage(nextPage: number, behavior: ScrollBehavior = "smooth") {
    const bounded = Math.max(0, Math.min(NAV_GROUPS.length - 1, nextPage));
    const rail = railRef.current;
    if (rail) rail.scrollTo({ left: bounded * rail.clientWidth, behavior });
    persistPage(bounded);
  }

  function clearMatchingNotifications(bucket: FooterBadgeKey) {
    markBucketViewed(bucket);
    if (bucket === "activity") markBucketViewed("messages");
    const ids = notifications
      .filter((notification) => isInActiveScope(notification, scope, { allowUnscoped: bucket === "profile", profileGlobal: bucket === "profile" }))
      .filter((notification) => {
        const text = notificationText(notification);
        if (bucket === "devices") return /device|switch|light|socket|plug|climate|ac|tv|provider|sync|offline|failed/.test(text);
        if (bucket === "spaces") return /space|room/.test(text);
        if (bucket === "community") return /community|announcement|notice|post|comment|reply|official/.test(text);
        if (bucket === "visitors") return /visitor|guest|gate|access/.test(text);
        if (bucket === "maintenance") return /maintenance|repair|work order|ticket/.test(text);
        if (bucket === "wallet") return /wallet|payment|transaction|billing|dues|fund/.test(text);
        if (bucket === "services") return /service|concierge|booking|request/.test(text);
        if (bucket === "profile") return /profile|verify|verification|account|setup|invite/.test(text);
        return bucket === "activity";
      })
      .map((notification) => String(notification.id || ""))
      .filter(Boolean);
    if (ids.length) markNotificationsRead(ids);
  }

  function clearLocalDot(bucket: FooterBadgeKey) {
    setLocalDots((current) => ({ ...current, [bucket]: false }));
    clearMatchingNotifications(bucket);
    markViewedLocal(scope, bucket);
  }

  const setCollapsedStable = useCallback((next: boolean) => {
    if (collapsedRef.current === next) return;
    const now = Date.now();
    const apply = () => {
      collapsedRef.current = next;
      lastCollapseChangeAt.current = Date.now();
      setCollapsed(next);
    };
    if (now - lastCollapseChangeAt.current < 140) {
      if (collapseTimerRef.current) window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = window.setTimeout(apply, 140);
      return;
    }
    apply();
  }, []);

  useEffect(() => {
    setLocalDots({});
    let nextPage = initialPage;
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (Number.isFinite(saved)) nextPage = Math.max(0, Math.min(NAV_GROUPS.length - 1, saved));
    } catch {}
    window.setTimeout(() => scrollToPage(nextPage, "auto"), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!activeItem) return;
    clearLocalDot(activeItem.key as FooterBadgeKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, scopeKey]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !activeContext.ready) return;
    const makeHandler = (eventName: string) => (payload: any) => {
      const incomingScope = eventScope(payload);
      if (!scopeMatches(incomingScope, scope, { allowUnscoped: false })) return;
      const bucket = eventBucket(eventName, payload);
      if (!eventIndicatesAttention(eventName, payload, bucket)) return;
      if (activeItem?.key === bucket) return;
      setLocalDots((current) => ({ ...current, [bucket]: true, activity: bucket === "activity" ? current.activity : true }));
    };
    const events = ["notification:new", "audit.recorded", "community.updated", "device.status.updated", "device.registry.updated", "visitor.updated", "visitor.created", "maintenance.updated", "wallet.updated", "service.updated", "security.alert", "utility.telemetry.updated", "watch.sync.updated"];
    const handlers = events.map((eventName) => ({ eventName, handler: makeHandler(eventName) }));
    handlers.forEach(({ eventName, handler }) => socket.on(eventName, handler));
    return () => handlers.forEach(({ eventName, handler }) => socket.off(eventName, handler));
  }, [activeContext.ready, activeContext.contextKey, scope, activeItem?.key]);

  useEffect(() => {
    const onScroll = (event: Event) => {
      const target = event.target as HTMLElement | Document | null;
      const element = target && "scrollTop" in target ? (target as HTMLElement) : document.scrollingElement || document.documentElement;
      const y = Number(element?.scrollTop || window.scrollY || 0);
      const diff = y - lastScrollY.current;
      if (Math.abs(diff) < 8) return;
      if (y < 28) {
        scrollIntent.current = 0;
        setCollapsedStable(false);
        lastScrollY.current = y;
        return;
      }

      if (scrollIntentResetRef.current) window.clearTimeout(scrollIntentResetRef.current);
      scrollIntentResetRef.current = window.setTimeout(() => {
        scrollIntent.current = 0;
      }, 140);

      if (diff > 0) {
        scrollIntent.current = Math.max(0, scrollIntent.current) + diff;
        if (scrollIntent.current > 42) {
          setCollapsedStable(true);
          scrollIntent.current = 0;
        }
      } else {
        scrollIntent.current = Math.min(0, scrollIntent.current) + diff;
        if (scrollIntent.current < -34) {
          setCollapsedStable(false);
          scrollIntent.current = 0;
        }
      }
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      if (collapseTimerRef.current) window.clearTimeout(collapseTimerRef.current);
      if (scrollIntentResetRef.current) window.clearTimeout(scrollIntentResetRef.current);
      window.removeEventListener("scroll", onScroll, { capture: true } as any);
      document.removeEventListener("scroll", onScroll, { capture: true } as any);
    };
  }, [setCollapsedStable]);

  function handlePageScroll() {
    const rail = railRef.current;
    if (!rail) return;
    if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      const nextPage = Math.round(rail.scrollLeft / Math.max(1, rail.clientWidth));
      scrollToPage(nextPage, "smooth");
    }, 90);
  }

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-[95] px-3 transition-all duration-300 ease-out" style={{ paddingBottom: "calc(8px + var(--sab))" }} aria-label="Oyi Home navigation">
      <div className={`pointer-events-auto mx-auto overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#040911]/86 px-2 shadow-[0_16px_54px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition-all duration-300 ease-out ${collapsed ? "w-[70vw] max-w-[310px] py-1" : "w-[92vw] max-w-[430px] py-1.5"}`}>
        <div ref={railRef} onScroll={handlePageScroll} className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV_GROUPS.map((group, groupIndex) => {
            const activeIndex = group.findIndex((item) => isActive(pathname, item));
            return (
              <div key={groupIndex} className="relative grid w-full min-w-full shrink-0 snap-center grid-cols-5 gap-1 px-0.5">
                {activeIndex >= 0 ? (
                  <span
                    className={`absolute bottom-1 top-1 rounded-[22px] border border-white/[0.105] bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.18),rgba(56,189,248,0.14)_42%,rgba(255,255,255,0.055)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_0_26px_rgba(56,189,248,0.24),0_10px_26px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? "mx-[8px]" : "mx-[3px]"}`}
                    style={{ width: "20%", transform: `translateX(${activeIndex * 100}%)` }}
                  />
                ) : null}
                {group.map((item) => {
                  const active = isActive(pathname, item);
                  const Icon = item.icon;
                  const badge = hasBadge(badges[item.key as FooterBadgeKey] || { count: 0, dot: false });
                  const isProfile = item.key === "profile";
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        scrollToPage(pageForKey(item.key));
                        clearLocalDot(item.key as FooterBadgeKey);
                        router.push(item.href);
                      }}
                      className={`group relative z-10 rounded-[21px] px-1.5 text-center transition-all duration-300 active:scale-[0.98] ${collapsed ? "py-1" : "py-1.5"} ${active ? "text-white" : "text-white/46 hover:text-white/78"}`}
                      aria-current={active ? "page" : undefined}
                    >
                      <div className="flex justify-center">
                        <span className={`relative grid place-items-center overflow-visible rounded-[13px] transition-all duration-300 ${collapsed ? "h-9 w-9" : "h-7 w-7"} ${active ? "text-sky-100" : "text-white/52 group-hover:text-white/78"}`}>
                          {isProfile && avatarUrl ? <img src={avatarUrl} alt="Profile" className="h-6 w-6 rounded-full object-cover ring-1 ring-white/15" /> : <Icon className={collapsed ? "text-[19px]" : "text-[18px]"} />}
                          {badge ? <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.8)]" /> : null}
                        </span>
                      </div>
                      <div className={`mt-0.5 truncate whitespace-nowrap text-[10px] font-medium tracking-[-0.025em] transition-all duration-300 ${collapsed ? "max-h-0 translate-y-1 opacity-0" : "max-h-4 translate-y-0 opacity-100"} ${active ? "text-white" : "text-white/48"}`}>{item.label}</div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
