"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import useActiveContext from "@/hooks/useActiveContext";
import { getSocket } from "@/services/socket";
import { servicesService, type HomeServiceRegistry, type ServiceAccount, type ServiceConfig, type ServiceKey, type ServicePayment } from "@/services/servicesService";
import { FiActivity, FiAlertCircle, FiCreditCard, FiDroplet, FiLayers, FiTool, FiWifi, FiZap } from "react-icons/fi";

const FILTERS = ["All", "Electricity", "Water", "Internet", "Gas", "Generator", "Solar", "Fees"] as const;

const CARD_ORDER: Array<{
  key: ServiceKey;
  title: string;
  subtitle: string;
  icon: any;
  filter: typeof FILTERS[number];
  cta: string;
  transactionType?: string;
}> = [
  { key: "utility_token", title: "Electricity", subtitle: "Meter vending and prepaid service readiness", icon: FiZap, filter: "Electricity", cta: "Buy Electricity", transactionType: "electricity_purchase" },
  { key: "water_service", title: "Water", subtitle: "Water billing and usage continuity", icon: FiDroplet, filter: "Water", cta: "Report Issue", transactionType: "issue_report" },
  { key: "internet_service", title: "Internet", subtitle: "Connectivity, plan, and renewal posture", icon: FiWifi, filter: "Internet", cta: "Renew / Support", transactionType: "internet_renewal" },
  { key: "gas_service", title: "Gas", subtitle: "Household gas continuity and refill readiness", icon: FiTool, filter: "Gas", cta: "Order Gas", transactionType: "gas_order" },
  { key: "generator_recovery", title: "Generator Recovery", subtitle: "Backup recovery and outage continuity", icon: FiActivity, filter: "Generator", cta: "Open Recovery", transactionType: "generator_recovery" },
  { key: "solar_battery_service", title: "Solar / Battery", subtitle: "Solar, inverter, and battery continuity", icon: FiLayers, filter: "Solar", cta: "Review Service", transactionType: "solar_battery_support" },
  { key: "service_charge", title: "Estate Fees", subtitle: "Operational dues linked to this home", icon: FiCreditCard, filter: "Fees", cta: "Review Fees", transactionType: "estate_fee" },
  { key: "other_facility_fees", title: "Facility Services", subtitle: "Facility-linked support and partner services", icon: FiAlertCircle, filter: "Fees", cta: "Request Support", transactionType: "facility_service" },
];

function toNaira(amount?: number | null) {
  if (amount == null || !Number.isFinite(Number(amount))) return "Pending source";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(Number(amount));
}

function dateText(value?: string | null) {
  if (!value) return "No recent activity";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "No recent activity"
    : date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function toneFor(value?: string | null) {
  const text = String(value || "").toLowerCase();
  if (/ready|active|available|stable|online/.test(text)) return "text-emerald-200 border-emerald-300/20 bg-emerald-400/10";
  if (/issue|failed|warning|blocked|degraded/.test(text)) return "text-amber-200 border-amber-300/20 bg-amber-400/10";
  if (/unsupported|offline|unavailable/.test(text)) return "text-red-200 border-red-300/20 bg-red-400/10";
  return "text-sky-100 border-sky-300/20 bg-sky-400/10";
}

function registryEntryFor(serviceKey: ServiceKey, registry: HomeServiceRegistry | null) {
  if (!registry) return null;
  if (serviceKey === "utility_token") return registry.electricity;
  if (serviceKey === "water_service") return registry.water;
  if (serviceKey === "gas_service") return registry.gas;
  if (serviceKey === "internet_service" || serviceKey === "fiber_internet") return registry.internet;
  if (serviceKey === "generator_recovery") return registry.generator_recovery;
  if (serviceKey === "solar_battery_service") return registry.solar_battery;
  if (serviceKey === "service_charge") return registry.estate_fees;
  if (serviceKey === "other_facility_fees") return registry.facility_services;
  return null;
}

function accountMapFor(accounts: ServiceAccount[]) {
  return new Map(accounts.map((account) => [account.service_key, account]));
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/36">{label}</div>
      <div className="mt-1 text-[13px] text-white/86">{value || "Pending source"}</div>
    </div>
  );
}

