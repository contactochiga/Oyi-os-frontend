// src/app/home/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import InviteSuggestionBridge from "../components/InviteSuggestionBridge";
import NotificationsBridge from "../components/NotificationsBridge";
import TopBar from "../components/TopBar";
import LayoutWrapper from "../components/LayoutWrapper";

// ✅ Dashboard UI (kept in-page to avoid breaking; you can separate later)
import DynamicSuggestionCard from "../components/DynamicSuggestionCard"; // still used in dashboard quick actions
import RemotePanelRenderer from "../components/remotes/RemotePanelRenderer";
import DeviceDiscoveryPanel from "../components/remotes/DeviceDiscoveryPanel";

// ✅ NEW: AI Console separation
import AiConsoleLauncher from "../components/ai-console/AiConsoleLauncher";
import AiConsoleSheet from "../components/ai-console/AiConsoleSheet";

// ✅ AI brain helpers (from your new separation)
import { aiService } from "../../services/aiService";
import { deviceService } from "../../services/deviceService";

import { visitorService, type VisitorAccess } from "@/services/visitorService";
import { communityService, type CommunityPost } from "@/services/communityService";
import { maintenanceService, type MaintenanceTicket } from "@/services/maintenanceService";
import { listMyNotifications, type AppNotification } from "@/services/notificationsService";

import useAuth from "../../hooks/useAuth";
import { useEventStore } from "../../store/useEventStore";

import {
  LayoutDashboard,
  Zap,
  DollarSign,
  Users,
  UserCheck,
  Wrench,
  Bell,
  Activity,
  Clock,
  ChevronRight,
} from "lucide-react";

import { motion } from "framer-motion";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ✅ If you moved these helpers into ai-console/logic, import them from there.
// Adjust paths if your folder differs.
import type { ChatMessage, DeviceAction } from "../components/ai-console/types";
import { nowMeta, createId } from "../components/ai-console/logic/ids";
import { inferPanel } from "../components/ai-console/logic/panelInference";
import {
  shouldOpenPanel,
  isSamePanelInstance,
  getSuggestionTitle,
} from "../components/ai-console/logic/panelRules";
import { executeActions } from "../components/ai-console/logic/actions";

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
      className="text-left rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 transition p-4"
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

