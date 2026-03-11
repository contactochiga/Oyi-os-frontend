"use client";

import { useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import { walletService } from "@/services/walletService";
import { FiZap, FiWifi, FiGlobe, FiHome, FiRefreshCcw } from "react-icons/fi";

type ServiceItem = {
  key: string;
  title: string;
  subtitle: string;
  reason: string;
  suggested: number;
  icon: any;
};

const SERVICE_ITEMS: ServiceItem[] = [
  {
    key: "utility_token",
    title: "Buy Utility Token",
    subtitle: "Power token, prepaid utility top-up",
    reason: "utility_token_purchase",
    suggested: 5000,
    icon: FiZap,
  },
  {
    key: "internet_service",
    title: "Internet Service",
    subtitle: "Data bundle and monthly internet plans",
    reason: "internet_service_payment",
    suggested: 10000,
    icon: FiWifi,
  },
  {
    key: "fiber_internet",
    title: "Fiber Internet",
    subtitle: "Fiber broadband service payments",
    reason: "fiber_internet_payment",
    suggested: 15000,
    icon: FiGlobe,
  },
  {
    key: "service_charge",
    title: "Pay Service Charge",
    subtitle: "Estate monthly/periodic service charge",
    reason: "estate_service_charge",
    suggested: 25000,
    icon: FiHome,
  },
  {
    key: "facility_fee",
    title: "Other Facility Fees",
    subtitle: "Estate operational and facility dues",
    reason: "facility_fee_payment",
    suggested: 12000,
    icon: FiHome,
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
      setMsg(`${item.title} paid from wallet successfully.`);
    } catch (e: any) {
      setErr(e?.message || "Payment failed");
    } finally {
      setWalletBusy((prev) => ({ ...prev, [item.key]: false }));
    }
  }

  return (
    <ConsumerShell title="Services" subtitle="Utilities • internet • service charge">
      <div className="mb-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-100">
        Wallet-only payments: fund your in-app wallet, then pay for services directly here.
      </div>

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

      <div className="space-y-3">
        {SERVICE_ITEMS.map((item) => {
          const Icon = item.icon;
          const isWalletBusy = !!walletBusy[item.key];

          return (
            <div key={item.key} className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <Icon className="h-4 w-4 text-cyan-300" />
                    <span>{item.title}</span>
                  </div>
                  <div className="text-xs text-white/45 mt-1">{item.subtitle}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setAmount(item.key, String(item.suggested))}
                  className="shrink-0 rounded-xl px-2.5 py-2 text-xs text-white/70 bg-white/10 hover:bg-white/15 border border-white/10 inline-flex items-center gap-1.5"
                >
                  <FiRefreshCcw className="h-3 w-3" />
                  Reset
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
                <div className="text-xs text-white/45">NGN</div>
                <input
                  inputMode="numeric"
                  value={amounts[item.key] || ""}
                  onChange={(e) => setAmount(item.key, e.target.value)}
                  placeholder={String(item.suggested)}
                  className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/30"
                />
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => payFromWallet(item)}
                  disabled={isWalletBusy}
                  className="w-full rounded-2xl py-2.5 bg-white text-black text-sm font-semibold border border-white/20 disabled:opacity-50"
                >
                  {isWalletBusy ? "Processing…" : "Pay from wallet"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ConsumerShell>
  );
}
