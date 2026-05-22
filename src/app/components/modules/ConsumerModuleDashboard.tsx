import Link from "next/link";
import ConsumerShell from "@/app/components/ConsumerShell";
import { ArrowRight, LucideIcon, Sparkles } from "lucide-react";

export type ConsumerMetric = {
  label: string;
  value: string | number;
  hint?: string;
};

export type ConsumerTab = {
  label: string;
  href: string;
};

export type ConsumerAction = {
  label: string;
  href: string;
  icon?: LucideIcon;
  body?: string;
};

export default function ConsumerModuleDashboard({
  title,
  subtitle,
  tabs,
  metrics,
  actions,
  notes,
}: {
  title: string;
  subtitle: string;
  tabs: ConsumerTab[];
  metrics: ConsumerMetric[];
  actions: ConsumerAction[];
  notes: string[];
}) {
  return (
    <ConsumerShell title={title} subtitle={subtitle} showBack backHref="/home">
      <div className="space-y-3 pb-8">
        <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 text-[12px] text-white/48">
          {tabs.map((tab, index) => (
            <Link
              key={`${tab.label}-${tab.href}`}
              href={tab.href}
              className={`shrink-0 rounded-full border px-3 py-1.5 transition ${
                index === 0
                  ? "border-sky-300/20 bg-sky-300/10 text-sky-50 shadow-[0_0_24px_rgba(74,168,255,0.08)]"
                  : "border-white/10 bg-white/[0.035] hover:bg-white/[0.07] hover:text-white/80"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {metrics.map((metric) => (
            <article key={metric.label} className="oyi-soft-card rounded-[20px] p-3.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-white/38">{metric.label}</div>
              <div className="mt-1.5 text-lg font-semibold text-white">{metric.value}</div>
              {metric.hint ? <div className="mt-1 text-[11px] leading-4 text-white/34">{metric.hint}</div> : null}
            </article>
          ))}
        </section>

        <section className="grid gap-2.5 sm:grid-cols-2">
          {actions.map((action) => {
            const Icon = action.icon || Sparkles;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="rounded-[20px] border border-white/10 bg-white/[0.035] p-3.5 transition hover:bg-white/[0.07] active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[16px] border border-sky-300/15 bg-sky-300/10 text-sky-100">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-white">{action.label}</div>
                      {action.body ? <div className="mt-1 text-[11px] leading-4 text-white/45">{action.body}</div> : null}
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/35" />
                </div>
              </Link>
            );
          })}
        </section>

        <section className="rounded-[20px] border border-white/10 bg-black/[0.16] p-3.5">
          <div className="text-sm font-semibold text-white">How Oyi uses this layer</div>
          <div className="mt-2 space-y-1.5">
            {notes.map((note) => (
              <div key={note} className="flex gap-2 text-xs leading-5 text-white/52">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300 shadow-[0_0_12px_rgba(74,168,255,0.7)]" />
                <span>{note}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </ConsumerShell>
  );
}
