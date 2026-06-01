// src/app/home/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  Check,
  Leaf,
  Lightbulb,
  MessageCircle,
  Moon,
  Plug,
  ShieldCheck,
  Thermometer,
  Users,
  Wallet,
  Watch,
  Wrench,
  X,
} from "lucide-react";

import LayoutWrapper from "../components/LayoutWrapper";
import InviteSuggestionBridge from "../components/InviteSuggestionBridge";
import NotificationsBridge from "../components/NotificationsBridge";
import HamburgerMenu from "../components/HamburgerMenu";
import MessagesInboxButton from "../components/MessagesInboxButton";
import BottomNav from "../components/BottomNav";
import { getDeviceIcon, getDeviceIconTone } from "@/lib/devicePresentation";

import { deviceService } from "../../services/deviceService";
import { walletService } from "@/services/walletService";
import { visitorService, type VisitorAccess } from "@/services/visitorService";
import {
  communityService,
  type CommunityPost,
} from "@/services/communityService";
import {
  maintenanceService,
  type MaintenanceTicket,
} from "@/services/maintenanceService";
import {
  listMyNotifications,
  type AppNotification,
} from "@/services/notificationsService";
import messagesService from "@/services/messagesService";
import { describeOyiWatchStatus, getOyiWatchSyncStatus } from "@/services/watchSyncService";
import useActiveContext, { type AvailableHomeContext } from "@/hooks/useActiveContext";
import useAuth from "../../hooks/useAuth";

function isOnline(device: any) {
  if (typeof device?.online === "boolean") return device.online;
  const status = String(device?.status || device?.state || "").toLowerCase();
  return (
    status.includes("online") ||
    status.includes("active") ||
    status.includes("connected") ||
    status === "on"
  );
}

