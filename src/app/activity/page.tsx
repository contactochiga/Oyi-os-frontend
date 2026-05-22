"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import { listMyNotifications, type AppNotification } from "@/services/notificationsService";
import { maintenanceService, type MaintenanceTicket } from "@/services/maintenanceService";
import { visitorService, type VisitorAccess } from "@/services/visitorService";
import { Bell, DoorOpen, ShieldCheck, Wrench } from "lucide-react";

function timeLabel(iso?: string | null) {
  if (!iso) return "Now";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Now";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function rowTone(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes("visitor") || lower.includes("access")) return { icon: DoorOpen, color: "text-sky-100 bg-sky-300/10" };
  if (lower.includes("maintenance") || lower.includes("support")) return { icon: Wrench, color: "text-amber-100 bg-amber-300/10" };
  if (lower.includes("security") || lower.includes("alert")) return { icon: ShieldCheck, color: "text-emerald-100 bg-emerald-300/10" };
  return { icon: Bell, color: "text-white/75 bg-white/[0.06]" };
}

export default function ActivityPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [visitors, setVisitors] = useState<VisitorAccess[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [n, v, m] = await Promise.all([
        listMyNotifications(),
        visitorService.listMine(),
        maintenanceService.listMyTickets({ status: "open" } as any),
      ]);
      setNotifications(Array.isArray(n) ? n : []);
      setVisitors(Array.isArray(v) ? v : []);
      setTickets(Array.isArray(m as any) ? (m as any) : []);
    } catch (e: any) {
      setErr(e?.message || "Activity could not sync yet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const heartbeat = useMemo(() => {
    const notificationRows = notifications.map((n) => ({
      id: `n-${n.id}`,
      type: String(n.type || "home"),
      title: n.title || "Home update",
      body: n.message || "Oyi activity",
      at: n.created_at,
    }));
    const visitorRows = visitors.slice(0, 4).map((v) => ({
      id: `v-${v.id}`,
      type: "visitor",
      title: (v as any).name ? `${(v as any).name} access ${v.status || "updated"}` : "Visitor access updated",
      body: v.purpose || "Gate activity",
      at: (v as any).updated_at || (v as any).created_at,
    }));
    const ticketRows = tickets.slice(0, 4).map((t) => ({
      id: `m-${t.id}`,
      type: "maintenance",
      title: t.title || "Maintenance request",
      body: String(t.status || "open").replaceAll("_", " "),
      at: t.created_at,
    }));
    return [...notificationRows, ...visitorRows, ...ticketRows]
      .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
      .slice(0, 12);
  }, [notifications, visitors, tickets]);

  return (
    <ConsumerShell title="Activity" subtitle="Environmental heartbeat • visitors • access • service updates">
      <div className="space-y-3 pb-8">
        <section className="oyi-glass rounded-[24px] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-sky-100/60">Heartbeat</div>
              <h1 className="mt-1.5 text-xl font-semibold text-white">Home aware</h1>
              <p className="mt-1.5 text-xs leading-5 text-white/50">Quiet monitoring active across access, maintenance and notices.</p>
            </div>
            <button type="button" onClick={load} disabled={loading} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/70 disabled:opacity-50">
              {loading ? "Syncing" : "Refresh"}
            </button>
          </div>
        </section>

        {err ? <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{err}</div> : null}

        <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-3">
          <div className="space-y-2">
            {heartbeat.length ? heartbeat.map((item) => {
              const tone = rowTone(item.type);
              const Icon = tone.icon;
              return (
                <article key={item.id} className="rounded-[18px] border border-white/10 bg-black/[0.18] px-3 py-3">
                  <div className="flex items-start gap-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${tone.color}`}><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white/90">{item.title}</div>
                      <div className="mt-1 truncate text-xs text-white/42">{item.body}</div>
                    </div>
                    <span className="text-[10px] text-white/32">{timeLabel(item.at)}</span>
                  </div>
                </article>
              );
            }) : (
              <div className="rounded-[20px] border border-white/10 bg-black/[0.18] p-5 text-center text-sm text-white/48">
                No heartbeat yet. Visitor, security, maintenance and community signals will appear here.
              </div>
            )}
          </div>
        </section>
      </div>
    </ConsumerShell>
  );
}
