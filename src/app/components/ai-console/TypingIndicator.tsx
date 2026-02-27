"use client";

import { motion } from "framer-motion";

export default function TypingIndicator() {
  return (
    <div
      className="
        px-4 py-2 rounded-2xl
        border border-white/10
        bg-white/5
        backdrop-blur-xl
        w-fit
      "
    >
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2 h-2 bg-white/60 rounded-full"
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
    </div>
  );
}
