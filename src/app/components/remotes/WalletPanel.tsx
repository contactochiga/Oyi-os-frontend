"use client";

import RemotePanel from "./RemotePanel";

type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: "credit" | "debit";
  time: string;
};

export default function WalletPanel({
  lastUpdated,
  onInteraction,
}: {
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const balance = 24500;

  const transactions: Transaction[] = [
    {
      id: "t1",
      title: "Electricity Bill",
      amount: 4500,
      type: "debit",
      time: "Today",
    },
    {
      id: "t2",
      title: "Wallet Funding",
      amount: 20000,
      type: "credit",
      time: "Yesterday",
    },
  ];

  const timeLabel =
    lastUpdated &&
    new Date(lastUpdated).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  function touch() {
    onInteraction?.();
  }

  function fundWallet() {
    console.log("Fund wallet");
    touch();
  }

  function payBills() {
    console.log("Pay pending bills");
    touch();
  }

  return (
    <RemotePanel title="Wallet" timestamp={timeLabel}>
      {/* BALANCE */}
      <div className="mb-4 rounded-xl bg-gray-800 border border-gray-700 p-4">
        <div className="text-xs text-gray-400 mb-1">Available Balance</div>
        <div className="text-2xl font-semibold text-white">
          ₦{balance.toLocaleString()}
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex gap-3 mb-5">
        <button
          onClick={fundWallet}
          className="flex-1 py-3 rounded-xl bg-[#E11D2E] text-white text-sm font-medium active:scale-95 transition"
        >
          Fund Wallet
        </button>

        <button
          onClick={payBills}
          className="flex-1 py-3 rounded-xl bg-gray-700 text-white text-sm font-medium active:scale-95 transition"
        >
          Pay Bills
        </button>
      </div>

      {/* TRANSACTIONS */}
      <div>
        <div className="text-xs text-gray-400 mb-2">
          Recent Transactions
        </div>

        <div className="space-y-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3 border border-gray-700"
            >
              <div>
                <div className="text-sm text-white">{tx.title}</div>
                <div className="text-xs text-gray-400">{tx.time}</div>
              </div>

              <div
                className={`text-sm font-medium ${
                  tx.type === "credit"
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {tx.type === "credit" ? "+" : "-"}₦
                {tx.amount.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </RemotePanel>
  );
}
