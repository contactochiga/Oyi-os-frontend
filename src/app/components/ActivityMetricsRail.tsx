"use client";

import type { ComponentType } from "react";

export type ActivityMetricItem = {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  color?: string;
};

export default function ActivityMetricsRail({ title, items, className = "" }: { title?: string; items: ActivityMetricItem[]; className?: string }) {
  return (
    <section className={`rounded-[20px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.046),rgba(255,255,255,0.012))] p-2.5 shadow-[0_12px_38px_rgba(0,0,0,0.30)] backdrop-blur-2xl ${className}`}>
      {title ? <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">{title}</div> : null}
      <div className={`${title ? "mt-3" : ""} flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="min-w-[78px] shrink-0 snap-start rounded-[16px] border border-white/[0.055] bg-white/[0.026] px-2 py-2 text-center">
              <div className={`mx-auto flex items-center justify-center gap-1.5 ${item.color || "text-sky-300"}`}>
                <Icon className="h-4 w-4" />
                <span className="text-[20px] font-semibold tracking-[-0.05em]">{item.value}</span>
              </div>
              <div className="mt-1 text-[11px] text-white/48">{item.label}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
