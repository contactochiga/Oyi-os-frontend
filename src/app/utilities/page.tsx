"use client";

import { useMemo } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import { Droplets, Lightbulb, PlugZap, Thermometer, Wifi } from "lucide-react";
import { useRouter } from "next/navigation";

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[22px] border border-white/[0.07] bg-white/[0.032] p-4 shadow-[0_16px_52px_rgba(0,0,0,0.28)] backdrop-blur-2xl ${className}`}>{children}</section>;
}

export default function UtilitiesPage() {
  const router = useRouter();

  const groups = useMemo(() => [
    { label: "Power", icon: PlugZap, href: "/devices?category=power", status: "Open device controls" },
    { label: "Water", icon: Droplets, href: "/services", status: "Open services" },
    { label: "Internet", icon: Wifi, href: "/services", status: "Open services" },
    { label: "Climate", icon: Thermometer, href: "/devices?category=climate", status: "Open device controls" },
    { label: "Lighting", icon: Lightbulb, href: "/devices?category=lights", status: "Open device controls" },
  ], []);

  return (
    <ConsumerShell title="Utilities" subtitle="Power, water, network and climate status.">
      <div className="space-y-3 pb-8">
        <Panel className="bg-[radial-gradient(circle_at_85%_5%,rgba(56,189,248,0.14),transparent_34%),rgba(255,255,255,0.032)]">
          <div className="flex items-start justify-between gap-4">
            <div><div className="text-[10px] uppercase tracking-[0.24em] text-sky-100/50">Utility layer</div><h2 className="mt-1.5 text-[19px] font-semibold tracking-[-0.05em] text-white">Home systems are visible.</h2><p className="mt-1 text-xs text-white/48">Open the relevant service or control surface when you need live device state.</p></div>
          </div>
        </Panel>
        <div className="space-y-2">
          {groups.map((group) => (
            <button key={group.label} onClick={() => router.push(group.href)} className="flex w-full items-center gap-3 rounded-[22px] border border-white/[0.07] bg-white/[0.032] px-4 py-3 text-left shadow-[0_12px_36px_rgba(0,0,0,0.24)] backdrop-blur-2xl transition hover:bg-white/[0.05]">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-sky-400/10 text-sky-100"><group.icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{group.label}</span><span className="mt-0.5 block text-xs text-white/42">{group.status}</span></span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-white/50">Open</span>
            </button>
          ))}
        </div>
      </div>
    </ConsumerShell>
  );
}
