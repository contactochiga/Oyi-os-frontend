"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Bolt,
  ChevronRight,
  CreditCard,
  Grid2X2,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
  Wrench,
  Cpu,
  Home,
  AlertTriangle,
  Activity as ActivityIcon,
  MessageCircle,
  Sparkles,
  UserPlus,
  Watch,
} from "lucide-react";

import LayoutWrapper from "@/app/components/LayoutWrapper";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import MessagesInboxButton from "@/app/components/MessagesInboxButton";
import BottomNav from "@/app/components/BottomNav";
import { getSocket } from "@/services/socket";
import { getDeviceIconFromText } from "@/lib/devicePresentation";
import { acknowledgeActivityEvent, acknowledgeSeenActivityEvents, getActivityFeed, notificationIdFromActivity, type ActivityCategory, type ActivityEvent, type ActivitySummary } from "@/services/activityService";
import { useNotificationStore } from "@/store/useNotificationStore";

type FilterKey = "all" | "alerts" | "devices" | "people";

const EMPTY_SUMMARY: ActivitySummary = { total_events: 0, alerts: 0, visitors: 0, actions: 0 };

const FILTERS: Array<{ key: FilterKey; label: string; icon: any }> = [
  { key: "all", label: "All Activity", icon: Grid2X2 },
  { key: "alerts", label: "Alerts", icon: ShieldCheck },
  { key: "devices", label: "Devices", icon: Cpu },
  { key: "people", label: "People", icon: UserRound },
];

function formatTime(value?: string | null) {
  if (!value) return "Now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function eventTone(category: ActivityCategory, severity?: string) {
  if (severity === "critical" || severity === "high") return { Icon: AlertTriangle, ring: "border-red-300/16 bg-red-500/10 text-red-200 shadow-[0_0_18px_rgba(248,113,113,0.18)]" };
  if (severity === "warning" || severity === "medium") return { Icon: AlertTriangle, ring: "border-amber-300/16 bg-amber-400/10 text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.18)]" };
  if (category === "security") return { Icon: ShieldCheck, ring: "border-emerald-300/16 bg-emerald-400/10 text-emerald-200 shadow-[0_0_18px_rgba(52,211,153,0.18)]" };
  if (category === "visitor") return { Icon: UserRound, ring: "border-violet-300/16 bg-violet-400/10 text-violet-200 shadow-[0_0_18px_rgba(167,139,250,0.18)]" };
  if (category === "device") return { Icon: Cpu, ring: "border-sky-300/16 bg-sky-400/10 text-sky-200 shadow-[0_0_18px_rgba(56,189,248,0.18)]" };
  if (category === "maintenance") return { Icon: Wrench, ring: "border-amber-300/16 bg-amber-400/10 text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.18)]" };
  if (category === "message") return { Icon: MessageCircle, ring: "border-blue-300/16 bg-blue-400/10 text-blue-200 shadow-[0_0_18px_rgba(96,165,250,0.18)]" };
  if (category === "service") return { Icon: CreditCard, ring: "border-purple-300/16 bg-purple-400/10 text-purple-200 shadow-[0_0_18px_rgba(192,132,252,0.18)]" };
  if (category === "invite") return { Icon: UserPlus, ring: "border-cyan-300/16 bg-cyan-400/10 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.18)]" };
  if (category === "scene" || category === "automation") return { Icon: Sparkles, ring: "border-blue-300/16 bg-blue-400/10 text-blue-200 shadow-[0_0_18px_rgba(59,130,246,0.18)]" };
  if (category === "watch") return { Icon: Watch, ring: "border-slate-200/16 bg-slate-300/10 text-slate-100 shadow-[0_0_18px_rgba(226,232,240,0.12)]" };
  if (category === "ai") return { Icon: Bolt, ring: "border-blue-300/16 bg-blue-400/10 text-blue-200 shadow-[0_0_18px_rgba(59,130,246,0.18)]" };
  if (category === "wallet") return { Icon: Wallet, ring: "border-purple-300/16 bg-purple-400/10 text-purple-200 shadow-[0_0_18px_rgba(192,132,252,0.18)]" };
  if (category === "community") return { Icon: Users, ring: "border-cyan-300/16 bg-cyan-400/10 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.18)]" };
  return { Icon: Bell, ring: "border-white/10 bg-white/[0.055] text-white/72" };
}

function matchesFilter(item: ActivityEvent, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "alerts") return item.category === "security" || item.severity === "critical" || item.severity === "warning" || item.severity === "high" || item.severity === "medium";
  if (filter === "devices") return item.category === "device" || item.category === "scene" || item.category === "automation" || item.category === "watch" || item.category === "ai";
  if (filter === "people") return item.category === "visitor" || item.category === "community" || item.category === "message" || item.category === "invite";
  return true;
}

