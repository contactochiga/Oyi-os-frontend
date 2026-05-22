// src/app/home/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bell,
  ChevronRight,
  Home,
  Leaf,
  Lightbulb,
  Lock,
  MessageSquare,
  Moon,
  ShieldCheck,
  Sparkles,
  Thermometer,
  UserCheck,
  Wallet,
  Zap,
} from "lucide-react";

import LayoutWrapper from "../components/LayoutWrapper";
import InviteSuggestionBridge from "../components/InviteSuggestionBridge";
import NotificationsBridge from "../components/NotificationsBridge";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import AiConsoleSheet from "../components/ai-console/AiConsoleSheet";

import { aiService } from "../../services/aiService";
import { deviceService } from "../../services/deviceService";
import { walletService } from "@/services/walletService";
import { visitorService, type VisitorAccess } from "@/services/visitorService";
import { communityService, type CommunityPost } from "@/services/communityService";
import { maintenanceService, type MaintenanceTicket } from "@/services/maintenanceService";
import { listMyNotifications, type AppNotification } from "@/services/notificationsService";
import useAuth from "../../hooks/useAuth";
import { useEventStore } from "../../store/useEventStore";

import type { ChatMessage, DeviceAction } from "../components/ai-console/types";
import { nowMeta, createId } from "../components/ai-console/logic/ids";
import { inferPanel } from "../components/ai-console/logic/panelInference";
import { executeActions } from "../components/ai-console/logic/actions";
import { getSuggestionTitle, isSamePanelInstance, shouldOpenPanel } from "../components/ai-console/logic/panelRules";

function isOnline(device: any) {
  if (typeof device?.online === "boolean") return device.online;
  const status = String(device?.status || device?.state || "").toLowerCase();
  return status.includes("online") || status.includes("active") || status.includes("connected") || status === "on";
}

