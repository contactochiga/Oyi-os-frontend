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
      <div className="space-y-4 pb-6">
        <nav className="-mx-1 flex gap-4 overflow-x-auto border-b border-white/10 px-1 text-[13px] text-white/50">
          {tabs.map((tab, index) => (
            <Link
              key={`${tab.label}-${tab.href}`}
              href={tab.href}
              className={`shrink-0 border-b-2 pb-3 transition ${
                index === 0 ? "border-violet-400 text-white" : "border-transparent hover:text-white"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(124,77,255,0.18),transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] p-5">
          <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:34px_34px]" />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.22em] text-violet-200/80">Oyi Consumer OS</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-white/60">{subtitle}</p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((metric) => (
            <article key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
              <div className="text-[11px] text-white/45">{metric.label}</div>
              <div className="mt-2 text-xl font-semibold text-white">{metric.value}</div>
              {metric.hint ? <div className="mt-1 text-[11px] text-white/35">{metric.hint}</div> : null}
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
                className="rounded-2xl border border-white/10 bg-black/20 p-4 transition active:scale-[0.99] hover:bg-white/[0.07]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/10 text-violet-200">
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

        <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <div className="text-sm font-semibold text-white">What this controls</div>
          <div className="mt-3 space-y-2">
            {notes.map((note) => (
              <div key={note} className="flex gap-2 text-sm leading-6 text-white/55">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                <span>{note}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </ConsumerShell>
  );
}
