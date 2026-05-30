"use client";

import { Bell, Check, Heart, Home, Lock, Mic, Package, Shield, Thermometer, Zap } from "lucide-react";
import ConsumerShell from "@/app/components/ConsumerShell";

const glances = [
  { title: "Home calm", detail: "All systems normal", icon: Home, tone: "text-sky-100 bg-sky-300/10" },
  { title: "Home secure", detail: "All doors locked", icon: Shield, tone: "text-emerald-100 bg-emerald-300/10" },
  { title: "Visitor at gate", detail: "Front Gate · now", icon: Bell, tone: "text-amber-100 bg-amber-300/10" },
  { title: "Package delivered", detail: "Main Door", icon: Package, tone: "text-violet-100 bg-violet-300/10" },
  { title: "Living room", detail: "24° · Cool", icon: Thermometer, tone: "text-cyan-100 bg-cyan-300/10" },
];

const actions = [
  { label: "All lights off", icon: Zap },
  { label: "Arm security", icon: Lock },
  { label: "Movie mode", icon: Heart },
  { label: "Climate", icon: Thermometer },
];

const states = ["listening", "thinking", "executing", "success", "alert", "awareness"];

function WatchFace({ title, detail, icon: Icon, tone = "text-sky-100 bg-sky-300/10" }: { title: string; detail: string; icon: any; tone?: string }) {
  return (
    <article className="aspect-square rounded-[34px] border border-white/10 bg-black/38 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.32)]">
      <div className="flex items-start justify-between text-[10px] text-white/56">
        <span>9:41</span>
        <span>•••</span>
      </div>
      <div className="flex h-[calc(100%-18px)] flex-col items-center justify-center text-center">
        <div className={`grid h-14 w-14 place-items-center rounded-full border border-white/10 ${tone}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="mt-3 text-sm font-semibold text-white">{title}</div>
        <div className="mt-1 text-[11px] leading-4 text-white/48">{detail}</div>
      </div>
    </article>
  );
}

export default function OyiWatchPage() {
  return (
    <ConsumerShell title="Watch Concept Preview" subtitle="Reference only · native watch app powers real sync">
      <div className="space-y-3 pb-8">
        <section className="oyi-glass relative overflow-hidden rounded-[28px] p-5">
          <div className="absolute -right-24 -top-20 h-64 w-64 rounded-full bg-blue-400/12 blur-3xl" />
          <div className="relative grid gap-5 md:grid-cols-[0.78fr_1.22fr] md:items-center">
            <div className="mx-auto w-full max-w-[220px] rounded-[42px] border border-white/12 bg-black/55 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
              <div className="flex items-start justify-between text-[11px] text-white/60">
                <span>9:41</span>
                <span>•••</span>
              </div>
              <div className="flex aspect-square flex-col items-center justify-center text-center">
                <div className="oyi-orb h-24 w-24" aria-hidden="true" />
                <div className="mt-5 text-base font-semibold text-sky-100">Listening...</div>
                <div className="mt-1 text-[11px] text-white/46">All systems normal</div>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-sky-100/55">Concept reference</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Oyi on your wrist.</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/54">This resident web page is a visual reference. Real Apple Watch sync runs through the native watchOS companion app and WatchConnectivity.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  [Mic, "Voice first", "Raise wrist and speak naturally."],
                  [Home, "Glanceable", "See only what matters now."],
                  [Zap, "Instant actions", "Run small reversible scenes."],
                  [Shield, "Always aware", "Secure confirmations and alerts."],
                ].map(([Icon, title, detail]: any) => (
                  <div key={title} className="rounded-[20px] border border-white/10 bg-white/[0.035] p-3">
                    <Icon className="h-4 w-4 text-sky-100" />
                    <div className="mt-2 text-sm font-semibold text-white">{title}</div>
                    <div className="mt-1 text-xs leading-4 text-white/44">{detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.028] p-3">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-white/36">Glances</div>
              <h2 className="mt-1 text-base font-semibold text-white">Home awareness</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/46">Concept preview</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {glances.map((item) => <WatchFace key={item.title} {...item} />)}
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.028] p-3">
            <div className="mb-3 px-1">
              <div className="text-[10px] uppercase tracking-[0.24em] text-white/36">Voice flow</div>
              <h2 className="mt-1 text-base font-semibold text-white">Listen · execute · confirm</h2>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <WatchFace title="Listening..." detail="Voice active" icon={Mic} tone="text-sky-100 bg-sky-300/10" />
              <WatchFace title="Working" detail="Turning off lights" icon={Zap} tone="text-blue-100 bg-blue-300/10" />
              <WatchFace title="Done" detail="Lights turned off" icon={Check} tone="text-emerald-100 bg-emerald-300/10" />
              <WatchFace title="Confirm" detail="Open gate?" icon={Shield} tone="text-amber-100 bg-amber-300/10" />
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.028] p-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-white/36">Quick actions</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {actions.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.label} type="button" className="rounded-[20px] border border-white/10 bg-white/[0.04] p-3 text-left text-white/70">
                    <Icon className="h-4 w-4 text-sky-100" />
                    <div className="mt-3 text-sm font-medium text-white">{item.label}</div>
                    <div className="mt-1 text-[11px] text-white/36">Confirm on wrist</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {states.map((state) => (
                <span key={state} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] capitalize text-white/48">{state}</span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </ConsumerShell>
  );
}
