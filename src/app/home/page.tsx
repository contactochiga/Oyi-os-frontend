// src/app/home/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowUp,
  ChevronDown,
  Leaf,
  Lightbulb,
  Mic,
  Moon,
  ShieldCheck,
  Thermometer,
  Wallet,
  Zap,
} from "lucide-react";

import LayoutWrapper from "../components/LayoutWrapper";
import InviteSuggestionBridge from "../components/InviteSuggestionBridge";
import NotificationsBridge from "../components/NotificationsBridge";
import HamburgerMenu from "../components/HamburgerMenu";
import NotificationBell from "../components/NotificationBell";
import BottomNav from "../components/BottomNav";

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
      className="group w-[168px] shrink-0 rounded-[28px] border border-white/[0.075] bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.017))] p-4 text-left shadow-[0_18px_54px_rgba(0,0,0,0.30)] backdrop-blur-2xl transition hover:border-white/14 hover:bg-white/[0.065] active:scale-[0.985] sm:w-[188px]"
    >
      <span
        className={`grid h-14 w-14 place-items-center rounded-full bg-gradient-to-b ${tones[tone]} to-transparent transition group-active:scale-95`}
      >
        <Icon className="h-7 w-7" />
      </span>
      <span className="mt-5 block text-[18px] font-semibold tracking-[-0.035em] text-white">
        {label}
      </span>
      <span className="mt-1 block text-[15px] text-white/52">{value}</span>
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { user, token, ready } = useAuth() as any;

  const [assignedDevices, setAssignedDevices] = useState<any[]>([]);
  const [discoveryDevices, setDiscoveryDevices] = useState<any[]>([]);
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
  const [dashBusy, setDashBusy] = useState(false);
  const [dashErr, setDashErr] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");

  const estateId = useMemo(() => {
    const fromUser = (user as any)?.estate_id || (user as any)?.estateId;
    if (fromUser) return String(fromUser);
    if (typeof window !== "undefined") {
      return (
        window.localStorage.getItem("oyi_estate_id") ||
        window.localStorage.getItem("estate_id") ||
        "f479050c-020f-47ce-93b5-3dbf8155a1f3"
      );
    }
    return "f479050c-020f-47ce-93b5-3dbf8155a1f3";
  }, [user]);

  async function refreshDevicePanelData() {
    if (!token) return;
    setDevicesBusy(true);
    setDevicesErr(null);
    try {
      const [assigned, discovered] = await Promise.allSettled([
        deviceService.getAssignedDevices(estateId),
        deviceService.discoverDevices(),
      ]);
      if (assigned.status === "fulfilled") setAssignedDevices(assigned.value);
      if (discovered.status === "fulfilled") setDiscoveryDevices(discovered.value);
      if (assigned.status === "rejected" && discovered.status === "rejected") {
        throw assigned.reason;
      }
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
      const [visitorRes, communityRes, maintenanceRes, notificationRes, walletRes] =
        await Promise.allSettled([
          visitorService.listMine(),
          communityService.listByEstate(estateId),
          maintenanceService.listMyTickets(),
          listMyNotifications(),
          walletService.getWallet().catch(() => null),
        ]);

      if (visitorRes.status === "fulfilled") setVisitors(visitorRes.value);
      if (communityRes.status === "fulfilled") setCommunityPosts(communityRes.value);
      if (maintenanceRes.status === "fulfilled") setMaintenance(maintenanceRes.value);
      if (notificationRes.status === "fulfilled") {
        setNotifications(Array.isArray(notificationRes.value) ? notificationRes.value : []);
      }
      if (walletRes.status === "fulfilled" && walletRes.value) {
        const balance =
          Number((walletRes.value as any)?.balance ?? (walletRes.value as any)?.amount ?? 0) || 0;
        setWalletBalance(balance);
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
  }, [ready, token, estateId]);

  const canMountAuthedBridges = !!ready && !!token;

  const favoriteDevices = useMemo(() => {
    const devices = assignedDevices.length ? assignedDevices : discoveryDevices;
    return devices
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
  }, [assignedDevices, discoveryDevices]);

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

  function openOyiWithPrompt(prompt?: string) {
    const value = String(prompt || aiPrompt || "").trim();
    router.push(value ? `/ai?prompt=${encodeURIComponent(value)}` : "/ai");
  }

  const estateName = String(
    (user as any)?.estate_name || (user as any)?.home_name || "Paradise 2 Residence",
  );
  const rawName = String((user as any)?.name || (user as any)?.first_name || "Oyi");
  const greetingName = rawName.split(" ")[0] || "Oyi";
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
  const totalVisibleDevices = assignedDevices.length || discoveryDevices.length;
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

  const suggestionChips = [
    favoriteDevices[0]?.name ? `Turn off ${favoriteDevices[0].name}` : "Turn off living room lights",
    activeVisitors ? "Show visitors" : "Arm security",
    openMaintenance ? "Show maintenance" : communityPosts.length ? "Open community" : "Open gate",
  ];

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 isolate min-h-0 overflow-hidden bg-[#02060b] text-white">
        <div className="oyi-ambient-bg" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_17%,rgba(0,132,255,0.18),transparent_34%),radial-gradient(circle_at_50%_61%,rgba(0,92,185,0.12),transparent_34%),linear-gradient(180deg,rgba(4,12,22,0.28),rgba(0,0,0,0.9))]" />
        <div className="pointer-events-none absolute inset-x-8 top-[20%] h-[46%] rounded-full bg-sky-500/[0.035] blur-3xl" />

        <div
          className="pointer-events-none fixed inset-x-0 z-[80] px-5"
          style={{ top: "calc(16px + var(--sat))" }}
        >
          {canMountAuthedBridges ? (
            <>
              <InviteSuggestionBridge />
              <NotificationsBridge />
            </>
          ) : null}
          <div className="pointer-events-auto mx-auto flex max-w-[820px] items-center justify-between">
            <div className="grid h-14 w-14 place-items-center rounded-full border border-white/12 bg-white/[0.035] shadow-[0_12px_42px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
              <HamburgerMenu />
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-white/[0.03] shadow-[0_12px_42px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
              <NotificationBell />
            </div>
          </div>
        </div>

        <div
          className="absolute inset-x-0 overflow-y-auto px-5"
          style={{
            zIndex: 20,
            top: "calc(74px + var(--sat))",
            bottom: "calc(92px + var(--sab))",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className="oyi-living-page oyi-page-fade mx-auto max-w-[820px] pb-8">
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <h1 className="mt-9 text-[31px] font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl">
                Good evening, {greetingName}
              </h1>
              <button
                type="button"
                onClick={() => router.push("/settings")}
                className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[19px] font-medium text-white/58 transition hover:bg-white/[0.04] active:scale-[0.99]"
              >
                <span>{estateName}</span>
                <ChevronDown className="h-5 w-5 text-white/62" />
              </button>

              <button
                type="button"
                onClick={() => openOyiWithPrompt()}
                aria-label="Open Oyi AI"
                className="group relative mx-auto mt-9 grid h-[202px] w-[202px] place-items-center rounded-full transition active:scale-[0.985] sm:h-[246px] sm:w-[246px]"
              >
                <span className="absolute inset-[-30px] rounded-full bg-sky-500/10 blur-3xl transition group-active:bg-sky-400/16" />
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-[-6px] rounded-full border border-sky-300/45"
                  animate={{ opacity: [0.45, 0.9, 0.45], scale: [0.98, 1.035, 0.98] }}
                  transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
                />
                <span className="absolute inset-0 rounded-full border border-sky-300/72 bg-[radial-gradient(circle_at_42%_28%,rgba(255,255,255,0.21),transparent_16%),radial-gradient(circle_at_50%_58%,rgba(22,111,255,0.42),rgba(2,7,14,0.94)_67%)] shadow-[inset_0_0_42px_rgba(255,255,255,0.055),0_0_48px_rgba(0,132,255,0.52),0_42px_90px_rgba(0,0,0,0.58)]" />
                <span className="absolute -bottom-10 h-14 w-[78%] rounded-[100%] bg-sky-500/20 blur-xl" />
                <span className="relative text-[42px] font-semibold tracking-[-0.08em] text-white sm:text-5xl">
                  Oyi
                </span>
              </button>

              <div className="mt-14">
                <div className="text-[35px] font-semibold leading-none tracking-[-0.05em] text-white sm:text-5xl">
                  Home is {homeState.toLowerCase()}.
                </div>
                <p className="mt-4 text-[18px] leading-6 text-white/56 sm:text-xl">
                  {supportLine}
                </p>
              </div>
            </motion.section>

            <section className="mt-8 overflow-hidden rounded-[30px] border border-white/[0.085] bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] px-4 py-4 shadow-[0_20px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
              <div className="grid grid-cols-3 divide-x divide-white/10">
                <button
                  type="button"
                  onClick={() => router.push("/activity")}
                  className="flex items-center justify-center gap-3 px-1 py-1.5 text-left active:scale-[0.99]"
                >
                  <Leaf className="h-8 w-8 text-sky-300 drop-shadow-[0_0_16px_rgba(56,189,248,0.78)]" />
                  <span>
                    <span className="block text-[13px] text-white/48">Atmosphere</span>
                    <span className="block text-[15px] font-semibold text-white">{homeState}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/security")}
                  className="flex items-center justify-center gap-3 px-1 py-1.5 text-left active:scale-[0.99]"
                >
                  <ShieldCheck className="h-8 w-8 text-emerald-300 drop-shadow-[0_0_16px_rgba(52,211,153,0.72)]" />
                  <span>
                    <span className="block text-[13px] text-white/48">Security</span>
                    <span className="block text-[15px] font-semibold text-white">{securityState}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/wallet")}
                  className="flex items-center justify-center gap-3 px-1 py-1.5 text-left active:scale-[0.99]"
                >
                  <Wallet className="h-8 w-8 text-violet-300 drop-shadow-[0_0_16px_rgba(168,85,247,0.76)]" />
                  <span>
                    <span className="block text-[13px] text-white/48">Wallet</span>
                    <span className="block text-[15px] font-semibold text-white">{walletLabel}</span>
                  </span>
                </button>
              </div>
            </section>

            <section className="relative mt-7 overflow-hidden rounded-[32px] border border-white/[0.095] bg-[radial-gradient(circle_at_88%_16%,rgba(0,117,255,0.20),transparent_24%),linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
              <div className="absolute -right-16 top-0 h-44 w-44 rounded-full bg-sky-400/10 blur-3xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="text-left">
                  <h2 className="text-[24px] font-semibold tracking-[-0.035em] text-white">Ask Oyi</h2>
                  <p className="mt-2 text-[16px] text-white/52">Your AI for your home.</p>
                </div>
                <button
                  type="button"
                  onClick={() => openOyiWithPrompt(aiPrompt || "voice command")}
                  className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-sky-200/30 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.30),rgba(0,70,255,0.92))] text-white shadow-[0_0_36px_rgba(0,132,255,0.66)] transition active:scale-95"
                  aria-label="Speak to Oyi"
                >
                  <Mic className="h-8 w-8" />
                </button>
              </div>

              <form
                className="relative mt-8"
                onSubmit={(event) => {
                  event.preventDefault();
                  openOyiWithPrompt();
                }}
              >
                <input
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  placeholder="Ask anything..."
                  className="h-16 w-full rounded-[28px] border border-white/[0.08] bg-black/28 px-5 pr-16 text-[17px] text-white outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition placeholder:text-white/34 focus:border-sky-300/32 focus:bg-black/36 focus:shadow-[0_0_34px_rgba(0,132,255,0.16)]"
                />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/12 text-white/74 transition hover:bg-white/18 active:scale-95"
                  aria-label="Send to Oyi"
                >
                  <ArrowUp className="h-5 w-5" />
                </button>
              </form>

              <div className="mt-5 flex gap-2 overflow-x-auto pb-0.5">
                {suggestionChips.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => openOyiWithPrompt(item)}
                    className="shrink-0 rounded-full border border-white/[0.085] bg-black/18 px-4 py-2.5 text-[14px] text-white/62 transition hover:bg-white/[0.06] hover:text-white/82 active:scale-[0.98]"
                  >
                    {item}
                  </button>
                ))}
              </div>
              {dashErr ? (
                <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                  {dashErr}
                </div>
              ) : null}
            </section>

            <section className="mt-9">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-[23px] font-medium tracking-[-0.04em] text-white/78">Quick controls</h2>
                <button
                  type="button"
                  onClick={() => router.push("/devices")}
                  className="text-[17px] font-medium text-sky-300 transition hover:text-sky-200 active:scale-[0.98]"
                >
                  Edit
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2">
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
                  value="Movie Time"
                  tone="violet"
                  onClick={() => openOyiWithPrompt("Activate movie mode")}
                />
              </div>

              <div className="mt-5 flex justify-center gap-2" aria-hidden="true">
                <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.9)]" />
                <span className="h-2 w-2 rounded-full bg-white/14" />
                <span className="h-2 w-2 rounded-full bg-white/14" />
              </div>
            </section>

            {favoriteDevices.length ? (
              <section className="mt-8 rounded-[28px] border border-white/[0.07] bg-white/[0.025] p-3 backdrop-blur-2xl">
                <div className="flex gap-2 overflow-x-auto">
                  {favoriteDevices.map((device) => {
                    const deviceId = pickDeviceId(device);
                    const online = isOnline(device);
                    const busy = deviceCommandBusy === deviceId;
                    return (
                      <button
                        key={deviceId || device?.name}
                        type="button"
                        disabled={busy}
                        onClick={() => toggleFavoriteDevice(device)}
                        className="min-w-[136px] rounded-[24px] border border-white/[0.065] bg-black/18 px-4 py-4 text-left transition hover:bg-white/[0.045] disabled:opacity-60 active:scale-[0.98]"
                      >
                        <span className={`grid h-10 w-10 place-items-center rounded-full ${online ? "bg-sky-400/18 text-sky-200" : "bg-white/[0.06] text-white/45"}`}>
                          <Zap className="h-5 w-5" />
                        </span>
                        <span className="mt-4 block truncate text-[14px] font-semibold text-white/84">
                          {device?.name || device?.label || "Device"}
                        </span>
                        <span className="mt-1 block text-xs text-white/42">
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

        <BottomNav />
      </main>
    </LayoutWrapper>
  );
}
