"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import { maintenanceService, type MaintenanceTicket } from "@/services/maintenanceService";
import { servicesService, type ServicePayment } from "@/services/servicesService";
import { listMyNotifications, type AppNotification } from "@/services/notificationsService";
import { Activity, FileText, ReceiptText, ShieldCheck, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";

function when(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString([], { month: "short", day: "2-digit" });
}
function money(amount: any) {
  const value = Number(amount || 0);
  try { return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value); } catch { return `₦${value}`; }
}
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[22px] border border-white/[0.07] bg-white/[0.032] p-4 shadow-[0_16px_52px_rgba(0,0,0,0.28)] backdrop-blur-2xl ${className}`}>{children}</section>;
}

export default function ReportsPage() {
  const router = useRouter();
  const [maintenance, setMaintenance] = useState<MaintenanceTicket[]>([]);
  const [payments, setPayments] = useState<ServicePayment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [m, p, n] = await Promise.all([
        maintenanceService.listMyTickets(),
        servicesService.history({ limit: 20 }),
        listMyNotifications(),
      ]);
      setMaintenance(Array.isArray(m) ? m : []);
      setPayments(Array.isArray(p) ? p : []);
      setNotifications(Array.isArray(n) ? n : []);
    } catch (e: any) {
      setErr(e?.message || "Reports unavailable");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  const activity = useMemo(() => notifications.slice(0, 8), [notifications]);
  const completed = maintenance.filter((item) => String(item.status || "").toLowerCase() === "resolved");

  return (
    <ConsumerShell title="Reports" subtitle="Documents, receipts and home history.">
      <div className="space-y-3 pb-8">
        {err ? <div className="rounded-[20px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{err}</div> : null}
        <Panel className="bg-[radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.13),transparent_34%),rgba(255,255,255,0.032)]">
          <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] uppercase tracking-[0.24em] text-sky-100/50">Home archive</div><h2 className="mt-1.5 text-[19px] font-semibold tracking-[-0.05em] text-white">Your records stay organized.</h2><p className="mt-1 text-xs text-white/48">Activity summaries, service history and payment receipts.</p></div><button onClick={load} className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs text-white/68">{loading ? "Syncing" : "Refresh"}</button></div>
        </Panel>
        <div className="grid grid-cols-3 gap-2">
          <Panel className="p-3"><ReceiptText className="h-4 w-4 text-violet-200" /><div className="mt-2 text-lg font-semibold text-white">{payments.length}</div><div className="text-[11px] text-white/42">Receipts</div></Panel>
          <Panel className="p-3"><Wrench className="h-4 w-4 text-emerald-200" /><div className="mt-2 text-lg font-semibold text-white">{completed.length}</div><div className="text-[11px] text-white/42">Completed</div></Panel>
          <Panel className="p-3"><Activity className="h-4 w-4 text-sky-200" /><div className="mt-2 text-lg font-semibold text-white">{activity.length}</div><div className="text-[11px] text-white/42">Summaries</div></Panel>
        </div>
        <Panel>
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Recent receipts</h3><button onClick={() => router.push('/wallet')} className="text-xs text-sky-200">Wallet</button></div>
          <div className="mt-3 space-y-2">
            {payments.length ? payments.slice(0, 6).map((p) => <div key={p.id} className="rounded-[18px] border border-white/[0.055] bg-black/18 px-3 py-2.5"><div className="text-sm font-medium text-white">{p.service_title || p.service_key?.replaceAll('_', ' ') || 'Payment'}</div><div className="mt-0.5 text-xs text-white/42">{money(p.amount)} · {when((p as any).created_at)}</div></div>) : <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm text-white/45">No receipts yet.</div>}
          </div>
        </Panel>
        <Panel>
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Service history</h3><button onClick={() => router.push('/maintenance')} className="text-xs text-sky-200">Maintenance</button></div>
          <div className="mt-3 space-y-2">
            {maintenance.length ? maintenance.slice(0, 6).map((m) => <div key={m.id} className="rounded-[18px] border border-white/[0.055] bg-black/18 px-3 py-2.5"><div className="text-sm font-medium text-white">{m.title || 'Service request'}</div><div className="mt-0.5 text-xs text-white/42">{String(m.status || 'open').replaceAll('_', ' ')} · {when(m.created_at)}</div></div>) : <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm text-white/45">No service history yet.</div>}
          </div>
        </Panel>
        <Panel>
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Activity summaries</h3><button onClick={() => router.push('/activity')} className="text-xs text-sky-200">Activity</button></div>
          <div className="mt-3 space-y-2">
            {activity.length ? activity.map((n) => <div key={n.id} className="flex items-center gap-3 rounded-[18px] border border-white/[0.055] bg-black/18 px-3 py-2.5"><span className="grid h-8 w-8 place-items-center rounded-full bg-sky-400/10 text-sky-100"><FileText className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-medium text-white">{n.title || 'Activity'}</span><span className="block truncate text-xs text-white/42">{n.message || n.type || 'Home update'} · {when(n.created_at)}</span></span></div>) : <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm text-white/45">No activity summaries yet.</div>}
          </div>
        </Panel>
      </div>
    </ConsumerShell>
  );
}