function ServiceCard({
  item,
  account,
  registry,
  config,
  latestPayment,
  busy,
  onAction,
}: {
  item: (typeof CARD_ORDER)[number];
  account?: ServiceAccount | null;
  registry: HomeServiceRegistry | null;
  config?: ServiceConfig | null;
  latestPayment?: ServicePayment | null;
  busy?: boolean;
  onAction: () => void;
}) {
  const Icon = item.icon;
  const entry = registryEntryFor(item.key, registry) as any;
  const identifier = account?.identifier || account?.meter_number || account?.account_number || entry?.meter_id || entry?.account_id || "Pending source";
  const provider = account?.provider || entry?.provider || "Pending source";
  const tariff = account?.tariff_profile || entry?.tariff_profile || "Pending source";
  const billing = account?.billing_profile || entry?.billing_profile || "Pending source";
  const readiness = account?.vending_readiness || entry?.vending_readiness || account?.status || entry?.status || "Pending";
  const health = account?.provider_health || entry?.provider_health || "Unknown";
  const linked = Boolean(account?.linked ?? entry?.linked);

  const fields = item.key === "utility_token"
    ? [
        { label: "Meter", value: identifier },
        { label: "KCT / KCTN", value: [account?.kct || entry?.kct, account?.kctn || entry?.kctn].filter(Boolean).join(" / ") || "Pending source" },
        { label: "Provider", value: provider },
        { label: "Tariff", value: tariff },
        { label: "Billing", value: billing },
        { label: "Last transaction", value: latestPayment?.reference || dateText(account?.last_activity_at || latestPayment?.created_at) },
      ]
    : item.key === "water_service"
    ? [
        { label: "Meter ID", value: identifier },
        { label: "Provider", value: provider },
        { label: "Billing", value: billing },
        { label: "Status", value: String(account?.status || entry?.status || "Pending").replace(/_/g, " ") },
        { label: "Usage", value: "Usage feed pending provider integration" },
        { label: "Last activity", value: dateText(account?.last_activity_at || latestPayment?.created_at) },
      ]
    : item.key === "internet_service"
    ? [
        { label: "Internet ID", value: identifier },
        { label: "Provider", value: provider },
        { label: "Plan", value: account?.plan || entry?.plan || "Pending source" },
        { label: "Billing", value: billing },
        { label: "Status", value: String(account?.status || entry?.status || "Pending").replace(/_/g, " ") },
        { label: "Last activity", value: dateText(account?.last_activity_at || latestPayment?.created_at) },
      ]
    : item.key === "gas_service"
    ? [
        { label: "Gas ID", value: identifier },
        { label: "Provider", value: provider },
        { label: "Billing", value: billing },
        { label: "Status", value: String(account?.status || entry?.status || "Pending").replace(/_/g, " ") },
        { label: "Last activity", value: dateText(account?.last_activity_at || latestPayment?.created_at) },
        { label: "Notes", value: String(account?.metadata?.service_notes || "Awaiting provider-linked ordering.") },
      ]
    : [
        { label: "Provider", value: provider },
        { label: "Identifier", value: identifier },
        { label: "Billing", value: billing },
        { label: "Status", value: String(account?.status || entry?.status || "Pending").replace(/_/g, " ") },
        { label: "Notes", value: String(account?.metadata?.service_notes || "Operational continuity record is ready.") },
        { label: "Last activity", value: dateText(account?.last_activity_at || latestPayment?.created_at) },
      ];

  return (
    <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-white/[0.05] text-white/80">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-white">{item.title}</h2>
            <p className="mt-1 text-[12px] leading-5 text-white/48">{item.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${toneFor(readiness)}`}>{String(readiness).replace(/_/g, " ")}</span>
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${toneFor(health)}`}>{String(health).replace(/_/g, " ")}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {fields.map((field) => <Field key={field.label} label={field.label} value={field.value} />)}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] text-white/45">
          {linked ? "Provisioned by Facility and linked to this home." : "Awaiting facility provisioning."}
          {config?.suggested_amount ? ` Suggested amount ${toNaira(Number(config.suggested_amount))}.` : ""}
        </div>
        <button
          type="button"
          onClick={onAction}
          disabled={busy}
          className="rounded-full border border-white/10 bg-white px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
        >
          {busy ? "Recording..." : item.cta}
        </button>
      </div>

      {latestPayment ? (
        <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5 text-[12px] text-white/64">
          Latest activity: {latestPayment.service_title || item.title} · {toNaira(latestPayment.amount)} · {dateText(latestPayment.created_at)}
        </div>
      ) : null}
    </section>
  );
}