function asArray<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.devices)) return value.devices;
  if (Array.isArray(value?.requests)) return value.requests;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function getGreetingPeriod() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function QuickControl({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "gold" | "sky" | "emerald" | "violet";
  onClick: () => void;
}) {
  const tones = {
    gold: "from-amber-300/22 text-amber-200 shadow-[0_0_28px_rgba(251,191,36,0.22)]",
    sky: "from-sky-300/22 text-sky-200 shadow-[0_0_28px_rgba(56,189,248,0.22)]",
    emerald:
      "from-emerald-300/22 text-emerald-200 shadow-[0_0_28px_rgba(52,211,153,0.22)]",
    violet:
      "from-violet-300/22 text-violet-200 shadow-[0_0_28px_rgba(168,85,247,0.22)]",
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-[138px] shrink-0 snap-start rounded-[24px] border border-white/[0.06] bg-[linear-gradient(145deg,rgba(255,255,255,0.045),rgba(255,255,255,0.014))] p-3.5 text-left shadow-[0_14px_42px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition hover:border-white/12 hover:bg-white/[0.055] active:scale-[0.985]"
    >
      <span
        className={`grid h-11 w-11 place-items-center rounded-full bg-gradient-to-b ${tones[tone]} to-transparent transition group-active:scale-95`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="mt-4 block text-[15px] font-semibold tracking-[-0.035em] text-white">
        {label}
      </span>
      <span className="mt-0.5 block text-[13px] text-white/48">{value}</span>
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { user, token, ready } = useAuth() as any;
  const activeContext = useActiveContext();

  const [assignedDevices, setAssignedDevices] = useState<any[]>([]);
  const [devicesBusy, setDevicesBusy] = useState(false);
  const [devicesErr, setDevicesErr] = useState<string | null>(null);
  const [deviceCommandBusy, setDeviceCommandBusy] = useState<string | null>(
    null,
  );

  const [visitors, setVisitors] = useState<VisitorAccess[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceTicket[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [messageUnread, setMessageUnread] = useState<number | null>(null);
  const [watchLabel, setWatchLabel] = useState("Unavailable");
  const [contextOpen, setContextOpen] = useState(false);
  const [contextSwitching, setContextSwitching] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [dashBusy, setDashBusy] = useState(false);
  const [dashErr, setDashErr] = useState<string | null>(null);
  const [quickPage, setQuickPage] = useState(0);
  const quickControlsRef = useRef<HTMLDivElement | null>(null);

  const estateId = useMemo(() => {
    const fromContext = activeContext.estate_id;
    const fromUser = (user as any)?.estate_id || (user as any)?.estateId;
    if (fromContext) return String(fromContext);
    if (fromUser) return String(fromUser);
    if (typeof window !== "undefined") {
      return (
        window.localStorage.getItem("oyi_estate_id") ||
        window.localStorage.getItem("estate_id") ||
        window.localStorage.getItem("ochiga_estate") ||
        ""
      );
    }
    return "";
  }, [activeContext.estate_id, user]);

  const homeId = useMemo(() => {
    const fromContext = activeContext.home_id;
    const fromUser = (user as any)?.home_id || (user as any)?.homeId;
    if (fromContext) return String(fromContext);
    if (fromUser) return String(fromUser);
    if (typeof window !== "undefined") {
      return (
        window.localStorage.getItem("oyi_home_id") ||
        window.localStorage.getItem("home_id") ||
        window.localStorage.getItem("ochiga_home") ||
        ""
      );
    }
    return "";
  }, [activeContext.home_id, user]);

  async function refreshDevicePanelData() {
    if (!token) return;
    setDevicesBusy(true);
    setDevicesErr(null);
    try {
      const assigned = await deviceService.getAssignedDevices(estateId);
      setAssignedDevices(asArray(assigned).filter((device) => String(device?.home_id || "") === String(homeId || "")));
    } catch (err: any) {
      setDevicesErr(err?.message || "Device sync unavailable");
    } finally {
      setDevicesBusy(false);
    }
  }

  async function refreshDashboardData() {
    if (!token) return;
    setDashBusy(true);
    setDashErr(null);
    try {
      const [visitorRes, communityRes, maintenanceRes, notificationRes, walletRes, messagesRes, watchRes] =
        await Promise.allSettled([
          visitorService.listMine(),
          estateId ? communityService.listByEstate(estateId) : Promise.resolve([]),
          maintenanceService.listMyTickets(),
          listMyNotifications(),
          walletService.getWallet().catch(() => null),
          messagesService.listInbox(),
          getOyiWatchSyncStatus().catch(() => null),
        ]);

      if (visitorRes.status === "fulfilled") setVisitors(asArray<VisitorAccess>(visitorRes.value));
      if (communityRes.status === "fulfilled") setCommunityPosts(asArray<CommunityPost>(communityRes.value));
      if (maintenanceRes.status === "fulfilled") setMaintenance(asArray<MaintenanceTicket>(maintenanceRes.value));
      if (notificationRes.status === "fulfilled") {
        setNotifications(asArray<AppNotification>(notificationRes.value));
      }
      if (walletRes.status === "fulfilled" && walletRes.value) {
        const balance =
          Number((walletRes.value as any)?.balance ?? (walletRes.value as any)?.amount ?? 0) || 0;
        setWalletBalance(balance);
      }
      if (messagesRes.status === "fulfilled") {
        const total = asArray<any>(messagesRes.value).reduce(
          (sum, thread) => sum + Number(thread?.unread_count || 0),
          0,
        );
        setMessageUnread(total);
      }
      if (watchRes.status === "fulfilled") {
        const value = watchRes.value as any;
        setWatchLabel(value ? describeOyiWatchStatus(value) : "Unavailable");
      }
    } catch (err: any) {
      setDashErr(err?.message || "Home context sync unavailable");
    } finally {
      setDashBusy(false);
    }
  }

  useEffect(() => {
    if (!ready || !token) return;
    refreshDevicePanelData();
    refreshDashboardData();
  }, [ready, token, estateId, homeId]);

  const canMountAuthedBridges = !!ready && !!token;

  const favoriteDevices = useMemo(() => {
    return assignedDevices
      .filter((device) => {
        const type = String(
          device?.device_type || device?.type || device?.category || "",
        ).toLowerCase();
        return (
          type.includes("light") ||
          type.includes("switch") ||
          type.includes("socket") ||
          type.includes("climate") ||
          type.includes("ac")
        );
      })
      .slice(0, 6);
  }, [assignedDevices]);

  function pickDeviceId(device: any) {
    return String(
      device?.id ||
        device?.device_id ||
        device?.external_id ||
        device?.tuya_device_id ||
        device?.name ||
        "",
    );
  }

  async function toggleFavoriteDevice(device: any) {
    const deviceId = pickDeviceId(device);
    if (!deviceId || deviceCommandBusy) return;
    const currentlyOn = isOnline(device);
    setDeviceCommandBusy(deviceId);
    try {
      await deviceService.commandDevice(deviceId, { switch: !currentlyOn });
      setAssignedDevices((items) =>
        items.map((item) =>
          pickDeviceId(item) === deviceId
            ? { ...item, online: !currentlyOn, status: !currentlyOn ? "online" : "off" }
            : item,
        ),
      );
    } finally {
      setDeviceCommandBusy(null);
      refreshDevicePanelData();
    }
  }

  function handleQuickScroll() {
    const el = quickControlsRef.current;
    if (!el) return;
    const scrollable = Math.max(1, el.scrollWidth - el.clientWidth);
    const progress = el.scrollLeft / scrollable;
    setQuickPage(Math.max(0, Math.min(2, Math.round(progress * 2))));
  }

  function contextLabel(ctx: AvailableHomeContext) {
    return (
      String(ctx.home_name || "").trim() ||
      [ctx.block, ctx.unit].map((part) => String(part || "").trim()).filter(Boolean).join(" / ") ||
      String(ctx.estate_name || "").trim() ||
      "Home"
    );
  }

  async function selectHomeContext(ctx: AvailableHomeContext) {
    setContextSwitching(true);
    setContextError(null);
    try {
      const result = await activeContext.selectContext(ctx);
      if (!(result as any)?.ok) {
        setContextError("Saved locally. Backend context switch needs validation.");
      } else {
        setContextOpen(false);
      }
      await Promise.all([refreshDevicePanelData(), refreshDashboardData()]);
    } finally {
      setContextSwitching(false);
    }
  }

  const homeLabel = [activeContext.home?.block, activeContext.home?.unit]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" / ");
  const estateName = String(
    activeContext.home?.name ||
      homeLabel ||
      activeContext.estate?.name ||
      (user as any)?.home_name ||
      (user as any)?.estate_name ||
      "No active home linked yet",
  );
  const rawName = String(
    (user as any)?.full_name ||
      (user as any)?.name ||
      (user as any)?.first_name ||
      (user as any)?.username ||
      (user as any)?.email?.split("@")[0] ||
      "Oyi",
  ).trim();
  const greetingName = rawName.split(" ")[0] || "Oyi";
  const greetingPeriod = getGreetingPeriod();
  const walletLabel =
    walletBalance === null
      ? "Ready"
      : `₦${walletBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const activeVisitors = visitors.filter((visitor) =>
    ["pending", "approved", "active", "arrived"].includes(
      String((visitor as any).status || "").toLowerCase(),
    ),
  ).length;
  const openMaintenance = maintenance.filter((ticket) =>
    !["closed", "resolved", "completed"].includes(
      String((ticket as any).status || "").toLowerCase(),
    ),
  ).length;
  const unread = notifications.filter((item) => item.status !== "read").length;
  const totalVisibleDevices = assignedDevices.length;
  const activeDevices = assignedDevices.filter(isOnline).length;
  const homeState = dashErr ? "Needs attention" : unread || openMaintenance ? "Aware" : "Calm";
  const securityState = activeVisitors ? `${activeVisitors} visitor${activeVisitors > 1 ? "s" : ""}` : "Protected";
  const supportLine = dashBusy
    ? "Syncing your home state."
    : dashErr
      ? "Some home signals need a refresh."
      : unread
        ? `${unread} update${unread > 1 ? "s" : ""} waiting quietly.`
        : "Everything is under control.";
  const deviceStateLabel = devicesBusy
    ? "Syncing"
    : devicesErr
      ? "Needs sync"
      : totalVisibleDevices
        ? `${activeDevices} On`
        : "Ready";
  const messagesLabel =
    messageUnread === null ? "Unavailable" : messageUnread > 0 ? `${messageUnread} unread` : "No unread";
  const maintenanceLabel = openMaintenance ? `${openMaintenance} open` : "None open";
  const communityLabel = communityPosts.length ? `${communityPosts.length} update${communityPosts.length > 1 ? "s" : ""}` : "No updates";
  const visitorLabel = activeVisitors ? `${activeVisitors} active` : "0 active";
  const homeStateItems = [
    {
      label: "Atmosphere",
      value: homeState,
      href: "/activity",
      Icon: Leaf,
      iconClass: "text-sky-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.70)]",
    },
    {
      label: "Security",
      value: securityState,
      href: "/security",
      Icon: ShieldCheck,
      iconClass: "text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.66)]",
    },
    {
      label: "Wallet",
      value: walletLabel,
      href: "/wallet",
      Icon: Wallet,
      iconClass: "text-violet-300 drop-shadow-[0_0_12px_rgba(168,85,247,0.68)]",
    },
    {
      label: "Visitors",
      value: visitorLabel,
      href: "/visitors",
      Icon: Users,
      iconClass: "text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.55)]",
    },
    {
      label: "Community",
      value: communityLabel,
      href: "/community",
      Icon: MessageCircle,
      iconClass: "text-blue-300 drop-shadow-[0_0_12px_rgba(96,165,250,0.58)]",
    },
    {
      label: "Devices",
      value: totalVisibleDevices ? `${activeDevices}/${totalVisibleDevices} online` : "No devices",
      href: "/devices",
      Icon: Plug,
      iconClass: "text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.55)]",
    },
    {
      label: "Messages",
      value: messagesLabel,
      href: "/messages",
      Icon: MessageCircle,
      iconClass: "text-sky-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.62)]",
    },
    {
      label: "Maintenance",
      value: maintenanceLabel,
      href: "/maintenance",
      Icon: Wrench,
      iconClass: "text-orange-300 drop-shadow-[0_0_12px_rgba(251,146,60,0.55)]",
    },
    {
      label: "Watch",
      value: watchLabel,
      href: "/profile",
      Icon: Watch,
      iconClass: "text-white/72 drop-shadow-[0_0_12px_rgba(255,255,255,0.22)]",
    },
  ];

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 isolate min-h-0 overflow-hidden bg-[#02060b] text-white">
        <div className="oyi-ambient-bg" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(0,132,255,0.14),transparent_31%),radial-gradient(circle_at_50%_55%,rgba(0,92,185,0.08),transparent_33%),linear-gradient(180deg,rgba(4,12,22,0.2),rgba(0,0,0,0.92))]" />
        <div className="pointer-events-none absolute inset-x-10 top-[18%] h-[42%] rounded-full bg-sky-500/[0.028] blur-3xl" />

        <div
          className="pointer-events-none fixed inset-x-0 z-[80] px-5"
          style={{ top: "calc(10px + var(--sat))" }}
        >
          {canMountAuthedBridges ? (
            <>
              <InviteSuggestionBridge />
              <NotificationsBridge />
            </>
          ) : null}
          <div className="pointer-events-auto mx-auto flex max-w-[430px] items-center justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/[0.03] shadow-[0_10px_32px_rgba(0,0,0,0.30)] backdrop-blur-2xl">
              <HamburgerMenu />
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/[0.028] shadow-[0_10px_32px_rgba(0,0,0,0.30)] backdrop-blur-2xl">
              <MessagesInboxButton />
            </div>
          </div>
        </div>

        <div
          className="absolute inset-x-0 overflow-y-auto px-5"
          style={{
            zIndex: 20,
            top: "calc(58px + var(--sat))",
            bottom: "calc(80px + var(--sab))",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className="oyi-living-page oyi-page-fade mx-auto max-w-[430px] pb-5 transition duration-300">
            <motion.section
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <h1 className="mt-5 text-[26px] font-semibold leading-tight tracking-[-0.04em] text-white sm:text-[30px]">
                Good {greetingPeriod}, {greetingName}
              </h1>
              <button
                type="button"
                onClick={() => setContextOpen(true)}
                className="mx-auto mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[16px] font-medium text-white/54 transition hover:bg-white/[0.04] active:scale-[0.99]"
              >
                <span>{estateName}</span>
                <ChevronDown className="h-4 w-4 text-white/58" />
              </button>

              <button
                type="button"
                onClick={() => router.push("/ai")}
                aria-label="Open Oyi intelligence"
                className="group relative mx-auto mt-6 grid h-[166px] w-[166px] place-items-center rounded-full transition active:scale-[0.985] sm:h-[182px] sm:w-[182px]"
              >
                <span className="absolute inset-[-20px] rounded-full bg-sky-500/9 blur-2xl transition group-active:bg-sky-400/14" />
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-[-6px] rounded-full border border-sky-300/45"
                  animate={{ opacity: [0.45, 0.9, 0.45], scale: [0.98, 1.035, 0.98] }}
                  transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
                />
                <span className="absolute inset-0 rounded-full border border-sky-300/68 bg-[radial-gradient(circle_at_42%_28%,rgba(255,255,255,0.18),transparent_15%),radial-gradient(circle_at_50%_58%,rgba(22,111,255,0.38),rgba(2,7,14,0.95)_68%)] shadow-[inset_0_0_34px_rgba(255,255,255,0.05),0_0_36px_rgba(0,132,255,0.46),0_30px_66px_rgba(0,0,0,0.55)]" />
                <span className="absolute -bottom-7 h-10 w-[74%] rounded-[100%] bg-sky-500/16 blur-xl" />
                <span className="relative text-[36px] font-semibold tracking-[-0.08em] text-white sm:text-[40px]">
                  Oyi
                </span>
              </button>

              <div className="mt-10">
                <div className="text-[28px] font-semibold leading-none tracking-[-0.05em] text-white sm:text-[32px]">
                  Home is {homeState.toLowerCase()}.
                </div>
                <p className="mt-2.5 text-[15px] leading-5 text-white/54 sm:text-[16px]">
                  {supportLine}
                </p>
              </div>
            </motion.section>

            <motion.section
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.48, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 overflow-hidden rounded-[24px] border border-white/[0.06] bg-[linear-gradient(145deg,rgba(255,255,255,0.043),rgba(255,255,255,0.014))] px-2.5 py-3 shadow-[0_16px_52px_rgba(0,0,0,0.30)] backdrop-blur-2xl"
            >
              <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth">
                {homeStateItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => router.push(item.href)}
                    className="flex min-w-[118px] snap-start items-center justify-center gap-2 rounded-[18px] px-2.5 py-1.5 text-left transition hover:bg-white/[0.045] active:scale-[0.99]"
                  >
                    <item.Icon className={`h-5 w-5 ${item.iconClass}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] text-white/42">{item.label}</span>
                      <span className="block truncate text-[12px] font-semibold text-white">{item.value}</span>
                    </span>
                  </button>
                ))}
              </div>
            </motion.section>

            <motion.section
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.48, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6"
            >
              <div className="mb-3.5 flex items-center justify-between">
                <h2 className="text-[18px] font-medium tracking-[-0.04em] text-white/76">Quick controls</h2>
                <button
                  type="button"
                  onClick={() => router.push("/devices")}
                  className="text-[14px] font-medium text-sky-300 transition hover:text-sky-200 active:scale-[0.98]"
                >
                  Edit
                </button>
              </div>
              <div
                ref={quickControlsRef}
                onScroll={handleQuickScroll}
                className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 scroll-smooth"
              >
                <QuickControl
                  icon={Lightbulb}
                  label="Lights"
                  value={deviceStateLabel}
                  tone="gold"
                  onClick={() => router.push("/devices")}
                />
                <QuickControl
                  icon={Thermometer}
                  label="Climate"
                  value="24° Cool"
                  tone="sky"
                  onClick={() => router.push("/utilities")}
                />
                <QuickControl
                  icon={ShieldCheck}
                  label="Security"
                  value={securityState}
                  tone="emerald"
                  onClick={() => router.push("/security")}
                />
                <QuickControl
                  icon={Moon}
                  label="Scenes"
                  value="Scenes"
                  tone="violet"
                  onClick={() => router.push("/scenes")}
                />
              </div>

              <div className="mt-3.5 flex justify-center gap-1.5" aria-hidden="true">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      quickPage === dot
                        ? "w-4 bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.85)]"
                        : "w-1.5 bg-white/13"
                    }`}
                  />
                ))}
              </div>
            </motion.section>

            {favoriteDevices.length ? (
              <section className="mt-5 rounded-[24px] border border-white/[0.055] bg-white/[0.02] p-2.5 backdrop-blur-2xl">
                <div className="flex gap-2 overflow-x-auto">
                  {favoriteDevices.map((device) => {
                    const deviceId = pickDeviceId(device);
                    const online = isOnline(device);
                    const busy = deviceCommandBusy === deviceId;
                    const Icon = getDeviceIcon(device);
                    const tone = getDeviceIconTone(device);
                    return (
                      <button
                        key={deviceId || device?.name}
                        type="button"
                        disabled={busy}
                        onClick={() => toggleFavoriteDevice(device)}
                        className="min-w-[118px] rounded-[20px] border border-white/[0.055] bg-black/16 px-3 py-3 text-left transition hover:bg-white/[0.04] disabled:opacity-60 active:scale-[0.98]"
                      >
                        <span className={`grid h-8 w-8 place-items-center rounded-full border ${tone}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="mt-3 block truncate text-[13px] font-semibold text-white/82">
                          {device?.name || device?.label || "Device"}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-white/40">
                          {busy ? "Working" : online ? "On" : "Off"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : devicesBusy ? (
              <section className="mt-8 rounded-[28px] border border-white/[0.07] bg-white/[0.025] p-5 text-sm text-white/48 backdrop-blur-2xl">
                Syncing favorite controls…
              </section>
            ) : devicesErr ? (
              <section className="mt-8 rounded-[28px] border border-amber-300/16 bg-amber-300/[0.07] p-5 text-sm text-amber-100/78 backdrop-blur-2xl">
                {devicesErr}
              </section>
            ) : null}
          </div>
        </div>


        {contextOpen ? (
          <div className="fixed inset-0 z-[115] flex items-end justify-center bg-black/42 px-4 pb-[calc(18px+var(--sab))] backdrop-blur-md sm:items-center sm:pb-4">
            <button
              type="button"
              className="absolute inset-0"
              aria-label="Close home selector"
              onClick={() => setContextOpen(false)}
            />
            <div className="relative w-full max-w-[390px] overflow-hidden rounded-[30px] border border-white/[0.09] bg-[#050a12]/92 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.62)] backdrop-blur-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-sky-100/48">Home context</div>
                  <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.04em] text-white">Choose your home</h2>
                  <p className="mt-1 text-xs text-white/45">Only linked homes are shown.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setContextOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-white/50 transition hover:bg-white/[0.1]"
                  aria-label="Close home selector"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 max-h-[48vh] space-y-2 overflow-y-auto pr-1">
                {activeContext.loading ? (
                  <div className="rounded-[22px] border border-white/[0.07] bg-white/[0.035] p-4 text-sm text-white/52">
                    Loading linked homes…
                  </div>
                ) : activeContext.available_contexts.length ? (
                  activeContext.available_contexts.map((ctx) => {
                    const active = String(ctx.home_id) === String(activeContext.home_id) && String(ctx.estate_id) === String(activeContext.estate_id);
                    return (
                      <button
                        key={`${ctx.estate_id}:${ctx.home_id}`}
                        type="button"
                        disabled={contextSwitching}
                        onClick={() => selectHomeContext(ctx)}
                        className={`w-full rounded-[22px] border px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-60 ${
                          active
                            ? "border-sky-300/30 bg-sky-400/[0.105] shadow-[0_0_26px_rgba(56,189,248,0.16)]"
                            : "border-white/[0.07] bg-white/[0.035] hover:bg-white/[0.055]"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-semibold text-white">{contextLabel(ctx)}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-white/42">{ctx.estate_name || "Estate"}</span>
                          </span>
                          {active ? <Check className="h-4 w-4 shrink-0 text-sky-200" /> : null}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-[22px] border border-white/[0.07] bg-white/[0.035] p-4 text-sm text-white/52">
                    No active home linked yet.
                  </div>
                )}
              </div>
              {contextError ? <p className="mt-3 text-xs text-amber-100/70">{contextError}</p> : null}
            </div>
          </div>
        ) : null}

        <BottomNav />
      </main>
    </LayoutWrapper>
  );
}
