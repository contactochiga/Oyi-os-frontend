// src/app/home/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import InviteSuggestionBridge from "../components/InviteSuggestionBridge";
import NotificationsBridge from "../components/NotificationsBridge";
import TopBar from "../components/TopBar";

import LayoutWrapper from "../components/LayoutWrapper";
import ChatFooter from "../components/ChatFooter";
import DynamicSuggestionCard from "../components/DynamicSuggestionCard";

import RemotePanelRenderer from "../components/remotes/RemotePanelRenderer";
import DeviceDiscoveryPanel from "../components/remotes/DeviceDiscoveryPanel";

import { aiService } from "../../services/aiService";
import { deviceService } from "../../services/deviceService";

import useAuth from "../../hooks/useAuth";
import { useEventStore } from "../../store/useEventStore";

import {
  LayoutDashboard,
  Zap,
  DollarSign,
  Users,
  UserCheck,
  Activity,
  Clock,
  ChevronRight,
} from "lucide-react";

import { motion } from "framer-motion";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  panel?: string | null;
  deviceId?: string;
  time: string;
  lastUpdated: number;
  pending?: boolean;
};

type DeviceAction =
  | {
      type: "device.command";
      deviceId: string;
      command: Record<string, any>;
    }
  | {
      type: "open.panel";
      panel: string;
      deviceId?: string;
    };

function nowMeta() {
  const now = new Date();
  return {
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    stamp: now.getTime(),
  };
}

function createId() {
  return Math.random().toString(36).slice(2, 9);
}

function inferPanel(aiPanel?: string | null, userText?: string): string | null {
  const src = `${aiPanel || ""} ${userText || ""}`
    .toLowerCase()
    .replace(/[^\w\s]/g, "");

  if (
    src.includes("home") ||
    src.includes("house") ||
    src.includes("summary") ||
    src.includes("overview") ||
    src.includes("status") ||
    src.includes("whats happening") ||
    src.includes("what's happening")
  )
    return "home";

  if (
    src.includes("room") ||
    src.includes("bedroom") ||
    src.includes("kitchen") ||
    src.includes("living room")
  )
    return "rooms";

  if (
    src.includes("visitor") ||
    src.includes("guest") ||
    src.includes("expecting") ||
    src.includes("delivery") ||
    src.includes("gate pass")
  )
    return "visitor";

  if (
    src.includes("door") ||
    src.includes("lock") ||
    src.includes("unlock") ||
    src.includes("front door")
  )
    return "door";

  if (src.includes("cctv") || src.includes("camera") || src.includes("surveillance"))
    return "cctv";

  if (
    src.includes("sensor") ||
    src.includes("motion") ||
    src.includes("smoke") ||
    src.includes("gas") ||
    src.includes("alert")
  )
    return "sensors";

  if (
    src.includes("maintenance") ||
    src.includes("repair") ||
    src.includes("fix") ||
    src.includes("issue") ||
    src.includes("support")
  )
    return "maintenance";

  if (
    src.includes("wallet") ||
    src.includes("payment") ||
    src.includes("balance") ||
    src.includes("fund")
  )
    return "wallet";

  if (
    src.includes("utility") ||
    src.includes("electric") ||
    src.includes("power") ||
    src.includes("water") ||
    src.includes("internet") ||
    src.includes("rent")
  )
    return "utilities";

  if (
    src.includes("community") ||
    src.includes("announcement") ||
    src.includes("estate news") ||
    src.includes("notice")
  )
    return "community";

  if (src.includes("light")) return "light";
  if (src.includes("ac") || src.includes("air conditioner") || src.includes("air"))
    return "ac";
  if (src.includes("tv") || src.includes("television")) return "tv";

  // ✅ include onboarding verbs to force devices panel intent
  if (
    src.includes("device") ||
    src.includes("appliance") ||
    src.includes("discover") ||
    src.includes("pair") ||
    src.includes("bind") ||
    src.includes("add device") ||
    src.includes("connect device") ||
    src.includes("add devices") ||
    src.includes("connect devices")
  )
    return "devices";

  return null;
}

function getSuggestionTitle(panel: string): string {
  switch (panel) {
    case "home":
      return "View home summary";
    case "rooms":
      return "Manage rooms";
    case "visitor":
      return "Manage visitors";
    case "door":
      return "Door access";
    case "wallet":
      return "Open wallet";
    case "utilities":
      return "View utilities";
    case "maintenance":
      return "Report maintenance issue";
    case "community":
      return "Community updates";
    case "light":
      return "Control lights";
    case "ac":
      return "Adjust air conditioner";
    case "tv":
      return "Control TV";
    case "cctv":
      return "View CCTV";
    case "sensors":
      return "View sensors";
    case "devices":
      return "Devices & Discovery";
    default:
      return "Continue";
  }
}

