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
      <div className="space-y-4 pb-8">
        <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 text-[13px] text-white/48">
          {tabs.map((tab, index) => (
            <Link
              key={`${tab.label}-${tab.href}`}
              href={tab.href}
              className={`shrink-0 rounded-full border px-4 py-2 transition ${
                index === 0
                  ? "border-sky-300/20 bg-sky-300/10 text-sky-50 shadow-[0_0_24px_rgba(74,168,255,0.08)]"
                  : "border-white/10 bg-white/[0.035] hover:bg-white/[0.07] hover:text-white/80"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_30%_0%,rgba(74,168,255,0.20),transparent_36%),linear-gradient(145deg,rgba(255,255,255,0.075),rgba(255,255,255,0.028))] p-5 shadow-[0_20px_90px_rgba(0,0,0,0.32)]">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-sky-300/10 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.24em] text-sky-100/70">Living Intelligence OS</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">{subtitle}</p>
            </div>
            <div className="oyi-orb h-16 w-16 shrink-0" aria-hidden="true" />
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((metric) => (
            <article key={metric.label} className="rounded-[24px] border border-white/10 bg-black/24 p-4 backdrop-blur-xl">
              <div className="text-[11px] text-white/42">{metric.label}</div>
              <div className="mt-2 text-xl font-semibold text-white">{metric.value}</div>
              {metric.hint ? <div className="mt-1 text-[11px] leading-4 text-white/34">{metric.hint}</div> : null}
            </article>
          ))}
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          {actions.map((action) => {
            const Icon = action.icon || Sparkles;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4 transition hover:bg-white/[0.075] active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-sky-300/15 bg-sky-300/10 text-sky-100">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-white">{action.label}</div>
                      {action.body ? <div className="mt-1 text-xs leading-5 text-white/45">{action.body}</div> : null}
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/35" />
                </div>
              </Link>
            );
          })}
        </section>

        <section className="rounded-[24px] border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-semibold text-white">How Oyi uses this layer</div>
          <div className="mt-3 space-y-2">
            {notes.map((note) => (
              <div key={note} className="flex gap-2 text-sm leading-6 text-white/55">
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
