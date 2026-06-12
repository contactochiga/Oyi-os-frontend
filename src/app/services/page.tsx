"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import ActivityMetricsRail from "@/app/components/ActivityMetricsRail";
import OyiContextRail from "@/app/components/OyiContextRail";
import { servicesService, type ServiceConfig, type ServiceKey, type ServicePayment } from "@/services/servicesService";
import useActiveContext from "@/hooks/useActiveContext";
import { FiChevronRight, FiClock, FiCreditCard, FiDroplet, FiFileText, FiHeadphones, FiHome, FiLayers, FiSliders, FiTool, FiWifi, FiZap } from "react-icons/fi";

type HomeContext = {
  id: string;
  name?: string | null;
  block?: string | null;
  unit?: string | null;
  electricity_meter?: string | null;
  internet_id?: string | null;
  water_meter?: string | null;
  gate_code?: string | null;
};

type ServiceItem = {
  key: ServiceKey;
  title: string;
  subtitle: string;
  icon: any;
};

type ServicePreset = {
  label: string;
  amount: number;
  meta?: Record<string, any>;
};

const SERVICE_ITEMS: ServiceItem[] = [
  { key: "utility_token", title: "Utility Token", subtitle: "Electricity token purchase", icon: FiZap },
  { key: "water_service", title: "Water Service", subtitle: "Water meter recharge and usage billing", icon: FiDroplet },
  { key: "internet_service", title: "Internet", subtitle: "Bundles and monthly fiber plans", icon: FiWifi },
  { key: "service_charge", title: "Estate Fees", subtitle: "Estate operational dues", icon: FiHome },
  { key: "other_facility_fees", title: "Facility Services", subtitle: "Partner and external estate services", icon: FiLayers },
];

const SERVICE_GROUPS: Array<{ title: string; keys: ServiceKey[] }> = [
  { title: "All", keys: ["utility_token", "water_service", "internet_service", "service_charge", "other_facility_fees"] },
  { title: "Utilities", keys: ["utility_token", "water_service"] },
  { title: "Connectivity", keys: ["internet_service", "fiber_internet"] as ServiceKey[] },
  { title: "Estate Fees", keys: ["service_charge"] },
  { title: "Facility Services", keys: ["other_facility_fees"] },
];

const SERVICE_PRESETS: Partial<Record<ServiceKey, ServicePreset[]>> = {
  water_service: [
    { label: "Starter Fill", amount: 5000, meta: { period_label: "Starter Water Fill" } },
    { label: "Standard Fill", amount: 12000, meta: { period_label: "Standard Water Fill" } },
    { label: "Bulk Fill", amount: 25000, meta: { period_label: "Bulk Water Fill" } },
  ],
  internet_service: [
    { label: "20 Mbps", amount: 11500, meta: { bundle_name: "20 Mbps Fiber" } },
    { label: "25 Mbps", amount: 18000, meta: { bundle_name: "25 Mbps Fiber" } },
    { label: "50 Mbps", amount: 32500, meta: { bundle_name: "50 Mbps Fiber" } },
  ],
  service_charge: [
    { label: "Monthly Flat Rate", amount: 500000, meta: { period_label: "Monthly Flat Rate" } },
  ],
};

function toNaira(amount: number) {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `NGN ${amount.toFixed(2)}`;
  }
}