function shouldOpenPanel(userText: string, panel: string | null) {
  if (!panel) return false;

  const MANAGEMENT = new Set([
    "home",
    "rooms",
    "visitor",
    "wallet",
    "utilities",
    "maintenance",
    "community",
    "devices",
    "cctv",
    "sensors",
  ]);

  const t = (userText || "").toLowerCase();

  const explicit =
    t.includes("open") ||
    t.includes("show") ||
    t.includes("manage") ||
    t.includes("panel") ||
    t.includes("settings") ||
    t.includes("list") ||
    t.includes("view") ||
    t.includes("discover") ||
    t.includes("add device") ||
    t.includes("add devices") ||
    t.includes("bind device") ||
    t.includes("bind devices") ||
    t.includes("pair device") ||
    t.includes("pair devices") ||
    t.includes("connect device") ||
    t.includes("connect devices");

  if (explicit && MANAGEMENT.has(panel)) return true;
  return false;
}

async function executeActions(actions: DeviceAction[] | undefined) {
  if (!actions?.length) return;

  for (const a of actions) {
    try {
      if (a.type === "device.command") {
        await deviceService.commandDevice(a.deviceId, a.command);
      }
    } catch {
      // swallow errors
    }
  }
}

function isSamePanelInstance(m: ChatMessage, panel: string, deviceId?: string) {
  if (!m.panel) return false;
  if (m.panel !== panel) return false;

  if (panel === "devices") return true;
  if (!deviceId) return true;

  return m.deviceId === deviceId;
}

function devKey(d: any) {
  return String(
    d?.id ||
      d?.external_id ||
      d?.externalId ||
      d?.device_id ||
      d?.dev_id ||
      d?.uuid ||
      ""
  );
}

function devLabel(d: any) {
  return d?.name || d?.type || d?.category || "Device";
}

function devSub(d: any) {
  const vendor = d?.vendor || d?.adapter || "";
  const room = d?.room_name || d?.room || null;
  const id =
    d?.external_id || d?.externalId || d?.device_id || d?.dev_id || d?.uuid || null;

  const bits = [
    vendor ? String(vendor) : null,
    room ? `room:${room}` : null,
    id ? `id:${id}` : null,
  ].filter(Boolean);

  return bits.join(" • ");
}

// -----------------------------
// Dashboard UI helpers (NO new deps)
// -----------------------------
function StatCard({
  icon,
  label,
  value,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.99 }}
      className="text-left rounded-3xl border border-white/10 bg-white/5 hover:bg-white/7 transition p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-white/55 flex items-center gap-2">
            {icon}
            <span className="truncate">{label}</span>
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
          {sub ? <div className="mt-1 text-[11px] text-white/40">{sub}</div> : null}
        </div>

        <div className="shrink-0 text-white/40">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </motion.button>
  );
}

