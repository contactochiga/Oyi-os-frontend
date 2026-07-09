// src/app/home/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  Check,
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
import HamburgerMenu from "../components/HamburgerMenu";
import MessagesInboxButton from "../components/MessagesInboxButton";
import BottomNav from "../components/BottomNav";
import OyiContextRail from "../components/OyiContextRail";
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
import { sceneService, type ConsumerScene } from "@/services/sceneService";
import { intelligenceService, type IntelligenceMetricSummary } from "@/services/intelligenceService";
import { oyiService, type OyiAwareness } from "@/services/oyiService";
import useActiveContext, { type AvailableHomeContext } from "@/hooks/useActiveContext";
import useAuth from "../../hooks/useAuth";
import { useRuntimeIntelligenceStore } from "@/store/useRuntimeIntelligenceStore";
import { awarenessFromBackend, awarenessFromRuntimeSignal, dedupeAwareness, type ConsumerAwarenessItem } from "@/lib/consumerAwareness";

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

function isUnavailable(device: any) {
  if (typeof device?.online === "boolean") return !device.online;
  const status = String(device?.status || "").toLowerCase();
  return status.includes("offline") || status.includes("unavailable") || status.includes("inactive") || status.includes("lost");
}

function isSimpleFavorite(device: any) {
  const type = String(device?.device_type || device?.type || device?.category || "").toLowerCase();
  return /light|switch|socket|plug|bulb|lamp/.test(type);
}

function favoritePreference(device: any) {
  const values = [
    device?.favorite,
    device?.is_favorite,
    device?.pinned,
    device?.metadata?.favorite,
    device?.metadata?.is_favorite,
    device?.metadata?.pinned,
  ];
  return values.find((value) => typeof value === "boolean");
}

function proximityStateLabel(value: any) {
  const text = String(value || "").toLowerCase();
  if (/leaving/.test(text)) return "leaving_home";
  if (/approach/.test(text)) return "approaching_estate";
  if (/near.*estate|inside.*estate/.test(text)) return "near_estate";
  if (/near.*home/.test(text)) return "near_home";
  if (/away/.test(text)) return "away";
  return "";
}

