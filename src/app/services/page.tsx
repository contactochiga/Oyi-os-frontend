"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import { servicesService, type ServiceConfig, type ServiceKey, type ServicePayment } from "@/services/servicesService";
import useActiveContext from "@/hooks/useActiveContext";
import { FiClock, FiGlobe, FiHome, FiLayers, FiWifi, FiZap } from "react-icons/fi";

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
  suggested: number;
  icon: any;
};

const SERVICE_ITEMS: ServiceItem[] = [
  {
    key: "utility_token",
    title: "Utility Token",
    subtitle: "Electricity token purchase",
    suggested: 5000,
    icon: FiZap,
  },
  {
    key: "internet_service",
    title: "Internet Service",
    subtitle: "Data bundles and monthly plans",
    suggested: 10000,
    icon: FiWifi,
  },
  {
    key: "fiber_internet",
    title: "Fiber Internet",
    subtitle: "Fiber broadband subscriptions",
    suggested: 15000,
    icon: FiGlobe,
  },
  {
    key: "service_charge",
    title: "Service Charge",
    subtitle: "Estate operational dues",
    suggested: 25000,
    icon: FiHome,
  },
  {
    key: "other_facility_fees",
    title: "Other Facility Fees",
    subtitle: "Special estate fees and one-off charges",
    suggested: 5000,
    icon: FiLayers,
  },
];

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
  if (serviceKey === "internet_service" || serviceKey === "fiber_internet")
    return String(home.internet_id || "");
  if (serviceKey === "service_charge") return String(home.id || "");
  if (serviceKey === "other_facility_fees") return String(home.id || "");
  return "";
}

