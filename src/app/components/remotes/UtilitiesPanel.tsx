"use client";

import RemotePanel from "./RemotePanel";

type Utility = {
  id: string;
  name: string;
  status: string;
  lastBill?: number;
};

export default function UtilitiesPanel({
  lastUpdated,
}: {
  lastUpdated?: number;
}) {
  const utilities: Utility[] = [
    { id: "u1", name: "Electricity", status: "Active", lastBill: 4500 },
    { id: "u2", name: "Water", status: "Active", lastBill: 1200 },
    { id: "u3", name: "Internet", status: "Active", lastBill: 8000 },
    { id: "u4", name: "Gas", status: "Normal" },
  ];

  return (
    <RemotePanel title="Utilities" lastUpdated={lastUpdated}>
      <div className="space-y-3">
        {utilities.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between rounded-xl bg-gray-800 border border-gray-700 p-4"
          >
            <div>
              <div className="text-sm text-white font-medium">{u.name}</div>
              <div className="text-xs text-gray-400">{u.status}</div>
            </div>

            {u.lastBill && (
              <div className="text-sm text-gray-300">
                ₦{u.lastBill.toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </RemotePanel>
  );
}
