"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plug, Watch, Home, Speaker, Cloud, Cpu } from "lucide-react";

import ConsumerShell from "@/app/components/ConsumerShell";
import useAuth from "@/hooks/useAuth";
import API from "@/services/api";
import { formatTuyaSyncSummary, getGenericIntegration, getStoredTuyaSyncSummary, getTuyaIntegration, saveTuyaIntegration, syncTuyaDevices, type TuyaSyncSummary } from "@/services/integrationsService";
import { describeOyiWatchStatus, getOyiWatchSyncStatus, isOyiWatchConnected, syncOyiWatchSession, type WatchSyncResult } from "@/services/watchSyncService";

type IntegrationItem = {
  key: string;
  label: string;
  status: "Connected" | "Not connected" | "Pending setup" | "Coming soon" | "Needs reconnect";
  detail?: string | null;
  icon: any;
};

function watchIntegrationStatus(status: WatchSyncResult | null): IntegrationItem["status"] {
  if (isOyiWatchConnected(status)) return "Connected";
  if (status?.deliveryState === "sync_failed" || status?.lastSyncError || status?.lastWatchError || status?.error) return "Needs reconnect";
  if (status?.deliveryState === "sync_queued" || status?.deliveryState === "sync_sent" || status?.deliveryState === "waiting_for_watch") return "Pending setup";
  if (status?.paired || status?.watchAppInstalled || status?.installed || status?.reachable) return "Pending setup";
  return "Not connected";
}