export default function ServicesPage() {
  const { estate_id: estateId, home } = useActiveContext();
  const [walletBusy, setWalletBusy] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(SERVICE_ITEMS.map((s) => [s.key, String(s.suggested)]))
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeServiceKey, setActiveServiceKey] = useState<ServiceKey | null>(null);
  const [history, setHistory] = useState<ServicePayment[]>([]);
  const [configs, setConfigs] = useState<Partial<Record<ServiceKey, ServiceConfig>>>({});
  const [configsFallback, setConfigsFallback] = useState(false);

  const activeService = useMemo(
    () => SERVICE_ITEMS.find((s) => s.key === activeServiceKey) || null,
    [activeServiceKey]
  );
  const activeAccountRef = useMemo(
    () => (activeService ? accountRefFor(activeService.key, home) : ""),
    [activeService, home]
  );
  const activeServiceView = useMemo(
    () => (activeService ? mergedServiceItem(activeService) : null),
    [activeService, configs]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadConfigs() {
      if (!estateId) {
        setConfigs({});
        setConfigsFallback(false);
        return;
      }

      const cfgRes: any = await servicesService.configs({ estate_id: estateId });
      if (cancelled || cfgRes?.error) return;

      const mapped = Object.fromEntries(
        (cfgRes.configs || []).map((cfg: ServiceConfig) => [cfg.service_key, cfg])
      ) as Partial<Record<ServiceKey, ServiceConfig>>;
      setConfigs(mapped);
      setConfigsFallback(Boolean(cfgRes.using_fallback));
    }

    void loadConfigs();
    return () => {
      cancelled = true;
    };
  }, [estateId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await servicesService.history({ limit: 80 });
      if (!cancelled) setHistory(Array.isArray(rows) ? rows : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [estateId, home?.id]);

  function setAmount(key: string, value: string) {
    setAmounts((prev) => ({ ...prev, [key]: value }));
  }

  async function payFromWallet(item: ServiceItem) {
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
      });
      if (res?.error) {
        setErr(String(res.error));
        return;
      }
      const receipt = res?.receipt as ServicePayment | undefined;
      if (receipt?.id) setHistory((prev) => [receipt, ...prev]);
      setMsg(`${item.title} paid successfully from wallet.`);
    } catch (e: any) {
      setErr(e?.message || "Payment failed");
    } finally {
      setWalletBusy((prev) => ({ ...prev, [item.key]: false }));
    }
  }

  const activeHistory = useMemo(() => {
    if (!activeServiceKey) return [];
    return history.filter((h) => h.service_key === activeServiceKey).slice(0, 8);
  }, [activeServiceKey, history]);

  function mergedServiceItem(item: ServiceItem) {
    const cfg = configs[item.key];
    return {
      ...item,
      title: cfg?.title || item.title,
      subtitle: cfg?.description || item.subtitle,
      suggested: Number(cfg?.suggested_amount ?? item.suggested),
      active: cfg?.active ?? true,
      accountLabel: cfg?.account_label || "Account Reference",
      accountHint: cfg?.account_hint || "Linked to your assigned home",
      currency: cfg?.currency || "NGN",
      unitCost: cfg?.unit_cost ?? null,
      unitName: cfg?.unit_name || null,
      billingMode: cfg?.billing_mode || "wallet_only",
    };
  }

  return (
    <ConsumerShell title="Services" subtitle="Utility • internet • fiber • service charge">
      {err ? (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {msg ? (
        <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {msg}
        </div>
      ) : null}

      {configsFallback ? (
        <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Estate service pricing is using fallback defaults until facility billing configuration is saved.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {SERVICE_ITEMS.map((item) => {
          const merged = mergedServiceItem(item);
          const Icon = merged.icon;
          const linkedRef = accountRefFor(merged.key, home);
          return (
            <button
              key={merged.key}
              type="button"
              onClick={() => merged.active && setActiveServiceKey(merged.key)}
              className={`text-left rounded-3xl border p-4 transition ${
                merged.active
                  ? "border-white/10 bg-white/5 hover:bg-white/10"
                  : "border-white/5 bg-white/[0.03] opacity-60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-200">
                  <Icon className="h-4 w-4" />
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] border ${
                    !merged.active
                      ? "border-zinc-500/35 bg-zinc-500/10 text-zinc-300"
                      : linkedRef
                      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                      : "border-amber-500/35 bg-amber-500/10 text-amber-200"
                  }`}
                >
                  {!merged.active ? "Disabled" : linkedRef ? "Linked" : "Unlinked"}
                </span>
              </div>
              <div className="mt-3 text-sm font-semibold text-white">{merged.title}</div>
              <div className="mt-1 text-xs text-white/50">{merged.subtitle}</div>
              <div className="mt-3 text-[11px] text-white/35">
                Default {toNaira(merged.suggested)}
              </div>
            </button>
          );
        })}
      </div>

      {!activeService ? (
        <div className="mt-4 rounded-3xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/60">
          Select a service card to open payment.
        </div>
      ) : null}

      {activeService ? (
        <div className="fixed inset-0 z-[120]">
          <button
            type="button"
            aria-label="Close payment panel"
            onClick={() => setActiveServiceKey(null)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto max-w-xl rounded-t-[32px] border border-white/10 bg-zinc-950 px-4 pb-6 pt-4 shadow-2xl">
              <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />

              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-white">{activeServiceView?.title}</div>
                  <div className="mt-1 text-xs text-white/45">{activeServiceView?.subtitle}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveServiceKey(null)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                  {activeServiceView?.accountLabel}
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {activeAccountRef || "Not linked yet"}
                </div>
                <div className="mt-1 text-xs text-white/45">{activeServiceView?.accountHint}</div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <div className="text-[11px] text-white/45">Home</div>
                <div className="mt-1 text-sm text-white">
                  {home?.name || [home?.block, home?.unit].filter(Boolean).join(" / ") || "Linked home"}
                </div>
                <div className="mt-3 text-[11px] text-white/45">Linked Account ID</div>
                <div className="mt-1 text-sm text-white">{activeAccountRef || "Not linked to this home yet"}</div>
                {activeServiceView?.unitCost != null ? (
                  <>
                    <div className="mt-3 text-[11px] text-white/45">Configured Unit Cost</div>
                    <div className="mt-1 text-sm text-white">
                      {toNaira(Number(activeServiceView.unitCost || 0))}
                      {activeServiceView.unitName ? ` / ${activeServiceView.unitName}` : ""}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 flex items-center gap-2">
                <div className="text-xs text-white/45">NGN</div>
                <input
                  inputMode="numeric"
                  value={amounts[activeService.key] || ""}
                  onChange={(e) => setAmount(activeService.key, e.target.value)}
                  placeholder={String(activeServiceView?.suggested || activeService.suggested)}
                  className="flex-1 bg-transparent outline-none text-sm text-white"
                />
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => payFromWallet(activeService)}
                  disabled={!!walletBusy[activeService.key] || !activeAccountRef}
                  className="rounded-2xl py-3 bg-white text-black text-sm font-semibold disabled:opacity-50"
                >
                  {walletBusy[activeService.key] ? "Processing..." : "Pay From Wallet"}
                </button>
                <button
                  type="button"
                  onClick={() => setAmount(activeService.key, String(activeServiceView?.suggested || activeService.suggested))}
                  className="rounded-2xl py-3 border border-white/10 bg-white/5 text-sm text-white/85 hover:bg-white/10"
                >
                  Reset Amount
                </button>
              </div>

              <div className="mt-4">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <FiClock className="h-3.5 w-3.5" />
                  Recent history
                </div>
                <div className="mt-2 space-y-2 max-h-52 overflow-auto pr-1">
                  {activeHistory.length === 0 ? (
                    <div className="text-xs text-white/45 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      No payment history yet for this service.
                    </div>
                  ) : (
                    activeHistory.map((h) => (
                      <div key={h.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                        <div className="text-xs text-white/90">{toNaira(h.amount)}</div>
                        <div className="text-[11px] text-white/50">Account: {h.account_ref || "—"}</div>
                        <div className="text-[11px] text-white/50">{h.reference || "—"}</div>
                        <div className="text-[11px] text-white/50">
                          {h.created_at ? new Date(h.created_at).toLocaleString() : "—"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </ConsumerShell>
  );
}
