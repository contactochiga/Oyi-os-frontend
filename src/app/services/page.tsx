"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import { servicesService, type ServiceConfig, type ServiceKey, type ServicePayment } from "@/services/servicesService";
import useActiveContext from "@/hooks/useActiveContext";
import { FiClock, FiDroplet, FiHome, FiLayers, FiWifi, FiZap } from "react-icons/fi";

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
  { key: "internet_service", title: "Fiber Internet Service", subtitle: "Bundles and monthly fiber plans", icon: FiWifi },
  { key: "service_charge", title: "Service Charge", subtitle: "Estate operational dues", icon: FiHome },
  { key: "other_facility_fees", title: "Other Facility Fees", subtitle: "Partner and external estate services", icon: FiLayers },
];

const SERVICE_GROUPS: Array<{ title: string; keys: ServiceKey[] }> = [
  { title: "Utilities", keys: ["utility_token", "water_service"] },
  { title: "Connectivity", keys: ["internet_service", "fiber_internet"] as ServiceKey[] },
  { title: "Estate Fees", keys: ["service_charge"] },
  { title: "Facility Services", keys: ["other_facility_fees"] },
  { title: "Other Charges", keys: [] },
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

  const activeService = useMemo(() => SERVICE_ITEMS.find((s) => s.key === activeServiceKey) || null, [activeServiceKey]);
  const activeAccountRef = useMemo(() => (activeService ? accountRefFor(activeService.key, home) : ""), [activeService, home]);
  const activeServiceView = useMemo(() => (activeService ? mergedServiceItem(activeService, configs) : null), [activeService, configs]);
  const activePresets = useMemo(() => (activeServiceKey ? SERVICE_PRESETS[activeServiceKey] || [] : []), [activeServiceKey]);
  const activeHistory = useMemo(() => {
    if (!activeServiceKey) return [];
    return history.filter((h) => h.service_key === activeServiceKey).slice(0, 8);
  }, [activeServiceKey, history]);
  const totalPaid = useMemo(() => history.reduce((sum, item) => sum + Number(item.amount || 0), 0), [history]);
  const serviceChargePaid = useMemo(() => history.filter((item) => item.service_key === "service_charge").reduce((sum, item) => sum + Number(item.amount || 0), 0), [history]);
  const utilityPaid = useMemo(() => history.filter((item) => item.service_key === "utility_token" || item.service_key === "water_service").reduce((sum, item) => sum + Number(item.amount || 0), 0), [history]);
  const internetPaid = useMemo(() => history.filter((item) => item.service_key === "internet_service" || item.service_key === "fiber_internet").reduce((sum, item) => sum + Number(item.amount || 0), 0), [history]);

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
  }, [contextReady, activeContext.contextKey]);

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
    <ConsumerShell title="Services" subtitle="Managed living • utilities • home support">
      <div className="oyi-living-page space-y-3 pb-8">
      {err ? <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div> : null}
      {msg ? <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{msg}</div> : null}
      {configsFallback ? (
        <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Estate service pricing is using fallback defaults until facility billing configuration is saved.
        </div>
      ) : null}

      <section className="oyi-environment-hero rounded-[22px] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-sky-100/60">Concierge Services</div>
            <h1 className="mt-1.5 text-[17px] font-semibold text-white">Managed living, simplified.</h1>
            <p className="mt-1.5 text-xs leading-5 text-white/50">Utilities, internet, dues and facility services stay curated for this home.</p>
          </div>
          <div className="oyi-orb h-12 w-12 shrink-0" aria-hidden="true" />
        </div>
      </section>

      <section className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[
          ["Service Charge", serviceChargePaid ? toNaira(serviceChargePaid) : "Ready"],
          ["Utilities", utilityPaid ? toNaira(utilityPaid) : "Linked"],
          ["Internet", internetPaid ? toNaira(internetPaid) : "Available"],
          ["Outstanding", "No live balance"],
          ["Credits", totalPaid ? toNaira(totalPaid) : "No receipts"],
        ].map(([label, value]) => (
          <div key={label} className="min-w-[132px] rounded-[20px] border border-white/[0.07] bg-white/[0.035] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/36">{label}</div>
            <div className="mt-1.5 truncate text-sm font-semibold text-white">{value}</div>
          </div>
        ))}
      </section>

      <section className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[
          ["Pay Service Charge", "service_charge"],
          ["Buy Electricity", "utility_token"],
          ["Buy Water", "water_service"],
          ["Renew Internet", "internet_service"],
          ["View Statements", ""],
        ].map(([label, key]) => (
          <button key={label} type="button" onClick={() => key ? setActiveServiceKey(key as ServiceKey) : undefined} className="shrink-0 rounded-full border border-sky-300/14 bg-sky-400/10 px-3 py-2 text-xs font-medium text-sky-100 transition active:scale-[0.98]">
            {label}
          </button>
        ))}
      </section>

      <div className="space-y-4">
        {SERVICE_GROUPS.map((group) => {
          const items = SERVICE_ITEMS.filter((item) => group.keys.includes(item.key));
          if (!items.length && group.title !== "Other Charges") return null;
          return (
            <section key={group.title}>
              <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">{group.title}</div>
              {items.length ? <div className="grid grid-cols-2 gap-2.5">
                {items.map((item) => {
                  const merged = mergedServiceItem(item, configs);
                  const Icon = merged.icon;
                  const linkedRef = accountRefFor(merged.key, home);
                  const iconTone = !merged.active
                    ? "bg-white/5 text-white/25"
                    : linkedRef
                    ? "bg-cyan-400/20 text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.25)]"
                    : "bg-white/10 text-white/45";

                  return (
                    <button key={merged.key} type="button" onClick={() => merged.active && setActiveServiceKey(merged.key)} className={`text-left rounded-[22px] border p-3.5 transition ${merged.active ? "border-white/10 bg-white/[0.035] hover:bg-white/[0.065]" : "border-white/5 bg-white/[0.03] opacity-60"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className={`inline-flex h-9 w-9 items-center justify-center rounded-[16px] transition ${iconTone}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {!merged.active ? <span className="rounded-full border border-zinc-500/35 bg-zinc-500/10 px-2 py-0.5 text-[10px] text-zinc-300">Disabled</span> : null}
                      </div>
                      <div className="mt-3 text-sm font-semibold text-white">{merged.title}</div>
                      <div className="mt-1 text-[11px] leading-4 text-white/48">{merged.subtitle}</div>
                    </button>
                  );
                })}
              </div> : <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.025] p-4 text-xs text-white/42">Additional charges will appear when your estate publishes them.</div>}
            </section>
          );
        })}
      </div>

      {!activeService ? (
        <div className="rounded-[22px] border border-dashed border-white/15 bg-white/[0.035] p-4 text-sm text-white/52">Select a service card to open payment.</div>
      ) : null}

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