export default function ServicesPage() {
  const activeContext = useActiveContext();
  const { estate_id: estateId } = activeContext;
  const contextReady = activeContext.ready;
  const [registry, setRegistry] = useState<HomeServiceRegistry | null>(null);
  const [accounts, setAccounts] = useState<ServiceAccount[]>([]);
  const [history, setHistory] = useState<ServicePayment[]>([]);
  const [configs, setConfigs] = useState<Partial<Record<ServiceKey, ServiceConfig>>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<typeof FILTERS[number]>("All");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!contextReady || !estateId) return;
      const [registryResult, accountsResult, historyRows, configResult] = await Promise.all([
        servicesService.homeRegistry({ estate_id: estateId, home_id: activeContext.home_id || undefined }),
        servicesService.myAccounts({ estate_id: estateId, home_id: activeContext.home_id || undefined }),
        servicesService.history({ home_id: activeContext.home_id || undefined, limit: 40 }),
        servicesService.configs({ estate_id: estateId }),
      ]);
      if (cancelled) return;
      if (!registryResult?.error) setRegistry(registryResult as HomeServiceRegistry);
      if (!accountsResult?.error) setAccounts(accountsResult.accounts || []);
      setHistory(Array.isArray(historyRows) ? historyRows : []);
      const nextConfigs = Object.fromEntries((configResult.configs || []).map((config: ServiceConfig) => [config.service_key, config])) as Partial<Record<ServiceKey, ServiceConfig>>;
      setConfigs(nextConfigs);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [contextReady, estateId, activeContext.home_id, activeContext.contextKey]);

  useEffect(() => {
    if (!contextReady || !estateId || !activeContext.home_id) return;
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => {
      void servicesService.homeRegistry({ estate_id: estateId, home_id: activeContext.home_id || undefined }).then((result: any) => {
        if (!result?.error) setRegistry(result as HomeServiceRegistry);
      });
      void servicesService.myAccounts({ estate_id: estateId, home_id: activeContext.home_id || undefined }).then((result: any) => {
        if (!result?.error) setAccounts(result.accounts || []);
      });
      void servicesService.history({ home_id: activeContext.home_id || undefined, limit: 40 }).then((rows: any) => {
        if (Array.isArray(rows)) setHistory(rows);
      });
    };
    socket.emit("subscribe:estate", estateId);
    socket.emit("subscribe:home", activeContext.home_id);
    ["service.updated", "service.transaction.initiated", "service.transaction.failed", "service.issue.reported", "wallet.service_payment.updated", "home.service_registry.updated"].forEach((event) => socket.on(event, refresh));
    return () => ["service.updated", "service.transaction.initiated", "service.transaction.failed", "service.issue.reported", "wallet.service_payment.updated", "home.service_registry.updated"].forEach((event) => socket.off(event, refresh));
  }, [contextReady, estateId, activeContext.home_id, activeContext.contextKey]);

  const accountMap = useMemo(() => accountMapFor(accounts), [accounts]);
  const visibleCards = useMemo(
    () => CARD_ORDER.filter((item) => activeFilter === "All" || item.filter === activeFilter),
    [activeFilter],
  );
  const latestByKey = useMemo(() => {
    const map = new Map<ServiceKey, ServicePayment>();
    for (const row of history) {
      if (!map.has(row.service_key)) map.set(row.service_key, row);
    }
    return map;
  }, [history]);

  const strip = [
    { label: "Services", value: accounts.length || CARD_ORDER.length },
    { label: "Ready", value: accounts.filter((item) => item.vending_readiness === "ready").length },
    { label: "Pending", value: accounts.filter((item) => /pending|manual_review|unsupported/.test(String(item.last_transaction_status || item.vending_readiness || ""))).length },
    { label: "Wallet", value: registry?.wallet?.balance != null ? toNaira(Number(registry.wallet.balance || 0)) : "Pending" },
  ];

  async function handleCardAction(item: (typeof CARD_ORDER)[number]) {
    setBusyKey(item.key);
    setMessage(null);
    setError(null);
    try {
      const account = accountMap.get(item.key);
      const result: any = await servicesService.initiateTransaction({
        service_key: item.key,
        account_ref: account?.identifier || undefined,
        transaction_type: item.transactionType,
        amount: Number(configs[item.key]?.suggested_amount || 0),
        estate_id: estateId || undefined,
        home_id: activeContext.home_id || undefined,
      });
      if (result?.error) {
        setError(String(result.error));
      } else {
        setMessage(result?.message || `${item.title} request recorded.`);
        if (result?.transaction) {
          const next = result.transaction;
          setAccounts((prev) => prev.map((row) => row.service_key === item.key ? { ...row, last_activity_at: next.created_at || new Date().toISOString(), last_transaction_status: next.status, last_transaction_type: next.transaction_type } : row));
        }
      }
    } catch (err: any) {
      setError(err?.message || "Unable to record service action");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <ConsumerShell
      title="Infrastructure Services"
      subtitle="Resident-bound electricity, water, internet, gas, and continuity services."
      strip={strip}
    >
      <div className="space-y-4 pb-8">
        {error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
        {message ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div> : null}

        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`rounded-full border px-3 py-2 text-xs transition ${activeFilter === filter ? "border-sky-300/24 bg-sky-400/12 text-sky-100" : "border-white/[0.08] bg-white/[0.03] text-white/60"}`}
            >
              {filter}
            </button>
          ))}
        </div>

        <section className="space-y-3">
          {visibleCards.map((item) => (
            <ServiceCard
              key={item.key}
              item={item}
              account={accountMap.get(item.key) || null}
              registry={registry}
              config={configs[item.key] || null}
              latestPayment={latestByKey.get(item.key) || null}
              busy={busyKey === item.key}
              onAction={() => void handleCardAction(item)}
            />
          ))}
        </section>

        <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/36">Recent service activity</div>
          <div className="mt-3 space-y-2">
            {history.slice(0, 8).map((payment) => (
              <div key={payment.id} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5">
                <div className="text-[13px] text-white/86">{payment.service_title || payment.service_key.replace(/_/g, " ")}</div>
                <div className="mt-1 text-[12px] text-white/48">{payment.reference} · {toNaira(payment.amount)} · {dateText(payment.created_at)}</div>
              </div>
            ))}
            {!history.length ? <div className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-sm text-white/45">No service activity has been recorded for this home yet.</div> : null}
          </div>
        </section>
      </div>
    </ConsumerShell>
  );
}
