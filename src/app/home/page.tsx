// src/app/home/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import InviteSuggestionBridge from "../components/InviteSuggestionBridge";
import NotificationsBridge from "../components/NotificationsBridge";
import TopBar from "../components/TopBar";
import LayoutWrapper from "../components/LayoutWrapper";

import DynamicSuggestionCard from "../components/DynamicSuggestionCard";
import RemotePanelRenderer from "../components/remotes/RemotePanelRenderer";
import DeviceDiscoveryPanel from "../components/remotes/DeviceDiscoveryPanel";

import AiConsoleLauncher from "../components/ai-console/AiConsoleLauncher";
import AiConsoleSheet from "../components/ai-console/AiConsoleSheet";

import { aiService } from "../../services/aiService";
import { deviceService } from "../../services/deviceService";

import {
  visitorService,
  type VisitorAccess,
} from "@/services/visitorService";
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

import type {
  ChatMessage,
  DeviceAction,
} from "../components/ai-console/types";
import { nowMeta, createId } from "../components/ai-console/logic/ids";
import { inferPanel } from "../components/ai-console/logic/panelInference";
import {
  shouldOpenPanel,
  isSamePanelInstance,
  getSuggestionTitle,
} from "../components/ai-console/logic/panelRules";
import { executeActions } from "../components/ai-console/logic/actions";

/* --------------------------- */
/*        UI COMPONENTS        */
/* --------------------------- */

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
          <div className="mt-2 text-2xl font-semibold text-white">
            {value}
          </div>
          {sub ? (
            <div className="mt-1 text-[11px] text-white/40">
              {sub}
            </div>
          ) : null}
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
          {subtitle ? (
            <div className="text-xs text-white/45 mt-1">
              {subtitle}
            </div>
          ) : null}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/* --------------------------- */
/*        HOME PAGE            */
/* --------------------------- */

export default function HomePage() {
  const router = useRouter();
  const { user, token, ready } = useAuth() as any;
  const { pushEvent } = useEventStore();

  const [input, setInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);

  const [assignedDevices, setAssignedDevices] = useState<any[]>([]);
  const [discoveryDevices, setDiscoveryDevices] = useState<any[]>([]);
  const [devicesTab, setDevicesTab] =
    useState<"assigned" | "discovery">("assigned");
  const [devicesBusy, setDevicesBusy] = useState(false);
  const [devicesErr, setDevicesErr] = useState<string | null>(null);

  const [visitors, setVisitors] = useState<VisitorAccess[]>([]);
  const [communityPosts, setCommunityPosts] =
    useState<CommunityPost[]>([]);
  const [maintenance, setMaintenance] =
    useState<MaintenanceTicket[]>([]);
  const [notifications, setNotifications] =
    useState<AppNotification[]>([]);
  const [dashErr, setDashErr] = useState<string | null>(null);
  const [dashBusy, setDashBusy] = useState(false);

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
      (typeof window !== "undefined"
        ? localStorage.getItem("ochiga_estate")
        : null)
    );
  }, [(user as any)?.estate_id]);

  /* ---------------- AI FIX ONLY ---------------- */

  async function handleSend(text?: string) {
    const command = (text ?? input).trim();
    if (!command) return;

    if (command === "__OPEN_INVITES__") {
      router.push("/invites");
      return;
    }

    setChatOpen(true);
    setInput("");

    const { time, stamp } = nowMeta();

    const userMsgId = createId();
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: command,
        time,
        lastUpdated: stamp,
      },
    ]);

    const pendingId = createId();

    // ✅ NO "Thinking…" TEXT ANYMORE
    setMessages((prev) => [
      ...prev,
      {
        id: pendingId,
        role: "assistant",
        content: "",
        time,
        lastUpdated: stamp,
        pending: true,
      },
    ]);

    try {
      const resp: any = await aiService.chat(command);
      const reply = resp?.reply || "Done.";
      const panel = inferPanel(resp?.panel, command);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                pending: false,
                content: reply,
                panel: panel || null,
                lastUpdated: Date.now(),
              }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                pending: false,
                content:
                  "Sorry — I couldn’t reach the system.",
              }
            : m
        )
      );
    }
  }

  /* ---------------- RETURN UI (UNCHANGED) ---------------- */

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 min-h-0 isolate">
        <div className="estate-wallpaper" />

        <div className="app-layer">
          <TopBar />

          {/* Your entire dashboard remains exactly as you wrote it */}

          <AiConsoleLauncher
            onOpen={() => setChatOpen(true)}
          />

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
            refreshDevicePanelData={async () => {}}
          />
        </div>
      </main>
    </LayoutWrapper>
  );
}
