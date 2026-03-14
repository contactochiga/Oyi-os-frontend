"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import { walletService } from "@/services/walletService";
import API from "@/services/api";
import { FiClock, FiGlobe, FiHome, FiLayers, FiWifi, FiZap } from "react-icons/fi";

type ServiceKey =
  | "utility_token"
  | "internet_service"
  | "fiber_internet"
  | "service_charge"
  | "other_facility_fees";

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
  reason: string;
  suggested: number;
  icon: any;
};

type LocalPayment = {
  id: string;
  serviceKey: ServiceKey;
  amount: number;
  accountRef: string;
  createdAt: string;
};

const SERVICE_ITEMS: ServiceItem[] = [
  {
    key: "utility_token",
    title: "Utility Token",
    subtitle: "Electricity token purchase",
    reason: "utility_token_purchase",
    suggested: 5000,
    icon: FiZap,
  },
  {
    key: "internet_service",
    title: "Internet Service",
    subtitle: "Data bundles and monthly plans",
    reason: "internet_service_payment",
    suggested: 10000,
    icon: FiWifi,
  },
  {
    key: "fiber_internet",
    title: "Fiber Internet",
    subtitle: "Fiber broadband subscriptions",
    reason: "fiber_internet_payment",
    suggested: 15000,
    icon: FiGlobe,
  },
  {
    key: "service_charge",
    title: "Service Charge",
    subtitle: "Estate operational dues",
    reason: "estate_service_charge",
    suggested: 25000,
    icon: FiHome,
  },
  {
    key: "other_facility_fees",
    title: "Other Facility Fees",
    subtitle: "Special estate fees and one-off charges",
    reason: "other_facility_fees",
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
  const [walletBusy, setWalletBusy] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(SERVICE_ITEMS.map((s) => [s.key, String(s.suggested)]))
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeServiceKey, setActiveServiceKey] = useState<ServiceKey | null>(null);
  const [history, setHistory] = useState<LocalPayment[]>([]);
  const [home, setHome] = useState<HomeContext | null>(null);

  const activeService = useMemo(
    () => SERVICE_ITEMS.find((s) => s.key === activeServiceKey) || null,
    [activeServiceKey]
  );
  const activeAccountRef = useMemo(
    () => (activeService ? accountRefFor(activeService.key, home) : ""),
    [activeService, home]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem("oyi_service_payments");
      const parsed = raw ? JSON.parse(raw) : [];
      setHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("oyi_service_payments", JSON.stringify(history));
    } catch {
      // ignore storage failure
    }
  }, [history]);

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get("/me/context");
        const payload = (res as any)?.data || {};
        setHome((payload?.home as HomeContext) || null);
      } catch {
        setHome(null);
      }
    })();
  }, []);

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
      const reason = `${item.reason}:${accountRef}`;
      const res: any = await walletService.debit({ amount, reason });
      if (res?.error) {
        setErr(String(res.error));
        return;
      }
      setHistory((prev) => [
        {
          id: `svc_${Date.now()}`,
          serviceKey: item.key,
          amount,
          accountRef,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setMsg(`${item.title} paid successfully from wallet.`);
    } catch (e: any) {
      setErr(e?.message || "Payment failed");
    } finally {
      setWalletBusy((prev) => ({ ...prev, [item.key]: false }));
    }
  }

  const activeHistory = useMemo(() => {
    if (!activeServiceKey) return [];
    return history.filter((h) => h.serviceKey === activeServiceKey).slice(0, 8);
  }, [activeServiceKey, history]);

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

      <div className="grid grid-cols-2 gap-3">
        {SERVICE_ITEMS.map((item) => {
          const Icon = item.icon;
          const linkedRef = accountRefFor(item.key, home);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveServiceKey(item.key)}
              className="text-left rounded-3xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-200">
                  <Icon className="h-4 w-4" />
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] border ${
                    linkedRef
                      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                      : "border-amber-500/35 bg-amber-500/10 text-amber-200"
                  }`}
                >
                  {linkedRef ? "Linked" : "Unlinked"}
                </span>
              </div>
              <div className="mt-3 text-sm font-semibold text-white">{item.title}</div>
              <div className="mt-1 text-xs text-white/50">{item.subtitle}</div>
            </button>
          );
        })}
      </div>

      {activeService ? (
        <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-white">{activeService.title}</div>
          <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <div className="text-[11px] text-white/50">Linked Account ID</div>
            <div className="text-sm text-white mt-0.5">{activeAccountRef || "Not linked to this home yet"}</div>
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 flex items-center gap-2">
            <div className="text-xs text-white/45">NGN</div>
            <input
              inputMode="numeric"
              value={amounts[activeService.key] || ""}
              onChange={(e) => setAmount(activeService.key, e.target.value)}
              placeholder={String(activeService.suggested)}
              className="flex-1 bg-transparent outline-none text-sm text-white"
            />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => payFromWallet(activeService)}
              disabled={!!walletBusy[activeService.key] || !activeAccountRef}
              className="rounded-2xl py-2.5 bg-white text-black text-sm font-semibold disabled:opacity-50"
            >
              {walletBusy[activeService.key] ? "Processing..." : "Pay From Wallet"}
            </button>
            <button
              type="button"
              onClick={() => setAmount(activeService.key, String(activeService.suggested))}
              className="rounded-2xl py-2.5 border border-white/10 bg-white/5 text-sm text-white/85 hover:bg-white/10"
            >
              Reset Amount
            </button>
          </div>

          <div className="mt-4">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <FiClock className="h-3.5 w-3.5" />
              Recent history
            </div>
            <div className="mt-2 space-y-2">
              {activeHistory.length === 0 ? (
                <div className="text-xs text-white/45 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  No payment history yet for this service.
                </div>
              ) : (
                activeHistory.map((h) => (
                  <div key={h.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-xs text-white/90">{toNaira(h.amount)}</div>
                    <div className="text-[11px] text-white/50">Account: {h.accountRef || "—"}</div>
                    <div className="text-[11px] text-white/50">{new Date(h.createdAt).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-3xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/60">
          Select a service card to open payment.
        </div>
      )}
    </ConsumerShell>
  );
}
