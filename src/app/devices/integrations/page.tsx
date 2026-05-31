"use client";

import { useEffect, useState } from "react";
import { Plug, Watch, Home, Speaker, Cloud, Cpu } from "lucide-react";

import ConsumerShell from "@/app/components/ConsumerShell";
import useAuth from "@/hooks/useAuth";
import API from "@/services/api";
import { getGenericIntegration, getTuyaIntegration } from "@/services/integrationsService";
import { describeOyiWatchStatus, getOyiWatchSyncStatus, isOyiWatchConnected } from "@/services/watchSyncService";

type IntegrationItem = {
  key: string;
  label: string;
  status: "Connected" | "Not Connected" | "Not configured";
  detail?: string | null;
  icon: any;
};

export default function DeviceIntegrationsPage() {
  const { token, ready } = useAuth() as any;
  const [items, setItems] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingTuya, setSyncingTuya] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  async function syncTuya() {
    setSyncingTuya(true);
    setSyncMessage("");
    try {
      const res = await API.post("/me/integrations/tuya/sync");
      const created = Number(res.data?.created || 0);
      const updated = Number(res.data?.updated || 0);
      setSyncMessage(`Tuya sync complete. ${created} new, ${updated} updated.`);
    } catch (err: any) {
      setSyncMessage(err?.response?.data?.error || err?.message || "Tuya sync failed.");
    } finally {
      setSyncingTuya(false);
    }
  }

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [watch, tuya, appleHome, google, alexa, edge] = await Promise.allSettled([
        getOyiWatchSyncStatus().catch(() => null),
        getTuyaIntegration(),
        API.get("/me/integrations/apple_home").then((res) => res.data).catch(() => ({ connected: false })),
        getGenericIntegration("google_assistant"),
        getGenericIntegration("alexa"),
        API.get("/me/integrations/oyi_edge").then((res) => res.data).catch(() => ({ connected: false })),
      ]);
      if (cancelled) return;
      const watchValue: any = watch.status === "fulfilled" ? watch.value : null;
      const tuyaValue: any = tuya.status === "fulfilled" ? tuya.value : null;
      const appleValue: any = appleHome.status === "fulfilled" ? appleHome.value : null;
      const googleValue: any = google.status === "fulfilled" ? google.value : null;
      const alexaValue: any = alexa.status === "fulfilled" ? alexa.value : null;
      const edgeValue: any = edge.status === "fulfilled" ? edge.value : null;
      setItems([
        { key: "watch", label: "Oyi Watch", status: isOyiWatchConnected(watchValue) ? "Connected" : "Not Connected", detail: describeOyiWatchStatus(watchValue), icon: Watch },
        { key: "tuya", label: "Tuya / Smart Life", status: tuyaValue?.connected ? "Connected" : "Not Connected", detail: tuyaValue?.masked_uid || null, icon: Plug },
        { key: "apple", label: "Apple Home", status: appleValue?.connected ? "Connected" : "Not Connected", detail: appleValue?.masked_external_user_id || null, icon: Home },
        { key: "google", label: "Google Home", status: googleValue?.connected ? "Connected" : "Not Connected", detail: googleValue?.masked_external_user_id || null, icon: Cloud },
        { key: "alexa", label: "Alexa", status: alexaValue?.connected ? "Connected" : "Not Connected", detail: alexaValue?.masked_external_user_id || null, icon: Speaker },
        { key: "edge", label: "Oyi Edge", status: edgeValue?.connected ? "Connected" : "Not configured", detail: edgeValue?.label || null, icon: Cpu },
      ]);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  return (
    <ConsumerShell title="Integrations" subtitle="Connected services for your home.">
      <section className="overflow-hidden rounded-[22px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.042),rgba(255,255,255,0.012))] shadow-[0_14px_48px_rgba(0,0,0,0.29)] backdrop-blur-2xl">
        {loading ? <div className="px-4 py-5 text-sm text-white/50">Loading integrations…</div> : null}
        {!loading && items.map((item, index) => {
          const Icon = item.icon;
          const connected = item.status === "Connected";
          return (
            <div key={item.key} className={`flex items-center gap-3 px-3.5 py-3 ${index ? "border-t border-white/[0.055]" : ""}`}>
              <span className={`grid h-9 w-9 place-items-center rounded-full border ${connected ? "border-emerald-300/15 bg-emerald-400/10 text-emerald-200" : "border-white/[0.07] bg-white/[0.035] text-white/48"}`}><Icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{item.label}</span>{item.detail ? <span className="mt-0.5 block truncate text-xs text-white/42">{item.detail}</span> : null}</span>
              {item.key === "tuya" && connected ? (
                <button type="button" onClick={() => void syncTuya()} disabled={syncingTuya} className="rounded-full border border-sky-300/18 bg-sky-400/10 px-2.5 py-1 text-[10px] font-medium text-sky-100 disabled:opacity-50">
                  {syncingTuya ? "Syncing" : "Sync"}
                </button>
              ) : <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${connected ? "bg-emerald-400/10 text-emerald-200" : "bg-white/[0.045] text-white/48"}`}>{item.status}</span>}
            </div>
          );
        })}
        {syncMessage ? <div className="border-t border-white/[0.055] px-3.5 py-3 text-xs text-white/54">{syncMessage}</div> : null}
      </section>
    </ConsumerShell>
  );
}
