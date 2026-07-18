"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import useActiveContext from "@/hooks/useActiveContext";
import { getSocket } from "@/services/socket";
import { servicesService, type HomeServiceRegistry, type ServiceAccount, type ServiceConfig, type ServiceKey, type ServicePayment } from "@/services/servicesService";
import { FiChevronDown, FiChevronUp, FiCreditCard, FiDroplet, FiTool, FiWifi, FiZap } from "react-icons/fi";

const SERVICE_CARDS: Array<{
  key: string;
  title: string;
  subtitle: string;
  icon: any;
  domain: "Power" | "Water" | "Internet" | "Gas" | "Estate Fees";
  cta: string;
  transactionType?: string;
  serviceKeys: ServiceKey[];
}> = [
  { key: "power", title: "Power", subtitle: "Electricity vending, backup continuity, and tariff readiness", icon: FiZap, domain: "Power", cta: "Buy Electricity", transactionType: "electricity_purchase", serviceKeys: ["utility_token", "generator_recovery", "solar_battery_service"] },
  { key: "water", title: "Water", subtitle: "Water billing and service continuity", icon: FiDroplet, domain: "Water", cta: "Report Issue", transactionType: "issue_report", serviceKeys: ["water_service"] },
  { key: "internet", title: "Internet", subtitle: "Connectivity, plans, and renewal posture", icon: FiWifi, domain: "Internet", cta: "Renew / Support", transactionType: "internet_renewal", serviceKeys: ["internet_service"] },
  { key: "gas", title: "Gas", subtitle: "Household gas continuity and refill readiness", icon: FiTool, domain: "Gas", cta: "Order Gas", transactionType: "gas_order", serviceKeys: ["gas_service"] },
  { key: "estate_fees", title: "Estate Fees", subtitle: "Resident charges, facility dues, and partner services", icon: FiCreditCard, domain: "Estate Fees", cta: "Review Fees", transactionType: "estate_fee", serviceKeys: ["service_charge", "other_facility_fees"] },
];

const DOMAIN_FILTERS = ["All", "Power", "Water", "Internet", "Gas", "Estate Fees"] as const;
const FILTER_LABELS: Record<(typeof DOMAIN_FILTERS)[number], string> = {
  All: "All",
  Power: "Power",
  Water: "Water",
  Internet: "Internet",
  Gas: "Gas",
  "Estate Fees": "Fees",
};

