"use client";

import { useEffect, useState } from "react";
import { Building2, Check, Home, Info, LocateFixed, MapPin, ShieldCheck } from "lucide-react";
import ConsumerShell from "@/app/components/ConsumerShell";
import useActiveContext from "@/hooks/useActiveContext";
import { DEFAULT_PROXIMITY_SETTINGS, proximityService, type ProximitySettings } from "@/services/proximityService";

const RADII: ProximitySettings["radius_meters"][] = [20, 100, 500, 1000];

function statusLabel(state?: string | null) {
  if (state === "near_home") return "Near Home";
  if (state === "leaving_home") return "Leaving Home";
  if (state === "approaching_estate") return "Approaching Estate";
  if (state === "away") return "Away";
  return "Location pending";
}

export default function ProximityAwarenessPage() {
  const context = useActiveContext();
  const [settings, setSettings] = useState<ProximitySettings>(DEFAULT_PROXIMITY_SETTINGS);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!context.ready) return;
    let active = true;
    proximityService.getSettings({ estate_id: context.estate_id, home_id: context.home_id })
      .then((next) => active && setSettings(next))
      .catch((error) => active && setMessage(error?.response?.data?.error || error?.message || "Proximity settings could not be loaded."));
    return () => { active = false; };
  }, [context.ready, context.contextKey, context.estate_id, context.home_id]);

  async function update(patch: Partial<ProximitySettings>, success: string) {
    setBusy("save");
    setMessage("");
    try {
      const next = await proximityService.updateSettings(patch, { estate_id: context.estate_id, home_id: context.home_id });
      setSettings(next);
      setMessage(success);
      window.dispatchEvent(new Event("oyi:proximity-settings-changed"));
    } catch (error: any) {
      setMessage(error?.response?.data?.error || error?.message || "Proximity settings could not be updated.");
    } finally {
      setBusy("");
    }
  }

  function saveCurrentLocation(target: "home" | "estate") {
    setBusy(target);
    setMessage("");
    if (!("geolocation" in navigator)) {
      setBusy("");
      setMessage("Location is not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const patch = target === "home"
          ? { home_lat: coords.latitude, home_lng: coords.longitude }
          : { estate_lat: coords.latitude, estate_lng: coords.longitude };
        void update(patch, `${target === "home" ? "Home" : "Estate"} point saved.`);
      },
      (error) => {
        setBusy("");
        setMessage(error.message || "Your location could not be read.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  const active = settings.enabled;

  return (
    <ConsumerShell title="Proximity Awareness" subtitle="Smart home awareness" backHref="/profile" hideStrip>
      <div className="space-y-5 pb-6">
        <section className="rounded-[24px] border border-sky-400/25 bg-[radial-gradient(circle_at_15%_15%,rgba(14,165,233,0.14),rgba(255,255,255,0.025)_52%,rgba(255,255,255,0.012))] p-4 shadow-[0_16px_48px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
          <div className="flex gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-sky-400/25 bg-sky-400/10 text-sky-300"><MapPin className="h-6 w-6" /></span>
            <div><h2 className="text-base font-semibold">Home awareness</h2><p className="mt-1 text-sm leading-6 text-white/58">Oyi can detect when you’re near or away from home. Your location is not shared with Facility and Oyi does not store a movement trail.</p></div>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Current status</h2>
          <div className="flex items-center gap-3 rounded-[22px] border border-white/[0.09] bg-white/[0.035] p-4">
            <span className={`grid h-12 w-12 place-items-center rounded-full border-2 ${active ? "border-emerald-400 text-white shadow-[0_0_20px_rgba(52,211,153,0.22)]" : "border-white/15 text-white/50"}`}><Home className="h-5 w-5" /></span>
            <div><div className={active ? "font-semibold text-emerald-300" : "font-semibold text-white/60"}>{active ? "Active" : "Disabled"}</div><div className="mt-1 text-sm text-white/48">{active ? statusLabel(settings.last_state) : "Awareness is turned off"}</div></div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold">Quick control</h2><p className="mt-1 text-xs text-white/48">Turn proximity awareness on or off.</p>
          <button type="button" disabled={Boolean(busy)} onClick={() => update({ enabled: !active }, active ? "Proximity awareness disabled." : "Proximity awareness enabled.")} className="mt-2 flex w-full items-center justify-between rounded-[22px] border border-white/[0.09] bg-white/[0.035] px-4 py-3.5 disabled:opacity-50">
            <span className="font-medium">Proximity awareness</span><span className={`relative h-8 w-14 rounded-full border transition ${active ? "border-sky-300/50 bg-sky-400/70" : "border-white/15 bg-white/[0.06]"}`}><span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${active ? "translate-x-6" : "translate-x-0"}`} /></span>
          </button>
        </section>

        <section>
          <h2 className="text-sm font-semibold">Awareness distance</h2><p className="mt-1 text-xs text-white/48">Set how close you need to be for Oyi to know you’re home.</p>
          <div className="mt-2 grid grid-cols-4 gap-1.5 rounded-[20px] border border-white/[0.08] bg-white/[0.025] p-2">
            {RADII.map((radius) => <button key={radius} type="button" disabled={Boolean(busy)} onClick={() => update({ radius_meters: radius }, "Awareness distance updated.")} className={`rounded-[14px] border px-1 py-2.5 text-sm ${settings.radius_meters === radius ? "border-sky-400 bg-sky-400/10 text-sky-300" : "border-white/[0.07] text-white/52"}`}>{radius === 1000 ? "1km" : `${radius}m`}</button>)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-white/45"><ShieldCheck className="h-4 w-4 text-sky-400" /> Larger distance means fewer false alerts.</div>
        </section>

        <section>
          <h2 className="text-sm font-semibold">Your locations</h2><p className="mt-1 text-xs text-white/48">These locations are used for awareness.</p>
          <div className="mt-2 overflow-hidden rounded-[22px] border border-white/[0.09] bg-white/[0.035]">
            {([{ target: "home" as const, label: "Home point", detail: "This is your primary home location.", saved: settings.home_lat != null && settings.home_lng != null, icon: Home }, { target: "estate" as const, label: "Estate point", detail: "General estate location.", saved: settings.estate_lat != null && settings.estate_lng != null, icon: Building2 }]).map((item, index) => {
              const Icon = item.icon;
              return <button key={item.target} type="button" disabled={Boolean(busy)} onClick={() => saveCurrentLocation(item.target)} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left disabled:opacity-50 ${index ? "border-t border-white/[0.08]" : ""}`}><span className="grid h-10 w-10 place-items-center rounded-full bg-sky-400/10 text-sky-300"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-medium">{item.label}</span><span className="block truncate text-xs text-white/45">{item.detail}</span></span><span className={item.saved ? "flex items-center gap-1 text-xs text-emerald-300" : "flex items-center gap-1 text-xs text-white/45"}>{item.saved ? <Check className="h-3.5 w-3.5" /> : <LocateFixed className="h-3.5 w-3.5" />}{item.saved ? "Saved" : "Set"}</span></button>;
            })}
          </div>
          <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-white/45"><Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" /> Location permission is requested only when you save locations or enable awareness.</div>
        </section>
        {message ? <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs text-white/60">{message}</div> : null}
      </div>
    </ConsumerShell>
  );
}