function MiniPanel({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-white/70" />
            {title}
          </div>
          {subtitle ? <div className="text-xs text-white/45 mt-1">{subtitle}</div> : null}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { user, token, ready } = useAuth() as any;
  const { pushEvent } = useEventStore();

  const [input, setInput] = useState("");

  // ✅ device panel data: separate discovery vs assigned
  const [assignedDevices, setAssignedDevices] = useState<any[]>([]);
  const [discoveryDevices, setDiscoveryDevices] = useState<any[]>([]);
  const [devicesTab, setDevicesTab] = useState<"assigned" | "discovery">("assigned");

  const [devicesBusy, setDevicesBusy] = useState(false);
  const [devicesErr, setDevicesErr] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "sys-1",
      role: "assistant",
      content: "Hello! I’m Oyi — how can I help?",
      ...nowMeta(),
      lastUpdated: Date.now(),
    },
  ]);

  const estateId = useMemo(() => {
    return (
      (user as any)?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null)
    );
  }, [(user as any)?.estate_id]);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // ✅ Jump to latest message without moving footer
  useEffect(() => {
    const a = requestAnimationFrame(() => {
      const b = requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
      });
      return () => cancelAnimationFrame(b);
    });
    return () => cancelAnimationFrame(a);
  }, [messages.length]);

  // ✅ helper: refresh both assigned + discovery
  async function refreshDevicePanelData() {
    setDevicesBusy(true);
    setDevicesErr(null);

    try {
      const [assigned, discovered] = await Promise.all([
        estateId ? deviceService.getDevices(estateId) : Promise.resolve([]),
        deviceService.getDevices(undefined),
      ]);

      setAssignedDevices(Array.isArray(assigned) ? assigned : []);
      setDiscoveryDevices(Array.isArray(discovered) ? discovered : []);
    } catch (e: any) {
      setAssignedDevices([]);
      setDiscoveryDevices([]);
      setDevicesErr(e?.message || "Failed to load devices");
    } finally {
      setDevicesBusy(false);
    }
  }

  // Load dashboard device stats early (safe)
  useEffect(() => {
    // don’t block: dashboard can still show 0
    refreshDevicePanelData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estateId]);

  async function handleSend(text?: string) {
    const command = (text ?? input).trim();
    if (!command) return;

    if (command === "__OPEN_INVITES__") {
      router.push("/invites");
      return;
    }

    setInput("");

    const { time, stamp } = nowMeta();

    const userMsgId = createId();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: command, time, lastUpdated: stamp },
    ]);

    const pendingId = createId();
    setMessages((prev) => [
      ...prev,
      {
        id: pendingId,
        role: "assistant",
        content: "Thinking…",
        time,
        lastUpdated: stamp,
        pending: true,
      },
    ]);

    try {
      const resp: any = await aiService.chat(command);

      const reply =
        resp?.reply ||
        `Got it. ${command.charAt(0).toUpperCase()}${command.slice(1)}.`;

      const panel = inferPanel(resp?.panel, command);

      const actions: DeviceAction[] | undefined = resp?.actions;
      if (actions?.length) await executeActions(actions);

      const openPanel = shouldOpenPanel(command, panel);
      const deviceId = resp?.deviceId;

      setMessages((prev) => {
        const next = prev.map((m) => {
          if (openPanel && panel && isSamePanelInstance(m, panel, deviceId) && m.id !== pendingId) {
            return { ...m, panel: null, deviceId: undefined };
          }

          if (m.id === pendingId) {
            if (!openPanel) {
              return {
                ...m,
                pending: false,
                content: reply,
                panel: null,
                deviceId: undefined,
                time,
                lastUpdated: stamp,
              };
            }

            return {
              ...m,
              pending: false,
              content: reply,
              panel: panel || null,
              deviceId,
              time,
              lastUpdated: stamp,
            };
          }

          return m;
        });

        return next;
      });

      if (openPanel && panel === "devices") {
        await refreshDevicePanelData();
        setDevicesTab("assigned");
      }

      if (openPanel && panel) {
        pushEvent({
          id: createId(),
          type: "info",
          category: "assistant",
          priority: "medium",
          actionable: true,
          title: getSuggestionTitle(panel),
          message: command,
          timestamp: stamp,
          expiresAt: Date.now() + 60_000,
        } as any);
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, pending: false, content: "Sorry — I couldn’t reach the system." }
            : m
        )
      );
    }
  }

  const canMountAuthedBridges = !!ready && !!token;

  // Dashboard computed stats (safe + real)
  const totalDevices = assignedDevices.length;
  const activeDevices = useMemo(() => {
    return assignedDevices.filter((d) => {
      if (typeof d?.online === "boolean") return d.online;
      const s = String(d?.status || "").toLowerCase();
      if (!s) return false;
      return s.includes("online") || s.includes("active") || s.includes("on") || s.includes("connected");
    }).length;
  }, [assignedDevices]);

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 min-h-0 isolate">
        {/* wallpaper */}
        <div className="estate-wallpaper" />

        {/* interactive layer */}
        <div className="app-layer">
          {/* ✅ A+B FIX: do NOT mount polling bridges until auth is ready + token exists */}
          {canMountAuthedBridges ? (
            <>
              <InviteSuggestionBridge />
              <NotificationsBridge />
            </>
          ) : null}

          <TopBar />

          {/* scroll region */}
          <div
            ref={scrollerRef}
            className="absolute left-0 right-0 overflow-y-auto"
            style={{
              zIndex: 20,
              top: "calc(64px + var(--sat))",
              bottom: "calc(152px + var(--sab) + var(--kb))",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              touchAction: "pan-y",
            }}
          >
            <div className="p-6 relative z-[20]">
              <div className="max-w-3xl mx-auto flex flex-col gap-4">
                {/* ✅ NEW: Dashboard Overview (does not affect chat / routes / footer) */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-white flex items-center gap-2">
                        <LayoutDashboard className="w-5 h-5 text-white/70" />
                        Dashboard Overview
                      </div>
                      <div className="text-xs text-white/45 mt-1">
                        Quick snapshot • tap any card to open its panel
                      </div>
                      {estateId ? (
                        <div className="mt-2 inline-flex items-center gap-2 text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/60">
                          Estate: <span className="text-white/80">{String(estateId)}</span>
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={refreshDevicePanelData}
                      disabled={devicesBusy}
                      className="shrink-0 rounded-xl px-3 py-2 text-sm text-white/80 bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50 transition"
                    >
                      {devicesBusy ? "Refreshing…" : "Refresh"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard
                      icon={<Zap className="w-4 h-4 text-sky-300" />}
                      label="Active Devices"
                      value={`${activeDevices}/${totalDevices || 0}`}
                      sub={totalDevices ? `${Math.round((activeDevices / Math.max(1, totalDevices)) * 100)}% online` : "No devices yet"}
                      onClick={() => handleSend("open devices")}
                    />

                    <StatCard
                      icon={<DollarSign className="w-4 h-4 text-emerald-300" />}
                      label="Wallet"
                      value="Open"
                      sub="Fund • bills • payments"
                      onClick={() => router.push("/wallet")}
                    />

                    <StatCard
                      icon={<UserCheck className="w-4 h-4 text-purple-300" />}
                      label="Visitors"
                      value="Manage"
                      sub="Create access • track entries"
                      onClick={() => router.push("/visitors")}
                    />

                    <StatCard
                      icon={<Users className="w-4 h-4 text-orange-300" />}
                      label="Community"
                      value="Updates"
                      sub="Announcements • posts"
                      onClick={() => router.push("/community")}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <MiniPanel
                      title="Quick Actions"
                      subtitle="These use your existing chat logic (no new routes)."
                      right={
                        <div className="text-[11px] text-white/40">
                          {discoveryDevices.length ? `${discoveryDevices.length} discovered` : ""}
                        </div>
                      }
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleSend("open devices")}
                          className="py-2.5 rounded-2xl bg-white text-black text-sm font-medium hover:opacity-90 transition"
                        >
                          Devices
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSend("show home status")}
                          className="py-2.5 rounded-2xl bg-white/10 text-white text-sm border border-white/10 hover:bg-white/15 transition"
                        >
                          Home Summary
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSend("open community")}
                          className="py-2.5 rounded-2xl bg-white/10 text-white text-sm border border-white/10 hover:bg-white/15 transition"
                        >
                          Community
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSend("open visitor")}
                          className="py-2.5 rounded-2xl bg-white/10 text-white text-sm border border-white/10 hover:bg-white/15 transition"
                        >
                          Visitors
                        </button>
                      </div>
                    </MiniPanel>

                    <MiniPanel
                      title="System Activity"
                      subtitle="Fast context without waiting for the chat."
                    >
                      <div className="space-y-2">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 flex items-start gap-3">
                          <div className="mt-0.5">
                            <Activity className="w-4 h-4 text-white/70" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm text-white/85 font-medium">
                              Devices loaded
                            </div>
                            <div className="text-xs text-white/45 mt-0.5 truncate">
                              Assigned: {assignedDevices.length} • Discovery: {discoveryDevices.length}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 flex items-start gap-3">
                          <div className="mt-0.5">
                            <Clock className="w-4 h-4 text-white/70" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm text-white/85 font-medium">
                              Command center ready
                            </div>
                            <div className="text-xs text-white/45 mt-0.5 truncate">
                              Use chat below to control devices & open panels.
                            </div>
                          </div>
                        </div>
                      </div>
                    </MiniPanel>
                  </div>
                </div>

                {/* Chat stream (UNCHANGED) */}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className="max-w-[80%] relative z-[20]">
                      {/* bubble */}
                      <div
                        className="px-4 py-2 rounded-2xl border border-white/10 relative z-[20]"
                        style={
                          m.role === "user"
                            ? {
                                background:
                                  "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.18) 100%), var(--brand)",
                                color: "white",
                                boxShadow:
                                  "0 10px 26px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.10) inset",
                              }
                            : {
                                background: "rgba(255,255,255,0.06)",
                                color: "rgba(255,255,255,0.92)",
                                backdropFilter: "blur(14px)",
                                WebkitBackdropFilter: "blur(14px)",
                                boxShadow: "0 10px 26px rgba(0,0,0,0.18)",
                              }
                        }
                      >
                        {m.content}
                      </div>

                      {/* panel */}
                      {m.panel && (
                        <div className="mt-3 relative z-[30]">
                          {m.panel === "devices" ? (
                            <div className="space-y-3">
                              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-xs text-white/60">
                                    Assigned:{" "}
                                    <span className="text-white/85 font-semibold">
                                      {assignedDevices.length}
                                    </span>{" "}
                                    • Discovery:{" "}
                                    <span className="text-white/85 font-semibold">
                                      {discoveryDevices.length}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={refreshDevicePanelData}
                                    disabled={devicesBusy}
                                    className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] text-white/80 border border-white/10 disabled:opacity-50"
                                  >
                                    {devicesBusy ? "Refreshing…" : "Refresh"}
                                  </button>
                                </div>

                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setDevicesTab("assigned")}
                                    className={`py-2 rounded-xl text-xs border transition ${
                                      devicesTab === "assigned"
                                        ? "bg-white text-black border-white/20"
                                        : "bg-white/5 text-white/75 border-white/10 hover:bg-white/10"
                                    }`}
                                  >
                                    Assigned
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDevicesTab("discovery")}
                                    className={`py-2 rounded-xl text-xs border transition ${
                                      devicesTab === "discovery"
                                        ? "bg-white text-black border-white/20"
                                        : "bg-white/5 text-white/75 border-white/10 hover:bg-white/10"
                                    }`}
                                  >
                                    Discovery
                                  </button>
                                </div>

                                {devicesErr && (
                                  <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                                    {devicesErr}
                                  </div>
                                )}
                              </div>

                              {devicesTab === "assigned" ? (
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs text-white/70 font-semibold">
                                      Devices in your home
                                    </div>
                                    <div className="text-[11px] text-white/45">(saved to DB)</div>
                                  </div>

                                  <div className="mt-3 space-y-2">
                                    {assignedDevices.map((d) => {
                                      const k =
                                        devKey(d) || Math.random().toString(36).slice(2);
                                      return (
                                        <div
                                          key={k}
                                          className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2"
                                        >
                                          <div className="min-w-0">
                                            <div className="text-[13px] text-white/90 font-semibold truncate">
                                              {devLabel(d)}
                                            </div>
                                            <div className="text-[11px] text-white/45 truncate">
                                              {devSub(d) || "—"}
                                            </div>
                                          </div>

                                          <div className="text-[11px] text-white/45 shrink-0">
                                            {d?.status
                                              ? String(d.status)
                                              : typeof d?.online === "boolean"
                                              ? d.online
                                                ? "Online"
                                                : "Offline"
                                              : ""}
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {!devicesBusy && assignedDevices.length === 0 && (
                                      <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
                                        No assigned devices yet. Go to{" "}
                                        <span className="text-white/80 font-semibold">
                                          Discovery
                                        </span>{" "}
                                        to bind devices to your account/home.
                                      </div>
                                    )}

                                    {devicesBusy && (
                                      <div className="flex items-center gap-3 text-xs text-white/50">
                                        <div className="w-4 h-4 border-2 border-white/15 border-t-white/70 rounded-full animate-spin" />
                                        Loading assigned devices…
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <DeviceDiscoveryPanel
                                  devices={discoveryDevices}
                                  onInteraction={refreshDevicePanelData}
                                />
                              )}
                            </div>
                          ) : (
                            <RemotePanelRenderer
                              panel={m.panel}
                              deviceId={m.deviceId}
                              lastUpdated={m.lastUpdated}
                              onInteraction={() =>
                                setMessages((prev) =>
                                  prev.map((x) =>
                                    x.id === m.id
                                      ? {
                                          ...x,
                                          time: new Date().toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          }),
                                          lastUpdated: Date.now(),
                                        }
                                      : x
                                  )
                                )
                              }
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <div ref={bottomRef} />
              </div>
            </div>
          </div>

          {/* suggestions */}
          <div className="fixed left-0 right-0 z-[50] px-4 chat-suggestions">
            <div className="max-w-3xl mx-auto">
              <DynamicSuggestionCard onSend={(t) => handleSend(t)} />
            </div>
          </div>

          {/* footer */}
          <div
            className="fixed bottom-0 left-0 right-0 z-[60] border-t border-white/10 chat-footer"
            style={{
              background: "rgba(10,12,18,0.72)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
            }}
          >
            <div className="max-w-3xl mx-auto px-4 pt-4">
              <ChatFooter input={input} setInput={setInput} onSend={() => handleSend()} />
            </div>
          </div>
        </div>
      </main>
    </LayoutWrapper>
  );
}