function timeLabel(iso?: string | null) {
  if (!iso) return "Just now";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function AmbientPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[28px] border border-white/10 bg-white/[0.045] shadow-[0_18px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl ${className}`}>
      {children}
    </section>
  );
}

function QuickControl({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-left text-white/80 transition hover:bg-white/[0.07] active:scale-[0.98]"
    >
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-300/10 text-sky-100">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
    </button>
  );
}

function SpaceCard({ title, detail, tone, onClick }: { title: string; detail: string; tone: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-h-[132px] rounded-[26px] border border-white/10 bg-black/20 p-4 text-left transition hover:bg-white/[0.065] active:scale-[0.99]"
    >
      <div className="flex h-full flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
            <ChevronRight className="h-4 w-4 text-white/28 transition group-hover:text-white/60" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
        </div>
        <p className="mt-3 text-xs leading-5 text-white/48">{detail}</p>
      </div>
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { user, token, ready } = useAuth() as any;
  const { pushEvent } = useEventStore();

  const [input, setInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [assignedDevices, setAssignedDevices] = useState<any[]>([]);
  const [discoveryDevices, setDiscoveryDevices] = useState<any[]>([]);
  const [devicesTab, setDevicesTab] = useState<"assigned" | "discovery">("assigned");
  const [devicesBusy, setDevicesBusy] = useState(false);
  const [devicesErr, setDevicesErr] = useState<string | null>(null);
  const [visitors, setVisitors] = useState<VisitorAccess[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceTicket[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [dashErr, setDashErr] = useState<string | null>(null);
  const [dashBusy, setDashBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "sys-1",
      role: "assistant",
      content: "I am here. Tell me what you want the home to check, open, or prepare.",
      ...nowMeta(),
      lastUpdated: Date.now(),
    },
  ]);

  const estateId = useMemo(
    () => (user as any)?.estate_id ?? (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [(user as any)?.estate_id]
  );

  const aiContextDevices = useMemo(
    () =>
      assignedDevices
        .map((d: any) => ({
          id: String(d?.id || d?.external_id || d?.externalId || d?.device_id || d?.dev_id || d?.uuid || ""),
          name: String(d?.name || d?.label || d?.type || "Device"),
          type: d?.type ? String(d.type) : null,
          room: d?.room_name || d?.room || null,
          status: d?.status || null,
        }))
        .filter((d) => d.id),
    [assignedDevices]
  );

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
      const wallet = await walletService.getWallet();
      setVisitors(Array.isArray(v) ? v : []);
      setMaintenance(Array.isArray(m as any) ? (m as any) : []);
      setNotifications(Array.isArray(n) ? n : []);
      setCommunityPosts(Array.isArray(c) ? c : []);
      setWalletBalance(wallet?.error ? null : Number(wallet?.balance ?? 0));
    } catch (e: any) {
      setDashErr(e?.message || "Oyi could not load home state yet.");
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
    if (command === "__OPEN_INVITES__") return router.push("/invites");

    setChatOpen(true);
    setInput("");
    const { time, stamp } = nowMeta();
    const userMsgId = createId();
    const pendingId = createId();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: command, time, lastUpdated: stamp },
      { id: pendingId, role: "assistant", content: "", time, lastUpdated: stamp, pending: true },
    ]);

    try {
      const resp: any = await aiService.chat(command, { estateId: estateId || null, devices: aiContextDevices });
      const replyBase = resp?.reply || "I have received that. I did not execute anything sensitive without confirmation.";
      const panel = inferPanel(resp?.panel, command);
      const actions: DeviceAction[] | undefined = resp?.actions;
      let actionFailure = "";
      if (actions?.length) {
        const results = await executeActions(actions);
        if (results.some((r) => !r.ok)) actionFailure = " Some actions could not complete. Check permissions and device state.";
      }
      const reply = `${replyBase}${actionFailure}`;
      const openPanel = shouldOpenPanel(command, panel);
      const deviceId = resp?.deviceId;

      setMessages((prev) =>
        prev.map((m) => {
          if (openPanel && panel && isSamePanelInstance(m, panel, deviceId) && m.id !== pendingId) {
            return { ...m, panel: null, deviceId: undefined };
          }
          if (m.id === pendingId) {
            return { ...m, pending: false, content: reply, panel: openPanel ? panel || null : null, deviceId, time, lastUpdated: stamp };
          }
          return m;
        })
      );

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
      setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...m, pending: false, content: "Oyi could not reach the intelligence layer right now." } : m)));
    }
  }

  const totalDevices = assignedDevices.length;
  const activeDevices = assignedDevices.filter(isOnline).length;
  const activeVisitors = visitors.filter((v) => ["entered", "active", "approved"].includes(String(v.status || "").toLowerCase())).length;
  const openMaintenance = maintenance.length;
  const unread = notifications.filter((n) => String(n.status || "").toLowerCase() === "unread").length;
  const latestActivity = [...notifications]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);
  const homeState = dashErr ? "Needs attention" : openMaintenance || unread ? "Awake" : "Calm";
  const securityState = activeVisitors ? `${activeVisitors} visitor signal${activeVisitors === 1 ? "" : "s"}` : "Perimeter calm";
  const atmosphere = totalDevices ? `${activeDevices}/${totalDevices} devices responsive` : "Awaiting connected devices";
  const canMountAuthedBridges = !!ready && !!token;

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 min-h-0 isolate overflow-hidden bg-[#03070c] text-white">
        <div className="oyi-ambient-bg" />
        <div className="relative z-10">
          {canMountAuthedBridges ? (
            <>
              <InviteSuggestionBridge />
              <NotificationsBridge />
            </>
          ) : null}
          <TopBar />
        </div>

        <div
          className="absolute inset-x-0 overflow-y-auto px-4"
          style={{
            zIndex: 20,
            top: "calc(64px + var(--sat))",
            bottom: "calc(92px + var(--sab))",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className="mx-auto max-w-5xl py-5">
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]"
            >
              <AmbientPanel className="relative overflow-hidden p-5">
                <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-sky-400/10 blur-3xl" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.26em] text-sky-100/55">Living Intelligence OS</div>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Home is {homeState.toLowerCase()}.</h1>
                    <p className="mt-3 max-w-sm text-sm leading-6 text-white/56">
                      {atmosphere}. {securityState}. Oyi is quietly watching the environment and will surface what matters.
                    </p>
                  </div>
                  <button type="button" onClick={() => setChatOpen(true)} className="oyi-orb h-24 w-24 shrink-0 active:scale-[0.98]" aria-label="Open Oyi" />
                </div>
                <div className="relative mt-5 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] text-white/40">Atmosphere</div>
                    <div className="mt-1 text-sm font-semibold text-white">{homeState}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] text-white/40">Security</div>
                    <div className="mt-1 text-sm font-semibold text-white">Protected</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] text-white/40">Wallet</div>
                    <div className="mt-1 text-sm font-semibold text-white">₦{Number(walletBalance || 0).toLocaleString()}</div>
                  </div>
                </div>
              </AmbientPanel>

              <AmbientPanel className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/38">Ambient AI</div>
                    <h2 className="mt-1 text-lg font-semibold text-white">Oyi is listening through context.</h2>
                  </div>
                  <div className="oyi-wave-line" aria-hidden="true">
                    {Array.from({ length: 16 }).map((_, index) => (
                      <i key={index} style={{ "--h": `${7 + ((index * 9) % 18)}px`, "--d": `${index * 46}ms` } as React.CSSProperties} />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChatOpen(true)}
                  className="mt-5 w-full rounded-3xl border border-sky-300/15 bg-sky-300/10 px-4 py-4 text-left transition hover:bg-sky-300/15 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-sky-100" />
                    <div>
                      <div className="text-sm font-semibold text-white">Ask Oyi to check, open, summarize, or prepare.</div>
                      <div className="mt-1 text-xs text-white/45">Sensitive actions still require permission and confirmation.</div>
                    </div>
                  </div>
                </button>
                {dashErr ? <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">{dashErr}</div> : null}
              </AmbientPanel>
            </motion.section>

            <section className="mt-4 flex gap-2 overflow-x-auto pb-1">
              <QuickControl label="Lights" icon={<Lightbulb className="h-4 w-4" />} onClick={() => router.push("/devices?category=lighting")} />
              <QuickControl label="Climate" icon={<Thermometer className="h-4 w-4" />} onClick={() => router.push("/utilities")} />
              <QuickControl label="Security" icon={<Lock className="h-4 w-4" />} onClick={() => router.push("/security")} />
              <QuickControl label="Scenes" icon={<Moon className="h-4 w-4" />} onClick={() => router.push("/devices")} />
              <QuickControl label="Energy" icon={<Zap className="h-4 w-4" />} onClick={() => router.push("/utilities")} />
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
              <AmbientPanel className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/38">Spatial Layer</div>
                    <h2 className="mt-1 text-lg font-semibold text-white">Spaces</h2>
                  </div>
                  <button type="button" onClick={() => router.push("/rooms")} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/65">View all</button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <SpaceCard title="Living Room" detail="Comfort, lights, entertainment and shared mood." tone="bg-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.7)]" onClick={() => router.push("/rooms")} />
                  <SpaceCard title="Kitchen" detail="Utility awareness, safety signals and routines." tone="bg-emerald-300 shadow-[0_0_16px_rgba(95,227,161,0.7)]" onClick={() => router.push("/rooms")} />
                  <SpaceCard title="Bedroom" detail="Quiet scenes, climate and night automation." tone="bg-indigo-300 shadow-[0_0_16px_rgba(165,180,252,0.7)]" onClick={() => router.push("/rooms")} />
                  <SpaceCard title="Outdoor" detail="Gate, perimeter, lights and visitor flow." tone="bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.7)]" onClick={() => router.push("/security")} />
                  <SpaceCard title="Security" detail="Access, cameras and unusual motion." tone="bg-rose-300 shadow-[0_0_16px_rgba(253,164,175,0.7)]" onClick={() => router.push("/security")} />
                  <SpaceCard title="Utilities" detail="Power, water, network and energy posture." tone="bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.7)]" onClick={() => router.push("/utilities")} />
                </div>
              </AmbientPanel>

              <AmbientPanel className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/38">Activity</div>
                    <h2 className="mt-1 text-lg font-semibold text-white">What matters now</h2>
                  </div>
                  {dashBusy ? <span className="text-xs text-white/42">Syncing…</span> : null}
                </div>
                <div className="mt-4 space-y-3">
                  {latestActivity.length ? latestActivity.map((item) => (
                    <button key={item.id} type="button" onClick={() => router.push("/notifications")} className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-left transition hover:bg-white/[0.06]">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-full bg-sky-300/10 text-sky-100"><Bell className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-white/88">{item.title || "Home update"}</div>
                          <div className="mt-1 truncate text-xs text-white/42">{item.message || item.type || "Oyi activity"}</div>
                        </div>
                        <span className="text-[10px] text-white/34">{timeLabel(item.created_at)}</span>
                      </div>
                    </button>
                  )) : (
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-sm text-white/48">No activity yet. Oyi will surface visitors, access logs, maintenance and alerts here.</div>
                  )}
                </div>
              </AmbientPanel>
            </section>

            <section className="mt-4 grid gap-4 pb-8 sm:grid-cols-2 lg:grid-cols-4">
              <AmbientPanel className="p-4">
                <ShieldCheck className="h-5 w-5 text-emerald-200" />
                <div className="mt-3 text-sm font-semibold text-white">Protected</div>
                <div className="mt-1 text-xs text-white/45">{securityState}</div>
              </AmbientPanel>
              <AmbientPanel className="p-4">
                <UserCheck className="h-5 w-5 text-sky-200" />
                <div className="mt-3 text-sm font-semibold text-white">Visitors</div>
                <div className="mt-1 text-xs text-white/45">{activeVisitors || "No active visitor"}</div>
              </AmbientPanel>
              <AmbientPanel className="p-4">
                <MessageSquare className="h-5 w-5 text-violet-200" />
                <div className="mt-3 text-sm font-semibold text-white">Community</div>
                <div className="mt-1 text-xs text-white/45">{communityPosts.length} estate update{communityPosts.length === 1 ? "" : "s"}</div>
              </AmbientPanel>
              <AmbientPanel className="p-4">
                <Leaf className="h-5 w-5 text-emerald-200" />
                <div className="mt-3 text-sm font-semibold text-white">Maintenance</div>
                <div className="mt-1 text-xs text-white/45">{openMaintenance ? `${openMaintenance} open request${openMaintenance === 1 ? "" : "s"}` : "No open request"}</div>
              </AmbientPanel>
            </section>
          </div>
        </div>

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

        <BottomNav />
      </main>
    </LayoutWrapper>
  );
}
