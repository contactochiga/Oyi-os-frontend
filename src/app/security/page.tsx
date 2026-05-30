"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import useActiveContext from "@/hooks/useActiveContext";
import { deviceService } from "@/services/deviceService";
import { visitorService, type VisitorAccess } from "@/services/visitorService";
import { Camera, ChevronRight, DoorOpen, KeyRound, ShieldCheck, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

function isSecurityDevice(device: any) {
  const text = `${device?.name || ""} ${device?.type || ""} ${device?.category || ""} ${device?.device_type || ""}`.toLowerCase();
  return ["lock", "door", "gate", "camera", "cctv", "security", "access", "motion", "sensor"].some((x) => text.includes(x));
}

function isOnline(device: any) {
  if (typeof device?.online === "boolean") return device.online;
  const status = String(device?.status || device?.state || "").toLowerCase();
  return ["online", "active", "connected", "on"].some((x) => status.includes(x));
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[22px] border border-white/[0.07] bg-white/[0.032] p-4 shadow-[0_16px_52px_rgba(0,0,0,0.28)] backdrop-blur-2xl ${className}`}>{children}</section>;
}

export default function SecurityPage() {
  const router = useRouter();
  const active = useActiveContext();
  const [devices, setDevices] = useState<any[]>([]);
  const [visitors, setVisitors] = useState<VisitorAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [deviceRows, visitorRows] = await Promise.all([
        deviceService.getAssignedDevices(active.estate_id || undefined),
        visitorService.listMine(),
      ]);
      setDevices(Array.isArray(deviceRows) ? deviceRows : []);
      setVisitors(Array.isArray(visitorRows) ? visitorRows : []);
    } catch (e: any) {
      setErr(e?.message || "Unable to load security state");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [active.estate_id]);

  const securityDevices = useMemo(() => devices.filter(isSecurityDevice), [devices]);
  const cameras = useMemo(() => securityDevices.filter((d) => `${d?.name || ""} ${d?.type || ""} ${d?.category || ""}`.toLowerCase().includes("camera") || `${d?.name || ""}`.toLowerCase().includes("cctv")), [securityDevices]);
  const accessDevices = useMemo(() => securityDevices.filter((d) => `${d?.name || ""} ${d?.type || ""} ${d?.category || ""}`.toLowerCase().match(/lock|door|gate|access/)), [securityDevices]);
  const activeVisitors = visitors.filter((v) => ["active", "approved", "entered"].includes(String(v.status || "").toLowerCase()));
  const offline = securityDevices.filter((d) => !isOnline(d));
  const secure = offline.length === 0 && activeVisitors.length === 0;

  return (
    <ConsumerShell title="Security" subtitle="Home access, cameras and trusted arrivals.">
      <div className="space-y-3 pb-8">
        {err ? <div className="rounded-[20px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{err}</div> : null}
        <Panel className="bg-[radial-gradient(circle_at_80%_10%,rgba(14,165,233,0.14),transparent_34%),rgba(255,255,255,0.032)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-sky-100/50">Secure state</div>
              <h2 className="mt-1.5 text-[19px] font-semibold tracking-[-0.05em] text-white">{loading ? "Checking home…" : secure ? "Home is protected." : "Attention needed."}</h2>
              <p className="mt-1 text-xs leading-5 text-white/48">Resident-visible security devices and visitor access stay here.</p>
            </div>
            <span className={`grid h-12 w-12 place-items-center rounded-full border ${secure ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : "border-amber-300/20 bg-amber-300/10 text-amber-100"}`}><ShieldCheck className="h-6 w-6" /></span>
          </div>
        </Panel>

        <div className="grid grid-cols-3 gap-2">
          <Panel className="p-3"><Camera className="h-4 w-4 text-sky-200" /><div className="mt-2 text-lg font-semibold text-white">{cameras.length}</div><div className="text-[11px] text-white/42">Cameras</div></Panel>
          <Panel className="p-3"><KeyRound className="h-4 w-4 text-emerald-200" /><div className="mt-2 text-lg font-semibold text-white">{accessDevices.length}</div><div className="text-[11px] text-white/42">Locks/Gates</div></Panel>
          <Panel className="p-3"><UserPlus className="h-4 w-4 text-violet-200" /><div className="mt-2 text-lg font-semibold text-white">{activeVisitors.length}</div><div className="text-[11px] text-white/42">Visitors</div></Panel>
        </div>

        <Panel>
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">Access shortcuts</h3><p className="mt-1 text-xs text-white/42">Open the exact control surface.</p></div><button onClick={load} className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs text-white/68">{loading ? "Syncing" : "Refresh"}</button></div>
          <div className="mt-3 space-y-2">
            {[{ label: "Invite visitor", body: "Create a resident-scoped access pass.", icon: UserPlus, href: "/visitors" }, { label: "Door and gate devices", body: "Control permitted access devices.", icon: DoorOpen, href: "/devices?category=security" }, { label: "Camera devices", body: "View cameras when your role permits.", icon: Camera, href: "/devices?category=cameras" }].map((item) => (
              <button key={item.label} onClick={() => router.push(item.href)} className="flex w-full items-center gap-3 rounded-[18px] border border-white/[0.055] bg-black/18 px-3 py-3 text-left transition hover:bg-white/[0.045]">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-sky-400/10 text-sky-100"><item.icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-white">{item.label}</span><span className="block truncate text-xs text-white/42">{item.body}</span></span>
                <ChevronRight className="h-4 w-4 text-white/35" />
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </ConsumerShell>
  );
}