function parseAmount(raw: string) {
  const n = Number(String(raw || "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function accountRefFor(serviceKey: ServiceKey, home: HomeContext | null) {
  if (!home) return "";
  if (serviceKey === "utility_token") return String(home.electricity_meter || "");
  if (serviceKey === "water_service") return String(home.water_meter || "");
  if (serviceKey === "internet_service" || serviceKey === "fiber_internet") return String(home.internet_id || "");
  if (serviceKey === "service_charge") return String(home.id || "");
  if (serviceKey === "other_facility_fees") return String(home.id || "");
  return "";
}

function mergedServiceItem(item: ServiceItem, configs: Partial<Record<ServiceKey, ServiceConfig>>) {
  const cfg = configs[item.key];
  return {
    ...item,
    title: cfg?.title || item.title,
    subtitle: cfg?.description || item.subtitle,
    active: cfg?.active ?? true,
    accountLabel: cfg?.account_label || "Account Reference",
    accountHint: cfg?.account_hint || "Linked to your assigned home",
    unitCost: cfg?.unit_cost ?? null,
    unitName: cfg?.unit_name || null,
  };
}

function serviceStatusFor(serviceKey: ServiceKey, linkedRef: string, active: boolean) {
  if (!active) return { label: "Unavailable", className: "border-white/8 bg-white/[0.04] text-white/40" };
  if (serviceKey === "utility_token") return { label: linkedRef ? "Available" : "Link Meter", className: linkedRef ? "border-emerald-300/12 bg-emerald-400/10 text-emerald-200" : "border-amber-300/14 bg-amber-400/10 text-amber-200" };
  if (serviceKey === "water_service") return { label: linkedRef ? "Connected" : "Setup Needed", className: linkedRef ? "border-sky-300/12 bg-sky-400/10 text-sky-200" : "border-amber-300/14 bg-amber-400/10 text-amber-200" };
  if (serviceKey === "internet_service" || serviceKey === "fiber_internet") return { label: linkedRef ? "Active" : "Setup Needed", className: linkedRef ? "border-emerald-300/12 bg-emerald-400/10 text-emerald-200" : "border-amber-300/14 bg-amber-400/10 text-amber-200" };
  if (serviceKey === "service_charge") return { label: "No Due", className: "border-emerald-300/12 bg-emerald-400/10 text-emerald-200" };
  return { label: "On Demand", className: "border-cyan-300/12 bg-cyan-400/10 text-cyan-200" };
}

function ServiceActionChip({ label, Icon, onClick }: { label: string; Icon: any; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3.5 text-xs font-medium text-white/74 shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-2xl transition hover:bg-white/[0.06] active:scale-[0.98]"
    >
      <Icon className="h-4 w-4 text-sky-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.48)]" />
      {label}
    </button>
  );
}

function AwarenessRail({ items }: { items: Array<{ icon: any; label: string; tone: string }> }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/42">Awareness</div>
      </div>
      <div className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex h-11 min-w-[150px] snap-start items-center gap-2 rounded-[18px] border border-white/[0.06] bg-[linear-gradient(145deg,rgba(255,255,255,0.044),rgba(255,255,255,0.012))] px-3 shadow-[0_10px_28px_rgba(0,0,0,0.24)] backdrop-blur-2xl"
            >
              <Icon className={`h-4 w-4 shrink-0 ${item.tone}`} />
              <span className="line-clamp-2 text-[12px] font-medium leading-4 text-white/72">{item.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ServiceCatalogCard({ item, configs, home, onOpen }: { item: ServiceItem; configs: Partial<Record<ServiceKey, ServiceConfig>>; home: HomeContext | null; onOpen: () => void }) {
  const merged = mergedServiceItem(item, configs);
  const linkedRef = accountRefFor(merged.key, home);
  const status = serviceStatusFor(merged.key, linkedRef, merged.active);
  const Icon = merged.icon;
  const iconTone = !merged.active
    ? "bg-white/5 text-white/25"
    : linkedRef
    ? "bg-cyan-400/12 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.18)]"
    : "bg-white/[0.065] text-white/55";

  return (
    <button
      type="button"
      onClick={() => merged.active && onOpen()}
      className={`flex w-full items-center gap-3 rounded-[22px] border px-3 py-3 text-left shadow-[0_14px_44px_rgba(0,0,0,0.26)] backdrop-blur-2xl transition active:scale-[0.992] ${merged.active ? "border-white/[0.075] bg-[linear-gradient(145deg,rgba(255,255,255,0.046),rgba(255,255,255,0.012))] hover:bg-white/[0.055]" : "border-white/5 bg-white/[0.025] opacity-60"}`}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] ${iconTone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold tracking-[-0.02em] text-white">{merged.title}</div>
        <div className="mt-0.5 truncate text-[12px] text-white/45">{merged.subtitle}</div>
      </div>
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-medium sm:px-2.5 sm:py-1 sm:text-[11px] ${status.className}`}>{status.label}</span>
      <FiChevronRight className="h-5 w-5 shrink-0 text-white/45" />
    </button>
  );
}

export default function ServicesPage() {
  const activeContext = useActiveContext();
  const { estate_id: estateId, home } = activeContext;
  const contextReady = activeContext.ready;
  const [walletBusy, setWalletBusy] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeServiceKey, setActiveServiceKey] = useState<ServiceKey | null>(null);
  const [history, setHistory] = useState<ServicePayment[]>([]);
  const [configs, setConfigs] = useState<Partial<Record<ServiceKey, ServiceConfig>>>({});
  const [configsFallback, setConfigsFallback] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<ServicePayment | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");

  const activeService = useMemo(() => SERVICE_ITEMS.find((s) => s.key === activeServiceKey) || null, [activeServiceKey]);
  const activeAccountRef = useMemo(() => (activeService ? accountRefFor(activeService.key, home) : ""), [activeService, home]);
  const activeServiceView = useMemo(() => (activeService ? mergedServiceItem(activeService, configs) : null), [activeService, configs]);
  const activePresets = useMemo(() => (activeServiceKey ? SERVICE_PRESETS[activeServiceKey] || [] : []), [activeServiceKey]);
  const activeHistory = useMemo(() => {
    if (!activeServiceKey) return [];
    return history.filter((h) => h.service_key === activeServiceKey).slice(0, 8);
  }, [activeServiceKey, history]);
  const serviceChargePaid = useMemo(() => history.filter((item) => item.service_key === "service_charge").reduce((sum, item) => sum + Number(item.amount || 0), 0), [history]);
  const selectedGroup = useMemo(() => SERVICE_GROUPS.find((group) => group.title === activeCategory) || SERVICE_GROUPS[0], [activeCategory]);
  const visibleServiceItems = useMemo(() => SERVICE_ITEMS.filter((item) => selectedGroup.keys.includes(item.key)), [selectedGroup]);
  const linkedUtilityAccounts = useMemo(() => {
    return [home?.electricity_meter, home?.water_meter, home?.internet_id].filter(Boolean).length;
  }, [home]);
  const activeServices = useMemo(() => SERVICE_ITEMS.filter((item) => (configs[item.key]?.active ?? true)).length, [configs]);
  const awarenessItems = useMemo(() => {
    const electricityLinked = Boolean(home?.electricity_meter);
    const waterLinked = Boolean(home?.water_meter);
    const internetLinked = Boolean(home?.internet_id);
    return [
      {
        icon: FiZap,
        label: electricityLinked ? "Electricity meter ready" : "Meter not linked",
        tone: electricityLinked ? "text-emerald-300" : "text-amber-300",
      },
      {
        icon: FiDroplet,
        label: waterLinked ? "Water recharge ready" : "Water setup needed",
        tone: waterLinked ? "text-sky-300" : "text-amber-300",
      },
      {
        icon: FiWifi,
        label: internetLinked ? "Internet plan active" : "Internet plan not configured",
        tone: internetLinked ? "text-emerald-300" : "text-amber-300",
      },
      {
        icon: FiCreditCard,
        label: history.length ? "Payment history available" : "No payment history",
        tone: history.length ? "text-emerald-300" : "text-white/55",
      },
      {
        icon: FiHeadphones,
        label: "Support center available",
        tone: "text-violet-300",
      },
    ];
  }, [home, history.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const serviceId = String(new URLSearchParams(window.location.search).get("serviceId") || "").trim() as ServiceKey;
    if (!serviceId) return;
    if (SERVICE_ITEMS.some((item) => item.key === serviceId)) setActiveServiceKey(serviceId);
  }, [contextReady, activeContext.contextKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadConfigs() {
      if (!contextReady || !estateId) {
        setConfigs({});
        setConfigsFallback(false);
        return;
      }
      const cfgRes: any = await servicesService.configs({ estate_id: estateId });
      if (cancelled || cfgRes?.error) return;
      const mapped = Object.fromEntries((cfgRes.configs || []).map((cfg: ServiceConfig) => [cfg.service_key, cfg])) as Partial<Record<ServiceKey, ServiceConfig>>;
      setConfigs(mapped);
      setConfigsFallback(Boolean(cfgRes.using_fallback));
    }
    void loadConfigs();
    return () => {
      cancelled = true;
    };
  }, [contextReady, activeContext.contextKey, estateId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!contextReady) { setHistory([]); return; }
      const rows = await servicesService.history({ limit: 80 });
      if (!cancelled) setHistory(Array.isArray(rows) ? rows : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [contextReady, activeContext.contextKey]);

  function setAmount(key: string, value: string) {
    setAmounts((prev) => ({ ...prev, [key]: value }));
  }

  function closeSheet() {
    setActiveServiceKey(null);
  }

  async function payFromWallet(item: ServiceItem, meta?: Record<string, any>) {
    setErr(null);
    setMsg(null);
    const amount = parseAmount(amounts[item.key]);
    if (amount < 100) {
      setErr(`Enter at least ${toNaira(100)} for ${item.title}.`);
      return;
    }

    const accountRef = accountRefFor(item.key, home);
    if (!accountRef) {
      setErr(`${item.title} account is not linked to this home yet.`);
      return;
    }

    setWalletBusy((prev) => ({ ...prev, [item.key]: true }));
    try {
      const res: any = await servicesService.pay({
        service_key: item.key,
        amount,
        account_ref: accountRef,
        ...(meta || {}),
      });
      if (res?.error) {
        setErr(String(res.error));
        return;
      }
      const receipt = res?.receipt as ServicePayment | undefined;
      if (receipt?.id) {
        setHistory((prev) => [receipt, ...prev]);
        setLastReceipt(receipt);
      }
      setMsg(`${item.title} paid successfully from wallet.`);
    } catch (e: any) {
      setErr(e?.message || "Payment failed");
    } finally {
      setWalletBusy((prev) => ({ ...prev, [item.key]: false }));
    }
  }

  return (
    <ConsumerShell title="Services" subtitle="Managed living, utilities and home support.">
      <div className="oyi-living-page space-y-3 pb-8">
      {err ? <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div> : null}
      {msg ? <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{msg}</div> : null}
      {configsFallback ? (
        <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Estate service pricing is using fallback defaults until facility billing configuration is saved.
        </div>
      ) : null}

      <section className="flex items-center justify-end gap-2">
        <ServiceActionChip label="Request Service" Icon={FiTool} onClick={() => setActiveServiceKey("other_facility_fees")} />
        <ServiceActionChip label="Support Center" Icon={FiHeadphones} onClick={() => { if (typeof window !== "undefined") window.location.href = "/support"; }} />
      </section>

      <ActivityMetricsRail
        items={[
          { icon: FiLayers, label: "Active Services", value: activeServices, color: "text-sky-300" },
          { icon: FiHome, label: "Utility Accounts", value: linkedUtilityAccounts, color: "text-cyan-200" },
          { icon: FiWifi, label: "Internet Plans", value: home?.internet_id ? 1 : 0, color: "text-violet-200" },
          { icon: FiHeadphones, label: "Support Tickets", value: "Ready", color: "text-amber-200" },
          { icon: FiCreditCard, label: "Service Charge", value: serviceChargePaid ? toNaira(serviceChargePaid) : "Ready", color: "text-emerald-200" },
          { icon: FiFileText, label: "Receipts", value: history.length, color: "text-white/65" },
        ]}
      />

      <AwarenessRail items={awarenessItems} />

      <OyiContextRail
        items={[
          { label: "Pay Service Charge", value: "Open", icon: FiHome, onClick: () => setActiveServiceKey("service_charge") },
          { label: "Buy Electricity", value: "Token", icon: FiZap, onClick: () => setActiveServiceKey("utility_token") },
          { label: "Buy Water", value: "Recharge", icon: FiDroplet, onClick: () => setActiveServiceKey("water_service") },
          { label: "Support", value: "Center", icon: FiHeadphones, onClick: () => { if (typeof window !== "undefined") window.location.href = "/support"; } },
        ]}
      />

      <section className="space-y-2.5">
        <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/42">Service Catalog</div>
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SERVICE_GROUPS.map((group) => (
            <button
              key={group.title}
              type="button"
              onClick={() => setActiveCategory(group.title)}
              className={`h-10 shrink-0 snap-start rounded-full border px-4 text-xs font-medium transition active:scale-[0.98] ${activeCategory === group.title ? "border-sky-300/24 bg-sky-400/12 text-sky-100 shadow-[0_0_22px_rgba(14,165,233,0.18)]" : "border-white/[0.075] bg-white/[0.03] text-white/62 hover:bg-white/[0.055]"}`}
            >
              {group.title}
            </button>
          ))}
          <button type="button" aria-label="Service filters" className="flex h-10 w-10 shrink-0 snap-start items-center justify-center rounded-full border border-white/[0.075] bg-white/[0.03] text-white/62">
            <FiSliders className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          {visibleServiceItems.map((item) => (
            <ServiceCatalogCard key={item.key} item={item} configs={configs} home={home} onOpen={() => setActiveServiceKey(item.key)} />
          ))}
        </div>
      </section>

      {activeService ? (
        <div className="fixed inset-0 z-[120]">
          <button type="button" aria-label="Close payment panel" onClick={closeSheet} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="absolute inset-x-0 bottom-0 top-16 flex items-end justify-center p-2">
            <div className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-t-[32px] border border-white/10 bg-zinc-950 shadow-2xl">
              <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-white/15" />
              <div className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/95 px-4 pb-4 pt-3 backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Service Payment</div>
                    <div className="text-base font-semibold text-white">{activeServiceView?.title}</div>
                    <div className="mt-1 text-xs text-white/45">{activeServiceView?.subtitle}</div>
                  </div>
                  <button type="button" onClick={closeSheet} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                    Done
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto px-4 pb-6">
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">{activeServiceView?.accountLabel}</div>
                      <div className="mt-2 text-sm font-medium text-white">{activeAccountRef || "Not linked yet"}</div>
                    </div>
                    <div className="text-right text-[11px] text-white/45">{home?.name || [home?.block, home?.unit].filter(Boolean).join(" / ") || "Linked home"}</div>
                  </div>
                  <div className="mt-1 text-xs text-white/45">{activeServiceView?.accountHint}</div>
                </div>

                {activePresets.length ? (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Plan Options</div>
                    <div className="mt-3 grid gap-2">
                      {activePresets.map((preset) => (
                        <button
                          key={`${activeService.key}:${preset.label}`}
                          type="button"
                          onClick={() => setAmount(activeService.key, String(preset.amount))}
                          className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left hover:bg-white/10 transition"
                        >
                          <div>
                            <div className="text-sm text-white">{preset.label}</div>
                            <div className="text-[11px] text-white/45">Tap to load amount</div>
                          </div>
                          <div className="text-sm font-medium text-white">{toNaira(preset.amount)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 flex items-center gap-2">
                  <div className="text-xs text-white/45">NGN</div>
                  <input
                    inputMode="numeric"
                    value={amounts[activeService.key] || ""}
                    onChange={(e) => setAmount(activeService.key, e.target.value)}
                    placeholder="Enter amount"
                    className="flex-1 bg-transparent outline-none text-sm text-white"
                  />
                </div>

                {activeServiceView?.unitCost != null ? (
                  <div className="mt-2 text-[11px] text-white/45">
                    Unit cost: {toNaira(Number(activeServiceView.unitCost || 0))}
                    {activeServiceView.unitName ? ` / ${activeServiceView.unitName}` : ""}
                  </div>
                ) : null}

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      const selectedPreset = activePresets.find((preset) => String(preset.amount) === String(parseAmount(amounts[activeService.key] || ""))) || null;
                      void payFromWallet(activeService, selectedPreset?.meta);
                    }}
                    disabled={Boolean(walletBusy[activeService.key]) || !activeAccountRef || activeService.key === "other_facility_fees"}
                    className="rounded-2xl py-3 bg-white text-black text-sm font-semibold disabled:opacity-50"
                  >
                    {walletBusy[activeService.key] ? "Processing..." : activeService.key === "other_facility_fees" ? "Coming Soon" : "Pay from Wallet"}
                  </button>
                  <button type="button" onClick={closeSheet} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/65">
                    Back to services
                  </button>
                </div>

                <div className="mt-2 text-[11px] text-white/45">Payment receipt is stored in wallet history and notifications.</div>

                {lastReceipt?.service_key === activeService.key ? (
                  <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-200">Latest Receipt</div>
                    <div className="mt-2 text-sm font-medium text-white">{lastReceipt.service_title || activeServiceView?.title}</div>
                    <div className="mt-1 text-sm text-emerald-100">{toNaira(lastReceipt.amount)}</div>
                    <div className="mt-1 text-[11px] text-emerald-50/80">{lastReceipt.reference}</div>
                    {lastReceipt.token_code ? <div className="mt-2 rounded-xl border border-emerald-400/20 bg-black/20 px-3 py-3 text-sm font-semibold tracking-[0.2em] text-emerald-100">{lastReceipt.token_code}</div> : null}
                    {lastReceipt.bundle_name ? <div className="mt-2 text-[11px] text-emerald-50/80">{lastReceipt.bundle_name}</div> : null}
                    {lastReceipt.period_label ? <div className="mt-1 text-[11px] text-emerald-50/80">{lastReceipt.period_label}</div> : null}
                    {lastReceipt.computed_units != null && lastReceipt.unit_name ? (
                      <div className="mt-1 text-[11px] text-emerald-50/80">{lastReceipt.computed_units} {lastReceipt.unit_name} @ {toNaira(Number(lastReceipt.unit_cost || 0))}</div>
                    ) : null}
                  </div>
                ) : null}

                {activeHistory.length ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/35">
                      <FiClock className="h-3.5 w-3.5" />
                      Recent Receipts
                    </div>
                    <div className="mt-3 space-y-2">
                      {activeHistory.map((payment) => (
                        <div key={payment.id} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                          <div className="text-sm text-white">{payment.service_title || activeServiceView?.title}</div>
                          <div className="mt-1 text-sm text-cyan-100">{toNaira(payment.amount)}</div>
                          <div className="mt-1 text-[11px] text-white/45">{payment.reference}</div>
                          {payment.token_code ? <div className="mt-2 text-[11px] font-semibold tracking-[0.18em] text-emerald-200">{payment.token_code}</div> : null}
                          {payment.bundle_name ? <div className="mt-1 text-[11px] text-white/45">{payment.bundle_name}</div> : null}
                          {payment.period_label ? <div className="mt-1 text-[11px] text-white/45">{payment.period_label}</div> : null}
                          {payment.computed_units != null && payment.unit_name ? (
                            <div className="mt-1 text-[11px] text-white/45">{payment.computed_units} {payment.unit_name} @ {toNaira(Number(payment.unit_cost || 0))}</div>
                          ) : null}
                          <div className="mt-1 text-[11px] text-white/35">{payment.created_at ? new Date(payment.created_at).toLocaleString() : "—"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </ConsumerShell>
  );
}
