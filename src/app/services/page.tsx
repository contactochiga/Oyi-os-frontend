"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import { walletService } from "@/services/walletService";
import { FiZap, FiWifi, FiGlobe, FiHome, FiPlusCircle, FiClock } from "react-icons/fi";

type ServiceKey = "utility_token" | "internet_service" | "fiber_internet" | "service_charge";

type ServiceItem = {
  key: ServiceKey;
  title: string;
  subtitle: string;
  reason: string;
  suggested: number;
  icon: any;
  info: string;
};

type LocalPayment = {
  id: string;
  serviceKey: ServiceKey;
  amount: number;
  createdAt: string;
};

const SERVICE_ITEMS: ServiceItem[] = [
  {
    key: "utility_token",
    title: "Utility",
    subtitle: "Electricity token purchase",
    reason: "utility_token_purchase",
    suggested: 5000,
    icon: FiZap,
    info: "Buy prepaid utility tokens linked to your home account.",
  },
  {
    key: "internet_service",
    title: "Internet",
    subtitle: "Data bundles and monthly plans",
    reason: "internet_service_payment",
    suggested: 10000,
    icon: FiWifi,
    info: "Pay internet bundles and renew home connectivity from wallet.",
  },
  {
    key: "fiber_internet",
    title: "Fiber",
    subtitle: "Fiber broadband payments",
    reason: "fiber_internet_payment",
    suggested: 15000,
    icon: FiGlobe,
    info: "Manage fiber subscription charges and new package renewals.",
  },
  {
    key: "service_charge",
    title: "Service Charge",
    subtitle: "Estate operational dues",
    reason: "estate_service_charge",
    suggested: 25000,
    icon: FiHome,
    info: "Pay estate service charges directly from wallet balance.",
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

export default function ServicesPage() {
  const [walletBusy, setWalletBusy] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(SERVICE_ITEMS.map((s) => [s.key, String(s.suggested)]))
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeServiceKey, setActiveServiceKey] = useState<ServiceKey | null>(null);
  const [history, setHistory] = useState<LocalPayment[]>([]);

  const activeService = useMemo(
    () => SERVICE_ITEMS.find((s) => s.key === activeServiceKey) || null,
    [activeServiceKey]
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

    setWalletBusy((prev) => ({ ...prev, [item.key]: true }));
    try {
      const res: any = await walletService.debit({ amount, reason: item.reason });
      if (res?.error) {
        setErr(String(res.error));
        return;
      }
      setHistory((prev) => [
        {
          id: `svc_${Date.now()}`,
          serviceKey: item.key,
          amount,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setMsg(`${item.title} paid from wallet successfully.`);
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

      <div className="grid gap-3 sm:grid-cols-2">
        {SERVICE_ITEMS.map((item) => {
          const Icon = item.icon;
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
                <div className="text-[11px] text-white/45">Open</div>
              </div>
              <div className="mt-3 text-sm font-semibold text-white">{item.title}</div>
              <div className="mt-1 text-xs text-white/50">{item.subtitle}</div>
            </button>
          );
        })}
      </div>

      {activeService ? (
        <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-white">{activeService.title}</div>
              <div className="mt-1 text-xs text-white/55">{activeService.info}</div>
            </div>
            <button
              type="button"
              onClick={() => setAmount(activeService.key, String(activeService.suggested))}
              className="rounded-xl border border-white/10 bg-white/10 px-2.5 py-2 text-xs text-white/75 hover:bg-white/15"
            >
              Reset
            </button>
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
              disabled={!!walletBusy[activeService.key]}
              className="rounded-2xl py-2.5 bg-white text-black text-sm font-semibold disabled:opacity-50"
            >
              {walletBusy[activeService.key] ? "Processing..." : "Pay Now"}
            </button>
            <button
              type="button"
              onClick={() => setAmount(activeService.key, String(activeService.suggested))}
              className="rounded-2xl py-2.5 border border-white/10 bg-white/5 text-sm text-white/85 hover:bg-white/10"
            >
              Buy New Bundle
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
                    <div className="text-[11px] text-white/50">{new Date(h.createdAt).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-3xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/60">
          Select a service card to view details, history, and payment actions.
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-100 inline-flex items-center gap-2">
        <FiPlusCircle className="h-4 w-4" />
        Wallet-only flow is active: top up wallet, then pay all services in-app.
      </div>
    </ConsumerShell>
  );
}