function toNaira(amount?: number | null) {
  if (amount == null || !Number.isFinite(Number(amount))) return "Awaiting source";
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
  if (/unsupported|offline|unavailable/.test(text)) return "text-rose-200 border-rose-300/20 bg-rose-400/10";
  return "text-white/78 border-white/10 bg-white/[0.06]";
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

function compositeRegistryEntry(serviceKeys: ServiceKey[], registry: HomeServiceRegistry | null) {
  return serviceKeys.map((key) => registryEntryFor(key, registry)).find(Boolean) || null;
}

function accountMapFor(accounts: ServiceAccount[]) {
  return new Map(accounts.map((account) => [account.service_key, account]));
}

function maskIdentifier(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return "Meter not linked yet";
  if (text.length <= 4) return text;
  return `••••${text.slice(-4)}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/36">{label}</div>
      <div className="mt-1 text-[13px] text-white/86">{value || "Awaiting setup"}</div>
    </div>
  );
}

function frontDetailsFor(item: (typeof SERVICE_CARDS)[number], account?: ServiceAccount | null, registry?: HomeServiceRegistry | null, latestPayment?: ServicePayment | null) {
  const entry = compositeRegistryEntry(item.serviceKeys, registry || null) as any;
  const identifier = account?.identifier || account?.meter_number || account?.account_number || entry?.meter_id || entry?.account_id || null;
  const provider = account?.provider || entry?.provider || null;
  const status = String(account?.status || entry?.status || account?.vending_readiness || entry?.vending_readiness || "Pending").replace(/_/g, " ");

  if (item.key === "power") {
    return {
      primary: identifier ? `Meter ending ${maskIdentifier(identifier)}` : "Meter not linked yet",
      secondary: "Awaiting facility provisioning",
      status,
      provider,
    };
  }

  if (item.key === "water") {
    return {
      primary: provider ? `Provider ${provider}` : "Provider pending",
      secondary: "Usage feed pending provider integration",
      status,
      provider,
    };
  }

  if (item.key === "internet") {
    return {
      primary: provider ? `${provider} service` : "Provider pending",
      secondary: account?.plan || entry?.plan || "Plan pending",
      status,
      provider,
    };
  }

  if (item.key === "gas") {
    return {
      primary: provider ? `Provider ${provider}` : "Provider pending",
      secondary: "Order flow routes through Facility provisioning",
      status,
      provider,
    };
  }

  return {
    primary: provider ? `Provider ${provider}` : "Provider pending",
    secondary: latestPayment ? `Last activity ${dateText(latestPayment.created_at)}` : "Operational continuity record ready",
    status,
    provider,
  };
}

function detailFieldsFor(item: (typeof SERVICE_CARDS)[number], account?: ServiceAccount | null, registry?: HomeServiceRegistry | null, latestPayment?: ServicePayment | null) {
  const entry = compositeRegistryEntry(item.serviceKeys, registry || null) as any;
  const identifier = account?.identifier || account?.meter_number || account?.account_number || entry?.meter_id || entry?.account_id || "Awaiting meter setup";
  const provider = account?.provider || entry?.provider || "Awaiting provider setup";
  const tariff = account?.tariff_profile || entry?.tariff_profile || "Awaiting tariff setup";
  const billing = account?.billing_profile || entry?.billing_profile || "Awaiting billing setup";
  const readiness = account?.vending_readiness || entry?.vending_readiness || account?.status || entry?.status || "Pending";

  if (item.key === "power") {
    return [
      { label: "Meter number", value: identifier },
      { label: "KCT / KCTN", value: [account?.kct || entry?.kct, account?.kctn || entry?.kctn].filter(Boolean).join(" / ") || "Awaiting meter setup" },
      { label: "Provider", value: provider },
      { label: "Tariff", value: tariff },
      { label: "Billing", value: billing },
      { label: "Readiness", value: String(readiness).replace(/_/g, " ") },
    ];
  }

  if (item.key === "water") {
    return [
      { label: "Meter ID", value: identifier },
      { label: "Provider", value: provider },
      { label: "Billing", value: billing },
      { label: "Status", value: String(account?.status || entry?.status || "Pending").replace(/_/g, " ") },
      { label: "Usage", value: "Usage feed pending provider integration" },
      { label: "Last activity", value: dateText(account?.last_activity_at || latestPayment?.created_at) },
    ];
  }

  if (item.key === "internet") {
    return [
      { label: "Internet ID", value: identifier },
      { label: "Provider", value: provider },
      { label: "Plan", value: account?.plan || entry?.plan || "Awaiting plan setup" },
      { label: "Billing", value: billing },
      { label: "Status", value: String(account?.status || entry?.status || "Pending").replace(/_/g, " ") },
      { label: "Last activity", value: dateText(account?.last_activity_at || latestPayment?.created_at) },
    ];
  }

  if (item.key === "gas") {
    return [
      { label: "Gas ID", value: identifier },
      { label: "Provider", value: provider },
      { label: "Billing", value: billing },
      { label: "Status", value: String(account?.status || entry?.status || "Pending").replace(/_/g, " ") },
      { label: "Last activity", value: dateText(account?.last_activity_at || latestPayment?.created_at) },
      { label: "Notes", value: String(account?.metadata?.service_notes || "Awaiting provider-linked ordering.") },
    ];
  }

  return [
    { label: "Provider", value: provider },
    { label: "Identifier", value: identifier },
    { label: "Billing", value: billing },
    { label: "Status", value: String(account?.status || entry?.status || "Pending").replace(/_/g, " ") },
    { label: "Tariff", value: tariff },
    { label: "Last activity", value: dateText(account?.last_activity_at || latestPayment?.created_at) },
  ];
}

function GroupedServiceCard({
  item,
  account,
  registry,
  config,
  latestPayment,
  busy,
  expanded,
  onToggle,
  onAction,
}: {
  item: (typeof SERVICE_CARDS)[number];
  account?: ServiceAccount | null;
  registry: HomeServiceRegistry | null;
  config?: ServiceConfig | null;
  latestPayment?: ServicePayment | null;
  busy?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onAction: () => void;
}) {
  const Icon = item.icon;
  const entry = compositeRegistryEntry(item.serviceKeys, registry) as any;
  const linked = Boolean(account?.linked ?? entry?.linked);
  const readiness = account?.vending_readiness || entry?.vending_readiness || account?.status || entry?.status || "Setup pending";
  const front = frontDetailsFor(item, account, registry, latestPayment);
  const details = detailFieldsFor(item, account, registry, latestPayment);

  return (
    <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] p-4 shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] border border-white/10 bg-white/[0.04] text-white/80">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-white">{item.title}</h2>
            <p className="mt-1 text-[12px] leading-5 text-white/48">{item.subtitle}</p>
          </div>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${toneFor(readiness)}`}>
          {String(readiness).replace(/_/g, " ")}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="text-[13px] font-medium text-white/88">{front.primary}</div>
        <div className="text-[12px] text-white/56">{front.secondary}</div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/44">
          <span>{linked ? "Provisioned by Facility" : "Awaiting facility provisioning"}</span>
          <span>•</span>
          <span>{dateText(account?.last_activity_at || latestPayment?.created_at)}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAction}
          disabled={busy}
          className="rounded-full border border-white/10 bg-white px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
        >
          {busy ? "Recording..." : item.cta}
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/72"
        >
          {expanded ? <FiChevronUp className="h-3.5 w-3.5" /> : <FiChevronDown className="h-3.5 w-3.5" />}
          More info
        </button>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-3 rounded-[20px] border border-white/8 bg-black/20 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {details.map((field) => <Field key={field.label} label={field.label} value={field.value} />)}
          </div>
          <div className="text-[11px] text-white/42">
            {config?.suggested_amount ? `Suggested amount ${toNaira(Number(config.suggested_amount))}. ` : ""}
            Account metadata stays available here without forcing technical identifiers into the first service view.
          </div>
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
  const [activeFilter, setActiveFilter] = useState<(typeof DOMAIN_FILTERS)[number]>("All");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRegistry(null);
    setAccounts([]);
    setHistory([]);
    setConfigs({});
    setMessage(null);
    setError(null);
  }, [activeContext.contextKey]);

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
      const errors = [
        (registryResult as any)?.error,
        (accountsResult as any)?.error,
        (historyRows as any)?.error,
        (configResult as any)?.error,
      ].filter(Boolean);
      if (!registryResult?.error) setRegistry(registryResult as HomeServiceRegistry);
      if (!accountsResult?.error) setAccounts(accountsResult.accounts || []);
      setHistory(Array.isArray(historyRows) ? historyRows : []);
      if (!(configResult as any)?.error) {
        const nextConfigs = Object.fromEntries((configResult.configs || []).map((config: ServiceConfig) => [config.service_key, config])) as Partial<Record<ServiceKey, ServiceConfig>>;
        setConfigs(nextConfigs);
      }
      setError(errors.length ? String(errors[0]) : null);
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
        else setError(String(result.error));
      });
      void servicesService.myAccounts({ estate_id: estateId, home_id: activeContext.home_id || undefined }).then((result: any) => {
        if (!result?.error) setAccounts(result.accounts || []);
        else setError(String(result.error));
      });
      void servicesService.history({ home_id: activeContext.home_id || undefined, limit: 40 }).then((rows: any) => {
        if (Array.isArray(rows)) setHistory(rows);
        else if (rows?.error) setError(String(rows.error));
      });
    };
    socket.emit("subscribe:estate", estateId);
    socket.emit("subscribe:home", activeContext.home_id);
    ["service.updated", "service.transaction.initiated", "service.transaction.failed", "service.issue.reported", "wallet.service_payment.updated", "home.service_registry.updated"].forEach((event) => socket.on(event, refresh));
    return () => ["service.updated", "service.transaction.initiated", "service.transaction.failed", "service.issue.reported", "wallet.service_payment.updated", "home.service_registry.updated"].forEach((event) => socket.off(event, refresh));
  }, [contextReady, estateId, activeContext.home_id, activeContext.contextKey]);

  const accountMap = useMemo(() => accountMapFor(accounts), [accounts]);
  const accountForCard = useCallback((item: (typeof SERVICE_CARDS)[number]) => {
    return item.serviceKeys.map((key) => accountMap.get(key) || null).find(Boolean) || null;
  }, [accountMap]);
  const latestByKey = useMemo(() => {
    const map = new Map<ServiceKey, ServicePayment>();
    for (const row of history) {
      if (!map.has(row.service_key)) map.set(row.service_key, row);
    }
    return map;
  }, [history]);
  const latestPaymentForCard = useCallback((item: (typeof SERVICE_CARDS)[number]) => {
    return item.serviceKeys.map((key) => latestByKey.get(key) || null).find(Boolean) || null;
  }, [latestByKey]);

  const strip = [
    { label: "Services", value: SERVICE_CARDS.length },
    { label: "Ready", value: accounts.filter((item) => item.vending_readiness === "ready").length },
    { label: "Pending", value: accounts.filter((item) => /pending|manual_review|unsupported/.test(String(item.last_transaction_status || item.vending_readiness || ""))).length },
    { label: "Wallet", value: registry?.wallet?.balance != null ? toNaira(Number(registry.wallet.balance || 0)) : "Pending" },
  ];

  const groupedSections = useMemo(() => {
    return DOMAIN_FILTERS.filter((item) => item !== "All")
      .filter((domain) => activeFilter === "All" || activeFilter === domain)
      .map((domain) => ({
        title: domain,
        cards: SERVICE_CARDS.filter((item) => item.domain === domain),
      }));
  }, [activeFilter]);

  async function handleCardAction(item: (typeof SERVICE_CARDS)[number]) {
    setBusyKey(item.key);
    setMessage(null);
    setError(null);
    try {
      const account = accountForCard(item);
      const result: any = await servicesService.initiateTransaction({
        service_key: item.serviceKeys[0],
        account_ref: account?.identifier || undefined,
        transaction_type: item.transactionType,
        amount: Number(configs[item.serviceKeys[0]]?.suggested_amount || 0),
        estate_id: estateId || undefined,
        home_id: activeContext.home_id || undefined,
      });
      if (result?.error) {
        setError(String(result.error));
      } else {
        setMessage(result?.message || `${item.title} request recorded.`);
        if (result?.transaction) {
          const next = result.transaction;
          setAccounts((prev) => prev.map((row) => item.serviceKeys.includes(row.service_key) ? { ...row, last_activity_at: next.created_at || new Date().toISOString(), last_transaction_status: next.status, last_transaction_type: next.transaction_type } : row));
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
      subtitle="Resident-ready electricity, water, connectivity, fees, and continuity services."
      strip={strip}
    >
      <div className="space-y-4 pb-8">
        {error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
        {message ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div> : null}

        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {DOMAIN_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${activeFilter === filter ? "border-white/18 bg-white/[0.09] text-white" : "border-white/[0.08] bg-white/[0.03] text-white/60"}`}
            >
              {FILTER_LABELS[filter]}
            </button>
          ))}
        </div>

        {groupedSections.map((section) => (
          <section key={section.title} className="space-y-3">
            <div className="space-y-3">
              {section.cards.map((item) => (
                <GroupedServiceCard
                  key={item.key}
                  item={item}
                  account={accountForCard(item)}
                  registry={registry}
                  config={configs[item.serviceKeys[0]] || null}
                  latestPayment={latestPaymentForCard(item)}
                  busy={busyKey === item.key}
                  expanded={expandedKey === item.key}
                  onToggle={() => setExpandedKey((current) => current === item.key ? null : item.key)}
                  onAction={() => void handleCardAction(item)}
                />
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/36">Recent service activity</div>
          <div className="mt-3 space-y-2">
            {history.slice(0, 8).map((payment) => (
              <div key={payment.id} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5">
                <div className="text-[13px] text-white/86">{payment.service_title || payment.service_key.replace(/_/g, " ")}</div>
                <div className="mt-1 text-[12px] text-white/48">{payment.reference} • {toNaira(payment.amount)} • {dateText(payment.created_at)}</div>
              </div>
            ))}
            {!history.length ? <div className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-sm text-white/45">No service activity has been recorded for this home yet.</div> : null}
          </div>
        </section>
      </div>
    </ConsumerShell>
  );
}