export default function DeviceIntegrationsPage() {
  const router = useRouter();
  const { token, user, ready } = useAuth() as any;
  const [items, setItems] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingTuya, setSyncingTuya] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [lastTuyaSync, setLastTuyaSync] = useState<TuyaSyncSummary | null>(() => getStoredTuyaSyncSummary());
  const [tuyaStatus, setTuyaStatus] = useState<any>(null);
  const [tuyaUid, setTuyaUid] = useState("");
  const [savingTuya, setSavingTuya] = useState(false);
  const [showAdvancedTuya, setShowAdvancedTuya] = useState(false);
  const [watchStatus, setWatchStatus] = useState<WatchSyncResult | null>(null);
  const [watchBusy, setWatchBusy] = useState(false);
  const [watchMessage, setWatchMessage] = useState("");

  async function syncTuya() {
    setSyncingTuya(true);
    setSyncMessage("");
    try {
      const result = await syncTuyaDevices();
      setLastTuyaSync(result);
      setSyncMessage(`Smart Life sync complete. ${formatTuyaSyncSummary(result)}.`);
    } catch (err: any) {
      setSyncMessage(err?.response?.data?.error || err?.message || "Tuya sync failed.");
    } finally {
      setSyncingTuya(false);
    }
  }

  async function saveTuyaUid() {
    if (!tuyaUid.trim()) return;
    setSavingTuya(true);
    setSyncMessage("");
    const result: any = await saveTuyaIntegration(tuyaUid.trim());
    if (result?.error) {
      setSyncMessage(result.error);
    } else {
      const next = await getTuyaIntegration();
      setTuyaStatus(next);
      setTuyaUid("");
      setSyncMessage("Smart Life / Tuya UID linked. Sync devices to import your registry.");
    }
    setSavingTuya(false);
  }

  async function refreshWatch() {
    setWatchBusy(true);
    const status = await getOyiWatchSyncStatus();
    setWatchStatus(status);
    setWatchMessage(describeOyiWatchStatus(status));
    setWatchBusy(false);
  }

  async function syncWatch() {
    setWatchBusy(true);
    const queued: WatchSyncResult = { available: true, deliveryState: "sync_queued", synced: false };
    setWatchStatus(queued);
    setWatchMessage(describeOyiWatchStatus(queued));
    const status = await syncOyiWatchSession(token, user);
    setWatchStatus(status);
    setWatchMessage(describeOyiWatchStatus(status));
    setWatchBusy(false);
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
      setWatchStatus(watchValue);
      const tuyaValue: any = tuya.status === "fulfilled" ? tuya.value : null;
      setTuyaStatus(tuyaValue);
      const appleValue: any = appleHome.status === "fulfilled" ? appleHome.value : null;
      const googleValue: any = google.status === "fulfilled" ? google.value : null;
      const alexaValue: any = alexa.status === "fulfilled" ? alexa.value : null;
      const edgeValue: any = edge.status === "fulfilled" ? edge.value : null;
      setItems([
        { key: "watch", label: "Oyi Watch", status: watchIntegrationStatus(watchValue), detail: describeOyiWatchStatus(watchValue), icon: Watch },
        { key: "tuya", label: "Tuya / Smart Life", status: tuyaValue?.provider_ready === false ? "Needs reconnect" : tuyaValue?.connected ? "Connected" : "Not connected", detail: tuyaValue?.masked_uid || null, icon: Plug },
        { key: "apple", label: "Apple Home", status: appleValue?.connected ? "Connected" : "Coming soon", detail: appleValue?.masked_external_user_id || null, icon: Home },
        { key: "google", label: "Google Assistant", status: googleValue?.connected ? "Connected" : "Not connected", detail: googleValue?.masked_external_user_id || null, icon: Cloud },
        { key: "alexa", label: "Alexa", status: alexaValue?.connected ? "Connected" : "Not connected", detail: alexaValue?.masked_external_user_id || null, icon: Speaker },
        { key: "edge", label: "Oyi Edge", status: edgeValue?.connected ? "Connected" : "Pending setup", detail: edgeValue?.label || "Local discovery requires an installed Edge node", icon: Cpu },
      ]);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  return (
    <ConsumerShell title="Connected Systems" subtitle="Manage device providers and companion connections.">
      <section className="overflow-hidden rounded-[22px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.042),rgba(255,255,255,0.012))] shadow-[0_14px_48px_rgba(0,0,0,0.29)] backdrop-blur-2xl">
        {loading ? <div className="px-4 py-5 text-sm text-white/50">Loading integrations…</div> : null}
        {!loading && items.map((item, index) => {
          const Icon = item.icon;
          const connected = item.status === "Connected";
          return (
            <div key={item.key} className={`flex items-center gap-3 px-3.5 py-3 ${index ? "border-t border-white/[0.055]" : ""}`}>
              <span className={`grid h-9 w-9 place-items-center rounded-full border ${connected ? "border-emerald-300/15 bg-emerald-400/10 text-emerald-200" : "border-white/[0.07] bg-white/[0.035] text-white/48"}`}><Icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{item.label}</span>{item.detail ? <span className="mt-0.5 block truncate text-xs text-white/42">{item.detail}</span> : null}</span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${connected ? "bg-emerald-400/10 text-emerald-200" : "bg-white/[0.045] text-white/48"}`}>{item.status}</span>
            </div>
          );
        })}
        {syncMessage ? <div className="border-t border-white/[0.055] px-3.5 py-3 text-xs text-white/54">{syncMessage}</div> : null}
        {lastTuyaSync ? <div className="border-t border-white/[0.055] px-3.5 py-3 text-[11px] leading-5 text-white/42">Last sync {new Date(lastTuyaSync.synced_at).toLocaleString()} · {formatTuyaSyncSummary(lastTuyaSync)}</div> : null}
      </section>
      <section className="mt-3 rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-3.5 backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Tuya / Smart Life</div>
            <p className="mt-1 text-xs leading-5 text-white/46">Cloud sync imports devices into Oyi without changing existing home or room assignments.</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${tuyaStatus?.provider_ready === true ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-400/10 text-amber-100"}`}>
            {tuyaStatus?.provider_ready === true ? "Provider Ready" : tuyaStatus?.provider_ready === false ? "Backend credentials missing" : "Provider status unavailable"}
          </span>
        </div>
        {tuyaStatus?.connected ? (
          <div className="mt-3 rounded-[18px] border border-white/[0.07] bg-white/[0.03] p-3">
            <div className="text-xs font-medium text-white/76">UID linked {tuyaStatus?.masked_uid ? `· ${tuyaStatus.masked_uid}` : ""}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => void syncTuya()} disabled={syncingTuya || !tuyaStatus?.provider_ready} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-45">{syncingTuya ? "Syncing…" : "Sync Now"}</button>
              <button type="button" onClick={() => router.push("/devices?add=device")} className="rounded-full border border-sky-300/18 bg-sky-400/10 px-3 py-2 text-xs text-sky-100">Open Add Device</button>
              <button type="button" onClick={() => setTuyaStatus((current: any) => ({ ...current, connected: false }))} className="rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-xs text-white/68">Reconnect</button>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <button type="button" onClick={() => setSyncMessage("Smart Life app-account QR linking is pending provider authorization setup. Use the advanced UID fallback for pilot accounts.")} disabled={tuyaStatus?.provider_ready === false} className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-black disabled:opacity-45">Connect Smart Life</button>
            <button type="button" onClick={() => setShowAdvancedTuya((current) => !current)} className="ml-2 h-10 rounded-full border border-white/[0.09] bg-white/[0.04] px-4 text-xs text-white/68">Advanced UID fallback</button>
            {showAdvancedTuya ? <div className="mt-3 rounded-[18px] border border-white/[0.07] bg-white/[0.025] p-3">
              <label className="text-xs text-white/54">Developer / pilot Tuya UID</label>
              <div className="mt-2 flex gap-2">
                <input value={tuyaUid} onChange={(event) => setTuyaUid(event.target.value)} placeholder="Enter Tuya UID" className="h-10 min-w-0 flex-1 rounded-full border border-white/[0.08] bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/30" />
                <button type="button" onClick={() => void saveTuyaUid()} disabled={savingTuya || !tuyaUid.trim()} className="rounded-full bg-white px-3 text-xs font-semibold text-black disabled:opacity-45">{savingTuya ? "Saving…" : "Save UID"}</button>
              </div>
            </div> : null}
          </div>
        )}
        {lastTuyaSync ? <div className="mt-3 text-[11px] leading-5 text-white/42">Last sync {new Date(lastTuyaSync.synced_at).toLocaleString()} · {formatTuyaSyncSummary(lastTuyaSync)} · Unchanged {lastTuyaSync.unchanged || 0}{lastTuyaSync.errors?.length ? ` · Errors ${lastTuyaSync.errors.length}` : ""}</div> : null}
        <p className="mt-3 text-[11px] leading-5 text-white/36">Provider scenes, automations, and room metadata are not executed or assigned until supported safely by the provider contract.</p>
      </section>
      <section className="mt-3 rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-3.5 backdrop-blur-2xl">
        <div className="text-sm font-semibold text-white">Oyi Watch</div>
        <p className="mt-1 text-xs leading-5 text-white/46">{describeOyiWatchStatus(watchStatus)}. Apple Watch may sleep between refreshes; if paired and installed, Oyi will queue sync and refresh when the Watch is reachable.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void syncWatch()} disabled={watchBusy} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-45">{watchBusy ? "Syncing..." : "Sync Watch"}</button>
          <button type="button" onClick={() => void refreshWatch()} disabled={watchBusy} className="rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-xs text-white/68 disabled:opacity-45">Refresh status</button>
        </div>
        {watchMessage ? <p className="mt-2 text-xs leading-5 text-white/48">{watchMessage}</p> : null}
      </section>
    </ConsumerShell>
  );
}