function PanelCard({
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

function dayKey(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString([], { weekday: "short" });
}

function sumByWeekday(items: { created_at?: string | null }[]) {
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const map: Record<string, number> = {};
  for (const k of order) map[k] = 0;

  for (const it of items) {
    const k = dayKey(it.created_at || null);
    if (k && map[k] != null) map[k] += 1;
  }

  return order.map((k) => ({ day: k, count: map[k] || 0 }));
}

export default function HomePage() {
  const router = useRouter();
  const { user, token, ready } = useAuth() as any;
  const { pushEvent } = useEventStore();

  const [input, setInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);

  // devices panel data
  const [assignedDevices, setAssignedDevices] = useState<any[]>([]);
  const [discoveryDevices, setDiscoveryDevices] = useState<any[]>([]);
  const [devicesTab, setDevicesTab] = useState<"assigned" | "discovery">("assigned");
  const [devicesBusy, setDevicesBusy] = useState(false);
  const [devicesErr, setDevicesErr] = useState<string | null>(null);

  // dashboard data
  const [visitors, setVisitors] = useState<VisitorAccess[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceTicket[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [dashErr, setDashErr] = useState<string | null>(null);
  const [dashBusy, setDashBusy] = useState(false);

  // chat messages
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
    return (user as any)?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null);
  }, [(user as any)?.estate_id]);

  const aiContextDevices = useMemo(() => {
    const normalize = (d: any) => ({
      id: String(
        d?.id ||
          d?.external_id ||
          d?.externalId ||
          d?.device_id ||
          d?.dev_id ||
          d?.uuid ||
          ""
      ),
      name: String(d?.name || d?.label || d?.type || "Device"),
      type: d?.type ? String(d.type) : null,
      room: d?.room_name || d?.room || null,
      status: d?.status || null,
    });

    return [...assignedDevices, ...discoveryDevices]
      .map(normalize)
      .filter((d) => d.id);
  }, [assignedDevices, discoveryDevices]);

  const dashScrollRef = useRef<HTMLDivElement | null>(null);

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

  async function refreshDashboardData() {
    if (!ready || !token) return;

    setDashBusy(true);
    setDashErr(null);

    try {
      const [v, m, n, c] = await Promise.all([
        visitorService.listMine(),
        maintenanceService.listMyTickets({ status: "open" } as any),
        listMyNotifications(),
        estateId ? communityService.listByEstate(String(estateId)) : Promise.resolve([]),
      ]);

      setVisitors(Array.isArray(v) ? v : []);
      setMaintenance(Array.isArray(m as any) ? (m as any) : []);
      setNotifications(Array.isArray(n) ? n : []);
      setCommunityPosts(Array.isArray(c) ? c : []);
    } catch (e: any) {
      setDashErr(e?.message || "Failed to load dashboard data");
    } finally {
      setDashBusy(false);
    }
  }

  useEffect(() => {
    refreshDevicePanelData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estateId]);

  useEffect(() => {
    refreshDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token, estateId]);

  async function handleSend(text?: string) {
    const command = (text ?? input).trim();
    if (!command) return;

    if (command === "__OPEN_INVITES__") {
      router.push("/invites");
      return;
    }

    // ensure chat opens whenever user sends
    setChatOpen(true);
    setInput("");

    const { time, stamp } = nowMeta();

    const userMsgId = createId();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: command, time, lastUpdated: stamp },
    ]);

    // ✅ IMPORTANT: no "Thinking…" text (TypingIndicator handles UI)
    const pendingId = createId();
    setMessages((prev) => [
      ...prev,
      { id: pendingId, role: "assistant", content: "", time, lastUpdated: stamp, pending: true },
    ]);

    try {
      const resp: any = await aiService.chat(command, {
        estateId: estateId || null,
        devices: aiContextDevices,
      });

      const reply =
        resp?.reply || `Got it. ${command.charAt(0).toUpperCase()}${command.slice(1)}.`;
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
          m.id === pendingId ? { ...m, pending: false, content: "Sorry — I couldn’t reach the system." } : m
        )
      );
    }
  }

  const canMountAuthedBridges = !!ready && !!token;

  // computed stats
  const totalDevices = assignedDevices.length;

  const activeDevices = useMemo(() => {
    return assignedDevices.filter((d) => {
      if (typeof d?.online === "boolean") return d.online;
      const s = String(d?.status || "").toLowerCase();
      if (!s) return false;
      return s.includes("online") || s.includes("active") || s.includes("on") || s.includes("connected");
    }).length;
  }, [assignedDevices]);

  const activeVisitors = useMemo(() => {
    return visitors.filter((v) => {
      const s = String(v.status || "").toLowerCase();
      return s === "entered" || s === "active";
    }).length;
  }, [visitors]);

  const approvedVisitors = useMemo(() => {
    return visitors.filter((v) => String(v.status || "").toLowerCase() === "approved").length;
  }, [visitors]);

  const openMaintenance = maintenance.length;

  const unreadNotifications = useMemo(() => {
    return notifications.filter((n) => String(n.status || "").toLowerCase() === "unread").length;
  }, [notifications]);

  const communityCount = communityPosts.length;

  const unreadCommunity = useMemo(() => {
    return notifications.filter((n) => {
      const t = String(n.type || "").toLowerCase();
      const s = String(n.status || "").toLowerCase();
      return s === "unread" && (t.includes("community") || t.includes("announcement"));
    }).length;
  }, [notifications]);

  const devicePie = useMemo(() => {
    return [
      { name: "Online", value: activeDevices },
      { name: "Offline", value: Math.max(0, totalDevices - activeDevices) },
    ];
  }, [activeDevices, totalDevices]);

  const visitorsByDay = useMemo(() => {
    return sumByWeekday(visitors.map((v) => ({ created_at: v.created_at })));
  }, [visitors]);

  const recentActivity = useMemo(() => {
    const sorted = [...notifications].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return (tb || 0) - (ta || 0);
    });
    return sorted.slice(0, 5);
  }, [notifications]);

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 min-h-0 isolate">
        <div className="estate-wallpaper" />

        <div className="app-layer">
          {canMountAuthedBridges ? (
            <>
              <InviteSuggestionBridge />
              <NotificationsBridge />
            </>
          ) : null}

          <TopBar />

          {/* DASHBOARD scroll region */}
          <div
            ref={dashScrollRef}
            className="absolute left-0 right-0 overflow-y-auto"
            style={{
              zIndex: 20,
              top: "calc(64px + var(--sat))",
              bottom: "calc(88px + var(--sab))",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              touchAction: "pan-y",
            }}
          >
            <div className="p-6 relative z-[20]">
              <div className="max-w-3xl mx-auto flex flex-col gap-4">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-white flex items-center gap-2">
                        <LayoutDashboard className="w-5 h-5 text-white/70" />
                        Dashboard Overview
                      </div>
                      <div className="text-xs text-white/45 mt-1">
                        Real counts • charts • quick actions (assistant pops up)
                      </div>

                      {estateId ? (
                        <div className="mt-2 inline-flex items-center gap-2 text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/60">
                          Estate: <span className="text-white/80">{String(estateId)}</span>
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={refreshDashboardData}
                      disabled={dashBusy}
                      className="shrink-0 rounded-xl px-3 py-2 text-sm text-white/80 bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50 transition"
                    >
                      {dashBusy ? "Refreshing…" : "Refresh"}
                    </button>
                  </div>

                  {dashErr ? (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {dashErr}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard
                      icon={<Zap className="w-4 h-4 text-sky-300" />}
                      label="Devices"
                      value={`${activeDevices}/${totalDevices || 0}`}
                      sub={
                        totalDevices
                          ? `${Math.round((activeDevices / Math.max(1, totalDevices)) * 100)}% online`
                          : "No devices yet"
                      }
                      onClick={() => handleSend("open devices")}
                    />

                    <StatCard
                      icon={<DollarSign className="w-4 h-4 text-emerald-300" />}
                      label="Wallet"
                      value={"—"}
                      sub="Tap to open"
                      onClick={() => router.push("/wallet")}
                    />

                    <StatCard
                      icon={<UserCheck className="w-4 h-4 text-purple-300" />}
                      label="Visitors"
                      value={`${activeVisitors}`}
                      sub={approvedVisitors ? `${approvedVisitors} approved` : "No approved visitors"}
                      onClick={() => router.push("/visitors")}
                    />

                    <StatCard
                      icon={<Users className="w-4 h-4 text-orange-300" />}
                      label="Community"
                      value={`${unreadCommunity || 0}`}
                      sub={`${communityCount} posts`}
                      onClick={() => router.push("/community")}
                    />
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard
                      icon={<Wrench className="w-4 h-4 text-yellow-300" />}
                      label="Maintenance"
                      value={`${openMaintenance}`}
                      sub="Open tickets"
                      onClick={() => handleSend("open maintenance")}
                    />
                    <StatCard
                      icon={<Bell className="w-4 h-4 text-pink-300" />}
                      label="Notifications"
                      value={`${unreadNotifications}`}
                      sub="Unread"
                      onClick={() => router.push("/notifications")}
                    />
                    <StatCard
                      icon={<Activity className="w-4 h-4 text-white/70" />}
                      label="Discovery"
                      value={`${discoveryDevices.length}`}
                      sub="Devices found"
                      onClick={() => handleSend("open devices")}
                    />
                    <StatCard
                      icon={<Clock className="w-4 h-4 text-white/70" />}
                      label="Assistant"
                      value="Ready"
                      sub="Tap to chat"
                      onClick={() => setChatOpen(true)}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <PanelCard
                      title="Devices Online"
                      subtitle="Live estate device availability"
                      right={
                        <button
                          type="button"
                          onClick={refreshDevicePanelData}
                          disabled={devicesBusy}
                          className="rounded-xl px-3 py-2 text-xs text-white/80 bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50 transition"
                        >
                          {devicesBusy ? "..." : "Refresh"}
                        </button>
                      }
                    >
                      <div className="h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={devicePie} dataKey="value" nameKey="name" outerRadius={70} innerRadius={40}>
                              <Cell fill="rgba(125, 211, 252, 0.9)" />
                              <Cell fill="rgba(255, 255, 255, 0.18)" />
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
                        Online: <span className="text-white/85 font-semibold">{activeDevices}</span> • Offline:{" "}
                        <span className="text-white/85 font-semibold">{Math.max(0, totalDevices - activeDevices)}</span>
                      </div>
                    </PanelCard>

                    <PanelCard title="Visitor Requests" subtitle="Created visitor access (by weekday)">
                      <div className="h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={visitorsByDay}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                            <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 12 }} />
                            <YAxis tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="count" fill="rgba(167, 139, 250, 0.9)" radius={[10, 10, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => router.push("/visitors")}
                          className="py-2.5 rounded-2xl bg-white text-black text-sm font-medium hover:opacity-90 transition"
                        >
                          Open Visitors
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSend("open visitor")}
                          className="py-2.5 rounded-2xl bg-white/10 text-white text-sm border border-white/10 hover:bg-white/15 transition"
                        >
                          Open via Chat
                        </button>
                      </div>
                    </PanelCard>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <PanelCard title="Quick Actions" subtitle="Uses your existing AI routes">
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
                          onClick={() => handleSend("open maintenance")}
                          className="py-2.5 rounded-2xl bg-white/10 text-white text-sm border border-white/10 hover:bg-white/15 transition"
                        >
                          Maintenance
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSend("open community")}
                          className="py-2.5 rounded-2xl bg-white/10 text-white text-sm border border-white/10 hover:bg-white/15 transition"
                        >
                          Community
                        </button>
                      </div>
                    </PanelCard>

                    <PanelCard title="Recent Activity" subtitle="From notifications">
                      {recentActivity.length === 0 ? (
                        <div className="text-sm text-white/55">No activity yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {recentActivity.map((n) => (
                            <div key={n.id} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm text-white/85 font-medium truncate">
                                    {n.title || "Update"}
                                  </div>
                                  <div className="text-xs text-white/45 mt-0.5 truncate">
                                    {n.message || ""}
                                  </div>
                                </div>
                                <div className="text-[11px] text-white/45 shrink-0">
                                  {String(n.status).toLowerCase() === "unread" ? "Unread" : "Read"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </PanelCard>
                  </div>
                </div>

                <div className="h-10" />
              </div>
            </div>
          </div>

          {/* ✅ NEW: Floating launcher (separated) */}
          <AiConsoleLauncher onOpen={() => setChatOpen(true)} />

          {/* ✅ NEW: Bottom sheet AI console (separated) */}
          <AiConsoleSheet
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            input={input}
            setInput={setInput}
            messages={messages}
            onSend={handleSend}
            assignedDevices={assignedDevices}
            discoveryDevices={discoveryDevices}
            devicesTab={devicesTab}
            setDevicesTab={setDevicesTab}
            devicesBusy={devicesBusy}
            devicesErr={devicesErr}
            refreshDevicePanelData={refreshDevicePanelData}
          />
        </div>
      </main>
    </LayoutWrapper>
  );
}