function readFavoritePower(device: any) {
  const raw = device?.switch ?? device?.power ?? device?.on ?? device?.state?.switch ?? device?.state?.power ?? device?.state?.on;
  if (typeof raw === "boolean") return raw;
  const status = String(device?.status || device?.state || "").toLowerCase();
  if (status === "on") return true;
  if (status === "off") return false;
  return null;
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
  const [registryDevices, setRegistryDevices] = useState<any[]>([]);
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
  const [scenes, setScenes] = useState<ConsumerScene[]>([]);
  const [latestSceneLabel, setLatestSceneLabel] = useState<string | null>(null);
  const [messageUnread, setMessageUnread] = useState<number | null>(null);
  const [watchLabel, setWatchLabel] = useState("Unavailable");
  const [intelligenceMetrics, setIntelligenceMetrics] = useState<IntelligenceMetricSummary | null>(null);
  const [backendAwareness, setBackendAwareness] = useState<OyiAwareness | null>(null);
  const [awarenessStatus, setAwarenessStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [contextOpen, setContextOpen] = useState(false);
  const [contextSwitching, setContextSwitching] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [dashBusy, setDashBusy] = useState(false);
  const [dashErr, setDashErr] = useState<string | null>(null);
  const [quickPage, setQuickPage] = useState(0);
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);
  const quickControlsRef = useRef<HTMLDivElement | null>(null);

  const contextReady = Boolean(ready && token && activeContext.ready);
  const estateId = useMemo(() => activeContext.estate_id ? String(activeContext.estate_id) : "", [activeContext.estate_id]);
  const homeId = useMemo(() => activeContext.home_id ? String(activeContext.home_id) : "", [activeContext.home_id]);
  const latestSignal = useRuntimeIntelligenceStore((state) => state.latestSignal);
  const latestExecution = useRuntimeIntelligenceStore((state) => state.latestExecution);
  const latestRecommendations = useRuntimeIntelligenceStore((state) => state.latestRecommendations);
  const latestRuntimeAwareness = useRuntimeIntelligenceStore((state) => state.latestAwareness);

  async function refreshDevicePanelData() {
    if (!contextReady || !estateId || !homeId) return;
    setDevicesBusy(true);
    setDevicesErr(null);
    try {
      const [assigned, registry] = await Promise.all([
        deviceService.getAssignedDevices(estateId),
        deviceService.getRegistryDevices(estateId),
      ]);
      setAssignedDevices(asArray(assigned).filter((device) => String(device?.home_id || "") === String(homeId || "")));
      setRegistryDevices(asArray(registry));
    } catch (err: any) {
      setDevicesErr(err?.message || "Device sync unavailable");
    } finally {
      setDevicesBusy(false);
    }
  }

  async function refreshDashboardData() {
    if (!contextReady || !estateId || !homeId) return;
    setDashBusy(true);
    setDashErr(null);
    setAwarenessStatus("loading");
    setBackendAwareness(null);
    try {
      const [visitorRes, communityRes, maintenanceRes, notificationRes, walletRes, messagesRes, watchRes, scenesRes, intelligenceRes, awarenessRes] =
        await Promise.allSettled([
          visitorService.listMine(),
          estateId ? communityService.listByEstate(estateId) : Promise.resolve([]),
          maintenanceService.listMyTickets(),
          listMyNotifications(),
          walletService.getWallet().catch(() => null),
          messagesService.listInbox(),
          getOyiWatchSyncStatus().catch(() => null),
          sceneService.listScenes(),
          intelligenceService.summary("consumer").catch(() => null),
          oyiService.awareness({ surface: "consumer", estate_id: estateId, home_id: homeId }).catch(() => null),
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
      if (scenesRes.status === "fulfilled") setScenes(scenesRes.value);
      if (intelligenceRes.status === "fulfilled" && intelligenceRes.value) setIntelligenceMetrics(intelligenceRes.value.metrics);
      if (awarenessRes.status === "fulfilled" && awarenessRes.value?.headline) {
        setBackendAwareness(awarenessRes.value);
        setAwarenessStatus("ready");
      } else {
        setBackendAwareness(null);
        setAwarenessStatus("error");
      }
    } catch (err: any) {
      setDashErr(err?.message || "Home context sync unavailable");
      setAwarenessStatus("error");
    } finally {
      setDashBusy(false);
    }
  }

  useEffect(() => {
    try {
      const cached = typeof window !== "undefined" ? JSON.parse(window.localStorage.getItem("oyi:last-scene") || "null") : null;
      if (cached?.name) setLatestSceneLabel(String(cached.name));
    } catch {}
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail?.name) setLatestSceneLabel(String(detail.name));
    };
    window.addEventListener("oyi:scene-activated", handler as EventListener);
    return () => window.removeEventListener("oyi:scene-activated", handler as EventListener);
  }, []);

  useEffect(() => {
    if (!contextReady) {
      setAssignedDevices([]);
      setRegistryDevices([]);
      setVisitors([]);
      setCommunityPosts([]);
      setMaintenance([]);
      setNotifications([]);
      setScenes([]);
      setIntelligenceMetrics(null);
      setBackendAwareness(null);
      setAwarenessStatus("idle");
      return;
    }
    refreshDevicePanelData();
    refreshDashboardData();
  }, [contextReady, activeContext.contextKey]);

  useEffect(() => {
    if (!contextReady) return;
    const refresh = () => void refreshDevicePanelData();
    window.addEventListener("oyi:device-registry-updated", refresh);
    return () => window.removeEventListener("oyi:device-registry-updated", refresh);
  }, [contextReady, activeContext.contextKey]);

  const canMountAuthedBridges = !!ready && !!token;

  const favoriteDevices = useMemo(() => {
    const candidates = assignedDevices.filter((device) => {
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
      });
    const hasSavedPreferences = candidates.some((device) => typeof favoritePreference(device) === "boolean");
    return (hasSavedPreferences ? candidates.filter((device) => favoritePreference(device) === true) : candidates).slice(0, 6);
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
    if (!isSimpleFavorite(device)) {
      router.push("/devices");
      return;
    }
    if (isUnavailable(device)) return;
    const currentlyOn = readFavoritePower(device);
    const next = currentlyOn === null ? true : !currentlyOn;
    setDeviceCommandBusy(deviceId);
    try {
      await deviceService.commandDevice(deviceId, { switch: next });
      setAssignedDevices((items) =>
        items.map((item) =>
          pickDeviceId(item) === deviceId
            ? { ...item, switch: next, power: next, on: next, status: next ? "on" : "off" }
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
      setAssignedDevices([]);
      setRegistryDevices([]);
      setVisitors([]);
      setCommunityPosts([]);
      setMaintenance([]);
      setNotifications([]);
      setScenes([]);
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
  const assignableDevices = registryDevices.filter((device) => {
    if (device?.home_id) return false;
    const status = String(device?.status || "").toLowerCase();
    const syncState = String(device?.sync_state || "").toLowerCase();
    return status !== "unavailable" && syncState !== "unavailable" && device?.is_managed_disabled !== true;
  });
  const availableToAssign = assignableDevices.length;
  const activeDevices = assignedDevices.filter(isOnline).length;
  const offlineDevices = assignedDevices.filter((device) => !isOnline(device)).length;
  const activeOnDevices = assignedDevices.filter((device) => isOnline(device) && readFavoritePower(device)).length;
  const securityAlerts = notifications.filter((item) => {
    const text = String(((item as any)?.type || "") + " " + ((item as any)?.title || "") + " " + ((item as any)?.message || "") + " " + ((item as any)?.payload?.kind || "")).toLowerCase();
    return item.status !== "read" && /security|urgent|critical|emergency|alert/.test(text);
  }).length;
  const proximityNotification = notifications.find((item) => {
    const text = String(((item as any)?.payload?.kind || "") + " " + ((item as any)?.type || "") + " " + ((item as any)?.title || "")).toLowerCase();
    return /proximity|near_home|leaving_home|approaching_estate|away/.test(text);
  });
  const proximityState = proximityStateLabel((proximityNotification as any)?.payload?.state || (proximityNotification as any)?.payload?.kind || (proximityNotification as any)?.title);
  const intelligenceAttention = Number(intelligenceMetrics?.attention || 0);
  const predictionCount = Number(intelligenceMetrics?.predictions || 0);
  const workflowCount = Number(intelligenceMetrics?.workflows || 0);
  const importantUpdates = Math.max(securityAlerts + openMaintenance + offlineDevices + activeVisitors, intelligenceAttention, predictionCount + workflowCount);
  const pendingVisitors = visitors.filter((visitor) => /pending|requested|awaiting/i.test(String((visitor as any).status || ""))).length;
  const latestActivityAt = [
    ...notifications.map((item) => String((item as any)?.created_at || (item as any)?.occurred_at || "")),
    ...maintenance.map((item) => String((item as any)?.updated_at || (item as any)?.created_at || "")),
    ...visitors.map((item) => String((item as any)?.updated_at || (item as any)?.created_at || "")),
  ].filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || "";
  const relativeActivity = (() => {
    const date = new Date(latestActivityAt);
    if (!latestActivityAt || Number.isNaN(date.getTime())) return "";
    const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (mins < 1) return "Last activity just now";
    if (mins < 60) return `Last activity detected ${mins} minute${mins === 1 ? "" : "s"} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Last activity detected ${hours} hour${hours === 1 ? "" : "s"} ago`;
    return "Review recent activity";
  })();
  const fallbackHomeAwareness = (() => {
    if (awarenessStatus === "loading" && !backendAwareness) {
      return { primary: "Checking home awareness.", secondary: "Ranking home signals now →", href: "/activity" };
    }
    if (backendAwareness?.headline) {
      const secondary = backendAwareness.summary || backendAwareness.body || backendAwareness.recommended_action;
      return {
        primary: backendAwareness.headline,
        secondary: secondary ? `${secondary} →` : "View details →",
        href: backendAwareness.destination || "/activity",
      };
    }
    if (awarenessStatus === "error") {
      return { primary: "Home status is available.", secondary: "Using local home context →", href: "/activity" };
    }
    if (dashErr) return { primary: "Home status is available.", secondary: "Open Activity →", href: "/activity" };
    if (securityAlerts) return { primary: "Security event detected.", secondary: "Review security update →", href: "/activity?filter=attention" };
    if (pendingVisitors) return { primary: "Visitor awaiting approval.", secondary: "Review visitor access →", href: "/visitors" };
    if (openMaintenance) return { primary: "Maintenance requires attention.", secondary: "Open maintenance request →", href: "/maintenance" };
    if (offlineDevices || activeOnDevices) return { primary: "Device attention required.", secondary: "Open device status →", href: "/devices" };
    if (proximityState === "away") return { primary: "You are away from home.", secondary: `${relativeActivity || "Oyi is watching your home"} →`, href: "/activity" };
    if (proximityState === "leaving_home") return { primary: "You left home.", secondary: "Review home status →", href: "/activity" };
    if (proximityState === "approaching_estate" || proximityState === "near_estate") return { primary: "You are near the estate.", secondary: activeVisitors ? "Review visitor access →" : "No visitor action waiting →", href: activeVisitors ? "/visitors" : "/activity" };
    if (predictionCount || workflowCount) return { primary: "Recommendations available.", secondary: "See recommendations →", href: "/activity?filter=attention" };
    if (importantUpdates || unread) return { primary: "Home is secure.", secondary: `Review ${importantUpdates || unread} recent update${(importantUpdates || unread) === 1 ? "" : "s"} →`, href: "/activity?filter=attention" };
    return { primary: "Home is operating normally.", secondary: "No action required →", href: "/activity" };
  })();
  const awarenessItems = useMemo<ConsumerAwarenessItem[]>(() => {
    const backendItem = awarenessFromBackend(backendAwareness);
    const liveItem = awarenessFromRuntimeSignal(latestSignal);
    const executionItem = awarenessFromRuntimeSignal({
      id: latestExecution?.executionId || latestExecution?.signalId || latestExecution?.id || "",
      type: latestExecution?.status === "failed" ? "device.command.failed" : latestExecution?.action || "home.activity",
      severity: latestExecution?.status === "failed" ? "warning" : "info",
      entity: {
        id: latestExecution?.device || latestExecution?.deviceId || latestExecution?.entityId || null,
        name: latestExecution?.deviceName || latestExecution?.action || "Home activity",
      },
      metadata: {
        observed_source: latestExecution?.origin,
        provider: latestExecution?.provider,
        summary: latestExecution?.result || latestExecution?.status,
      },
    });
    const runtimeAwarenessItem = latestRuntimeAwareness?.headline
      ? awarenessFromBackend({
          headline: String(latestRuntimeAwareness.headline),
          summary: String(latestRuntimeAwareness.summary || latestRuntimeAwareness.reason || ""),
          severity: (latestRuntimeAwareness.severity || "info") as any,
          destination: String(latestRuntimeAwareness.destination || "/activity"),
          recommended_action: String(latestRuntimeAwareness.recommended_action || ""),
        })
      : null;
    const recommendationItem = latestRecommendations[0]
      ? {
          id: `recommendation:${latestRecommendations[0]?.id || latestRecommendations[0]?.title || "next"}`,
          title: String(latestRecommendations[0]?.title || "Recommendation available"),
          summary: String(latestRecommendations[0]?.summary || latestRecommendations[0]?.reason || "Oyi has a suggested next step for your home."),
          actionLabel: "View activity",
          destination: String(latestRecommendations[0]?.destination || "/activity"),
          urgency: "warning" as const,
          icon: "activity" as const,
          priority: 35,
        }
      : null;
    return dedupeAwareness([backendItem, runtimeAwarenessItem, liveItem, executionItem, recommendationItem]).slice(0, 3);
  }, [backendAwareness, latestExecution, latestRecommendations, latestRuntimeAwareness, latestSignal]);
  const homeAwareness = awarenessItems[0]
    ? {
        primary: awarenessItems[0].title,
        secondary: `${awarenessItems[0].summary} →`,
        href: awarenessItems[0].destination,
      }
    : fallbackHomeAwareness;
  const securityState = activeVisitors ? `${activeVisitors} visitor${activeVisitors > 1 ? "s" : ""}` : "Protected";
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
  const scenesLabel = latestSceneLabel ? `${latestSceneLabel} activated` : scenes.length ? scenes[0].name : "Create your first scene";
  const homeStateItems = [
    {
      label: latestSceneLabel ? "Last Scene" : "Scenes",
      value: scenesLabel,
      href: "/scenes?create=scene",
      Icon: Moon,
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
      label: "Visitors",
      value: visitorLabel,
      href: "/visitors",
      Icon: Users,
      iconClass: "text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.55)]",
    },
    {
      label: "Wallet",
      value: walletLabel,
      href: "/wallet",
      Icon: Wallet,
      iconClass: "text-violet-300 drop-shadow-[0_0_12px_rgba(168,85,247,0.68)]",
    },
    {
      label: "Devices",
      value: totalVisibleDevices ? `${activeDevices}/${totalVisibleDevices} online` : "No devices",
      href: "/devices",
      Icon: Plug,
      iconClass: "text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.55)]",
    },
    {
      label: "Maintenance",
      value: maintenanceLabel,
      href: "/maintenance",
      Icon: Wrench,
      iconClass: "text-orange-300 drop-shadow-[0_0_12px_rgba(251,146,60,0.55)]",
    },
    {
      label: "Community",
      value: communityLabel,
      href: "/community",
      Icon: MessageCircle,
      iconClass: "text-blue-300 drop-shadow-[0_0_12px_rgba(96,165,250,0.58)]",
    },
    {
      label: "Messages",
      value: messagesLabel,
      href: "/messages",
      Icon: MessageCircle,
      iconClass: "text-sky-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.62)]",
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
                onClick={() => router.push("/ai?module=home")}
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
                  {homeAwareness.primary}
                </div>
                <button
                  type="button"
                  onClick={() => router.push(homeAwareness.href)}
                  className="mx-auto mt-2.5 block text-[13px] font-medium leading-5 text-sky-200/78 transition hover:text-sky-100 active:scale-[0.99] sm:text-[14px]"
                >
                  {homeAwareness.secondary}
                </button>
                {awarenessItems.length > 1 ? (
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {awarenessItems.slice(1, 3).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => router.push(item.destination)}
                        className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/66 transition hover:bg-white/[0.06] active:scale-[0.99]"
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </motion.section>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.48, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <OyiContextRail
                className="mt-5"
                items={homeStateItems.map((item) => ({
                  label: item.label,
                  value: item.value,
                  icon: item.Icon,
                  iconClassName: item.iconClass,
                  onClick: () => router.push(item.href),
                }))}
              />
            </motion.div>

            {totalVisibleDevices ? <motion.section
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.48, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6"
            >
              <div className="mb-3.5 flex items-center justify-between">
                <h2 className="text-[18px] font-medium tracking-[-0.04em] text-white/76">Quick controls</h2>
                <button
                  type="button"
                  onClick={() => router.push("/devices?edit=favorites")}
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
                  onClick={() => router.push("/devices?category=lights")}
                />
                <QuickControl
                  icon={Thermometer}
                  label="Climate"
                  value={assignedDevices.some((device) => String(device?.device_type || device?.type || device?.category || "").toLowerCase().match(/climate|ac|hvac|thermostat/)) ? "Available" : "Not configured"}
                  tone="sky"
                  onClick={() => router.push("/devices?category=climate")}
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
                  value={scenesLabel}
                  tone="violet"
                  onClick={() => router.push("/scenes?create=scene")}
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
            </motion.section> : availableToAssign ? (
              <motion.section
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.48, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="mt-6 rounded-[24px] border border-sky-300/12 bg-sky-400/[0.045] p-4 backdrop-blur-2xl"
              >
                <h2 className="text-[17px] font-semibold tracking-[-0.04em] text-white">Devices discovered and ready to assign.</h2>
                <p className="mt-1.5 text-xs leading-5 text-white/46">{availableToAssign} device{availableToAssign === 1 ? "" : "s"} available. Assign them to this home to begin controlling your spaces.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => router.push("/devices?add=device")} className="rounded-full border border-sky-300/24 bg-sky-400/12 px-3 py-2 text-xs font-medium text-sky-100">Assign Devices</button>
                  <button type="button" onClick={() => router.push("/devices")} className="rounded-full px-3 py-2 text-xs font-medium text-white/56">Open Devices</button>
                </div>
              </motion.section>
            ) : (
              <motion.section
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.48, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="mt-6 rounded-[24px] border border-white/[0.06] bg-white/[0.025] p-4 backdrop-blur-2xl"
              >
                <h2 className="text-[17px] font-semibold tracking-[-0.04em] text-white">No devices connected yet.</h2>
                <p className="mt-1.5 text-xs leading-5 text-white/46">Add your first device to begin controlling your home.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => router.push("/devices?add=device")} className="rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-xs font-medium text-sky-100">Add Device</button>
                  <button type="button" onClick={() => setLearnMoreOpen(true)} className="rounded-full px-3 py-2 text-xs font-medium text-white/48">Learn More</button>
                </div>
              </motion.section>
            )}

            {favoriteDevices.length ? (
              <section className="mt-5 rounded-[24px] border border-white/[0.055] bg-white/[0.02] p-2.5 backdrop-blur-2xl">
                <div className="flex gap-2 overflow-x-auto">
                  {favoriteDevices.map((device) => {
                    const deviceId = pickDeviceId(device);
                    const online = isOnline(device);
                    const unavailable = isUnavailable(device);
                    const simple = isSimpleFavorite(device);
                    const power = readFavoritePower(device);
                    const busy = deviceCommandBusy === deviceId;
                    const Icon = getDeviceIcon(device);
                    const tone = getDeviceIconTone(device);
                    return (
                      <button
                        key={deviceId || device?.name}
                        type="button"
                        disabled={busy || unavailable}
                        onClick={() => simple ? void toggleFavoriteDevice(device) : router.push("/devices")}
                        className="min-w-[118px] rounded-[20px] border border-white/[0.055] bg-black/16 px-3 py-3 text-left transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.98]"
                      >
                        <span className={`grid h-8 w-8 place-items-center rounded-full border ${tone}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="mt-3 block truncate text-[13px] font-semibold text-white/82">
                          {device?.name || device?.label || "Device"}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-white/40">
                          {busy ? "Working" : unavailable ? "Unavailable" : power === true ? "On" : power === false ? "Off" : simple ? "Ready" : online ? "Open controls" : "Open controls"}
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

        {learnMoreOpen ? (
          <div className="fixed inset-0 z-[115] flex items-end justify-center bg-black/52 px-4 pb-[calc(18px+var(--sab))] backdrop-blur-md sm:items-center sm:pb-4">
            <button type="button" className="absolute inset-0" aria-label="Close device guidance" onClick={() => setLearnMoreOpen(false)} />
            <section className="relative w-full max-w-[390px] rounded-[28px] border border-white/[0.08] bg-[#050a12]/95 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.62)]">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[10px] uppercase tracking-[0.2em] text-sky-100/48">Connected home</p><h2 className="mt-1 text-[18px] font-semibold tracking-[-0.04em]">Add your first device</h2></div>
                <button type="button" onClick={() => setLearnMoreOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-white/52" aria-label="Close device guidance"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-4 space-y-2 text-sm leading-5 text-white/56">
                <p>Connected Systems links external providers and syncs supported smart devices into Oyi.</p>
                <p>Add Device discovers or assigns devices. Organize them into rooms, create scenes, and control your home safely from Oyi.</p>
              </div>
              <button type="button" onClick={() => router.push("/devices?add=device")} className="mt-4 w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-black">Open Add Device</button>
            </section>
          </div>
        ) : null}

        <BottomNav />
      </main>
    </LayoutWrapper>
  );
}
