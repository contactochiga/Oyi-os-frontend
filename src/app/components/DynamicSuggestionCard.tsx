"use client";

import { motion, AnimatePresence } from "framer-motion";
import { DynamicItem } from "@/types/dynamic";

export default function DynamicSuggestionCard({
  items,
}: {
  items: DynamicItem[];
}) {
  const now = Date.now();

  // Filter expired items
  const visibleItems = items.filter(
    (i) => !i.expiresAt || i.expiresAt > now
  );

  if (visibleItems.length === 0) return null;

  return (
    <div className="pointer-events-none">
      <AnimatePresence>
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="pointer-events-auto flex gap-2 overflow-x-auto pb-2"
        >
          {visibleItems.map((item) => (
            <SuggestionItem key={item.id} item={item} />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function SuggestionItem({ item }: { item: DynamicItem }) {
  const base =
    "px-4 py-2 rounded-full text-sm whitespace-nowrap transition active:scale-95";

  const styleByType = {
    action: "bg-gray-800 hover:bg-gray-700",
    notification: "bg-gray-800/80",
    info: "bg-gray-700/70",
    alert: "bg-[#E11D2E]",
  }[item.type];

  const priorityRing =
    item.priority === "high"
      ? "ring-2 ring-[#E11D2E]/40"
      : "";

  return (
    <button
      onClick={item.onSelect}
      className={`${base} ${styleByType} ${priorityRing} text-white`}
    >
      <div className="flex flex-col text-left">
        <span className="font-medium">{item.title}</span>
        {item.subtitle && (
          <span className="text-xs text-white/60">
            {item.subtitle}
          </span>
        )}
      </div>
    </button>
  );
}
