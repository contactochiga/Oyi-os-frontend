"use client";

import RemotePanel from "./RemotePanel";

type TicketStatus = "open" | "in_progress" | "resolved";

type Ticket = {
  id: string;
  category: "electricity" | "water" | "security" | "device" | "general";
  title: string;
  status: TicketStatus;
  time: string;
};

export default function MaintenancePanel({
  lastUpdated,
  onInteraction,
}: {
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const tickets: Ticket[] = [
    {
      id: "m1",
      category: "electricity",
      title: "Power outage in living room",
      status: "in_progress",
      time: "Today",
    },
    {
      id: "m2",
      category: "water",
      title: "Low water pressure",
      status: "open",
      time: "Yesterday",
    },
  ];

  function touch() {
    onInteraction?.();
  }

  function statusColor(status: TicketStatus) {
    switch (status) {
      case "resolved":
        return "text-green-400";
      case "in_progress":
        return "text-yellow-400";
      default:
        return "text-red-400";
    }
  }

  function categoryBadge(cat: Ticket["category"]) {
    switch (cat) {
      case "electricity":
        return "bg-yellow-500/20 text-yellow-400";
      case "water":
        return "bg-blue-500/20 text-blue-400";
      case "security":
        return "bg-red-500/20 text-red-400";
      case "device":
        return "bg-purple-500/20 text-purple-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  }

  return (
    <RemotePanel title="Maintenance & Support" lastUpdated={lastUpdated}>
      <div className="space-y-3">

        {tickets.map((t) => (
          <div
            key={t.id}
            className="rounded-xl bg-gray-800 border border-gray-700 p-4"
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${categoryBadge(
                  t.category
                )}`}
              >
                {t.category.toUpperCase()}
              </span>

              <span className="text-xs text-gray-400">{t.time}</span>
            </div>

            <div className="text-sm text-white font-medium">
              {t.title}
            </div>

            <div className={`text-xs mt-1 ${statusColor(t.status)}`}>
              Status: {t.status.replace("_", " ")}
            </div>
          </div>
        ))}

        {/* ACTIONS */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => {
              console.log("Create maintenance request");
              touch();
            }}
            className="flex-1 py-3 rounded-xl bg-[#E11D2E] text-white text-sm font-medium active:scale-95 transition"
          >
            Report an Issue
          </button>

          <button
            onClick={() => {
              console.log("Contact support");
              touch();
            }}
            className="flex-1 py-3 rounded-xl bg-gray-700 text-white text-sm font-medium active:scale-95 transition"
          >
            Contact Support
          </button>
        </div>
      </div>
    </RemotePanel>
  );
}
