"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import InviteSuggestionBridge from "../components/InviteSuggestionBridge";
import NotificationsBridge from "../components/NotificationsBridge";
import TopBar from "../components/TopBar";
import LayoutWrapper from "../components/LayoutWrapper";

import AiConsoleLauncher from "../components/ai-console/AiConsoleLauncher";
import AiConsoleSheet from "../components/ai-console/AiConsoleSheet";

import { aiService } from "../../services/aiService";
import { deviceService } from "../../services/deviceService";

import { visitorService } from "@/services/visitorService";
import { communityService } from "@/services/communityService";
import { maintenanceService } from "@/services/maintenanceService";
import { listMyNotifications } from "@/services/notificationsService";

import useAuth from "../../hooks/useAuth";
import { useEventStore } from "../../store/useEventStore";

import type { ChatMessage, DeviceAction } from "../components/ai-console/types";
import { nowMeta, createId } from "../components/ai-console/logic/ids";
import { inferPanel } from "../components/ai-console/logic/panelInference";
import {
  shouldOpenPanel,
  isSamePanelInstance,
  getSuggestionTitle,
} from "../components/ai-console/logic/panelRules";
import { executeActions } from "../components/ai-console/logic/actions";

export default function HomePage() {
  const router = useRouter();
  const { user, token, ready } = useAuth() as any;
  const { pushEvent } = useEventStore();

  const [input, setInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);

  const [assignedDevices, setAssignedDevices] = useState<any[]>([]);
  const [discoveryDevices, setDiscoveryDevices] = useState<any[]>([]);
  const [devicesTab, setDevicesTab] = useState<"assigned" | "discovery">(
    "assigned"
  );
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
      (typeof window !== "undefined"
        ? localStorage.getItem("ochiga_estate")
        : null)
    );
  }, [(user as any)?.estate_id]);

  async function refreshDevicePanelData() {
    setDevicesBusy(true);
    setDevicesErr(null);

    try {
      const [assigned, discovered] = await Promise.all([
        estateId
          ? deviceService.getDevices(estateId)
          : Promise.resolve([]),
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

  useEffect(() => {
    refreshDevicePanelData();
  }, [estateId]);

  // ✅ UPDATED AI SEND LOGIC (no "Thinking…")
  async function handleSend(text?: string) {
    const command = (text ?? input).trim();
    if (!command) return;

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

    // ✅ NO TEXT — JUST PENDING FLAG
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

      const reply =
        resp?.reply ||
        `Got it. ${command.charAt(0).toUpperCase()}${command.slice(1)}.`;

      const panel = inferPanel(resp?.panel, command);
      const actions: DeviceAction[] | undefined = resp?.actions;

      if (actions?.length) {
        await executeActions(actions);
      }

      const openPanel = shouldOpenPanel(command, panel);
      const deviceId = resp?.deviceId;

      setMessages((prev) =>
        prev.map((m) => {
          if (openPanel && panel && isSamePanelInstance(m, panel, deviceId) && m.id !== pendingId) {
            return { ...m, panel: null, deviceId: undefined };
          }

          if (m.id === pendingId) {
            return {
              ...m,
              pending: false,
              content: reply,
              panel: openPanel ? panel || null : null,
              deviceId,
              time,
              lastUpdated: stamp,
            };
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
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                pending: false,
                content: "Sorry — I couldn’t reach the system.",
              }
            : m
        )
      );
    }
  }

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 isolate">
        <div className="estate-wallpaper" />

        <div className="app-layer">
          {ready && token && (
            <>
              <InviteSuggestionBridge />
              <NotificationsBridge />
            </>
          )}

          <TopBar />

          {/* Floating launcher */}
          <AiConsoleLauncher onOpen={() => setChatOpen(true)} />

          {/* AI Console */}
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
