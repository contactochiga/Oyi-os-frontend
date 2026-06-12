"use client";

import type { ComponentType } from "react";

export type OyiContextRailItem = {
  label: string;
  value?: string | number | null;
  icon?: ComponentType<{ className?: string }>;
  iconClassName?: string;
  onClick?: () => void;
};

export default function OyiContextRail({ items, className = "" }: { items: OyiContextRailItem[]; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-[24px] border border-white/[0.06] bg-[linear-gradient(145deg,rgba(255,255,255,0.043),rgba(255,255,255,0.014))] px-2.5 py-3 shadow-[0_16px_52px_rgba(0,0,0,0.30)] backdrop-blur-2xl ${className}`}>
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              {Icon ? <Icon className={`h-5 w-5 shrink-0 ${item.iconClassName || "text-sky-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.62)]"}`} /> : null}
              <span className="min-w-0">
                <span className="block truncate text-[10px] text-white/42">{item.label}</span>
                {item.value !== undefined && item.value !== null ? (
                  <span className="block truncate text-[12px] font-semibold text-white">{item.value}</span>
                ) : null}
              </span>
            </>
          );

          if (item.onClick) {
            return (
              <button
                key={`${item.label}:${item.value ?? ""}`}
                type="button"
                onClick={item.onClick}
                className="flex min-w-[118px] snap-start items-center justify-center gap-2 rounded-[18px] px-2.5 py-1.5 text-left transition hover:bg-white/[0.045] active:scale-[0.99]"
              >
                {content}
              </button>
            );
          }

          return (
            <div
              key={`${item.label}:${item.value ?? ""}`}
              className="flex min-w-[118px] snap-start items-center justify-center gap-2 rounded-[18px] px-2.5 py-1.5 text-left"
            >
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
