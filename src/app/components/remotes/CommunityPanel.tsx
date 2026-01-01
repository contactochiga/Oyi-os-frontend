"use client";

import RemotePanel from "./RemotePanel";

type CommunityItem = {
  id: string;
  type: "announcement" | "poll" | "event";
  title: string;
  body: string;
  time: string;
};

export default function CommunityPanel({
  lastUpdated,
  onInteraction,
}: {
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const items: CommunityItem[] = [
    {
      id: "c1",
      type: "announcement",
      title: "Power Maintenance",
      body: "Power will be unavailable tomorrow from 10am – 2pm.",
      time: "Today",
    },
    {
      id: "c2",
      type: "poll",
      title: "Water Schedule",
      body: "Preferred water supply time?",
      time: "Yesterday",
    },
    {
      id: "c3",
      type: "event",
      title: "Estate Clean-Up",
      body: "Saturday by 7am at the central park.",
      time: "2 days ago",
    },
  ];

  function touch() {
    onInteraction?.();
  }

  return (
    <RemotePanel title="Community" lastUpdated={lastUpdated}>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-gray-800 bg-gray-800 p-4"
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  item.type === "announcement"
                    ? "bg-red-600/20 text-red-400"
                    : item.type === "poll"
                    ? "bg-blue-600/20 text-blue-400"
                    : "bg-green-600/20 text-green-400"
                }`}
              >
                {item.type.toUpperCase()}
              </span>

              <span className="text-xs text-gray-400">{item.time}</span>
            </div>

            <div className="text-sm text-white font-medium mb-1">
              {item.title}
            </div>

            <div className="text-sm text-gray-300">{item.body}</div>

            {item.type === "poll" && (
              <button
                onClick={touch}
                className="mt-3 w-full py-2 rounded-lg bg-gray-700 text-sm text-white"
              >
                View Poll
              </button>
            )}
          </div>
        ))}
      </div>
    </RemotePanel>
  );
}
