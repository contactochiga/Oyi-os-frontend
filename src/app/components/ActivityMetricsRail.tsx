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
    <section className={`overflow-hidden rounded-[20px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.042),rgba(255,255,255,0.012))] px-2.5 py-2 shadow-[0_12px_38px_rgba(0,0,0,0.30)] backdrop-blur-2xl ${className}`}>
      {title ? <div className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300/84">{title}</div> : null}
      <div className={`${title ? "mt-2" : ""} flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="min-w-[108px] shrink-0 snap-start rounded-[16px] border border-white/[0.05] bg-white/[0.028] px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${item.color || "text-sky-300"}`} />
                <span className="text-[9px] uppercase tracking-[0.16em] text-white/34">{item.label}</span>
              </div>
              <div className="mt-1.5 text-[15px] font-semibold tracking-[-0.04em] text-white/88">{item.value}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