function summaryValue(value: number | undefined) {
  return Number.isFinite(value) ? String(value) : "0";
}

export default function ActivityPage() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [summary, setSummary] = useState<ActivitySummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const acknowledgedRef = useRef<Set<string>>(new Set());
  const markNotificationsRead = useNotificationStore((state) => state.markNotificationsRead);

  async function load(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const result = await getActivityFeed();
    if ("error" in result) {
      setError(result.error);
      setEvents([]);
      setSummary(EMPTY_SUMMARY);
    } else {
      setEvents(result.items);
      setSummary(result.summary || EMPTY_SUMMARY);
      setLastSync(result.generated_at || new Date().toISOString());
      const unseen = result.items.filter((item) => {
        const notificationId = notificationIdFromActivity(item);
        return notificationId && !acknowledgedRef.current.has(notificationId);
      });
      if (unseen.length) {
        void acknowledgeSeenActivityEvents(unseen).then((ids) => {
          ids.forEach((id) => acknowledgedRef.current.add(id));
          markNotificationsRead(ids);
        });
      }
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => void load(true);
    const events = [
      "notification",
      "notification:new",
      "signal",
      "device:update",
      "device.status.updated",
      "device.registry.updated",
      "visitor.created",
      "visitor.updated",
      "maintenance.updated",
      "community.updated",
      "dm:new",
      "message.created",
      "wallet.updated",
      "service.updated",
      "security.alert",
      "audit.recorded",
      "ai.tool.executed",
    ];
    events.forEach((eventName) => socket.on(eventName, refresh));
    return () => {
      events.forEach((eventName) => socket.off(eventName, refresh));
    };
  }, []);

  const visibleEvents = useMemo(() => events.filter((item) => matchesFilter(item, filter)), [events, filter]);

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 overflow-hidden bg-[#02060b] text-white">
        <div className="oyi-ambient-bg" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_14%,rgba(0,132,255,0.14),transparent_30%),linear-gradient(180deg,rgba(3,10,19,0.22),rgba(0,0,0,0.94))]" />

        <div className="fixed inset-x-0 z-[80] px-5" style={{ top: "calc(8px + var(--sat))" }}>
          <div className="mx-auto flex max-w-[430px] items-center justify-between">
            <div className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.03] shadow-[0_8px_26px_rgba(0,0,0,0.28)] backdrop-blur-2xl"><HamburgerMenu /></div>
            <div className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.028] shadow-[0_8px_26px_rgba(0,0,0,0.28)] backdrop-blur-2xl"><MessagesInboxButton /></div>
          </div>
        </div>

        <div className="absolute inset-x-0 overflow-y-auto px-5" style={{ top: "calc(70px + var(--sat))", bottom: "calc(78px + var(--sab))", WebkitOverflowScrolling: "touch" }}>
          <div className="mx-auto max-w-[430px] pb-5">
            <header>
              <h1 className="text-[27px] font-semibold leading-none tracking-[-0.055em] text-white">Activity</h1>
              <p className="mt-2 text-[13px] leading-5 text-white/56">Live updates from your home.</p>
            </header>

            <section className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Activity filters">
              {FILTERS.map((item) => {
                const Icon = item.icon;
                const active = filter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFilter(item.key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition active:scale-[0.98] ${
                      active
                        ? "border-sky-400/70 bg-sky-400/10 text-sky-200 shadow-[0_0_22px_rgba(0,132,255,0.20)]"
                        : "border-white/[0.075] bg-white/[0.025] text-white/62 hover:bg-white/[0.05]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </section>

            <section className="mt-4 rounded-[20px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.046),rgba(255,255,255,0.012))] p-2.5 shadow-[0_12px_38px_rgba(0,0,0,0.30)] backdrop-blur-2xl">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Today</div>
              <div className="mt-3 grid grid-cols-4 divide-x divide-white/[0.065]">
                <SummaryCell icon={ActivityIcon} label="Events" value={summaryValue(summary.total_events)} color="text-sky-300" />
                <SummaryCell icon={ShieldCheck} label="Alerts" value={summaryValue(summary.alerts)} color="text-emerald-300" />
                <SummaryCell icon={Users} label="Visitors" value={summaryValue(summary.visitors)} color="text-violet-300" />
                <SummaryCell icon={Bolt} label="Actions" value={summaryValue(summary.actions)} color="text-amber-300" />
              </div>
            </section>

            {error ? (
              <section className="mt-4 rounded-[20px] border border-amber-300/16 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                <div className="font-medium">Activity temporarily unavailable.</div>
                <div className="mt-1 text-xs text-amber-100/70">{error}</div>
              </section>
            ) : null}

            <section className="mt-4">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="text-xs text-white/38">{lastSync ? `Synced ${formatTime(lastSync)}` : loading ? "Syncing activity" : "Live feed"}</div>
                <button type="button" onClick={() => load(true)} disabled={loading || refreshing} className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-xs text-white/60 disabled:opacity-45">
                  {refreshing ? "Refreshing" : "Refresh"}
                </button>
              </div>

              {loading ? <ActivitySkeleton /> : null}

              {!loading && !visibleEvents.length ? (
                <div className="rounded-[20px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.042),rgba(255,255,255,0.012))] p-5 text-center shadow-[0_14px_48px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
                  <div className="mx-auto grid h-8 w-8 place-items-center rounded-full border border-sky-300/15 bg-sky-400/10 text-sky-200">
                    <Home className="h-5 w-5" />
                  </div>
                  <h2 className="mt-3 text-base font-semibold tracking-[-0.04em]">No activity yet.</h2>
                  <p className="mt-1.5 text-xs leading-5 text-white/48">Your home updates will appear here.</p>
                </div>
              ) : null}

              {!loading && visibleEvents.length ? (
                <div className="relative pl-[50px]">
                  <div className="absolute bottom-3 left-[45px] top-3 w-px bg-white/[0.07]" />
                  <div className="space-y-2.5">
                    {visibleEvents.map((item) => <ActivityRow key={item.id} item={item} />)}
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>

        <BottomNav />
      </main>
    </LayoutWrapper>
  );
}

function SummaryCell({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="min-w-0 px-1.5 py-1 text-center">
      <div className={`mx-auto flex items-center justify-center gap-1.5 ${color}`}>
        <Icon className="h-4 w-4" />
        <span className="text-[20px] font-semibold tracking-[-0.05em]">{value}</span>
      </div>
      <div className="mt-1 text-[11px] text-white/48">{label}</div>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityEvent }) {
  const router = useRouter();
  const markNotificationsRead = useNotificationStore((state) => state.markNotificationsRead);
  const tone = eventTone(item.category, item.severity);
  const Icon = item.category === "device" ? getDeviceIconFromText(`  `) : tone.Icon;
  const actionable = Boolean(item.action?.href);
  const content = (
    <>
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${tone.ring}`}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold tracking-[-0.025em] text-white">{item.title}</div>
          <div className="mt-0.5 truncate text-[12px] text-white/50">{item.description}</div>
        </div>
        {item.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnail_url} alt="" className="h-8 w-8 rounded-[12px] object-cover" />
        ) : item.severity === "critical" || item.severity === "high" ? (
          <span className="rounded-full border border-red-300/18 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-200">High</span>
        ) : (
          <span className="max-w-[58px] truncate text-[11px] text-white/42">{item.label || item.category}</span>
        )}
        {actionable ? <ChevronRight className="h-4 w-4 text-sky-200/55" /> : null}
      </div>
      {actionable ? <div className="mt-2 pl-12 text-[10px] font-medium text-sky-200/62">{item.action?.label || "Open"}</div> : null}
    </>
  );
  return (
    <article className="relative">
      <div className="absolute -left-[50px] top-5 w-[42px] pr-2.5 text-right text-[11px] font-medium text-white/42">{formatTime(item.occurred_at)}</div>
      <div className={`absolute -left-[9px] top-6 h-2 w-2 rounded-full border border-[#02060b] ${actionable ? "bg-sky-300 shadow-[0_0_14px_rgba(56,189,248,0.42)]" : "bg-slate-700 shadow-[0_0_12px_rgba(56,189,248,0.20)]"}`} />
      {actionable ? (
        <button type="button" onClick={() => {
          const notificationId = notificationIdFromActivity(item);
          if (notificationId) {
            markNotificationsRead([notificationId]);
            void acknowledgeActivityEvent(item);
          }
          if (item.action?.href) router.push(item.action.href);
        }} className="w-full rounded-[20px] border border-sky-300/14 bg-[linear-gradient(145deg,rgba(56,189,248,0.07),rgba(255,255,255,0.012))] px-3 py-2.5 text-left shadow-[0_12px_38px_rgba(0,0,0,0.26)] backdrop-blur-2xl transition active:scale-[0.99]">
          {content}
        </button>
      ) : (
        <div className="rounded-[20px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.044),rgba(255,255,255,0.012))] px-3 py-2.5 shadow-[0_12px_38px_rgba(0,0,0,0.26)] backdrop-blur-2xl">
          {content}
        </div>
      )}
    </article>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-[20px] border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-white/[0.06]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 rounded-full bg-white/[0.06]" />
              <div className="h-2.5 w-1/2 rounded-full bg-white/[0.04]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
